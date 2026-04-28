import { logTrace } from "../../logging";
import { ClientListener, Sp, CombinedController } from "./clientListener";

export class FrontHotReloadService extends ClientListener {
    constructor(private sp: Sp, private controller: CombinedController) {
        super();

        const enable = !!this.sp.settings["skymp5-client"]["enable-front-hotreload"];

        logTrace(this, `enable-front-hotreload is`, enable);

        if (!enable) {
            return;
        }

        this.connectToFrontHotReload();
    }

    private connectToFrontHotReload() {
        this.controller.once("update", () => {
            const url = "localhost:1234";
            logTrace(this, `Loading url`, url);
            this.sp.browser.loadUrl(url);
        });
    }
}
