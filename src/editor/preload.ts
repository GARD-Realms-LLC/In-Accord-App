import electron, {ipcRenderer} from "electron";
import fs from "fs";
import path from "path";
import * as IPCEvents from "@common/constants/ipcevents";

// Build info file only exists for non-linux (for current injection)
let dataPath = "";
let userDataPath = "";
if (process.platform === "win32" || process.platform === "darwin") {
    userDataPath = electron.ipcRenderer.sendSync(IPCEvents.GET_PATH, "userData");
    // Per-channel layout: %APPDATA%\discordcanary\InAccord (etc)
    dataPath = userDataPath;
}
else dataPath = process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : path.join(process.env.HOME!, ".config"); // This will help with snap packages eventually
dataPath = path.join(dataPath, "InAccord") + "/";

function detectReleaseChannel(): string {
    const fromEnv = String(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || "").trim().toLowerCase();
    if (fromEnv) return fromEnv;

    // Prefer deriving from the Discord userData folder name.
    try {
        if (userDataPath) {
            const leaf = path.basename(userDataPath).toLowerCase();
            if (leaf === "discordptb") return "ptb";
            if (leaf === "discordcanary") return "canary";
            if (leaf === "discorddevelopment") return "development";
            if (leaf === "discord") return "stable";
        }
    }
    catch {}

    // Fallback: derive from the running executable name.
    try {
        const exe = path.basename(process.execPath || "").toLowerCase();
        if (exe.includes("canary")) return "canary";
        if (exe.includes("ptb")) return "ptb";
        if (exe.includes("development")) return "development";
    }
    catch {}

    return "stable";
}

const releaseChannel = detectReleaseChannel();
if (!process.env.DISCORD_RELEASE_CHANNEL) process.env.DISCORD_RELEASE_CHANNEL = releaseChannel;

const query = new URLSearchParams(location.search);

const type = query.get("type")!;
const filename = query.get("filename")!;

let filepath;
if (type === "custom-css") {
    filepath = path.join(dataPath, "data", releaseChannel, "custom.css");
}
else {
    filepath = path.join(dataPath, `${type}s`, filename);
}

electron.contextBridge.exposeInMainWorld("Editor", {
    type,
    filename,
    filepath,
    read() {
        return fs.readFileSync(filepath, "utf-8");
    },
    open() {
        electron.shell.openPath(filepath);
    },
    write(contents) {
        fs.writeFileSync(filepath, contents, "utf-8");
    },
    shouldShowWarning(showWarning) {
        electron.ipcRenderer.invoke(IPCEvents.EDITOR_SHOULD_SHOW_WARNING, showWarning);
    },
    readText() {
        return electron.clipboard.readText();
    },
    settings: {
        get: () => ipcRenderer.sendSync(IPCEvents.EDITOR_SETTINGS_GET),
        subscribe(listener) {
            electron.ipcRenderer.on(IPCEvents.EDITOR_SETTINGS_UPDATE, (event, settings) => {
                listener(settings);
            });
        },
        setLiveUpdate(state) {
            electron.ipcRenderer.invoke(IPCEvents.EDITOR_SETTINGS_UPDATE, state);
        }
    }
} satisfies typeof window.Editor);