import fs from "fs";
import path from "path";
import os from "os";

function safeNow() {
    try {
        return new Date().toISOString();
    }
    catch {
        return "";
    }
}

function getWinChannelBaseDir(): string {
    const envAppData = process.env.APPDATA ?? "";


    // Discord's isolated/preload context can have a stripped environment.
    // Resolve Roaming AppData without depending on APPDATA.
    const resolveRoamingAppData = () => {
        const candidates: string[] = [];
        if (envAppData) candidates.push(envAppData);
        const userProfile = process.env.USERPROFILE ?? "";
        if (userProfile) candidates.push(path.join(userProfile, "AppData", "Roaming"));
        try {
            const home = os.homedir?.() ?? "";
            if (home) candidates.push(path.join(home, "AppData", "Roaming"));
        }
        catch {}

        for (const c of candidates) {
            try {
                if (c && fs.existsSync(c)) return c;
            }
            catch {}
        }
        return envAppData;
    };

    const appData = resolveRoamingAppData();
    if (!appData) return "";

    const pickStable = () => {
        const lower = path.join(appData, "discord");
        const upper = path.join(appData, "Discord");
        // Prefer the official Stable folder name if it exists.
        // If both exist (from previous runs), using the wrong one breaks loading.
        try { if (fs.existsSync(upper)) return upper; } catch {}
        try { if (fs.existsSync(lower)) return lower; } catch {}
        return upper;
    };

    // Prefer deriving channel from the actual executable name.
    // Discord can clear/override env vars; execPath is stable.
    const exe = path.basename(process.execPath || "").toLowerCase();
    if (exe === "discordptb.exe") return path.join(appData, "discordptb");
    if (exe === "discordcanary.exe") return path.join(appData, "discordcanary");
    if (exe === "discorddevelopment.exe") return path.join(appData, "discorddevelopment");
    if (exe === "discord.exe") return pickStable();

    // Fallback to environment variables.
    let c = String(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || "").toLowerCase();
    if (!c) {
        try {
            const low = String(process.execPath || "").toLowerCase();
            if (low.includes("canary")) c = "canary";
            else if (low.includes("ptb")) c = "ptb";
            else if (low.includes("development")) c = "development";
        }
        catch {}
    }
    if (!c) c = "stable";

    if (c === "ptb") return path.join(appData, "discordptb");
    if (c === "canary") return path.join(appData, "discordcanary");
    if (c === "development" || c === "dev") return path.join(appData, "discorddevelopment");
    return pickStable();
}

function getChannelBaseDir(): string {
    if (process.platform === "win32") return getWinChannelBaseDir();

    // For completeness: keep it simple and consistent with other code paths.
    if (process.platform === "darwin") {
        const home = process.env.HOME ?? "";
        const base = home ? path.join(home, "Library", "Application Support") : "";
        let c = String(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || "").toLowerCase();
        if (!c) {
            try {
                const low = String(process.execPath || "").toLowerCase();
                if (low.includes("canary")) c = "canary";
                else if (low.includes("ptb")) c = "ptb";
                else if (low.includes("development")) c = "development";
            }
            catch {}
        }
        if (!c) c = "stable";
        if (!base) return "";
        if (c === "ptb") return path.join(base, "discordptb");
        if (c === "canary") return path.join(base, "discordcanary");
        if (c === "development" || c === "dev") return path.join(base, "discorddevelopment");
        return path.join(base, "discord");
    }

    const configHome = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || "", ".config");
    let c = String(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || "").toLowerCase();
    if (!c) {
        try {
            const low = String(process.execPath || "").toLowerCase();
            if (low.includes("canary")) c = "canary";
            else if (low.includes("ptb")) c = "ptb";
            else if (low.includes("development")) c = "development";
        }
        catch {}
    }
    if (!c) c = "stable";
    if (!configHome) return "";
    if (c === "ptb") return path.join(configHome, "discordptb");
    if (c === "canary") return path.join(configHome, "discordcanary");
    if (c === "development" || c === "dev") return path.join(configHome, "discorddevelopment");
    return path.join(configHome, "discord");
}

function detectChannelIdWin(): "stable" | "ptb" | "canary" | "development" {
    try {
        const exe = path.basename(process.execPath || "").toLowerCase();
        if (exe.includes("discordptb")) return "ptb";
        if (exe.includes("discordcanary")) return "canary";
        if (exe.includes("discorddevelopment")) return "development";
    }
    catch {}

    let c = String(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || "").toLowerCase();
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
}

