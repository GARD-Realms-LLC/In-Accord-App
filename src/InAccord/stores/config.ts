import Store from "./base";

type RuntimeProcess = {
    platform?: string;
    cwd?: () => string;
    env?: Record<string, string | undefined>;
};

type PreloadApi = any;

function getPreloadApi(): PreloadApi | null {
    try {
        const fn: any = (globalThis as any).InAccordPreload;
        if (typeof fn === "function") return fn();
    }
    catch {}
    return null;
}

function joinPath(...parts: string[]) {
    const api = getPreloadApi();
    const join = api?.path?.join;
    if (typeof join === "function") return join(...parts);
    return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

const runtimeProcess: RuntimeProcess = (globalThis as any).process ?? {
    platform: typeof navigator !== "undefined" ? (navigator.userAgent.includes("Mac") ? "darwin" : navigator.userAgent.includes("Win") ? "win32" : "linux") : "linux",
    cwd: () => ".",
    env: {}
};

const env = runtimeProcess.env ?? {};

function getDiscordNativePath(name: string): string {
    try {
        const fn: any = (window as any)?.DiscordNative?.app?.getPath;
        if (typeof fn !== "function") return "";
        const v = fn(name);
        return (typeof v === "string") ? v : "";
    }
    catch {
        return "";
    }
}

function getDiscordUserDataPath(): string {
    // Prefer explicit env (when present), otherwise use Discord's native API.
    return String(env.DISCORD_USER_DATA ?? "") || getDiscordNativePath("userData") || "";
}

function getDiscordAppDataPath(): string {
    // Roaming appData path (on Windows this is %APPDATA% which is also Discord userData).
    return String(env.APPDATA ?? "") || getDiscordNativePath("appData") || "";
}

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
    // BetterDiscord-style: native channel first.
    try {
        const native = window?.DiscordNative?.app?.getReleaseChannel?.();
        const normalized = normalizeReleaseChannel(String(native ?? ""));
        if (normalized) return normalized;
    }
    catch {}

    // Explicit env overrides.
    const fromEnv = normalizeReleaseChannel(String((env as any).INACCORD_RELEASE_CHANNEL ?? env.DISCORD_RELEASE_CHANNEL ?? ""));
    if (fromEnv) return fromEnv;

    // Derive from the userData folder name when available.
    try {
        const userData = String(env.DISCORD_USER_DATA ?? "");
        if (userData) {
            const leaf = userData.replace(/[\\/]+$/, "").split(/[\\/]/).pop()?.toLowerCase() ?? "";
            if (leaf === "discordptb") return "ptb";
            if (leaf === "discordcanary") return "canary";
            if (leaf === "discorddevelopment") return "development";
            if (leaf === "discord") return "stable";
        }
    }
    catch {}

    // Derive from execPath as a final fallback.
    try {
        const execPath = String((runtimeProcess as any).execPath ?? "");
        const low = execPath.toLowerCase();
        if (low.includes("canary")) return "canary";
        if (low.includes("ptb")) return "ptb";
        if (low.includes("development")) return "development";
    }
    catch {}

    return "stable";
}

const detectedReleaseChannel = detectReleaseChannel();

function ensureDirectory(dir: string) {
    if (!dir) return;
    const api = getPreloadApi();
    const fsApi = api?.filesystem;
    try {
        if (fsApi && typeof fsApi.exists === "function" && typeof fsApi.createDirectory === "function") {
            if (!fsApi.exists(dir)) fsApi.createDirectory(dir, {recursive: true});
        }
    }
    catch {
        // renderer-only mode: ignore
    }
}

function resolveDiscordBasePath() {
    if (runtimeProcess.platform === "win32") {
        // On Windows, Discord userData lives directly under %APPDATA%\discord(canary|ptb|...)
        // so userData is the best source of truth.
        const userData = getDiscordUserDataPath();
        if (userData) return userData;

        const appData = getDiscordAppDataPath();
        const releaseChannel = detectedReleaseChannel;

        if (!appData) return "";

        if (releaseChannel === "ptb") return joinPath(appData, "discordptb");
        if (releaseChannel === "canary") return joinPath(appData, "discordcanary");
        if (releaseChannel === "development" || releaseChannel === "dev") return joinPath(appData, "discorddevelopment");
        return joinPath(appData, "Discord");
    }

    if (runtimeProcess.platform === "darwin") {
        const userData = getDiscordUserDataPath();
        if (userData) return userData;

        const home = env.HOME ?? "";
        const releaseChannel = detectedReleaseChannel;
        if (!home) return "";
        const base = joinPath(home, "Library", "Application Support");

        if (releaseChannel === "ptb") return joinPath(base, "discordptb");
        if (releaseChannel === "canary") return joinPath(base, "discordcanary");
        if (releaseChannel === "development" || releaseChannel === "dev") return joinPath(base, "discorddevelopment");
        return joinPath(base, "discord");
    }

    const userData = getDiscordUserDataPath();
    if (userData) return userData;

    const configHome = env.XDG_CONFIG_HOME || joinPath(env.HOME ?? "", ".config");
    const releaseChannel = detectedReleaseChannel;
    if (!configHome) return "";
    if (releaseChannel === "ptb") return joinPath(configHome, "discordptb");
    if (releaseChannel === "canary") return joinPath(configHome, "discordcanary");
    if (releaseChannel === "development" || releaseChannel === "dev") return joinPath(configHome, "discorddevelopment");
    return joinPath(configHome, "discord");
}

