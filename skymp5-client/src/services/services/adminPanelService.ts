import { BrowserMessageEvent, DxScanCode } from "skyrimPlatform";
import { logError, logTrace } from "../../logging";
import { QueryKeyCodeBindings } from "../events/queryKeyCodeBindings";
import { ClientListener, CombinedController, Sp } from "./clientListener";

const openEventString = `window.dispatchEvent(new CustomEvent('openAdminPanel'))`;
const closeEventString = `window.dispatchEvent(new CustomEvent('closeAdminPanel'))`;

const SPEED_MULT_DEFAULT = 100;
const SPEED_MULT_FAST = 500;

type CheatName = "noclip" | "fastMove";

interface AdminPanelMessage {
  type: "adminPanel";
  cheat: CheatName;
  enabled: boolean;
}

export class AdminPanelService extends ClientListener {
  constructor(private sp: Sp, private controller: CombinedController) {
    super();

    this.controller.emitter.on("queryKeyCodeBindings", (e) => this.onQueryKeyCodeBindings(e));
    this.controller.on("browserMessage", (e) => this.onBrowserMessage(e));
    this.controller.on("update", () => this.onUpdate());
  }

  private onQueryKeyCodeBindings(e: QueryKeyCodeBindings) {
    if (!e.isDown([DxScanCode.F1])) {
      return;
    }

    this.isOpen = !this.isOpen;
    logTrace(this, `Admin panel toggled: ${this.isOpen ? "open" : "closed"}`);

    if (this.isOpen) {
      this.sp.browser.setFocused(true);
      this.sp.browser.executeJavaScript(openEventString);
    } else {
      this.sp.browser.setFocused(false);
      this.sp.browser.executeJavaScript(closeEventString);
    }
  }

  private onBrowserMessage(e: BrowserMessageEvent) {
    const raw = e.arguments[0];
    if (typeof raw !== "string") {
      return;
    }

    let data: AdminPanelMessage;
    try {
      data = JSON.parse(raw) as AdminPanelMessage;
    } catch {
      return;
    }

    if (!data || data.type !== "adminPanel") {
      return;
    }

    if (typeof data.enabled !== "boolean") {
      logError(this, "Invalid adminPanel browser message payload:", data);
      return;
    }

    logTrace(this, `Cheat '${data.cheat}' set to ${data.enabled}`);

    switch (data.cheat) {
      case "noclip":
        if (data.enabled !== this.noclipEnabled) {
          this.noclipEnabled = data.enabled;
          this.controller.once("update", () => this.sp.Debug.toggleCollisions());
        }
        break;
      case "fastMove":
        this.fastMoveEnabled = data.enabled;
        if (!data.enabled) {
          this.controller.once("update", () => {
            const player = this.sp.Game.getPlayer();
            if (player) player.setActorValue("SpeedMult", SPEED_MULT_DEFAULT);
          });
        }
        break;
      default:
        logError(this, "Unknown cheat:", data.cheat);
    }
  }

  private onUpdate() {
    if (!this.fastMoveEnabled) {
      return;
    }

    const player = this.sp.Game.getPlayer();
    if (player) player.setActorValue("SpeedMult", SPEED_MULT_FAST);
  }

  private isOpen = false;
  private noclipEnabled = false;
  private fastMoveEnabled = false;
}
