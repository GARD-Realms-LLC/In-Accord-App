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
function detectChannelIdWin() {
  try {
    const exe = import_path.default.basename(process.execPath || "").toLowerCase();
    if (exe.includes("discordptb")) return "ptb";
    if (exe.includes("discordcanary")) return "canary";
    if (exe.includes("discorddevelopment")) return "development";
  } catch {
  }
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
  if (c === "ptb") return "ptb";
  if (c === "canary") return "canary";
  if (c === "development" || c === "dev") return "development";
  return "stable";
}
(function main() {
  const iaDir = __dirname;
  const channelId = process.platform === "win32" ? detectChannelIdWin() : "stable";
  const logFile = iaDir ? import_path.default.join(iaDir, `InAccord_coreloader.${channelId}.log`) : "";
  appendLog(logFile, `[coreloader] start pid=${process.pid} platform=${process.platform} channel=${channelId} iaDir=${iaDir} exec=${process.execPath}`);
  try {
    if (!iaDir) {
      appendLog(logFile, `[coreloader] no_channel_base`);
      return;
    }
    const mainhookChannel = import_path.default.join(iaDir, `mainhook.${channelId}.js`);
    const mainhookGeneric = import_path.default.join(iaDir, "mainhook.js");
    const mainhook = process.env.INACCORD_MAINHOOK || (import_fs.default.existsSync(mainhookChannel) ? mainhookChannel : mainhookGeneric);
    appendLog(logFile, `[coreloader] mainhook=${mainhook} exists=${import_fs.default.existsSync(mainhook)}`);
    if (!import_fs.default.existsSync(mainhook)) return;
    require(mainhook);
    appendLog(logFile, `[coreloader] require_mainhook ok`);
  } catch (e) {
    appendLog(logFile, `[coreloader] exception ${e?.stack || e?.message || String(e)}`);
  }
})();