function resolveInAccordBasePath() {
    if (runtimeProcess.platform === "win32") {
        // Prefer channel-specific Discord userData (BetterDiscord-style).
        const userData = getDiscordUserDataPath();
        if (userData) return joinPath(userData, "InAccord");

        const appData = getDiscordAppDataPath();
        if (!appData) return "";

        // Fallback: derive Discord base dir from detected channel.
        if (detectedReleaseChannel === "ptb") return joinPath(appData, "discordptb", "InAccord");
        if (detectedReleaseChannel === "canary") return joinPath(appData, "discordcanary", "InAccord");
        if (detectedReleaseChannel === "development") return joinPath(appData, "discorddevelopment", "InAccord");
        return joinPath(appData, "Discord", "InAccord");
    }

    if (runtimeProcess.platform === "darwin") {
        const userData = getDiscordUserDataPath();
        if (userData) return joinPath(userData, "InAccord");

        const home = env.HOME ?? "";
        if (!home) return "";
        const base = joinPath(home, "Library", "Application Support");

        if (detectedReleaseChannel === "ptb") return joinPath(base, "discordptb", "InAccord");
        if (detectedReleaseChannel === "canary") return joinPath(base, "discordcanary", "InAccord");
        if (detectedReleaseChannel === "development") return joinPath(base, "discorddevelopment", "InAccord");
        return joinPath(base, "discord", "InAccord");
    }

    const userData = getDiscordUserDataPath();
    if (userData) return joinPath(userData, "InAccord");

    const configHome = env.XDG_CONFIG_HOME || joinPath(env.HOME ?? "", ".config");
    if (!configHome) return "";

    if (detectedReleaseChannel === "ptb") return joinPath(configHome, "discordptb", "InAccord");
    if (detectedReleaseChannel === "canary") return joinPath(configHome, "discordcanary", "InAccord");
    if (detectedReleaseChannel === "development") return joinPath(configHome, "discorddevelopment", "InAccord");
    return joinPath(configHome, "discord", "InAccord");
}

function resolveIADataPath() {
    const fromEnv = env.InAccord_DATA_PATH ?? env.inaccord_DATA_PATH ?? "";
    if (fromEnv) return fromEnv;

    const iaBase = resolveInAccordBasePath();
    if (iaBase) return iaBase;

    const userData = getDiscordUserDataPath();
    if (userData) return joinPath(userData, "InAccord");

    const discordBase = resolveDiscordBasePath();
    if (discordBase) return joinPath(discordBase, "InAccord");

    return joinPath((runtimeProcess.cwd?.() ?? "."), "InAccord");
}

const iaDataPath = resolveIADataPath();
const backupFolderName = env.inaccord_BACKUP_FOLDER ?? "backup";


export default new class ConfigStore extends Store {
    constructor() {
        super();
        this.ensurePaths();
    }

    data = {
        branch: env.__BRANCH__ ?? "unknown",
        commit: env.__COMMIT__ ?? "unknown",
        build: env.__BUILD__ ?? "unknown",
        version: env.__VERSION__ ?? "0.0.0",

        // TODO: asynchronously get these from the mian process instead of hacky env vars
        appPath: env.DISCORD_APP_PATH!,
        userData: env.DISCORD_USER_DATA!,
        iaPath: iaDataPath,
        dataPath: joinPath(iaDataPath, "data"),
        backupPath: joinPath(iaDataPath, backupFolderName),
        pluginsPath: joinPath(iaDataPath, "plugins"),
        themesPath: joinPath(iaDataPath, "themes"),
        channelPath: joinPath(iaDataPath, "data", detectedReleaseChannel),
    };

    ensurePaths() {
        ensureDirectory(this.data.iaPath);
        ensureDirectory(this.data.dataPath);
        ensureDirectory(this.data.backupPath);
        ensureDirectory(this.data.pluginsPath);
        ensureDirectory(this.data.themesPath);
        ensureDirectory(this.data.channelPath);
    }

    get(id: keyof typeof this.data) {
        return this.data[id];
    }

    set(id: keyof typeof this.data, value: string) {
        this.data[id] = value;
        this.emitChange();
    }

    get isDevelopment() {return this.data.build !== "production";}
    get isCanary() {return this.data.branch !== "main";}
};