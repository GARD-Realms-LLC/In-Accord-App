import fs from "fs";
import path from "path";
import electron, {BrowserWindow} from "electron";
import {spawn} from "child_process";

import ReactDevTools from "./reactdevtools";
import * as IPCEvents from "@common/constants/ipcevents";

// Small safe logger to help diagnose startup/injection issues when Discord exits too fast to read
function safeLog(message: string) {
    try {
        const logPath = path.join(__dirname, "fatal_crash.log");
        try { fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] ${message}`); } catch {}
        try {
            // Also attempt to write into the InAccord data folder (userData sibling) so users can access logs
            const alt = path.join(iaFolder || (electron.app.getPath("userData") + "/.."), "InAccord", "fatal_crash.log");
            fs.appendFileSync(alt, `\n[${new Date().toISOString()}] ${message}`);
        } catch {}
    }
    catch {
        // ignore
    }
}

// Build info file only exists for non-linux (for current injection)
const appPath = electron.app.getAppPath();
const buildInfoFile = path.resolve(appPath, "..", "build_info.json");

// Locate data path to find transparency settings
let iaFolder = "";
if (process.platform === "win32" || process.platform === "darwin") iaFolder = path.join(electron.app.getPath("userData"), "..");
else iaFolder = process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : path.join(process.env.HOME!, ".config"); // This will help with snap packages eventually
iaFolder = path.join(iaFolder, "InAccord") + "/";

let hasCrashed = false;
// Track injection attempts per BrowserWindow to avoid infinite retry loops
const injectionAttempts: WeakMap<BrowserWindow, number> = new WeakMap();
export default class InAccord {
    static _settings: Record<string, Record<string, any>>;

    static getSetting(category: string, key: string) {
        if (this._settings) return this._settings[category]?.[key];

        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const buildInfo = require(buildInfoFile);
            const settingsFile = path.resolve(iaFolder, "data", buildInfo.releaseChannel, "settings.json");

            // eslint-disable-next-line @typescript-eslint/no-require-imports
            this._settings = require(settingsFile) ?? {};
            safeLog(`Loaded settings file for channel=${buildInfo.releaseChannel}: ${settingsFile}`);
            return this._settings[category]?.[key];
        }
        catch {
            this._settings = {};
            safeLog(`Failed to load settings for category=${category} key=${key}; falling back to defaults`);
            return this._settings[category]?.[key];
        }
    }

    static ensureDirectories() {
        const dataFolder = path.join(iaFolder, "data");
        const backupFolder = path.join(iaFolder, "backup");
        const backupsFolder = path.join(iaFolder, "backups");
        if (!fs.existsSync(iaFolder)) fs.mkdirSync(iaFolder);
        if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder);
        if (!fs.existsSync(path.join(dataFolder, "stable"))) fs.mkdirSync(path.join(dataFolder, "stable"));
        if (!fs.existsSync(path.join(dataFolder, "canary"))) fs.mkdirSync(path.join(dataFolder, "canary"));
        if (!fs.existsSync(path.join(dataFolder, "ptb"))) fs.mkdirSync(path.join(dataFolder, "ptb"));
        if (!fs.existsSync(path.join(dataFolder, "development"))) fs.mkdirSync(path.join(dataFolder, "development"));
        if (!fs.existsSync(backupFolder) && fs.existsSync(backupsFolder)) fs.mkdirSync(backupFolder);
        if (!fs.existsSync(backupFolder)) fs.mkdirSync(backupFolder);
        if (!fs.existsSync(backupsFolder)) fs.mkdirSync(backupsFolder);
        if (!fs.existsSync(path.join(iaFolder, "plugins"))) fs.mkdirSync(path.join(iaFolder, "plugins"));
        if (!fs.existsSync(path.join(iaFolder, "themes"))) fs.mkdirSync(path.join(iaFolder, "themes"));
    }

    static async injectRenderer(browserWindow: BrowserWindow) {
        const location = path.join(__dirname, "InAccord.js");
        if (!fs.existsSync(location)) {
            safeLog(`InAccord renderer bundle not found at ${location}`);
            return;
        }

        let content: string;
        try {
            content = fs.readFileSync(location).toString();
        }
        catch (err) {
            safeLog(`Failed to read InAccord renderer bundle at ${location}: ${err && err.stack || err}`);
            return;
        }

        safeLog(`Injecting renderer bundle into window id=${(browserWindow as any).id || 'unknown'}`);

        // Before injecting, check whether the renderer has its webpack chunk array
        // available. If not, retry a few times with a delay.
        try {
            const attempts = injectionAttempts.get(browserWindow) ?? 0;
            const ready = await browserWindow.webContents.executeJavaScript("typeof window !== 'undefined' && !!window.webpackChunkdiscord_app && typeof window.webpackChunkdiscord_app.push === 'function'", true).catch(() => false);
            const hasPreloadFn = await browserWindow.webContents.executeJavaScript("typeof window !== 'undefined' && typeof window.InAccordPreload === 'function'", true).catch(() => false);
            if (!ready || !hasPreloadFn) {
                if (!hasPreloadFn) safeLog('Renderer missing InAccordPreload function, will retry');
                if (!ready) {
                    if (attempts < 10) {
                        injectionAttempts.set(browserWindow, attempts + 1);
                        safeLog(`Renderer not ready for injection (attempt ${attempts + 1}), scheduling retry`);
                        setTimeout(() => this.injectRenderer(browserWindow), 1000);
                        return;
                    }
                    safeLog(`Renderer not ready after ${attempts} attempts, aborting inject`);
                    return;
                }
                // If only preload function is missing but webpack is ready, retry briefly
                injectionAttempts.set(browserWindow, attempts + 1);
                if ((injectionAttempts.get(browserWindow) ?? 0) <= 10) {
                    safeLog(`Preload function missing, retrying injection (attempt ${injectionAttempts.get(browserWindow)})`);
                    setTimeout(() => this.injectRenderer(browserWindow), 500);
                    return;
                }
                safeLog(`Preload function not available after retries, aborting inject`);
                return;
            }
        } catch (checkErr) {
            safeLog(`Error while checking renderer readiness: ${checkErr && checkErr.stack || checkErr}`);
        }

        try {
            // Encode the renderer bundle as base64 to avoid breaking the wrapper when the bundle
            // contains template literals or backticks. The renderer will decode and eval it.
            const b64 = Buffer.from(content, 'utf8').toString('base64');
            const wrapper = `
                (function(){
                    try {
                        const src = atob('${b64}');
                        (function(){ eval(src); }).call(window);
                        return { success: true };
                    } catch(error) {
                        try { console.error(error); } catch {}
                        return { success: false, message: (error && (error.message || String(error))) || 'unknown', stack: (error && error.stack) || null };
                    }
                })();
                //# sourceURL=InAccord/InAccord.js
            `;
            const result = await browserWindow.webContents.executeJavaScript(wrapper, true);
            if (!result || !result.success) {
                safeLog(`Injection of renderer bundle returned failure: ${result && (result.message || JSON.stringify(result))}`);
                if (result && result.stack) safeLog(`Injection stack: ${result.stack}`);
                return;
            }
        } catch (err) {
            safeLog(`Execution error while injecting renderer bundle: ${err && err.stack || err}`);
            return;
        }
    }

    static setup(browserWindow: BrowserWindow) {

        // Setup some useful vars to avoid blocking IPC calls
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            process.env.DISCORD_RELEASE_CHANNEL = require(buildInfoFile).releaseChannel;
            safeLog(`Detected release channel: ${process.env.DISCORD_RELEASE_CHANNEL}`);
        }
        catch {
            process.env.DISCORD_RELEASE_CHANNEL = "stable";
            safeLog(`build_info.json missing, defaulting release channel to stable`);
        }

        // @ts-expect-error adding new property, don't want to override object
        process.env.DISCORD_PRELOAD = browserWindow.__originalPreload;
        process.env.DISCORD_APP_PATH = appPath;
        process.env.DISCORD_USER_DATA = electron.app.getPath("userData");
        process.env.InAccord_DATA_PATH = iaFolder;
        process.env.inaccord_BACKUP_FOLDER = "backup";
        // Backward compatibility for older renderer code expecting lowercase key
        process.env.inaccord_DATA_PATH = iaFolder;

        // When DOM is avialable, pass the renderer over the wall
        browserWindow.webContents.on("dom-ready", () => {
            // Temporary fix for new canary/ptb changes
            if (!hasCrashed) return setTimeout(() => this.injectRenderer(browserWindow), 1000);

            // If a previous crash was detected, show a message explianing why ia isn't there
            electron.dialog.showMessageBox({
                title: "Discord Crashed",
                type: "warning",
                message: "Something crashed your Discord Client",
                detail: "InAccord has automatically disabled itself just in case. To enable it agian, restart Discord or click the button below.\n\nThis may have been caused by a plugin. Try moving all of your plugins outside the plugin folder and see if Discord still crashed.",
                buttons: ["Try Agian", "Open Plugins Folder", "Cancel"],
            }).then((result) => {
                if (result.response === 0) {
                    electron.app.relaunch();
                    electron.app.exit();
                }
                if (result.response === 1) {
                    if (process.platform === "win32") spawn("explorer.exe", [path.join(iaFolder, "plugins")]);
                    else electron.shell.openPath(path.join(iaFolder, "plugins"));
                }
            });
            hasCrashed = false;
        });

        // This is used to alert renderer code to onSwitch events
        browserWindow.webContents.on("did-navigate-in-page", () => {
            browserWindow.webContents.send(IPCEvents.NAVIGATE);
        });

        browserWindow.webContents.on("render-process-gone", () => {
            hasCrashed = true;
            safeLog(`Renderer process gone for window (hasCrashed set).`);
        });

        // Seems to be windows exclusive. MacOS requires a build plist change
        if (electron.app.setAsDefaultProtocolClient("InAccord")) {
            // If application was opened via protocol, set process.env.InAccord_PROTOCOL
            const protocol = process.argv.find((arg) => arg.startsWith("InAccord://"));
            if (protocol) {
                process.env.InAccord_PROTOCOL = protocol;
            }

            // I think this is how it works on MacOS
            // But cant work still because of a build plist needs changed (I think?)
            electron.app.on("open-url", (_, url) => {
                if (url.startsWith("InAccord://")) {
                    browserWindow.webContents.send(IPCEvents.HANDLE_PROTOCOL, url);
                }
            });

            electron.app.on("second-instance", (_, argv) => {
                // Ignore multi instance
                if (argv.includes("--multi-instance")) return;

                const url = argv.find((arg) => arg.startsWith("InAccord://"));

                if (url) {
                    browserWindow.webContents.send(IPCEvents.HANDLE_PROTOCOL, url);
                }
            });
        }
    }

    static disableMediaKeys() {
        if (!InAccord.getSetting("general", "mediaKeys")) return;
        const originalDisable = electron.app.commandLine.getSwitchValue("disable-features") || "";
        electron.app.commandLine.appendSwitch("disable-features", `${originalDisable ? "," : ""}HardwareMediaKeyHandling,MediaSessionService`);
    }
}

if (InAccord.getSetting("developer", "reactDevTools")) {
    electron.app.whenReady().then(async () => {
        await ReactDevTools.install(iaFolder);
    });
}

// eslint-disable-next-line accessor-piars
Object.defineProperty(global, "appSettings", {
    set(setting) {
        setting.set("DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING", true);
        if (InAccord.getSetting("window", "removeMinimumSize")) {
            setting.set("MIN_WIDTH", 0);
            setting.set("MIN_HEIGHT", 0);
        }
        else {
            setting.set("MIN_WIDTH", 940);
            setting.set("MIN_HEIGHT", 500);
        }
        delete global.appSettings;
        global.appSettings = setting;
    },
    configurable: true,
    enumerable: false
});

declare global {
    // eslint-disable-next-line no-var
    var appSettings: any;
}
