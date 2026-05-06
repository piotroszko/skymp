/* eslint-disable @typescript-eslint/no-explicit-any */
import * as http from "http";
import { BlockList } from "net";

import { RconSettings } from "../../settings";
import { Content, Log, System, SystemContext } from "../system";
import { buildBlockList, ipAllowed, normalizeIp, verifyBearer, verifyTokenString } from "./RconAuth";
import { RconAudit } from "./RconAudit";
import { dispatch, RconRuntime } from "./RconCommands";
import { RconEventBus } from "./RconEventBus";
import {
  rconAuthFailuresCounter,
  rconClientsConnectedGauge,
  rconExecCounter,
  rconExecDurationHistogram,
  rconSocketDroppedCounter,
} from "./RconMetrics";
import {
  AuditEntry,
  PlayerConnectPayload,
  PlayerCustomPacketPayload,
  PlayerDisconnectPayload,
  RconError,
  RconExecRequest,
  RconExecResponse,
  TOPIC_AUDIT,
  TOPIC_PLAYER_CONNECT,
  TOPIC_PLAYER_CUSTOM_PACKET,
  TOPIC_PLAYER_DISCONNECT,
  KNOWN_TOPICS,
} from "./RconTypes";

const Koa = require("koa");
const Router = require("koa-router");
const koaBody = require("koa-body");

const DEFAULT_PORT = 7790;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_ALLOWLIST = ["127.0.0.1/32", "::1/128"];
const DEFAULT_MAX_BODY_BYTES = 65_536;
const DEFAULT_PING_INTERVAL_MS = 25_000;
const DEFAULT_PING_TIMEOUT_MS = 20_000;
const FLUSH_INTERVAL_MS = 10;

type SocketIoServer = any;

export class RconService implements System {
  systemName = "RconService";

  private settings: RconSettings | null = null;
  private blockList: BlockList | null = null;
  private httpServer: http.Server | null = null;
  private io: SocketIoServer | null = null;
  private namespace: any = null;
  private audit: RconAudit | null = null;
  private bus: RconEventBus | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly runtime: RconRuntime = {
    connectedUserIds: new Set<number>(),
  };
  private clientsConnected = 0;
  private signalsRegistered = false;

  constructor(
    private readonly log: Log,
    private readonly rconSettings: RconSettings | null,
    private readonly dataDir: string,
  ) {}

