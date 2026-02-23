import electron from "electron";
import path from "path";
import os from "os";

import * as IPCEvents from "@common/constants/ipcevents";

let dataPath = "";
// Discord does not provide InAccord's custom IPC listeners.
// Never call ia-get-path here; derive paths from the OS/user instead.

function normalizeReleaseChannel(input: string): string {
    const c = String(input ?? "").trim().toLowerCase();
    if (!c) return "";
    if (c === "stable" || c === "discord") return "stable";
    if (c === "ptb" || c === "discordptb") return "ptb";
    if (c === "canary" || c === "discordcanary") return "canary";
    if (c === "development" || c === "dev" || c === "discorddevelopment") return "development";
    return c;
}

function detectReleaseChannel(): string {
    // Prefer explicit overrides.
    const fromEnv = normalizeReleaseChannel(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || "");
    if (fromEnv) return fromEnv;

    // BetterDiscord-style fallback: derive from the running executable.
    try {
        const execPath = String(process.execPath || "");
        const exe = path.basename(execPath).toLowerCase();

        // Windows
        if (exe === "discordptb.exe") return "ptb";
        if (exe === "discordcanary.exe") return "canary";
        if (exe === "discorddevelopment.exe") return "development";
        if (exe === "discord.exe") return "stable";

        // macOS/Linux (or any other packaging): substring match.
        const low = execPath.toLowerCase();
        if (low.includes("canary")) return "canary";
        if (low.includes("ptb")) return "ptb";
        if (low.includes("development")) return "development";
    }
    catch {}

    return "stable";
}

const releaseChannel = detectReleaseChannel();
// Keep legacy consumers working (Discord Canary often doesn't provide this env var reliably).
if (!process.env.DISCORD_RELEASE_CHANNEL) process.env.DISCORD_RELEASE_CHANNEL = releaseChannel;

if (process.platform === "win32") {
    const resolveRoamingAppData = () => {
        const candidates: string[] = [];
        if (process.env.APPDATA) candidates.push(process.env.APPDATA);
        const userProfile = process.env.USERPROFILE ?? "";
        if (userProfile) candidates.push(path.join(userProfile, "AppData", "Roaming"));
        try {
            const home = os.homedir?.() ?? "";
            if (home) candidates.push(path.join(home, "AppData", "Roaming"));
        }
        catch {}

        for (const c of candidates) {
            try {
                if (c) return c;
            }
            catch {}
        }
        return process.env.APPDATA ?? "";
    };

    const appData = resolveRoamingAppData();
    const base = releaseChannel === "ptb" ? "discordptb" : releaseChannel === "canary" ? "discordcanary" : releaseChannel === "development" ? "discorddevelopment" : "Discord";
    dataPath = path.join(appData, base, "InAccord");
}
else if (process.platform === "darwin") {
    const home = process.env.HOME ?? "";
    const support = home ? path.join(home, "Library", "Application Support") : "";
    const base = releaseChannel === "ptb" ? "discordptb" : releaseChannel === "canary" ? "discordcanary" : releaseChannel === "development" ? "discorddevelopment" : "discord";
    dataPath = path.join(support, base, "InAccord");
}
else {
    const configHome = process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : path.join(process.env.HOME!, ".config");
    const base = releaseChannel === "ptb" ? "discordptb" : releaseChannel === "canary" ? "discordcanary" : releaseChannel === "development" ? "discorddevelopment" : "discord";
    dataPath = path.join(configHome, base, "InAccord");
}

dataPath = dataPath + path.sep;

let _settings: Record<string, Record<string, any>>;
function getSetting(category: string, key: string) {
    if (_settings) return _settings[category]?.[key];

    try {
        const settingsFile = path.resolve(dataPath, "data", releaseChannel, "settings.json");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        _settings = require(settingsFile) ?? {};
        return _settings[category]?.[key];
    }
    catch {
        _settings = {};
        return _settings[category]?.[key];
    }
}

const {exposeInMainWorld} = electron.contextBridge;

// Hold the listeners
let /** @type {Function} */ onOpened: () => void, /** @type {Function} */ onClosed: () => void;

let isOpen = false;
/** @type {boolean} */
let patchDevtoolsCallbacks: boolean = getSetting("developer", "devToolsWarning");
if (typeof patchDevtoolsCallbacks !== "boolean") patchDevtoolsCallbacks = false;

const contextBridge = {
    ...electron.contextBridge,
    exposeInMainWorld(apiKey: string, api: any) {
        if (apiKey === "DiscordNative") {
            // On macOS check if native frame is enabled
            // every other os say false
            api.window.USE_OSX_NATIVE_TRAFFIC_LIGHTS = process.platform === "darwin" && process.env.InAccord_IN_APP_TRAFFIC_LIGHTS === "false";

            api.window.setDevtoolsCallbacks(
                () => {
                    isOpen = true;
                    if (!patchDevtoolsCallbacks) onOpened?.();
                },
                () => {
                    isOpen = false;
                    if (!patchDevtoolsCallbacks) onClosed?.();
                }
            );

            api.window.setDevtoolsCallbacks = (_onOpened: () => void, _onClosed: () => void) => {
                onOpened = _onOpened;
                onClosed = _onClosed;
            };
        }

        exposeInMainWorld(apiKey, api);
    }
};

class DiscordNativePatch {
    static setDevToolsWarningState(value: boolean) {
        patchDevtoolsCallbacks = value;

        // If devtools is open
        if (isOpen) {
            // If you enable it, run the onClsoed function
            if (value) onClosed?.();
            // If its disabled, run the onOpened function
            else onOpened?.();
        }
    }

    // For native frame
    // document.body does not exist when this is ran.
    // so we have to wiat for it
    static injectCSS() {
        if (process.env.InAccord_NATIVE_FRAME === "false") return;

        // Have to use `global.` because the file is in node
        const mutationObserver = new global.MutationObserver(() => {
            if (global.document.body) {
                mutationObserver.disconnect();

                const style = global.document.createElement("style");
                style.textContent = `
                    #app-mount > div[class*=titleBar_], div[class*="-winButtons"] { display: none !important; }
                    .platform-osx nav[class*=wrapper_][class*=guilds_] {margin-top: 0;}
                    .platform-win div[class*=content_] > div[class*=sidebar_] {border-radius: 0;}
                `;

                global.document.body.append(style);
            }
        });

        mutationObserver.observe(global.document, {childList: true, subtree: true});
    }

    static patch() {
        const electronPath = require.resolve("electron");
        delete require.cache[electronPath]!.exports; // If it didn't work, try to delete existing
        require.cache[electronPath]!.exports = {...electron, contextBridge}; // Try to assign agian after deleting
    }

    static init() {
        this.injectCSS();
        this.patch();
    }
}

export default DiscordNativePatch;