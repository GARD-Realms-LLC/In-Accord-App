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

// src/electron/mainhook/index.ts
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_os = __toESM(require("os"));
function safeNow() {
  try {
    return (/* @__PURE__ */ new Date()).toISOString();
  } catch {
    return "";
  }
}
function getWinChannelBaseDir() {
  const envAppData = process.env.APPDATA ?? "";
  const resolveRoamingAppData = () => {
    const candidates = [];
    if (envAppData) candidates.push(envAppData);
    const userProfile = process.env.USERPROFILE ?? "";
    if (userProfile) candidates.push(import_path.default.join(userProfile, "AppData", "Roaming"));
    try {
      const home = import_os.default.homedir?.() ?? "";
      if (home) candidates.push(import_path.default.join(home, "AppData", "Roaming"));
    } catch {
    }
    for (const c2 of candidates) {
      try {
        if (c2 && import_fs.default.existsSync(c2)) return c2;
      } catch {
      }
    }
    return envAppData;
  };
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
function appendLog(logFile, msg) {
  try {
    if (!logFile) return;
    import_fs.default.appendFileSync(logFile, `${safeNow()} ${msg}
`);
  } catch {
  }
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isDiscordUrl(url) {
  const u = String(url || "");
  if (!u) return false;
  const low = u.toLowerCase();
  if (low.startsWith("discord:")) return true;
  return low.includes("discord.com") || low.includes("discordapp.com");
}
(function main() {
  const channelBase = getChannelBaseDir();
  const logFile = channelBase ? import_path.default.join(channelBase, "InAccord_mainhook.log") : "";
  appendLog(logFile, `[mainhook] start pid=${process.pid} platform=${process.platform} base=${channelBase}`);
  try {
    if (channelBase) {
      const markerPath = import_path.default.join(channelBase, "InAccord.mainhook_loaded.json");
      import_fs.default.writeFileSync(markerPath, JSON.stringify({
        ts: safeNow(),
        pid: process.pid,
        platform: process.platform,
        channelBase
      }, null, 2));
      appendLog(logFile, `[mainhook] marker_written ${markerPath}`);
    }
  } catch (e) {
    appendLog(logFile, `[mainhook] marker_write_failed ${e?.stack || e?.message || String(e)}`);
  }
  const rendererPreload = process.env.INACCORD_RENDERER_PRELOAD || (channelBase ? import_path.default.join(channelBase, "InAccord", "preload.js") : "");
  const inAccordBundlePath = (() => {
    try {
      if (rendererPreload) {
        const dir = import_path.default.dirname(rendererPreload);
        return import_path.default.join(dir, "InAccord.js");
      }
    } catch {
    }
    return channelBase ? import_path.default.join(channelBase, "InAccord", "InAccord.js") : "";
  })();
  appendLog(logFile, `[mainhook] rendererPreload=${rendererPreload}`);
  appendLog(logFile, `[mainhook] inAccordBundlePath=${inAccordBundlePath}`);
  let electron;
  try {
    electron = require("electron");
  } catch (e) {
    appendLog(logFile, `[mainhook] require('electron') failed ${e?.stack || e?.message || String(e)}`);
    return;
  }
  const app = electron?.app;
  const sessionMod = electron?.session;
  if (!app || !sessionMod) {
    appendLog(logFile, `[mainhook] electron missing app/session`);
    return;
  }
  const ensurePreloadOnSession = (ses, reason) => {
    try {
      if (!ses) {
        appendLog(logFile, `[mainhook] session missing reason=${reason}`);
        return;
      }
      try {
        const register = ses.registerPreloadScript;
        const getScripts = ses.getPreloadScripts;
        if (typeof register === "function") {
          const existing = typeof getScripts === "function" ? getScripts.call(ses) || [] : [];
          const already = Array.isArray(existing) && existing.some((s) => {
            try {
              const fp = String(s?.filePath || "");
              return fp && rendererPreload && fp === rendererPreload;
            } catch {
              return false;
            }
          });
          if (!already && rendererPreload) {
            const id = "inaccord-renderer-preload";
            const attempts = [
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
              } catch {
              }
            }
            let nowHas = false;
            try {
              const after = typeof getScripts === "function" ? getScripts.call(ses) || [] : [];
              nowHas = Array.isArray(after) && after.some((s) => {
                try {
                  return String(s?.filePath || "") === rendererPreload;
                } catch {
                  return false;
                }
              });
            } catch {
            }
            appendLog(logFile, `[mainhook] registerPreloadScript attempted reason=${reason} registered=${registered} verified=${nowHas}`);
          } else {
            appendLog(logFile, `[mainhook] preload already present (preloadScripts) reason=${reason}`);
          }
        }
      } catch (e) {
        appendLog(logFile, `[mainhook] registerPreloadScript failed reason=${reason} ${e?.stack || e?.message || String(e)}`);
      }
      if (typeof ses.setPreloads !== "function") {
        appendLog(logFile, `[mainhook] setPreloads unavailable reason=${reason}`);
        return;
      }
      const current = typeof ses.getPreloads === "function" ? ses.getPreloads() || [] : [];
      const next = [...new Set([...current || [], rendererPreload].filter(Boolean))];
      if (current && current.includes && current.includes(rendererPreload)) {
        appendLog(logFile, `[mainhook] preload already present reason=${reason}`);
        return;
      }
      ses.setPreloads(next);
      appendLog(logFile, `[mainhook] setPreloads ok reason=${reason} count=${next.length}`);
    } catch (e) {
      appendLog(logFile, `[mainhook] setPreloads failed reason=${reason} ${e?.stack || e?.message || String(e)}`);
    }
  };
  const injectIntoWebContents = async (contents, reason) => {
    void contents;
    void reason;
    return;
    try {
      if (!contents || typeof contents.executeJavaScript !== "function") return;
      if (!inAccordBundlePath || !import_fs.default.existsSync(inAccordBundlePath)) {
        appendLog(logFile, `[mainhook] inject skipped (bundle missing) reason=${reason} path=${inAccordBundlePath}`);
        return;
      }
      let url = "";
      try {
        url = String(contents.getURL?.() || "");
      } catch {
      }
      if (!isDiscordUrl(url)) {
        appendLog(logFile, `[mainhook] inject skipped (url) reason=${reason} url=${url}`);
        return;
      }
      appendLog(logFile, `[mainhook] inject start reason=${reason} url=${url}`);
      const code = import_fs.default.readFileSync(inAccordBundlePath, "utf8");
      const execPromise = Promise.resolve(contents.executeJavaScript(code, true));
      await Promise.race([
        execPromise,
        (async () => {
          await wait(3e4);
          throw new Error("executeJavaScript timeout");
        })()
      ]);
      appendLog(logFile, `[mainhook] inject ok reason=${reason}`);
      try {
        if (channelBase) {
          const markerPath = import_path.default.join(channelBase, "InAccord.injected.json");
          import_fs.default.writeFileSync(markerPath, JSON.stringify({
            ts: safeNow(),
            pid: process.pid,
            reason,
            url,
            bundlePath: inAccordBundlePath
          }, null, 2));
          appendLog(logFile, `[mainhook] injected_marker_written ${markerPath}`);
        }
      } catch (e) {
        appendLog(logFile, `[mainhook] injected_marker_write_failed ${e?.stack || e?.message || String(e)}`);
      }
    } catch (e) {
      appendLog(logFile, `[mainhook] inject failed reason=${reason} ${e?.stack || e?.message || String(e)}`);
    }
  };
  try {
    app.on("web-contents-created", (_event, contents) => {
      try {
        ensurePreloadOnSession(contents?.session, "web-contents-created");
      } catch {
      }
      try {
        const schedule = (reason, delayMs = 0) => {
          try {
            if (!delayMs) return void injectIntoWebContents(contents, reason);
            setTimeout(() => void injectIntoWebContents(contents, reason), delayMs);
          } catch {
          }
        };
        contents?.once?.("did-finish-load", () => {
          schedule("did-finish-load", 0);
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
      } catch {
      }
    });
    appendLog(logFile, `[mainhook] attached web-contents-created`);
  } catch (e) {
    appendLog(logFile, `[mainhook] attach web-contents-created failed ${e?.stack || e?.message || String(e)}`);
  }
  const applyAll = () => {
    try {
      const all = typeof sessionMod.getAllSessions === "function" ? sessionMod.getAllSessions() : [];
      if (all && all.length) {
        for (const ses of all) ensurePreloadOnSession(ses, "getAllSessions");
      }
      ensurePreloadOnSession(sessionMod.defaultSession, "defaultSession");
    } catch (e) {
      appendLog(logFile, `[mainhook] applyAll failed ${e?.stack || e?.message || String(e)}`);
    }
    try {
      const webContents = electron?.webContents;
      const allContents = webContents && typeof webContents.getAllWebContents === "function" ? webContents.getAllWebContents() : [];
      for (const c of allContents) {
        void injectIntoWebContents(c, "applyAll");
      }
    } catch (e) {
      appendLog(logFile, `[mainhook] applyAll injection scan failed ${e?.stack || e?.message || String(e)}`);
    }
  };
  try {
    if (typeof app.whenReady === "function") {
      app.whenReady().then(() => {
        appendLog(logFile, `[mainhook] app.whenReady resolved`);
        applyAll();
      }).catch((e) => {
        appendLog(logFile, `[mainhook] app.whenReady rejected ${e?.stack || e?.message || String(e)}`);
      });
    } else {
      app.on("ready", () => {
        appendLog(logFile, `[mainhook] app ready event`);
        applyAll();
      });
    }
  } catch (e) {
    appendLog(logFile, `[mainhook] ready hook failed ${e?.stack || e?.message || String(e)}`);
  }
})();
