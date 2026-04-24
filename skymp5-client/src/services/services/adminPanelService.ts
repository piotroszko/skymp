import { DxScanCode } from "skyrimPlatform";
import { logTrace } from "../../logging";
import { QueryKeyCodeBindings } from "../events/queryKeyCodeBindings";
import { ClientListener, CombinedController, Sp } from "./clientListener";

const openEventString = `window.dispatchEvent(new CustomEvent('openAdminPanel'))`;
const closeEventString = `window.dispatchEvent(new CustomEvent('closeAdminPanel'))`;

export class AdminPanelService extends ClientListener {
  constructor(private sp: Sp, private controller: CombinedController) {
    super();

    this.controller.emitter.on("queryKeyCodeBindings", (e) => this.onQueryKeyCodeBindings(e));
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

  private isOpen = false;
}
