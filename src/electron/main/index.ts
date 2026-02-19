// Absolute earliest log: prove main process is loaded at all (Stable crash diagnosis)
try {
    const fs = require("fs");
    const path = require("path");
    const absPreload = path.resolve(__dirname, "preload.js");
    fs.appendFileSync(path.join(__dirname, "fatal_crash.log"), `\n[${new Date().toISOString()}] ABSOLUTE_EARLIEST_MAIN_ENTRY\n`);
    fs.appendFileSync(path.join(__dirname, "fatal_crash.log"), `\n[${new Date().toISOString()}] ENV: ${JSON.stringify(process.env)}\n`);
    fs.appendFileSync(path.join(__dirname, "fatal_crash.log"), `\n[${new Date().toISOString()}] RESOLVED_PRELOAD: ${absPreload}\n`);
    process.env.DISCORD_PRELOAD = absPreload;
} catch {}
// Early runtime crash logger: write uncaught exceptions and unhandled rejections to fatal_crash.log
try {
    const fs = require("fs");
    const path = require("path");
    process.on("uncaughtException", (err) => {
        try { fs.appendFileSync(path.join(__dirname, "fatal_crash.log"), `\n[${new Date().toISOString()}] UNCAUGHT: ${err && err.stack || err}\n`); } catch {}
        process.exit(1);
    });
    process.on("unhandledRejection", (reason) => {
        try { fs.appendFileSync(path.join(__dirname, "fatal_crash.log"), `\n[${new Date().toISOString()}] REJECTION: ${reason && reason.stack || reason}\n`); } catch {}
    });
} catch (e) {}

import {app} from "electron";
import path from "path";
import fs from "fs";

// Diagnostic helper to log early environment details
try {
    const _fs = require("fs");
    const _path = require("path");
    try {
        const info = {
            platform: process.platform,
            argv: process.argv.slice(0, 20),
            env_DISCORD_PRELOAD: process.env.DISCORD_PRELOAD || null,
            env_DISCORD_APP_PATH: process.env.DISCORD_APP_PATH || null,
        };
        _fs.appendFileSync(_path.join(__dirname, "fatal_crash.log"), `\n[${new Date().toISOString()}] MAIN_START: ${JSON.stringify(info)}\n`);
        try {
            // Also write to workspace dist folder in case __dirname is inside an asar or not writable
            const altLog = _path.join(process.cwd(), "dist", "fatal_crash.log");
            _fs.appendFileSync(altLog, `\n[${new Date().toISOString()}] MAIN_START_CWD: ${JSON.stringify(info)}\n`);
        } catch {}
        try {
            // Also write to OS temp dir to catch early crashes when repo paths are not writable
            const _os = require("os");
            const tmpLog = _path.join(_os.tmpdir(), "InAccord_fatal_crash.log");
            _fs.appendFileSync(tmpLog, `\n[${new Date().toISOString()}] MAIN_START_TMP: ${JSON.stringify(info)}\n`);
        } catch {}
    } catch {}
} catch {}

// Detect old install and delete it
const appPath = app.getAppPath(); // Should point to app or app.asar
const oldInstall = path.resolve(appPath, "..", "app");
if (fs.existsSync(oldInstall)) {
    fs.rmdirSync(oldInstall, {recursive: true});
    app.quit();
    app.relaunch();
}

import ipc from "./modules/ipc";
import BrowserWindow from "./modules/browserwindow";
import CSP from "./modules/csp";

if (!process.argv.includes("--vanilla")) {
    process.env.NODE_OPTIONS = "--no-force-async-hooks-checks";
    app.commandLine.appendSwitch("no-force-async-hooks-checks");

    // Patch and replace the built-in BrowserWindow
    BrowserWindow.patchBrowserWindow();

    // Register all IPC events
    ipc.registerEvents();


    // Remove CSP immediately on linux since they install to discord_desktop_core still
    try {
        CSP.remove();
    }
    catch {
        // Remove when everyone is moved to core
    }
}

// Needs to run this after Discord but before ready()
if (!process.argv.includes("--vanilla")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const InAccord = require("./modules/inaccord").default;
    InAccord.disableMediaKeys();
    InAccord.ensureDirectories();
    try {
        // As a last-resort: attempt to inject renderer into any BrowserWindow that is created
        app.on("browser-window-created", (_, bw) => {
            try {
                bw.webContents.once("dom-ready", () => {
                    try {
                        // Call injectRenderer but don't await to avoid blocking
                        InAccord.injectRenderer(bw).catch(() => {});
                    }
                    catch (e) {
                        try { require("fs").appendFileSync(require("path").join(__dirname, "fatal_crash.log"), `\n[${new Date().toISOString()}] INJECTION_ERROR: ${e && e.stack || e}\n`); } catch {}
                    }
                });
            }
            catch (e) {
                try { require("fs").appendFileSync(require("path").join(__dirname, "fatal_crash.log"), `\n[${new Date().toISOString()}] BROWSER_WINDOW_CREATED_HANDLER_ERROR: ${e && e.stack || e}\n`); } catch {}
            }
        });
    }
    catch (e) {}
}