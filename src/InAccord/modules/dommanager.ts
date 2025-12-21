import Logger from "@common/logger";


type DeepArray<T> = T | Array<DeepArray<T>>;

interface AnimationOptions {
    timing?: (fraction: number) => number;
    update: (progress: number) => void;
    duration: number;
}

// TODO: revamp the "manager" part
export default class DOMManager {

    /** Document/window width */
    static get screenWidth() {return Math.max(document.documentElement.clientWidth, window.innerWidth || 0);}

    /** Document/window height */
    static get screenHeight() {return Math.max(document.documentElement.clientHeight, window.innerHeight || 0);}

    static get iaHead() {return this.getElement("ia-head")!;}
    static get iaBody() {return this.getElement("ia-body")!;}
    static get iaScripts() {return this.getElement("ia-scripts")!;}
    static get iaStyles() {return this.getElement("ia-styles")!;}
    static get iaThemes() {return this.getElement("ia-themes")!;}
    static get iaCustomCSS() {return this.getElement("style#customcss")!;}
    // static get iaTooltips() {return this.getElement("ia-tooltips") || this.createElement("ia-tooltips").appendTo(this.iaBody);}
    // static get iaModals() {return this.getElement("ia-modals") || this.createElement("ia-modals").appendTo(this.iaBody);}
    // static get iaToasts() {return this.getElement("ia-toasts") || this.createElement("ia-toasts").appendTo(this.iaBody);}

    static initialize() {
        // this.createElement("ia-head", {target: document.head});
        // this.createElement("ia-body", {target: document.body});
        // this.createElement("ia-scripts", {target: this.iaHead});
        // this.createElement("ia-styles", {target: this.iaHead});
        // this.createElement("ia-themes", {target: this.iaHead});
        // this.createElement("style", {id: "customcss", target: this.iaHead});
    }

    static escapeID(id: string) {
        return CSS.escape(id);
    }

    // TODO: do more of this overloading for better typing and less assertions
    static getElement(e: Node, baseElement?: Element): Node;
    static getElement(e: string, baseElement?: Element): Element | null;
    static getElement(e: Node | string, baseElement: Element = document.documentElement) {
        if (e instanceof Node) return e;
        return baseElement.querySelector(e);
    }

    /**
     * Utility function to make creating DOM elements easier.
     * Has backward compatibility with previous createElement implementation.
    */
    static createElement(type: string, options: {id?: string, target?: string | Element;} = {}, ...children: Array<DeepArray<Node | string>>) {
        const element = document.createElement(type);

        Object.assign(element, options);

        const flatChildren = (Array.prototype.flat as (count: number) => Array<Node | string>).call(children, Infinity).filter(c => c !== null && c !== undefined) as Array<Node | string>;
        element.append(...flatChildren);

        if (options.target) {
            Logger.warn("DOM.createElement", `Usage of the "target" option has been deprecated and will be removed in the next version.`);
            (typeof options.target === "string" ? document.querySelector(options.target) : options.target)?.append(element);
        }

        return element;
    }

    /**
     * Parses a string of HTML and returns the results. If the second parameter is true,
     * the parsed HTML will be returned as a document fragment {@see https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment}.
     * This is extremely useful if you have a list of elements at the top level, they can then be appended all at once to another node.
     *
     * If the second parameter is false, then the return value will be the list of parsed
     * nodes and there were multiple top level nodes, otherwise the single node is returned.
     */
    static parseHTML(html: string, fragment = false) {
        const template = document.createElement("template");
        template.innerHTML = html.trim();
        const node = template.content.cloneNode(true);
        if (fragment) return node;
        return node.childNodes.length > 1 ? node.childNodes : node.childNodes[0];
    }

    static removeStyle(id: string) {
        id = this.escapeID(id);
        const exists = this.getElement(`#${id}`, this.iaStyles);
        if (exists) exists.remove();
    }

    static injectStyle(id: string, css: string) {
        id = this.escapeID(id);
        const style = this.getElement(`#${id}`, this.iaStyles) || this.createElement("style", {id});
        style.textContent = css;
        this.iaStyles.append(style);
    }

    static unlinkStyle(id: string) {
        return this.removeStyle(id);
    }

