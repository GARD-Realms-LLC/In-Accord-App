import type {Webpack} from "discord";
import Logger from "@common/logger";
import type {RawModule} from "../types/discord/webpack";

export let webpackRequire: Webpack.Require | null = null;

export const lazyListeners = new Set<Webpack.Filter>();

let attached = false;
let chunkGlobal: any = null;
let __ORIGINAL_PUSH__: any = null;
const readyWaiters = new Set<() => void>();

function findChunkGlobal(): {key: string; value: any;} | null {
    // Canonical Discord key.
    const direct = (window as any).webpackChunkdiscord_app;
    if (direct && typeof direct.push === "function") return {key: "webpackChunkdiscord_app", value: direct};

    // Canary/variants: scan for other chunk globals.
    try {
        for (const key of Object.keys(window as any)) {
            if (!key.startsWith("webpackChunk")) continue;
            const v = (window as any)[key];
            if (v && typeof v.push === "function") return {key, value: v};
        }
    }
    catch {}

    return null;
}

function notifyReady() {
    for (const w of [...readyWaiters]) {
        try {w();} catch {}
    }
    readyWaiters.clear();
}

function isWebpackReady() {
    return Boolean(webpackRequire && typeof webpackRequire === "function" && (webpackRequire as any).c && (webpackRequire as any).m);
}

export function waitForWebpackRequire(timeoutMs = 15000): Promise<Webpack.Require> {
    if (isWebpackReady()) return Promise.resolve(webpackRequire as Webpack.Require);

    return new Promise((resolve, reject) => {
        const started = performance.now();

        const tick = () => {
            if (isWebpackReady()) {
                resolve(webpackRequire as Webpack.Require);
                return;
            }

            if (performance.now() - started >= timeoutMs) {
                reject(new Error("Webpack require was not detected before timeout"));
                return;
            }

            setTimeout(tick, 25);
        };

        const waiter = () => {
            queueMicrotask(() => {
                if (isWebpackReady()) resolve(webpackRequire as Webpack.Require);
            });
        };

        readyWaiters.add(waiter);
        tick();
    });
}

function attachToChunkGlobal(global: any) {
    if (attached) return;
    attached = true;
    chunkGlobal = global;
    __ORIGINAL_PUSH__ = global.push.bind(global);

    try {
        Object.defineProperty(global, "push", {
            configurable: true,
            get: () => handlePush,
            set: (newPush) => {
                try {
                    __ORIGINAL_PUSH__ = newPush.bind?.(global) ?? newPush;
                }
                catch {
                    __ORIGINAL_PUSH__ = newPush;
                }

                Object.defineProperty(global, "push", {
                    value: handlePush,
                    configurable: true,
                    writable: true
                });
            }
        });
    }
    catch {}

    try {
        global.push([
            [Symbol("InAccord")],
            {},
            (__webpack_require__: any) => {
                try {
                    const ok = typeof __webpack_require__ === "function" && __webpack_require__ && typeof __webpack_require__.c === "object" && typeof __webpack_require__.m === "object";
                    if (!ok) return;
                    webpackRequire = __webpack_require__;
                    try {listenToModules(__webpack_require__.m);} catch {}
                    notifyReady();
                }
                catch (error) {
                    Logger.stacktrace("WebpackModules", "Failed to capture webpack require", error as Error);
                }
            }
        ]);
    }
    catch (error) {
        Logger.stacktrace("WebpackModules", "Failed to push require-capture chunk", error as Error);
    }
}

function tryAttachNow() {
    const found = findChunkGlobal();
    if (found) {
        attachToChunkGlobal(found.value);
        return true;
    }

    return false;
}

function listenToModules(modules: Record<PropertyKey, RawModule>) {
    for (const moduleId in modules) {
        const originalModule = modules[moduleId];

        modules[moduleId] = (module, exports, require) => {
            try {
                Reflect.apply(originalModule, null, [module, exports, require]);

                const listeners = [...lazyListeners];
                for (let i = 0; i < listeners.length; i++) {
                    try {listeners[i](exports, module, module.id);}
                    catch (error) {
                        Logger.stacktrace("WebpackModules", "Could not fire callback listener:", error as Error);
                    }
                }
            }
            catch (error) {
                Logger.stacktrace("WebpackModules", "Could not patch pushed module", error as Error);
            }
            finally {
                require.m[moduleId] = originalModule;
            }
        };

        Object.assign(modules[moduleId], originalModule, {
            toString: () => originalModule.toString()
        });
    }
}

function handlePush(chunk: Webpack.ModuleWithoutEffect | Webpack.ModuleWithEffect) {
    const [, modules] = chunk;
    listenToModules(modules);
    const target = chunkGlobal ?? (window as any).webpackChunkdiscord_app;
    const original = __ORIGINAL_PUSH__ ?? target?.push;
    return Reflect.apply(original, target, [chunk]);
}

tryAttachNow();

// If we weren't able to attach immediately, keep trying briefly.
// Some Canary builds create the chunk global later during bootstrap.
if (!attached) {
    const started = performance.now();
    const timer = setInterval(() => {
        if (attached) {
            clearInterval(timer);
            return;
        }
        if (performance.now() - started > 15000) {
            clearInterval(timer);
            return;
        }
        tryAttachNow();
    }, 250);

    // Also attempt to hook the canonical property if possible.
    try {
        let current = (window as any).webpackChunkdiscord_app;
        Object.defineProperty(window, "webpackChunkdiscord_app", {
            configurable: true,
            get: () => current,
            set: (v) => {
                current = v;
                if (v && typeof v.push === "function") {
                    attachToChunkGlobal(v);
                }
            }
        });
    }
    catch {}
}

export const modules = new Proxy({} as Webpack.Require["m"], {
    ownKeys() {return isWebpackReady() ? Object.keys((webpackRequire as Webpack.Require).m) : [];},
    getOwnPropertyDescriptor() {
        return {
            enumerable: true,
            configurable: true, // Not actually
        };
    },
    get(_, k) {
        if (!isWebpackReady()) return undefined;
        return (webpackRequire as Webpack.Require).m[k];
    },
    set() {
        throw new Error("[WebpackModules~modules] Setting modules is not allowed.");
    }
});