  async initAsync(ctx: SystemContext): Promise<void> {
    const rconSettings = this.rconSettings;
    if (!rconSettings || rconSettings.enabled !== true) {
      this.log("RconService disabled (rcon.enabled not true)");
      return;
    }
    if (typeof rconSettings.key !== "string" || rconSettings.key.length === 0) {
      throw new Error("RconService: rcon.key must be a non-empty string when rcon.enabled is true");
    }

    this.settings = rconSettings;

    const allowlist =
      Array.isArray(rconSettings.ipAllowlist) && rconSettings.ipAllowlist.length > 0
        ? rconSettings.ipAllowlist
        : DEFAULT_ALLOWLIST;
    this.blockList = buildBlockList(allowlist);
    this.bus = new RconEventBus();
    this.audit = new RconAudit(`${this.dataDir.replace(/\/+$/, "")}/rcon-audit`, 10_000, (msg) =>
      this.log(msg),
    );

    const { Server: SocketIoServerCtor } = require("socket.io") as {
      Server: new (server: http.Server, opts?: any) => SocketIoServer;
    };

    const app = this.buildKoaApp(ctx);
    this.httpServer = http.createServer(app.callback());
    this.io = new SocketIoServerCtor(this.httpServer, {
      pingInterval: rconSettings.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS,
      pingTimeout: rconSettings.pingTimeoutMs ?? DEFAULT_PING_TIMEOUT_MS,
      serveClient: false,
      maxHttpBufferSize: rconSettings.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
    });
    this.namespace = this.io.of("/rcon");
    this.attachSocketAuth();
    this.attachSocketHandlers();

    const port = rconSettings.port ?? DEFAULT_PORT;
    const host = rconSettings.listenHost ?? DEFAULT_HOST;

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        this.httpServer?.off("error", onError);
        reject(err);
      };
      this.httpServer!.once("error", onError);
      this.httpServer!.listen(port, host, () => {
        this.httpServer!.off("error", onError);
        this.log(`RconService listening on ${host}:${port}`);
        resolve();
      });
    });

    this.flushTimer = setInterval(() => {
      this.bus?.flush(this.namespace);
    }, FLUSH_INTERVAL_MS);
    if (typeof this.flushTimer.unref === "function") {
      this.flushTimer.unref();
    }

    this.registerShutdownHooks();
  }

  connect(userId: number, _ctx: SystemContext): void {
    if (!this.settings) {
      return;
    }
    this.runtime.connectedUserIds.add(userId);
    let ip = "";
    try {
      ip = (_ctx.svr as unknown as { getUserIp: (u: number) => string }).getUserIp(userId);
    } catch {
      ip = "";
    }
    const payload: PlayerConnectPayload = {
      userId,
      ip,
      ts: new Date().toISOString(),
    };
    this.bus?.push(TOPIC_PLAYER_CONNECT, payload);
  }

  disconnect(userId: number, _ctx: SystemContext): void {
    if (!this.settings) {
      return;
    }
    this.runtime.connectedUserIds.delete(userId);
    const payload: PlayerDisconnectPayload = {
      userId,
      ts: new Date().toISOString(),
    };
    this.bus?.push(TOPIC_PLAYER_DISCONNECT, payload);
  }

  customPacket(userId: number, type: string, content: Content, _ctx: SystemContext): void {
    if (!this.settings) {
      return;
    }
    if (this.settings.enableCustomPacketTopic !== true) {
      return;
    }
    const payload: PlayerCustomPacketPayload = {
      userId,
      type,
      content,
      ts: new Date().toISOString(),
    };
    this.bus?.push(TOPIC_PLAYER_CUSTOM_PACKET, payload);
  }

  async updateAsync(_ctx: SystemContext): Promise<void> {
    // Bus is also drained by flushTimer for liveness; this acts as a backup.
    this.bus?.flush(this.namespace);
  }

  private buildKoaApp(ctx: SystemContext): any {
    const app = new Koa();
    app.proxy = false;
    const router = new Router();

    app.use(async (kctx: any, next: () => Promise<void>) => {
      try {
        await next();
      } catch (err) {
        if (err instanceof RconError) {
          kctx.status = errorCodeToStatus(err.code);
          kctx.body = { ok: false, error: { code: err.code, message: err.message } };
          return;
        }
        this.log(
          `RconService unhandled error: ${(err as Error).message}\n${(err as Error).stack ?? ""}`,
        );
        kctx.status = 500;
        kctx.body = {
          ok: false,
          error: { code: "internal", message: "internal error" },
        };
      }
    });

    app.use(async (kctx: any, next: () => Promise<void>) => {
      const ip = normalizeIp(kctx.request.ip ?? "");
      if (!this.blockList || !ipAllowed(this.blockList, ip)) {
        rconAuthFailuresCounter.inc({ channel: "rest", reason: "bad_ip" });
        kctx.status = 403;
        kctx.body = { ok: false, error: { code: "bad_auth", message: "ip not allowed" } };
        return;
      }
      await next();
    });

    app.use(async (kctx: any, next: () => Promise<void>) => {
      const headerValue = kctx.request.get("authorization");
      const authorization = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      if (kctx.path === "/healthz") {
        await next();
        return;
      }
      if (!verifyBearer(authorization, this.settings?.key ?? "")) {
        rconAuthFailuresCounter.inc({ channel: "rest", reason: "bad_key" });
        kctx.status = 401;
        kctx.set("WWW-Authenticate", 'Rcon realm="rcon"');
        kctx.body = { ok: false, error: { code: "bad_auth", message: "invalid bearer" } };
        return;
      }
      await next();
    });

    app.use(
      koaBody.default
        ? koaBody.default({ jsonLimit: this.settings?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES })
        : koaBody({ jsonLimit: this.settings?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES }),
    );

    router.get("/healthz", (kctx: any) => {
      kctx.body = {
        ok: true,
        uptime: process.uptime(),
        clientsConnected: this.clientsConnected,
      };
    });

    router.post("/exec", async (kctx: any) => {
      const body = (kctx.request.body ?? {}) as Partial<RconExecRequest>;
      const verb = typeof body.verb === "string" ? body.verb : "";
      const args =
        body.args && typeof body.args === "object" && !Array.isArray(body.args)
          ? (body.args as Record<string, unknown>)
          : {};
      const requestId = typeof body.requestId === "string" ? body.requestId : undefined;
      const actor = normalizeIp(kctx.request.ip ?? "");

      if (!verb) {
        rconExecCounter.inc({ verb: "<missing>", result: "bad_request" });
        const response: RconExecResponse = {
          ok: false,
          requestId,
          error: { code: "bad_request", message: "verb is required" },
        };
        kctx.status = 400;
        kctx.body = response;
        this.recordAudit({
          ts: new Date().toISOString(),
          actor,
          verb,
          args,
          ok: false,
          durationMs: 0,
          requestId,
          error: response.error,
        });
        return;
      }

      const endTimer = rconExecDurationHistogram.startTimer({ verb });
      const startedAt = Date.now();
      try {
        const result = await dispatch(verb, args, ctx, this.runtime);
        endTimer();
        rconExecCounter.inc({ verb, result: "ok" });
        const response: RconExecResponse = { ok: true, requestId, result };
        kctx.body = response;
        this.recordAudit({
          ts: new Date().toISOString(),
          actor,
          verb,
          args,
          ok: true,
          durationMs: Date.now() - startedAt,
          requestId,
        });
      } catch (err) {
        endTimer();
        const rconErr =
          err instanceof RconError
            ? err
            : new RconError("internal", err instanceof Error ? err.message : String(err));
        rconExecCounter.inc({ verb, result: rconErr.code });
        kctx.status = errorCodeToStatus(rconErr.code);
        const response: RconExecResponse = {
          ok: false,
          requestId,
          error: { code: rconErr.code, message: rconErr.message },
        };
        kctx.body = response;
        this.recordAudit({
          ts: new Date().toISOString(),
          actor,
          verb,
          args,
          ok: false,
          durationMs: Date.now() - startedAt,
          requestId,
          error: response.error,
        });
      }
    });

    app.use(router.routes()).use(router.allowedMethods());
    return app;
  }

  private attachSocketAuth(): void {
    if (!this.namespace) {
      return;
    }
    this.namespace.use((socket: any, next: (err?: Error) => void) => {
      const handshake = socket.handshake ?? {};
      const ip = normalizeIp(handshake.address ?? "");
      if (!this.blockList || !ipAllowed(this.blockList, ip)) {
        rconAuthFailuresCounter.inc({ channel: "ws", reason: "bad_ip" });
        next(new Error("ip not allowed"));
        return;
      }
      const auth = handshake.auth ?? {};
      const token = auth.token;
      if (!verifyTokenString(token, this.settings?.key ?? "")) {
        rconAuthFailuresCounter.inc({ channel: "ws", reason: "bad_key" });
        next(new Error("invalid token"));
        return;
      }
      next();
    });
  }

  private attachSocketHandlers(): void {
    if (!this.namespace) {
      return;
    }
    this.namespace.on("connection", (socket: any) => {
      this.clientsConnected++;
      rconClientsConnectedGauge.set(this.clientsConnected);

      socket.on("subscribe", (topics: unknown) => {
        if (!Array.isArray(topics)) {
          return;
        }
        for (const topic of topics) {
          if (typeof topic !== "string") {
            continue;
          }
          if (!KNOWN_TOPICS.has(topic)) {
            continue;
          }
          socket.join(topic);
        }
      });

      socket.on("unsubscribe", (topics: unknown) => {
        if (!Array.isArray(topics)) {
          return;
        }
        for (const topic of topics) {
          if (typeof topic !== "string") {
            continue;
          }
          socket.leave(topic);
        }
      });

      socket.on("disconnect", () => {
        this.clientsConnected = Math.max(0, this.clientsConnected - 1);
        rconClientsConnectedGauge.set(this.clientsConnected);
      });

      socket.on("error", (err: Error) => {
        this.log(`Rcon socket error: ${err.message}`);
        rconSocketDroppedCounter.inc({ reason: "socket_error" });
      });
    });
  }

  private recordAudit(entry: AuditEntry): void {
    this.audit?.enqueue(entry);
    this.bus?.push(TOPIC_AUDIT, entry);
  }

  private registerShutdownHooks(): void {
    if (this.signalsRegistered) {
      return;
    }
    this.signalsRegistered = true;
    const shutdown = (signal: string) => {
      this.log(`RconService shutting down on ${signal}`);
      try {
        this.io?.close();
      } catch {
        // ignore
      }
      try {
        this.httpServer?.close();
      } catch {
        // ignore
      }
      void this.audit?.flush();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }
}

function errorCodeToStatus(code: string): number {
  switch (code) {
    case "bad_auth":
      return 401;
    case "bad_request":
      return 400;
    case "not_connected":
    case "not_found":
      return 404;
    default:
      return 500;
  }
}
