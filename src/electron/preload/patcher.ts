import {webFrame} from "electron";


// TODO: could use better typing when this is rewritten
export default function () {
    // Only patch in the top-level frame. Discord creates subframes/webviews and
    // patching those can be noisy and ineffective.
    try {
        if (window.top && window.top !== window) return;
    }
    catch {
        // If we can't determine top-frame reliably, continue.
    }

    const patcher = function () {
        const chunkName = "webpackChunkdiscord_app";
        const predefine = function (target: object, prop: keyof typeof target, effect: (v: any) => void) {
            const value = target[prop];
            Object.defineProperty(target, prop, {
                get() {return value;},
                set(newValue) {
                    Object.defineProperty(target, prop, {
                        value: newValue,
                        configurable: true,
                        enumerable: true,
                        writable: true
                    });

                    try {
                        effect(newValue);
                    }
                    catch (error) {
                        // eslint-disable-next-line no-console
                        console.error(error);
                    }


                    return newValue;
                },
                configurable: true
            });
        };

        if (!Reflect.has(window, chunkName)) {
            // @ts-expect-error cba
            predefine(window, chunkName, instance => {
                instance.push([[Symbol()], {}, (require: any) => {
                    require.d = (target: object, exports: any) => {
                        for (const key in exports) {
                            if (!Reflect.has(exports, key)) continue;

                            try {
                                Object.defineProperty(target, key, {
                                    get: () => exports[key](),
                                    set: v => {exports[key] = () => v;},
                                    enumerable: true,
                                    configurable: true
                                });
                            }
                            catch (error) {
                                // eslint-disable-next-line no-console
                                console.error(error);
                            }
                        }
                    };
                }]);
            });
        }
    };

    const code = "(" + patcher + ")()";

    // Prefer running in the page context so the defineProperty hook applies to
    // Discord's real window globals (webpackChunkdiscord_app, etc).
    // Some Discord Canary builds can behave differently depending on contextIsolation;
    // attempt both mechanisms safely.
    try {
        void (webFrame as any).executeJavaScript?.(code, true);
    }
    catch {
        // ignore
    }
    try {
        const wf: any = webFrame as any;
        if (typeof wf.executeJavaScriptInIsolatedWorld === "function") {
            void wf.executeJavaScriptInIsolatedWorld(0, [{code}], true);
        }
    }
    catch {
        // ignore
    }
}
