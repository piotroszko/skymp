import { BrowserMessageEvent } from "skyrimPlatform";
import { FunctionInfo } from "../../lib/functionInfo";
import { ClientListener, CombinedController, Sp } from "./clientListener";

declare const window: any;

const events = {
    succefullLoginOk: 'succefullLoginOk'
};

export class SuccefullLoginInGameService extends ClientListener {
    constructor(private sp: Sp, private controller: CombinedController) {
        super();
        this.controller.emitter.on("gameLoad", () => this.onGameLoad());
        this.controller.on("browserMessage", (e) => this.onBrowserMessage(e));
    }

    private onGameLoad() {
        this.sp.Utility.wait(15).then(() => this.showDialog());
    }

    private showDialog() {
        this.sp.browser.executeJavaScript(new FunctionInfo(this.dialogWidgetSetter).getText({ events }));
        this.sp.browser.setVisible(true);
        this.sp.browser.setFocused(true);
    }

    private onBrowserMessage(e: BrowserMessageEvent) {
        if (e.arguments[0] !== events.succefullLoginOk) {
            return;
        }
        this.sp.browser.executeJavaScript('window.skyrimPlatform.widgets.remove(3);');
        this.sp.browser.setFocused(false);
    }

    private dialogWidgetSetter = () => {
        const widget = {
            type: "form",
            id: 3,
            caption: "login",
            elements: [
                {
                    type: "text",
                    text: "Succeful login",
                    tags: [],
                },
                {
                    type: "button",
                    text: "Ok",
                    tags: ["ELEMENT_STYLE_MARGIN_EXTENDED"],
                    click: () => window.skyrimPlatform.sendMessage(events.succefullLoginOk),
                    hint: undefined,
                }
            ]
        };
        window.skyrimPlatform.widgets.add(widget);
    }
}
