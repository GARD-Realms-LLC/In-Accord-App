import fs from "fs";
import os from "os";
import path from "path";

function safeNow() {
    try {
        return new Date().toISOString();
    }
    catch {
        return "";
    }
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

function resolveRoamingAppData(): string {
    const candidates: string[] = [];
    const envAppData = process.env.APPDATA ?? "";
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
}

function getWinChannelBaseDir(): string {
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

    const exe = path.basename(process.execPath || "").toLowerCase();
    if (exe === "discordptb.exe") return path.join(appData, "discordptb");
    if (exe === "discordcanary.exe") return path.join(appData, "discordcanary");
    if (exe === "discorddevelopment.exe") return path.join(appData, "discorddevelopment");
    if (exe === "discord.exe") return pickStable();

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

function getChannelBaseDir(): string {
    if (process.platform === "win32") return getWinChannelBaseDir();

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

(function main() {
    const roaming = resolveRoamingAppData();
    const iaDir = roaming ? path.join(roaming, "InAccord") : "";
    const channelId = (process.platform === "win32") ? detectChannelIdWin() : "stable";
    const logFile = iaDir ? path.join(iaDir, `InAccord_coreloader.${channelId}.log`) : "";

    appendLog(logFile, `[coreloader] start pid=${process.pid} platform=${process.platform} channel=${channelId} iaDir=${iaDir} exec=${process.execPath}`);

    try {
        if (!iaDir) {
            appendLog(logFile, `[coreloader] no_channel_base`);
            return;
        }

        const mainhook = process.env.INACCORD_MAINHOOK || path.join(iaDir, `mainhook.${channelId}.js`);

        appendLog(logFile, `[coreloader] mainhook=${mainhook} exists=${fs.existsSync(mainhook)}`);
        if (!fs.existsSync(mainhook)) return;

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require(mainhook);

        appendLog(logFile, `[coreloader] require_mainhook ok`);
    }
    catch (e: any) {
        appendLog(logFile, `[coreloader] exception ${(e?.stack || e?.message || String(e))}`);
    }
})();