function resolveInAccordDir(): string {
    try {
        if (process.platform === "win32") {
            const appData = process.env.APPDATA ?? "";
            if (appData) return path.join(appData, "InAccord");
            const userProfile = process.env.USERPROFILE ?? "";
            if (userProfile) return path.join(userProfile, "AppData", "Roaming", "InAccord");
        }
    }
    catch {}
    return "";
}

function appendLog(logFile: string, msg: string) {
    try {
        if (!logFile) return;
        fs.appendFileSync(logFile, `${safeNow()} ${msg}\n`);
    }
    catch {
        // ignore
    }
}

function wait(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isDiscordUrl(url: string): boolean {
    const u = String(url || "");
    // If the URL is empty, the webContents isn't navigated/ready yet.
    // Treat this as non-Discord to avoid injecting too early (can hang/crash).
    if (!u) return false;
    const low = u.toLowerCase();
    if (low.startsWith("discord:")) return true;
    return low.includes("discord.com") || low.includes("discordapp.com");
}

function normalizeHeaderValue(v: any): string {
    if (Array.isArray(v)) return v.map((x) => String(x ?? "")).join("; ");
    return String(v ?? "");
}

function relaxCspValue(original: string): string {
    const input = String(original || "").trim();
    if (!input) return input;

    // Minimal relaxation needed for Electron executeJavaScript/script injection patterns.
    // Discord is an Electron app; we only apply this to Discord pages (see url filter).
    const addTokens = (value: string, tokens: string[]) => {
        const parts = value.split(/\s+/).filter(Boolean);
        for (const t of tokens) {
            if (!parts.includes(t)) parts.push(t);
        }
        return parts.join(" ");
    };

    const directives = input.split(";").map((d) => d.trim()).filter(Boolean);
    const map = new Map<string, string>();
    for (const d of directives) {
        const space = d.indexOf(" ");
        const name = (space === -1 ? d : d.slice(0, space)).trim().toLowerCase();
        const value = (space === -1 ? "" : d.slice(space + 1)).trim();
        if (!name) continue;
        // Keep first occurrence; Discord CSP can be huge and duplicated.
        if (!map.has(name)) map.set(name, value);
    }

    const scriptTokens = ["'unsafe-eval'", "blob:", "file:", "filesystem:", "data:"];
    const styleTokens = ["'unsafe-inline'", "blob:", "file:", "data:"];

    const defaultSrc = map.get("default-src");
    const scriptSrc = map.get("script-src") ?? defaultSrc ?? "";
    const styleSrc = map.get("style-src") ?? defaultSrc ?? "";

    map.set("script-src", addTokens(scriptSrc, scriptTokens));
    map.set("style-src", addTokens(styleSrc, styleTokens));

    // Rebuild directives preserving a stable order: default-src first if present, then the rest.
    const out: string[] = [];
    if (map.has("default-src")) out.push(`default-src ${map.get("default-src")}`.trim());
    out.push(`script-src ${map.get("script-src")}`.trim());
    out.push(`style-src ${map.get("style-src")}`.trim());

    for (const [name, value] of map.entries()) {
        if (name === "default-src" || name === "script-src" || name === "style-src") continue;
        out.push(value ? `${name} ${value}` : name);
    }

    return out.join("; ");
}

(function main() {
    const channelId = (process.platform === "win32") ? detectChannelIdWin() : "stable";
    const iaDir = resolveInAccordDir();
    const logFile = iaDir ? path.join(iaDir, `InAccord_mainhook.${channelId}.log`) : "";

    appendLog(logFile, `[mainhook] start pid=${process.pid} platform=${process.platform} channel=${channelId} iaDir=${iaDir}`);

    try {
        if (iaDir) {
            const markerPath = path.join(iaDir, `InAccord.mainhook_loaded.${channelId}.json`);
            fs.writeFileSync(markerPath, JSON.stringify({
                ts: safeNow(),
                pid: process.pid,
                platform: process.platform,
                iaDir,
                channelId
            }, null, 2));
            appendLog(logFile, `[mainhook] marker_written ${markerPath}`);
        }
    }
    catch (e: any) {
        appendLog(logFile, `[mainhook] marker_write_failed ${(e?.stack || e?.message || String(e))}`);
    }

    const rendererPreload = process.env.INACCORD_RENDERER_PRELOAD
        || (iaDir ? path.join(iaDir, `preload.${channelId}.js`) : "");

    const inAccordBundlePath = (() => {
        try {
            if (rendererPreload) {
                const dir = path.dirname(rendererPreload);
                return path.join(dir, "InAccord.js");
            }
        }
        catch {}
        return iaDir ? path.join(iaDir, `InAccord.${channelId}.js`) : "";
    })();

    appendLog(logFile, `[mainhook] rendererPreload=${rendererPreload}`);
    appendLog(logFile, `[mainhook] inAccordBundlePath=${inAccordBundlePath}`);

    // The hook's only job: ensure our renderer preload is added to Electron sessions.
    // This avoids patching Discord files and does not require Discord to honor DISCORD_PRELOAD.
    let electron: any;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        electron = require("electron");
    }
    catch (e: any) {
        appendLog(logFile, `[mainhook] require('electron') failed ${(e?.stack || e?.message || String(e))}`);
        return;
    }

    const app = electron?.app;
    const sessionMod = electron?.session;

    if (!app || !sessionMod) {
        appendLog(logFile, `[mainhook] electron missing app/session`);
        return;
    }

    // NOTE: We no longer patch CSP here.
    // Preload-based injection uses Electron APIs and does not require CSP relaxations,
    // and CSP header rewriting can significantly slow down Canary startup.

    const ensurePreloadOnSession = (ses: any, reason: string) => {
        try {
            if (!ses) {
                appendLog(logFile, `[mainhook] session missing reason=${reason}`);
                return;
            }

            // Newer Electron versions deprecate setPreloads/getPreloads in favor of
            // registerPreloadScript/getPreloadScripts. Try the new API first.
            try {
                const register = ses.registerPreloadScript;
                const getScripts = ses.getPreloadScripts;
                if (typeof register === "function") {
                    const existing = (typeof getScripts === "function") ? (getScripts.call(ses) || []) : [];
                    const already = Array.isArray(existing) && existing.some((s: any) => {
                        try {
                            const fp = String(s?.filePath || "");
                            return fp && rendererPreload && fp === rendererPreload;
                        }
                        catch {
                            return false;
                        }
                    });

                    if (!already && rendererPreload) {
                        const id = "inaccord-renderer-preload";
                        const attempts: any[] = [
                            { id, filePath: rendererPreload, type: "frame" },
                            { id, filePath: rendererPreload },
                            { filePath: rendererPreload, type: "frame" },
                            { filePath: rendererPreload }
                        ];

                        let registered = false;
                        for (const opts of attempts) {
                            try {
                                register.call(ses, opts);
                                registered = true;
                                break;
                            }
                            catch {
                                // keep trying option shapes
                            }
                        }

                        let nowHas = false;
                        try {
                            const after = (typeof getScripts === "function") ? (getScripts.call(ses) || []) : [];
                            nowHas = Array.isArray(after) && after.some((s: any) => {
                                try { return String(s?.filePath || "") === rendererPreload; } catch { return false; }
                            });
                        }
                        catch {}

                        appendLog(logFile, `[mainhook] registerPreloadScript attempted reason=${reason} registered=${registered} verified=${nowHas}`);
                    }
                    else {
                        appendLog(logFile, `[mainhook] preload already present (preloadScripts) reason=${reason}`);
                    }
                }
            }
            catch (e: any) {
                appendLog(logFile, `[mainhook] registerPreloadScript failed reason=${reason} ${(e?.stack || e?.message || String(e))}`);
            }

            // Legacy API fallback.
            if (typeof ses.setPreloads !== "function") {
                appendLog(logFile, `[mainhook] setPreloads unavailable reason=${reason}`);
                return;
            }

            const current: string[] = (typeof ses.getPreloads === "function") ? (ses.getPreloads() || []) : [];
            const next = [...new Set([...(current || []), rendererPreload].filter(Boolean))];

            // If getPreloads exists and already contains it, avoid rewriting.
            if (current && current.includes && current.includes(rendererPreload)) {
                appendLog(logFile, `[mainhook] preload already present reason=${reason}`);
                return;
            }

            ses.setPreloads(next);
            appendLog(logFile, `[mainhook] setPreloads ok reason=${reason} count=${next.length}`);
        }
        catch (e: any) {
            appendLog(logFile, `[mainhook] setPreloads failed reason=${reason} ${(e?.stack || e?.message || String(e))}`);
        }
    };

    const injectIntoWebContents = async (contents: any, reason: string) => {
        // Renderer injection is handled by the preload (preload.js) which is registered on sessions.
        // On newer Discord Canary builds, executeJavaScript() can fail with "Script failed to execute"
        // and adds noise/instability. Do not attempt main-process JS injection.
        void contents;
        void reason;
        return;

        try {
            if (!contents || typeof contents.executeJavaScript !== "function") return;
            if (!inAccordBundlePath || !fs.existsSync(inAccordBundlePath)) {
                appendLog(logFile, `[mainhook] inject skipped (bundle missing) reason=${reason} path=${inAccordBundlePath}`);
                return;
            }

            // Avoid injecting into non-Discord pages (best-effort).
            let url = "";
            try { url = String(contents.getURL?.() || ""); } catch {}
            if (!isDiscordUrl(url)) {
                appendLog(logFile, `[mainhook] inject skipped (url) reason=${reason} url=${url}`);
                return;
            }

            appendLog(logFile, `[mainhook] inject start reason=${reason} url=${url}`);
            const code = fs.readFileSync(inAccordBundlePath, "utf8");

            // Execute in the page context; this bypasses script-src file:// restrictions.
            const execPromise = Promise.resolve(contents.executeJavaScript(code, true));
            await Promise.race([
                execPromise,
                (async () => {
                        await wait(30000);
                    throw new Error("executeJavaScript timeout");
                })()
            ]);

            appendLog(logFile, `[mainhook] inject ok reason=${reason}`);

            try {
                if (channelBase) {
                    const markerPath = path.join(channelBase, "InAccord.injected.json");
                    fs.writeFileSync(markerPath, JSON.stringify({
                        ts: safeNow(),
                        pid: process.pid,
                        reason,
                        url,
                        bundlePath: inAccordBundlePath
                    }, null, 2));
                    appendLog(logFile, `[mainhook] injected_marker_written ${markerPath}`);
                }
            }
            catch (e: any) {
                appendLog(logFile, `[mainhook] injected_marker_write_failed ${(e?.stack || e?.message || String(e))}`);
            }
        }
        catch (e: any) {
            appendLog(logFile, `[mainhook] inject failed reason=${reason} ${(e?.stack || e?.message || String(e))}`);
        }
    };

    // Attach as early as possible.
    try {
        app.on("web-contents-created", (_event: any, contents: any) => {
            try {
                ensurePreloadOnSession(contents?.session, "web-contents-created");
            }
            catch {}

            try {
                // Discord's navigation lifecycle differs across channels/versions.
                // Canary can start on about:blank and later navigate without another full load.
                // Attach multiple hooks so injection eventually happens.

                const schedule = (reason: string, delayMs = 0) => {
                    try {
                        if (!delayMs) return void injectIntoWebContents(contents, reason);
                        setTimeout(() => void injectIntoWebContents(contents, reason), delayMs);
                    }
                    catch {}
                };

                contents?.once?.("did-finish-load", () => {
                    schedule("did-finish-load", 0);
                    // Small delayed retry helps when the URL becomes discord:// right after load.
                    schedule("did-finish-load+delay", 750);
                });

                contents?.on?.("dom-ready", () => {
                    schedule("dom-ready", 0);
                });

                contents?.on?.("did-navigate", () => {
                    schedule("did-navigate", 0);
                });

                contents?.on?.("did-navigate-in-page", () => {
                    schedule("did-navigate-in-page", 0);
                });
            }
            catch {}
        });
        appendLog(logFile, `[mainhook] attached web-contents-created`);
    }
    catch (e: any) {
        appendLog(logFile, `[mainhook] attach web-contents-created failed ${(e?.stack || e?.message || String(e))}`);
    }

    const applyAll = () => {
        try {
            const all = (typeof sessionMod.getAllSessions === "function") ? sessionMod.getAllSessions() : [];
            if (all && all.length) {
                for (const ses of all) ensurePreloadOnSession(ses, "getAllSessions");
            }
            // Always try the default session too.
            ensurePreloadOnSession(sessionMod.defaultSession, "defaultSession");
        }
        catch (e: any) {
            appendLog(logFile, `[mainhook] applyAll failed ${(e?.stack || e?.message || String(e))}`);
        }

        // Try injecting into any existing webContents.
        try {
            const webContents = electron?.webContents;
            const allContents = (webContents && typeof webContents.getAllWebContents === "function")
                ? webContents.getAllWebContents()
                : [];
            for (const c of allContents) {
                void injectIntoWebContents(c, "applyAll");
            }
        }
        catch (e: any) {
            appendLog(logFile, `[mainhook] applyAll injection scan failed ${(e?.stack || e?.message || String(e))}`);
        }
    };

    try {
        if (typeof app.whenReady === "function") {
            app.whenReady().then(() => {
                appendLog(logFile, `[mainhook] app.whenReady resolved`);
                applyAll();
            }).catch((e: any) => {
                appendLog(logFile, `[mainhook] app.whenReady rejected ${(e?.stack || e?.message || String(e))}`);
            });
        }
        else {
            app.on("ready", () => {
                appendLog(logFile, `[mainhook] app ready event`);
                applyAll();
            });
        }
    }
    catch (e: any) {
        appendLog(logFile, `[mainhook] ready hook failed ${(e?.stack || e?.message || String(e))}`);
    }
})();
