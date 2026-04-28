import * as crypto from "crypto";
import * as bcrypt from "bcrypt";
import { System, Log, Content, SystemContext } from "./system";
import { IUserStore, normalizeEmail } from "../auth/userStore/IUserStore";
import { loginsCounter, loginErrorsCounter } from "./metricsSystem";

const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SessionInfo {
  userId: number;
  ip: string;
  createdAt: number;
  lastSeen: number;
}

export interface AuthServiceOptions {
  passwordMinLength: number;
  sessionTtlMs: number;
  maxCharactersPerAccount: number;
}

export const defaultAuthOptions: AuthServiceOptions = {
  passwordMinLength: 8,
  sessionTtlMs: 24 * 60 * 60 * 1000,
  maxCharactersPerAccount: 5,
};

interface AuthErrorPacket {
  customPacketType: string;
  error: string;
}

export class AuthService implements System {
  systemName = "AuthService";

  private readonly sessions = new Map<string, SessionInfo>();

  constructor(
    private readonly log: Log,
    private readonly store: IUserStore,
    private readonly options: AuthServiceOptions = defaultAuthOptions,
  ) {}

  async initAsync(_ctx: SystemContext): Promise<void> {
    this.log("AuthService initialized");
  }

  disconnect(userId: number, _ctx: SystemContext): void {
    for (const [token, info] of this.sessions.entries()) {
      if (info.userId === userId) {
        this.sessions.delete(token);
      }
    }
  }

  customPacket(userId: number, type: string, content: Content, ctx: SystemContext): void {
    switch (type) {
      case "registerRequest":
        this.handleRegister(userId, content, ctx);
        return;
      case "loginRequest":
        this.handleLogin(userId, content, ctx);
        return;
      case "createCharacterRequest":
        this.handleCreateCharacter(userId, content, ctx);
        return;
      case "playRequest":
        this.handlePlay(userId, content, ctx);
        return;
      default:
        return;
    }
  }

  private send(ctx: SystemContext, userId: number, payload: object): void {
    ctx.svr.sendCustomPacket(userId, JSON.stringify(payload));
  }

  private sendError(ctx: SystemContext, userId: number, type: string, error: string): void {
    const packet: AuthErrorPacket = { customPacketType: type, error };
    this.send(ctx, userId, packet);
  }

  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  private getSession(token: string): SessionInfo | null {
    const info = this.sessions.get(token);
    if (!info) {
      return null;
    }
    if (Date.now() - info.lastSeen > this.options.sessionTtlMs) {
      this.sessions.delete(token);
      return null;
    }
    info.lastSeen = Date.now();
    return info;
  }

  private validateEmail(email: unknown): string | null {
    if (typeof email !== "string") {
      return "Email must be a string";
    }
    const trimmed = email.trim();
    if (trimmed.length === 0 || trimmed.length > 254) {
      return "Email length is invalid";
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      return "Email format is invalid";
    }
    return null;
  }

  private validatePassword(password: unknown): string | null {
    if (typeof password !== "string") {
      return "Password must be a string";
    }
    if (password.length < this.options.passwordMinLength) {
      return `Password must be at least ${this.options.passwordMinLength} characters`;
    }
    if (password.length > 1024) {
      return "Password is too long";
    }
    return null;
  }

  private handleRegister(userId: number, content: Content, ctx: SystemContext): void {
    const email = content["email"];
    const password = content["password"];

    const emailErr = this.validateEmail(email);
    if (emailErr) {
      this.sendError(ctx, userId, "registerResult", emailErr);
      return;
    }
    const passwordErr = this.validatePassword(password);
    if (passwordErr) {
      this.sendError(ctx, userId, "registerResult", passwordErr);
      return;
    }

    (async () => {
      try {
        const existing = await this.store.findByEmail(email as string);
        if (existing) {
          this.sendError(ctx, userId, "registerResult", "Email already registered");
          return;
        }

        const hash = await bcrypt.hash(password as string, BCRYPT_ROUNDS);
        await this.store.create(email as string, hash);

        this.send(ctx, userId, { customPacketType: "registerResult", ok: true });
        this.log(`Registered ${normalizeEmail(email as string)}`);
      } catch (e) {
        loginErrorsCounter.inc({ reason: "register-exception" });
        this.log(`registerRequest failed: ${(e as Error).message}`);
        this.sendError(ctx, userId, "registerResult", "Registration failed");
      }
    })();
  }

