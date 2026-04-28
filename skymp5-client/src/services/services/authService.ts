import { AccountCharacter, AuthGameData, RemoteAuthGameData, authGameDataStorageKey } from "../../features/authModel";
import { ClientListener, CombinedController, Sp } from "./clientListener";
import { BrowserMessageEvent } from "skyrimPlatform";
import { AuthNeededEvent } from "../events/authNeededEvent";
import { BrowserWindowLoadedEvent } from "../events/browserWindowLoadedEvent";
import { logTrace, logError } from "../../logging";
import { ConnectionMessage } from "../events/connectionMessage";
import { CreateActorMessage } from "../messages/createActorMessage";
import { CustomPacketMessage } from "../messages/customPacketMessage";
import { MsgType } from "../../messages";
import { ConnectionDenied } from "../events/connectionDenied";

const events = {
  registerAttempt: "authRegisterAttempt",
  loginAttempt: "authLoginAttempt",
  createCharacter: "authCreateCharacter",
  deleteCharacter: "authDeleteCharacter",
  renameCharacter: "authRenameCharacter",
  play: "authPlay",
  showAuthScreen: "authShowScreen",
  authResult: "authResult",
  ready: "authReady",
};

const SESSION_DETAIL_EVENT = "skymp:authResult";
const SHOW_SCREEN_EVENT = "skymp:authShowScreen";

export class AuthService extends ClientListener {
  private session: string | null = null;
  private email: string | null = null;
  private characters: AccountCharacter[] = [];
  private authDialogOpen = false;
  private playerEverSawActualGameplay = false;
  private playRequestInFlightProfileId: number | null = null;

  constructor(private sp: Sp, private controller: CombinedController) {
    super();

    this.controller.emitter.on("authNeeded", (e) => this.onAuthNeeded(e));
    this.controller.emitter.on("browserWindowLoaded", (e) => this.onBrowserWindowLoaded(e));
    this.controller.emitter.on("createActorMessage", (e) => this.onCreateActorMessage(e));
    this.controller.emitter.on("customPacketMessage", (e) => this.onCustomPacketMessage(e));
    this.controller.emitter.on("connectionDenied", (e) => this.onConnectionDenied(e));
    this.controller.on("browserMessage", (e) => this.onBrowserMessage(e));
    this.controller.on("update", () => this.onUpdate());
    this.controller.once("update", () => { this.playerEverSawActualGameplay = true; });
  }

  private onUpdate() {
    if (!this.session || this.selectedProfileId === null) {
      return;
    }
    let raceMenuOpen = false;
    try {
      raceMenuOpen = this.sp.Ui.isMenuOpen("RaceSex Menu");
    } catch {
      return;
    }
    if (raceMenuOpen === this.lastRaceMenuOpen) {
      return;
    }
    this.lastRaceMenuOpen = raceMenuOpen;
    if (raceMenuOpen) {
      return;
    }
    // Race menu just closed — sync the display name back to the auth side.
    let displayName = "";
    try {
      const player = this.sp.Game.getPlayer();
      if (player) {
        displayName = (player.getDisplayName() || "").trim();
      }
    } catch (e) {
      logError(this, "Failed to read player display name on race menu close", e);
      return;
    }
    if (!displayName) {
      return;
    }
    const profileId = this.selectedProfileId;
    const session = this.session;
    const matching = this.characters.find((c) => c.profileId === profileId);
    if (matching && matching.name === displayName) {
      return;
    }
    logTrace(this, "Syncing character name from race menu:", displayName);
    this.sendCustomPacket("renameCharacterRequest", { session, profileId, name: displayName });
  }

  private onAuthNeeded(_e: AuthNeededEvent) {
    this.showAuthScreen();
  }

  private onBrowserWindowLoaded(_e: BrowserWindowLoadedEvent) {
    if (this.shouldShowAuthOnLoad) {
      this.showAuthScreen();
    }
  }

