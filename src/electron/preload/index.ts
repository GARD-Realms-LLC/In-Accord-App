import {contextBridge, webFrame} from "electron";
import fs from "fs";
import path from "path";
import {Buffer as NodeBuffer} from "buffer";
import patchDefine from "./patcher";
import newProcess from "./process";
import * as iaApi from "./api";
import init from "./init";
import DiscordNativePatch from "./discordnativepatch";

function injectRendererBundleFromPreload() {
    try {
        // Only inject once in the top-level frame. Discord uses subframes/webviews,
        // and injecting into the wrong frame can look like "no UI" even though code ran.
        try {
            if (window.top && window.top !== window) {
                return;
            }
        }
        catch {
            // If we can't determine top-frame reliably, continue.
        }

        const detectChannelId = (): "stable" | "ptb" | "canary" | "development" => {
            try {
                // Prefer deriving from the running executable.
                const exe = String(path.basename(process.execPath || "")).toLowerCase();
                if (exe.includes("discordptb")) return "ptb";
                if (exe.includes("discordcanary")) return "canary";
                if (exe.includes("discorddevelopment")) return "development";
            }
            catch {}

            let c = String((process.env as any).INACCORD_RELEASE_CHANNEL || (process.env as any).DISCORD_RELEASE_CHANNEL || "").toLowerCase();
            if (!c) {
                try {
                    const low = String(process.execPath || "").toLowerCase();
                    if (low.includes("canary")) c = "canary";
                    else if (low.includes("ptb")) c = "ptb";
                    else if (low.includes("development")) c = "development";
                }
                catch {}
            }
            if (c === "ptb") return "ptb";
            if (c === "canary") return "canary";
            if (c === "development" || c === "dev") return "development";
            return "stable";
        };

        const channelId = detectChannelId();
        const iaDir = __dirname;

        const injectLogPath = path.join(iaDir, `InAccord_inject.${channelId}.log`);

        const preloadLoadedMarkerPath = path.join(iaDir, `InAccord.preload_loaded.${channelId}.json`);
        const runningMarkerPath = path.join(iaDir, `InAccord.running.${channelId}.json`);
        const injectStatusPath = path.join(iaDir, `InAccord.inject_status.${channelId}.json`);

        const logLine = (message: string) => {
            try {
                // Keep the log bounded to avoid unbounded growth
                try {
                    const stat = fs.existsSync(injectLogPath) ? fs.statSync(injectLogPath) : null;
                    if (stat && stat.size > 2_000_000) {
                        fs.writeFileSync(injectLogPath, "");
                    }
                    // If the log is stale (e.g., from a previous day/run), rotate it so
                    // launchers don't keep surfacing old failures.
                    if (stat) {
                        const ageMs = Date.now() - stat.mtimeMs;
                        if (Number.isFinite(ageMs) && ageMs > 60 * 60 * 1000) {
                            fs.writeFileSync(injectLogPath, "");
                        }
                    }
                }
                catch {}

                fs.appendFileSync(injectLogPath, `${new Date().toISOString()} ${message}\n`);
            }
            catch {}
        };

        const writeInjectStatus = (status: string, extra?: Record<string, any>) => {
            try {
                const payload = {
                    ts: new Date().toISOString(),
                    pid: process.pid,
                    status,
                    ...(extra || {})
                };
                fs.writeFileSync(injectStatusPath, JSON.stringify(payload, null, 2));
                try { logLine(`[status] wrote ${injectStatusPath} status=${String(status)}`); } catch {}
            }
            catch (e: any) {
                try { logLine(`[status] write_failed ${injectStatusPath} err=${String(e?.stack || e?.message || String(e))}`); } catch {}
            }
        };

        logLine(`[preload] start pid=${process.pid} channel=${channelId} __dirname=${__dirname}`);
        writeInjectStatus("preload-start", {preloadDir: __dirname, iaDir, channelId});

        // Write marker files so the launcher can reliably detect that preload executed,
        // even if renderer injection fails later.
        try {
            const payload = {
                ts: new Date().toISOString(),
                pid: process.pid,
                preloadDir: __dirname,
                iaDir,
                channelId
            };
            fs.writeFileSync(preloadLoadedMarkerPath, JSON.stringify(payload, null, 2));
            fs.writeFileSync(runningMarkerPath, JSON.stringify(payload, null, 2));
            logLine(`[preload] markers_written preload_loaded=${preloadLoadedMarkerPath} running=${runningMarkerPath}`);
        }
        catch (error: any) {
            logLine(`[preload] markers_write_failed ${(error?.stack || error?.message || String(error))}`);
        }

        // Capture any preload-context errors (helps when renderer injection fails before UI exists)
        try {
            window.addEventListener("error", (ev: ErrorEvent) => {
                const msg = ev?.error?.stack || ev?.message || "unknown error";
                logLine(`[preload] window.error ${msg}`);
            });
            window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
                const reason: any = (ev as any)?.reason;
                const msg = reason?.stack || String(reason ?? "unknown rejection");
                logLine(`[preload] unhandledrejection ${msg}`);
            });
        }
        catch {}

        const bundlePath = path.join(__dirname, `InAccord.${channelId}.js`);
        logLine(`[preload] bundlePath=${bundlePath} exists=${fs.existsSync(bundlePath)}`);
        if (!fs.existsSync(bundlePath)) return;

        // Discord's renderer uses restrictive CSP; executing bundle text via webFrame
        // bypasses script-src while still running in the page context.
        let injected = false;
        // Canary often takes longer to finish bootstrapping; allow more retries.
        const maxAttempts = 25;
        let attempts = 0;

        const markInjected = (mode: string) => {
            try {
                if ((window as any).__INACCORD_INJECTED__) return;
                Object.defineProperty(window, "__INACCORD_INJECTED__", {value: true, configurable: false});
            }
            catch {
                try { (window as any).__INACCORD_INJECTED__ = true; } catch {}
            }
            try { logLine(`[inject] marked_injected mode=${mode}`); } catch {}
        };


        const inject = () => {
            if (injected) return;
            attempts++;

            try {
                logLine(`[inject] attempt=${attempts}/${maxAttempts} domReadyState=${document.readyState}`);

                // Do not inject on Discord's splash/boot file:// pages.
                // Canary uses a file:// splash first; injecting there causes "app-mount missing" loops
                // and can make it look like InAccord did nothing.
                try {
                    const href = String(window.location?.href || "");
                    const proto = String(window.location?.protocol || "");
                    const host = String(window.location?.host || "");
                    const isDiscordHost = host.includes("discord.com") || host.includes("discordapp.com") || host.includes("canary.discord.com") || host.includes("ptb.discord.com");
                    const isDiscordProtocol = proto === "discord:";
                    if (!(isDiscordHost || isDiscordProtocol)) {
                        writeInjectStatus("waiting-url", {attempts, maxAttempts, href, proto, host});
                        if (attempts < maxAttempts) setTimeout(inject, 300);
                        return;
                    }

                    // Avoid injecting on the file:// splash (even though it might mention discord in path).
                    if (proto === "file:") {
                        writeInjectStatus("waiting-url", {attempts, maxAttempts, href, proto, host});
                        if (attempts < maxAttempts) setTimeout(inject, 300);
                        return;
                    }
                }
                catch {}

                // Some Discord builds briefly have no body even after DOMContentLoaded.
                // InAccord's renderer bundle expects to be able to append elements.
                if (!document.body) {
                    logLine(`[inject] body_missing retrying`);
                    if (attempts < maxAttempts) setTimeout(inject, 150);
                    return;
                }

                // Canary frequently reaches DOMContentLoaded before Discord's root mount exists.
                // Running the renderer too early can make it look like "nothing happens".
                try {
                    if (!document.getElementById("app-mount")) {
                        logLine(`[inject] app-mount missing retrying`);
                        writeInjectStatus("waiting-app-mount", {attempts, maxAttempts, readyState: document.readyState});
                        if (attempts < maxAttempts) setTimeout(inject, 250);
                        return;
                    }
                }
                catch {}

                let code = "";
                try {
                    code = fs.readFileSync(bundlePath, "utf8");
                }
                catch (e: any) {
                    logLine(`[inject] read_bundle_failed ${(e?.stack || e?.message || String(e))}`);
                    return;
                }

                // Run in the top frame page context (MAIN WORLD).
                // IMPORTANT: no require shim. The renderer bundle must be browser-safe.
                // Also: only mark injected after successful execution.
                // Canary can run with strict context isolation; executing in the preload
                // isolated world makes the UI appear to do nothing.
                const wrapped = `(() => {\n` +
                    `try {\n` +
                    `  if (window.__INACCORD_INJECTED__) return 'already';\n` +
                    `  try { document.documentElement && document.documentElement.setAttribute('data-inaccord-status','running'); } catch {}\n` +
                    `  try { document.documentElement && document.documentElement.removeAttribute('data-inaccord-error'); } catch {}\n` +
                    `${code}\n` +
                    `  try { Object.defineProperty(window, '__INACCORD_INJECTED__', {value: true, configurable: false}); } catch {}\n` +
                    `  try { document.documentElement && document.documentElement.setAttribute('data-inaccord-status','ok'); } catch {}\n` +
                    `  return 'ok';\n` +
                    `} catch (e) {\n` +
                    `  const msg = (e?.stack || e?.message || String(e));\n` +
                    `  try { document.documentElement && document.documentElement.setAttribute('data-inaccord-status','error'); } catch {}\n` +
                    `  try { document.documentElement && document.documentElement.setAttribute('data-inaccord-error', String(msg).slice(0, 500)); } catch {}\n` +
                    `  return 'error:' + msg;\n` +
                    `}\n` +
                    `})()`;

                const readMainWorldStatus = () => {
                    try {
                        const s = document.documentElement?.getAttribute?.("data-inaccord-status") || "";
                        const e = document.documentElement?.getAttribute?.("data-inaccord-error") || "";
                        const r = document.documentElement?.getAttribute?.("data-inaccord-renderer") || "";
                        const re = document.documentElement?.getAttribute?.("data-inaccord-startup-error") || "";
                        const stage = document.documentElement?.getAttribute?.("data-inaccord-startup-stage") || "";
                        const attempt = document.documentElement?.getAttribute?.("data-inaccord-startup-attempt") || "";
                        const detail = document.documentElement?.getAttribute?.("data-inaccord-startup-error-detail") || "";
                        return {
                            status: String(s),
                            error: String(e),
                            renderer: String(r),
                            rendererError: String(re),
                            startupStage: String(stage),
                            startupAttempt: String(attempt),
                            startupErrorDetail: String(detail)
                        };
                    }
                    catch {
                        return {status: "", error: "", renderer: "", rendererError: "", startupStage: "", startupAttempt: "", startupErrorDetail: ""};
                    }
                };

                const execInMainWorld = async () => {
                    // We must execute the renderer bundle in the same JS world as Discord's
                    // runtime (webpack, Flux, etc). On some Canary builds, different Electron
                    // APIs can end up evaluating in a world that shares the DOM but not the
                    // necessary globals, which looks like "preload ran" but produces no UI.
                    //
                    // Strategy: probe both methods and pick the one that can see webpack.
                    const wf: any = webFrame as any;
                    const probe = `(() => {\n` +
                        `  try {\n` +
                        `    const hasChunk = !!(window && (window.webpackChunkdiscord_app || window.__webpack_require__));\n` +
                        `    const hasDoc = !!(document && document.getElementById && document.getElementById('app-mount'));\n` +
                        `    return { ok: true, hasChunk, hasDoc, href: String(location && location.href || '') };\n` +
                        `  } catch (e) {\n` +
                        `    return { ok: false, error: String(e && (e.stack || e.message) || e) };\n` +
                        `  }\n` +
                        `})()`;

                    const tryExec = async (mode: "executeJavaScript" | "executeJavaScriptInIsolatedWorld:0", js: string) => {
                        if (mode === "executeJavaScript") {
                            const r = await wf.executeJavaScript(js, true);
                            return {mode, result: r};
                        }
                        if (typeof wf.executeJavaScriptInIsolatedWorld === "function") {
                            const r = await wf.executeJavaScriptInIsolatedWorld(0, [{code: js}], true);
                            const first = Array.isArray(r) ? r[0] : r;
                            return {mode, result: first};
                        }
                        throw new Error("executeJavaScriptInIsolatedWorld unavailable");
                    };

                    // Prefer the method that reports it can see Discord's chunk/require.
                    let preferred: "executeJavaScript" | "executeJavaScriptInIsolatedWorld:0" = "executeJavaScript";
                    try {
                        const p1: any = (await tryExec("executeJavaScript", probe))?.result;
                        if (p1 && typeof p1 === "object" && p1.hasChunk) preferred = "executeJavaScript";
                        else {
                            const p2: any = (await tryExec("executeJavaScriptInIsolatedWorld:0", probe))?.result;
                            if (p2 && typeof p2 === "object" && p2.hasChunk) preferred = "executeJavaScriptInIsolatedWorld:0";
                        }
                    }
                    catch {
                        // If probing fails, continue with the default.
                    }

                    const exec = await tryExec(preferred, wrapped);
                    return exec;
                };

                void Promise.resolve(execInMainWorld()).then((ret: any) => {
                    const mode = String(ret?.mode || "unknown");
                    const st = readMainWorldStatus();
                    const result = String(ret?.result);

                    if (result.startsWith("error:") || st.status === "error") {
                        const errText = result.startsWith("error:") ? result.slice("error:".length) : (st.error || "unknown");
                        logLine(`[inject] ${mode} error ${errText}`);
                        writeInjectStatus("error", {mode, attempts, maxAttempts, error: errText, renderer: st.renderer, rendererError: st.rendererError, startupStage: st.startupStage, startupAttempt: st.startupAttempt, startupErrorDetail: st.startupErrorDetail});

                        // If the renderer threw (often because Discord isn't ready yet), keep retrying.
                        if (attempts < maxAttempts) {
                            setTimeout(inject, Math.min(250 + attempts * 250, 2000));
                        }
                    }
                    else if (st.status === "ok" || result === "ok" || result === "already") {
                        injected = true;
                        markInjected(mode);
                        logLine(`[inject] ${mode} ok ret=${result}`);
                        writeInjectStatus("ok", {mode, attempts, maxAttempts, result, renderer: st.renderer, rendererError: st.rendererError, startupStage: st.startupStage, startupAttempt: st.startupAttempt, startupErrorDetail: st.startupErrorDetail});

                        // Post-injection status updates:
                        // The initial status capture can happen mid-startup (e.g., connection-wait).
                        // Poll a few times and rewrite inject_status.json so launchers/debugging can
                        // see startup-complete or the real later failure stage.
                        const post = (delayMs: number) => {
                            try {
                                setTimeout(() => {
                                    try {
                                        const s2 = readMainWorldStatus();
                                        const stage = String(s2.startupStage || "");
                                        const renderer = String(s2.renderer || "");
                                        const rendererErr = String(s2.rendererError || "");
                                        const detail = String(s2.startupErrorDetail || "");

                                        if (renderer === "startup-complete") {
                                            writeInjectStatus("startup-complete", {mode, stage, renderer, rendererError: rendererErr});
                                        }
                                        else if (renderer === "startup-error") {
                                            writeInjectStatus("startup-error", {mode, stage, renderer, rendererError: rendererErr, startupErrorDetail: detail});
                                        }
                                        else {
                                            writeInjectStatus("startup-progress", {mode, stage, renderer, rendererError: rendererErr});
                                        }
                                    }
                                    catch {}
                                }, Math.max(0, delayMs | 0));
                            }
                            catch {}
                        };

                        post(1500);
                        post(6000);
                        post(15000);
                    }
                    else {
                        logLine(`[inject] ${mode} not_ready status=${st.status || ""} ret=${result}`);
                        writeInjectStatus("not-ready", {mode, attempts, maxAttempts, status: st.status || "", result, renderer: st.renderer, rendererError: st.rendererError, startupStage: st.startupStage, startupAttempt: st.startupAttempt, startupErrorDetail: st.startupErrorDetail});
                        if (attempts < maxAttempts) {
                            setTimeout(inject, Math.min(250 + attempts * 250, 2000));
                        }
                    }
                }).catch((e: any) => {
                    logLine(`[inject] executeJavaScript_failed ${(e?.stack || e?.message || String(e))}`);
                    writeInjectStatus("exec-failed", {attempts, maxAttempts, error: String(e?.stack || e?.message || String(e))});

                    if (attempts < maxAttempts) {
                        setTimeout(inject, Math.min(250 + attempts * 250, 2000));
                    }
                });
            }
            catch (error: any) {
                logLine(`[inject] exception ${(error?.stack || error?.message || String(error))}`);
                if (attempts < maxAttempts) {
                    setTimeout(inject, Math.min(250 + attempts * 250, 2000));
                }
            }
        };

        // Inject after DOMContentLoaded (more consistent on Discord) but also schedule retries.
        if (document.readyState === "loading") {
            window.addEventListener("DOMContentLoaded", inject, {once: true});
        }
        else {
            inject();
        }
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("[InAccord] preload bundle setup failed", error);
    }
}

try {
    patchDefine();
}
catch (error) {
    // eslint-disable-next-line no-console
    console.error("[InAccord] patchDefine failed", error);
}

try {
    DiscordNativePatch.init();
}
catch (error) {
    // eslint-disable-next-line no-console
    console.error("[InAccord] DiscordNativePatch init failed", error);
}

let hasInitialized = false;
contextBridge.exposeInMainWorld("process", newProcess);
contextBridge.exposeInMainWorld("InAccordPreload", () => {
    // Multiple parts of the renderer call InAccordPreload() at different times.
    // Returning null after the first call can cause non-deterministic startup failures
    // (depending on who called first). Keep the one-time side effects guarded, but
    // always return the API object.
    if (!hasInitialized) hasInitialized = true;
    return iaApi;
});

try {
    init();
}
catch (error) {
    // eslint-disable-next-line no-console
    console.error("[InAccord] preload init failed", error);
}

injectRendererBundleFromPreload();
