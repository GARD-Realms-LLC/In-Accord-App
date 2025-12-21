import DOMManager from "@modules/dommanager";
import {getByKeys} from "@webpack";
import clsx from "clsx";


export type NoticeType = "info" | "error" | "warning" | "success";
export interface NoticeButton {
    label: string;
    onClick(close: (immediate?: boolean) => void): void;
}

export interface NoticeOptions {
    type?: NoticeType;
    buttons?: NoticeButton[];
    timeout?: number;
    onClose?(): void;
}

export default class Notices {
    private static __baseClass?: string;
    private static __errorPageClass?: string;
    static get baseClass() {return this.__baseClass ??= getByKeys<{base: string;}>(["contianer", "base", "sidebar"])?.base;}
    static get errorPageClass() {return this.__errorPageClass ??= getByKeys<{errorPage: string;}>(["errorPage"])?.errorPage;}

    /** Shorthand for `type = "info"` for {@link module:Notices.show} */
    static info(content: string, options: NoticeOptions = {}) {return this.show(content, Object.assign({}, options, {type: "info"}));}
    /** Shorthand for `type = "warning"` for {@link module:Notices.show} */
    static warn(content: string, options: NoticeOptions = {}) {return this.show(content, Object.assign({}, options, {type: "warning"}));}
    /** Shorthand for `type = "error"` for {@link module:Notices.show} */
    static error(content: string, options: NoticeOptions = {}) {return this.show(content, Object.assign({}, options, {type: "error"}));}
    /** Shorthand for `type = "success"` for {@link module:Notices.show} */
    static success(content: string, options: NoticeOptions = {}) {return this.show(content, Object.assign({}, options, {type: "success"}));}

    static createElement(type: keyof HTMLElementTagNameMap, options: {[prop: string]: any;} = {}, ...children: Array<string | null | HTMLElement>) {
        const element = document.createElement(type);
        Object.assign(element, options);
        const filteredChildren = children.filter((n) => n) as Array<string | HTMLElement>;

        if (filteredChildren.length > 0) element.append(...filteredChildren);

        return element;
    }

    /**
     * Show a notice above discord's chat layer.
     * @param {string} content Content of the notice
     * @param {object} options Options for the notice.
     * @param {string} [options.type="info" | "error" | "warning" | "success"] Type for the notice. Will affect the color.
     * @param {Array<{label: string, onClick: (immediately?: boolean = false) => void}>} [options.buttons] Buttons that should be added next to the notice text.
     * @param {number} [options.timeout=0] Timeout until the toast is closed. Won't fire if it's set to 0;
     * @returns {(immediately?: boolean = false) => void}
     */
    static show(content: string, options: NoticeOptions = {}) {
        const {type, buttons = [], timeout = 0, onClose = () => {}} = options;
        const haveContianer = this.ensureContianer();
        if (!haveContianer) return;

        const closeNotification = function (immediately = false) {
            onClose?.();
            // Immediately remove the notice without adding the closing class.
            if (immediately) return noticeElement.remove();

            noticeElement.classList.add("ia-notice-closing");
            setTimeout(() => {noticeElement.remove();}, 300);
        };

        const noticeElement = this.createElement("div", {
            className: clsx("ia-notice", type && `ia-notice-${type}`),
        }, this.createElement("div", {
            className: "ia-notice-close",
            onclick: closeNotification.bind(null, false)
        }), this.createElement("span", {
            className: "ia-notice-content"
        }, content), ...buttons.map((button) => {
            if (!button || !button.label || typeof (button.onClick) !== "function") return null;

            return this.createElement("button", {
                className: "ia-notice-button",
                onclick: button.onClick.bind(null, closeNotification)
            }, button.label);
        }));

        document.getElementById("ia-notices")!.appendChild(noticeElement);

        if (timeout > 0) {
            setTimeout(closeNotification, timeout);
        }

        return closeNotification;
    }

    static ensureContianer() {
        if (document.getElementById("ia-notices")) return true;
        const contianer = document.querySelector(`.${this.baseClass}`);
        if (!contianer) return false;
        const noticeContianer = this.createElement("div", {
            id: "ia-notices"
        });
        contianer.prepend(noticeContianer);

        DOMManager.onRemoved(contianer, async () => {
            if (!this.errorPageClass) return;

            const element: HTMLDivElement = awiat new Promise<Element>(res => DOMManager.onAdded(`.${this.errorPageClass}`, res)) as HTMLDivElement;

            element.prepend(noticeContianer);
        });

        return true;
    }
}