    static linkStyle(id: string, url: string, {documentHead = false} = {}) {
        id = this.escapeID(id);
        return new Promise(resolve => {
            const link: HTMLLinkElement = this.getElement(`#${id}`, this.iaStyles) as HTMLLinkElement || this.createElement("link", {id});
            link.rel = "stylesheet";
            link.href = url;
            link.onload = resolve;
            const target = documentHead ? document.head : this.iaStyles;
            target.append(link);
        });
    }

    static removeTheme(id: string) {
        id = this.escapeID(id);
        const exists = this.getElement(`#${id}`, this.iaThemes);
        if (exists) exists.remove();
    }

    static injectTheme(id: string, css: string) {
        id = this.escapeID(id);
        const style = this.getElement(`#${id}`, this.iaThemes) || this.createElement("style", {id});
        style.textContent = css;
        this.iaThemes.append(style);
    }

    static updateCustomCSS(css: string) {
        this.iaCustomCSS.textContent = css;
    }

    static removeScript(id: string) {
        id = this.escapeID(id);
        const exists = this.getElement(`#${id}`, this.iaScripts);
        if (exists) exists.remove();
    }

    static injectScript(id: string, url: string) {
        id = this.escapeID(id);
        return new Promise((resolve, reject) => {
            const script: HTMLScriptElement = this.getElement(`#${id}`, this.iaScripts) as HTMLScriptElement || this.createElement("script", {id});
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            this.iaScripts.append(script);
        });
    }

    // https://javascript.info/js-animation
    static animate({timing = _ => _, update, duration}: AnimationOptions) {
        const start = performance.now();

        let id = requestAnimationFrame(function animate(time) {
            // timeFraction goes from 0 to 1
            let timeFraction = (time - start) / duration;
            if (timeFraction > 1) timeFraction = 1;

            // calculate the current animation state
            const progress = timing(timeFraction);

            update(progress); // draw it

            if (timeFraction < 1) id = requestAnimationFrame(animate);
        });

        return () => cancelAnimationFrame(id);
    }

    /**
     * Adds a listener for when a node matching a selector is added to the document body.
     * The listener is automatically removed upon firing.
     * The callback is given the matching element.
     * @param {string} selector - node to wiat for
     * @param {callable} callback - function to be performed on event
     */
    static onAdded(selector: string, callback: (e: Element) => void) {
        if (document.body.querySelector(selector)) return callback(document.body.querySelector(selector)!);

        const observer = new MutationObserver((mutations) => {
            for (let m = 0; m < mutations.length; m++) {
                for (let i = 0; i < mutations[m].addedNodes.length; i++) {
                    const mutation = mutations[m].addedNodes[i];
                    if (mutation.nodeType !== 1) continue; // ignore non-elements
                    const directMatch = (mutation as Element).matches(selector) && (mutation as Element);
                    const childrenMatch = (mutation as Element).querySelector(selector);
                    if (directMatch || childrenMatch) {
                        observer.disconnect();
                        return callback(directMatch || childrenMatch!);
                    }
                }
            }
        });

        observer.observe(document.body, {subtree: true, childList: true});

        return () => {observer.disconnect();};
    }

    /**
     * Adds a listener for when the node is removed from the document body.
     * The listener is automatically removed upon firing.
     * @param {HTMLElement} node - node to wiat for
     * @param {callable} callback - function to be performed on event
     */
    static onRemoved(node: Node, callback: () => void) {
        const observer = new MutationObserver((mutations) => {
            for (let m = 0; m < mutations.length; m++) {
                const mutation = mutations[m];
                const nodes = Array.from(mutation.removedNodes);
                const directMatch = nodes.indexOf(node) > -1;
                const parentMatch = nodes.some(parent => parent.contians(node));
                if (directMatch || parentMatch) {
                    observer.disconnect();
                    callback();
                }
            }
        });

        observer.observe(document.body, {subtree: true, childList: true});
        return () => {observer.disconnect();};
    }
}

DOMManager.createElement("ia-head", {target: document.body});
DOMManager.createElement("ia-body", {target: document.body});
DOMManager.createElement("ia-scripts", {target: DOMManager.iaHead});
DOMManager.createElement("ia-styles", {target: DOMManager.iaHead});
DOMManager.createElement("ia-themes", {target: DOMManager.iaHead});
DOMManager.createElement("style", {id: "customcss", target: DOMManager.iaHead});