import { ClientListener, CombinedController, Sp } from "./clientListener";
import { FunctionInfo } from "../../lib/functionInfo";
import { BrowserMessageEvent } from "skyrimPlatform";
import { logTrace } from "../../logging";
import { TimersService } from "./timersService";

declare const window: any;

const events = {
    ok: 'testLoadedDialog_ok',
};

export class TestLoadedDialogService extends ClientListener {
    constructor(private sp: Sp, private controller: CombinedController) {
        super();
        this.controller.emitter.on("gameLoad", () => this.onGameLoad());
        this.controller.on("browserMessage", (e) => this.onBrowserMessage(e));
    }

    private onGameLoad() {
        logTrace(this, "gameLoad received, scheduling dialog show in 3s");

        const timersService = this.controller.lookupListener(TimersService);
        timersService.setTimeout(() => this.showWidget(), 3000);
    }

    private showWidget() {
        logTrace(this, "Showing loaded-into-game test dialog");
        this.sp.browser.executeJavaScript(new FunctionInfo(this.widgetSetter).getText({ events }));
        this.sp.browser.setVisible(true);
        this.sp.browser.setFocused(true);
    }

    private onBrowserMessage(e: BrowserMessageEvent) {
        if (e.arguments[0] !== events.ok) {
            return;
        }
        logTrace(this, "Ok clicked, hiding loaded-into-game test dialog");
        this.sp.browser.executeJavaScript('window.skyrimPlatform.widgets.set([]);');
        this.sp.browser.setFocused(false);
    }

    private widgetSetter = () => {
        const widget = {
            type: "form",
            id: 42,
            caption: "skymp",
            elements: [
                {
                    type: "text",
                    text: "You successfully loaded into the game!",
                    tags: [],
                },
                {
                    type: "button",
                    text: "Ok",
                    tags: ["ELEMENT_STYLE_MARGIN_EXTENDED"],
                    click: () => window.skyrimPlatform.sendMessage(events.ok),
                    hint: null,
                },
            ],
        };
        window.skyrimPlatform.widgets.set([widget]);
    };
}
