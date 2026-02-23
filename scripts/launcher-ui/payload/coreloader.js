var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/electron/coreloader/index.ts
var import_fs = __toESM(require("fs"));
var import_os = __toESM(require("os"));
var import_path = __toESM(require("path"));
function safeNow() {
  try {
    return (/* @__PURE__ */ new Date()).toISOString();
  } catch {
    return "";
  }
}
function appendLog(logFile, msg) {
  try {
    if (!logFile) return;
    import_fs.default.appendFileSync(logFile, `${safeNow()} ${msg}
`);
  } catch {
  }
}
function resolveRoamingAppData() {
  const candidates = [];
  const envAppData = process.env.APPDATA ?? "";
  if (envAppData) candidates.push(envAppData);
  const userProfile = process.env.USERPROFILE ?? "";
  if (userProfile) candidates.push(import_path.default.join(userProfile, "AppData", "Roaming"));
  try {
    const home = import_os.default.homedir?.() ?? "";
    if (home) candidates.push(import_path.default.join(home, "AppData", "Roaming"));
  } catch {
  }
  for (const c of candidates) {
    try {
      if (c && import_fs.default.existsSync(c)) return c;
    } catch {
    }
  }
  return envAppData;
}
function getWinChannelBaseDir() {
  const appData = resolveRoamingAppData();
  if (!appData) return "";
  const pickStable = () => {
    const lower = import_path.default.join(appData, "discord");
    const upper = import_path.default.join(appData, "Discord");
    try {
      if (import_fs.default.existsSync(upper)) return upper;
    } catch {
    }
    try {
      if (import_fs.default.existsSync(lower)) return lower;
    } catch {
    }
    return upper;
  };
  const exe = import_path.default.basename(process.execPath || "").toLowerCase();
  if (exe === "discordptb.exe") return import_path.default.join(appData, "discordptb");
  if (exe === "discordcanary.exe") return import_path.default.join(appData, "discordcanary");
  if (exe === "discorddevelopment.exe") return import_path.default.join(appData, "discorddevelopment");
  if (exe === "discord.exe") return pickStable();
  let c = String(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || "").toLowerCase();
  if (!c) {
    try {
      const low = String(process.execPath || "").toLowerCase();
      if (low.includes("canary")) c = "canary";
      else if (low.includes("ptb")) c = "ptb";
      else if (low.includes("development")) c = "development";
    } catch {
    }
  }
  if (!c) c = "stable";
  if (c === "ptb") return import_path.default.join(appData, "discordptb");
  if (c === "canary") return import_path.default.join(appData, "discordcanary");
  if (c === "development" || c === "dev") return import_path.default.join(appData, "discorddevelopment");
  return pickStable();
}
function getChannelBaseDir() {
  if (process.platform === "win32") return getWinChannelBaseDir();
  if (process.platform === "darwin") {
    const home = process.env.HOME ?? "";
    const base = home ? import_path.default.join(home, "Library", "Application Support") : "";
    let c2 = String(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || "").toLowerCase();
    if (!c2) {
      try {
        const low = String(process.execPath || "").toLowerCase();
        if (low.includes("canary")) c2 = "canary";
        else if (low.includes("ptb")) c2 = "ptb";
        else if (low.includes("development")) c2 = "development";
      } catch {
      }
    }
    if (!c2) c2 = "stable";
    if (!base) return "";
    if (c2 === "ptb") return import_path.default.join(base, "discordptb");
    if (c2 === "canary") return import_path.default.join(base, "discordcanary");
    if (c2 === "development" || c2 === "dev") return import_path.default.join(base, "discorddevelopment");
    return import_path.default.join(base, "discord");
  }
  const configHome = process.env.XDG_CONFIG_HOME || import_path.default.join(process.env.HOME || "", ".config");
  let c = String(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || "").toLowerCase();
  if (!c) {
    try {
      const low = String(process.execPath || "").toLowerCase();
      if (low.includes("canary")) c = "canary";
      else if (low.includes("ptb")) c = "ptb";
      else if (low.includes("development")) c = "development";
    } catch {
    }
  }
  if (!c) c = "stable";
  if (!configHome) return "";
  if (c === "ptb") return import_path.default.join(configHome, "discordptb");
  if (c === "canary") return import_path.default.join(configHome, "discordcanary");
  if (c === "development" || c === "dev") return import_path.default.join(configHome, "discorddevelopment");
  return import_path.default.join(configHome, "discord");
}
(function main() {
  const channelBase = getChannelBaseDir();
  const logFile = channelBase ? import_path.default.join(channelBase, "InAccord_coreloader.log") : "";
  appendLog(logFile, `[coreloader] start pid=${process.pid} platform=${process.platform} base=${channelBase} exec=${process.execPath}`);
  try {
    if (!channelBase) {
      appendLog(logFile, `[coreloader] no_channel_base`);
      return;
    }
    const inAccordDir = import_path.default.join(channelBase, "InAccord");
    const mainhook = process.env.INACCORD_MAINHOOK || import_path.default.join(inAccordDir, "mainhook.js");
    appendLog(logFile, `[coreloader] mainhook=${mainhook} exists=${import_fs.default.existsSync(mainhook)}`);
    if (!import_fs.default.existsSync(mainhook)) return;
    require(mainhook);
    appendLog(logFile, `[coreloader] require_mainhook ok`);
  } catch (e) {
    appendLog(logFile, `[coreloader] exception ${e?.stack || e?.message || String(e)}`);
  }
})();