  private handleLogin(userId: number, content: Content, ctx: SystemContext): void {
    const email = content["email"];
    const password = content["password"];

    if (typeof email !== "string" || typeof password !== "string") {
      this.sendError(ctx, userId, "loginResult", "Email and password are required");
      return;
    }

    (async () => {
      try {
        const record = await this.store.findByEmail(email);
        const ok = record ? await bcrypt.compare(password, record.passwordHash) : false;

        if (!record || !ok) {
          loginErrorsCounter.inc({ reason: "bad-credentials" });
          this.sendError(ctx, userId, "loginResult", "Invalid email or password");
          return;
        }

        const token = this.generateSessionToken();
        this.sessions.set(token, {
          userId: record.userId,
          ip: ctx.svr.getUserIp(userId),
          createdAt: Date.now(),
          lastSeen: Date.now(),
        });

        this.send(ctx, userId, {
          customPacketType: "loginResult",
          ok: true,
          session: token,
          characters: record.characters.map((c) => ({ profileId: c.profileId, name: c.name })),
        });
        this.log(`Login session issued for ${record.email}`);
      } catch (e) {
        loginErrorsCounter.inc({ reason: "login-exception" });
        this.log(`loginRequest failed: ${(e as Error).message}`);
        this.sendError(ctx, userId, "loginResult", "Login failed");
      }
    })();
  }

  private handleCreateCharacter(userId: number, content: Content, ctx: SystemContext): void {
    const session = content["session"];
    const name = content["name"];

    if (typeof session !== "string") {
      this.sendError(ctx, userId, "createCharacterResult", "Session is required");
      return;
    }
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 64) {
      this.sendError(ctx, userId, "createCharacterResult", "Character name is invalid");
      return;
    }

    const info = this.getSession(session);
    if (!info) {
      this.sendError(ctx, userId, "createCharacterResult", "Session expired, please log in again");
      return;
    }

    (async () => {
      try {
        const record = await this.store.getById(info.userId);
        if (!record) {
          this.sendError(ctx, userId, "createCharacterResult", "Account not found");
          return;
        }
        if (record.characters.length >= this.options.maxCharactersPerAccount) {
          this.sendError(
            ctx,
            userId,
            "createCharacterResult",
            `Reached the maximum of ${this.options.maxCharactersPerAccount} characters`,
          );
          return;
        }

        const character = await this.store.addCharacter(info.userId, name.trim());
        this.send(ctx, userId, {
          customPacketType: "createCharacterResult",
          ok: true,
          profileId: character.profileId,
          name: character.name,
        });
        this.log(`Created character ${character.profileId} (${character.name}) for user ${info.userId}`);
      } catch (e) {
        this.log(`createCharacterRequest failed: ${(e as Error).message}`);
        this.sendError(ctx, userId, "createCharacterResult", "Failed to create character");
      }
    })();
  }

  private handlePlay(userId: number, content: Content, ctx: SystemContext): void {
    const session = content["session"];
    const profileId = content["profileId"];

    if (typeof session !== "string") {
      this.sendError(ctx, userId, "playResult", "Session is required");
      return;
    }
    if (typeof profileId !== "number" || !Number.isFinite(profileId)) {
      this.sendError(ctx, userId, "playResult", "profileId is required");
      return;
    }

    const info = this.getSession(session);
    if (!info) {
      this.sendError(ctx, userId, "playResult", "Session expired, please log in again");
      return;
    }

    (async () => {
      try {
        const record = await this.store.getById(info.userId);
        if (!record) {
          this.sendError(ctx, userId, "playResult", "Account not found");
          return;
        }

        const owned = record.characters.some((c) => c.profileId === profileId);
        if (!owned) {
          this.sendError(ctx, userId, "playResult", "Character does not belong to this account");
          return;
        }

        if ((ctx.svr as unknown as { onLoginAttempt?: (id: number) => boolean }).onLoginAttempt) {
          const cont = (ctx.svr as unknown as { onLoginAttempt: (id: number) => boolean }).onLoginAttempt(profileId);
          if (!cont) {
            this.sendError(ctx, userId, "playResult", "You are not allowed to play");
            return;
          }
        }

        loginsCounter.inc();
        this.log(`User slot ${userId} playing as profileId ${profileId}`);
        (ctx.gm as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit(
          "spawnAllowed",
          userId,
          profileId,
          [],
          undefined,
        );
      } catch (e) {
        this.log(`playRequest failed: ${(e as Error).message}`);
        this.sendError(ctx, userId, "playResult", "Failed to start play");
      }
    })();
  }
}
