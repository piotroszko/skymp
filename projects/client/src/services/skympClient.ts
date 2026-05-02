import { printConsole, settings, storage } from "skyrimPlatform";

import { AuthGameData, authGameDataStorageKey } from "../features/authModel";
import { logTrace } from "../logging";
import { setupHooks } from "../sync/animation";
import { AuthAttemptEvent } from "../types/events/authAttemptEvent";
import { ConnectionDenied } from "../types/events/connectionDenied";
import { ConnectionFailed } from "../types/events/connectionFailed";
import { ConnectionMessage } from "../types/events/connectionMessage";
import { CreateActorMessage } from "../types/messages/createActorMessage";
import { ClientListener, CombinedController, Sp } from "./clientListener";
import * as networking from "./networkingService";
import { SettingsService, TargetPeer } from "./settingsService";

printConsole("Hello Multiplayer!");
printConsole("settings:", settings["skymp5-client"]);

export class SkympClient extends ClientListener {
  constructor(
    private sp: Sp,
    private controller: CombinedController,
  ) {
    super();

    this.controller.emitter.on("connectionFailed", (e) => this.onConnectionFailed(e));
    this.controller.emitter.on("connectionDenied", (e) => this.onConnectionDenied(e));

    this.controller.emitter.on("createActorMessage", (e) => this.onActorCreateMessage(e));

    // Auth happens via custom packets after the connection is established,
    // so the client always connects immediately and AuthService coordinates the
    // login UI on top of the live connection.
    logTrace(this, `Starting client immediately; auth will be performed via custom packets`);
    this.controller.emitter.on("authAttempt", (e) => this.onAuthAttempt(e));
    this.controller.once("tick", () => {
      this.controller.emitter.emit("authNeeded", {});
    });
    this.startClient();
  }

  private onAuthAttempt(e: AuthAttemptEvent) {
    logTrace(this, `Caught auth event, persisting authGameData`);
    storage[authGameDataStorageKey] = e.authGameData;
  }

  private onActorCreateMessage(e: ConnectionMessage<CreateActorMessage>) {
    if (e.message.isMe) {
      this.sp.browser.setFocused(false);
    }
  }

  private onConnectionFailed(e: ConnectionFailed) {
    logTrace(this, "Connection failed");
  }

  private onConnectionDenied(e: ConnectionDenied) {
    logTrace(this, "Connection denied: " + e.error);
  }

  private startClient() {
    // once("tick", ...) is needed to ensure networking service initialized
    this.controller.once("tick", () => this.establishConnectionConditional());
    this.ctor();
  }

  private ctor() {
    // TODO: refactor into service
    setupHooks();

    this.sp.printConsole("SkympClient ctor");
  }

  private establishConnectionConditional() {
    const isConnected = this.controller.lookupListener(networking.NetworkingService).isConnected();
    if (isConnected) {
      logTrace(this, "Reconnect is not required");
      return;
    }

    this.controller.lookupListener(SettingsService).getTargetPeer(({ host, port }: TargetPeer) => {
      storage.targetIp = host;
      storage.targetPort = port;

      printConsole(`Connecting to ${host}:${port}`);
      this.controller.lookupListener(networking.NetworkingService).connect(host, port);
    });
  }
}