  private showAuthScreen() {
    this.shouldShowAuthOnLoad = true;
    this.authDialogOpen = true;
    this.sp.browser.setVisible(true);
    this.sp.browser.setFocused(true);
    if (this.frontReady) {
      this.publishVisibility(true);
    }
  }

  private hideAuthScreen() {
    this.shouldShowAuthOnLoad = false;
    this.authDialogOpen = false;
    this.publishVisibility(false);
  }

  private publishVisibility(visible: boolean) {
    this.dispatchToBrowser(SHOW_SCREEN_EVENT, { visible });
  }

  private onCreateActorMessage(e: ConnectionMessage<CreateActorMessage>) {
    if (!e.message.isMe) return;
    if (this.authDialogOpen) {
      logTrace(this, "Player actor created, hiding auth UI");
      this.hideAuthScreen();
    }
  }

  private onConnectionDenied(_e: ConnectionDenied) {
    this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
      type: "connectionDenied",
      ok: false,
      error: _e.error || "Connection denied",
    });
  }

  private onBrowserMessage(e: BrowserMessageEvent) {
    const args = e.arguments;
    const type = args[0];
    switch (type) {
      case events.ready:
        this.frontReady = true;
        if (this.shouldShowAuthOnLoad) {
          this.publishVisibility(true);
        }
        return;
      case events.registerAttempt:
        this.handleRegisterAttempt(args[1] as string, args[2] as string);
        return;
      case events.loginAttempt:
        this.handleLoginAttempt(args[1] as string, args[2] as string);
        return;
      case events.createCharacter:
        this.handleCreateCharacter();
        return;
      case events.deleteCharacter:
        this.handleDeleteCharacter(args[1] as number);
        return;
      case events.renameCharacter:
        this.handleRenameCharacter(args[1] as number, args[2] as string);
        return;
      case events.play:
        this.handlePlay(args[1] as number);
        return;
      default:
        return;
    }
  }

  private handleRegisterAttempt(email: string, password: string) {
    if (typeof email !== "string" || typeof password !== "string") {
      this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
        type: "registerResult", ok: false, error: "Email and password are required",
      });
      return;
    }
    this.sendCustomPacket("registerRequest", { email, password });
  }

  private handleLoginAttempt(email: string, password: string) {
    if (typeof email !== "string" || typeof password !== "string") {
      this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
        type: "loginResult", ok: false, error: "Email and password are required",
      });
      return;
    }
    this.email = email;
    this.sendCustomPacket("loginRequest", { email, password });
  }

  private handleCreateCharacter() {
    if (!this.session) {
      this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
        type: "createCharacterResult", ok: false, error: "Not logged in",
      });
      return;
    }
    this.sendCustomPacket("createCharacterRequest", { session: this.session });
  }

  private handleDeleteCharacter(profileId: number) {
    if (!this.session) {
      this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
        type: "deleteCharacterResult", ok: false, error: "Not logged in",
      });
      return;
    }
    if (typeof profileId !== "number") {
      this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
        type: "deleteCharacterResult", ok: false, error: "profileId is required",
      });
      return;
    }
    this.sendCustomPacket("deleteCharacterRequest", { session: this.session, profileId });
  }

  private handleRenameCharacter(profileId: number, name: string) {
    if (!this.session) {
      this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
        type: "renameCharacterResult", ok: false, error: "Not logged in",
      });
      return;
    }
    if (typeof profileId !== "number") {
      this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
        type: "renameCharacterResult", ok: false, error: "profileId is required",
      });
      return;
    }
    if (typeof name !== "string" || name.trim().length === 0) {
      this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
        type: "renameCharacterResult", ok: false, error: "Character name is required",
      });
      return;
    }
    this.sendCustomPacket("renameCharacterRequest", { session: this.session, profileId, name });
  }

  private handlePlay(profileId: number) {
    if (!this.session) {
      this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
        type: "playResult", ok: false, error: "Not logged in",
      });
      return;
    }
    if (typeof profileId !== "number") {
      this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
        type: "playResult", ok: false, error: "profileId is required",
      });
      return;
    }
    this.playRequestInFlightProfileId = profileId;
    this.selectedProfileId = profileId;
    this.sendCustomPacket("playRequest", { session: this.session, profileId });

    if (this.email) {
      const remote: RemoteAuthGameData = {
        session: this.session,
        email: this.email,
        characters: this.characters,
        selectedProfileId: profileId,
      };
      const authGameData: AuthGameData = { remote };
      this.sp.storage[authGameDataStorageKey] = authGameData;
      this.controller.emitter.emit("authAttempt", { authGameData });
    }
  }

  private onCustomPacketMessage(event: ConnectionMessage<CustomPacketMessage>) {
    let content: Record<string, unknown> = {};
    try {
      content = JSON.parse(event.message.contentJsonDump);
    } catch (e) {
      if (e instanceof SyntaxError) {
        logError(this, "onCustomPacketMessage failed to parse JSON", e.message);
        return;
      }
      throw e;
    }
    const type = content["customPacketType"];
    if (typeof type !== "string") return;

    switch (type) {
      case "registerResult":
        this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
          type: "registerResult",
          ok: !!content.ok,
          error: typeof content.error === "string" ? content.error : undefined,
        });
        return;
      case "loginResult": {
        const ok = !!content.ok;
        if (ok) {
          this.session = typeof content.session === "string" ? content.session : null;
          const rawCharacters = Array.isArray(content.characters) ? content.characters : [];
          this.characters = rawCharacters
            .filter((c): c is AccountCharacter => !!c && typeof (c as AccountCharacter).profileId === "number")
            .map((c) => ({ profileId: (c as AccountCharacter).profileId, name: (c as AccountCharacter).name }));
        }
        this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
          type: "loginResult",
          ok,
          error: typeof content.error === "string" ? content.error : undefined,
          characters: ok ? this.characters : undefined,
        });
        return;
      }
      case "createCharacterResult": {
        const ok = !!content.ok;
        if (ok && typeof content.profileId === "number") {
          const character: AccountCharacter = {
            profileId: content.profileId,
            name: typeof content.name === "string" ? content.name : "",
          };
          this.characters = [...this.characters, character];
        }
        this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
          type: "createCharacterResult",
          ok,
          error: typeof content.error === "string" ? content.error : undefined,
          characters: this.characters,
        });
        return;
      }
      case "deleteCharacterResult":
      case "renameCharacterResult": {
        const ok = !!content.ok;
        if (ok && Array.isArray(content.characters)) {
          this.characters = (content.characters as AccountCharacter[])
            .filter((c) => !!c && typeof c.profileId === "number")
            .map((c) => ({ profileId: c.profileId, name: c.name }));
        }
        this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
          type,
          ok,
          error: typeof content.error === "string" ? content.error : undefined,
          characters: this.characters,
        });
        return;
      }
      case "playResult": {
        const ok = !!content.ok;
        if (!ok) {
          this.playRequestInFlightProfileId = null;
        }
        this.dispatchToBrowser(SESSION_DETAIL_EVENT, {
          type: "playResult",
          ok,
          error: typeof content.error === "string" ? content.error : undefined,
        });
        return;
      }
      default:
        return;
    }
  }

  private sendCustomPacket(customPacketType: string, payload: object) {
    const message: CustomPacketMessage = {
      t: MsgType.CustomPacket,
      contentJsonDump: JSON.stringify({ customPacketType, ...payload }),
    };
    this.controller.emitter.emit("sendMessage", { message, reliability: "reliable" });
  }

  private dispatchToBrowser(eventName: string, detail: object) {
    const json = JSON.stringify(detail).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const code = `window.dispatchEvent(new CustomEvent('${eventName}', { detail: JSON.parse('${json}') }));`;
    this.sp.browser.executeJavaScript(code);
  }

  private shouldShowAuthOnLoad = false;
  private frontReady = false;
  private selectedProfileId: number | null = null;
  private lastRaceMenuOpen = false;
}
