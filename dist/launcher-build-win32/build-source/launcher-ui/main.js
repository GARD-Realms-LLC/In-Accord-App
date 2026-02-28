/* eslint-disable brace-style, no-empty, no-unused-vars, operator-linebreak */

// InAccord Launcher (Electron portable) - main process
// Purpose: provide IPC for the launcher UI (scripts/launcher-ui/index.html)
// and perform BetterDiscord-shaped payload install + core patching.

// Must be set before Electron spins up child processes.
try {if (!process.env.ELECTRON_DISABLE_GPU) process.env.ELECTRON_DISABLE_GPU = "1";} catch {}
try {if (!process.env.ELECTRON_ENABLE_LOGGING) process.env.ELECTRON_ENABLE_LOGGING = "1";} catch {}

const electron = require("electron");
const {app, BrowserWindow, ipcMain, dialog, clipboard, shell} = electron;
const fs = require("fs");
const path = require("path");
const os = require("os");
const child_process = require("child_process");

// Optional dependency: only used for app.asar patching.
let asar = null;
try {asar = require("asar");} catch {}
try {if (!asar) asar = require("@electron/asar");} catch {}

const CORE_PATCH_MARKER = "INACCORD_CORE_PATCH_BD_STYLE";
const ASAR_PATCH_MARKER = "INACCORD_ASAR_PATCH_v2";

function safeNow() {
  try {return new Date().toISOString();} catch {return "";}
}

function safeJson(v) {
  try {return JSON.stringify(v, null, 2);} catch {return String(v);}
}

function statSafe(p) {
  try {return (p && fs.existsSync(p)) ? fs.statSync(p) : null;} catch {return null;}
}

function getLauncherLogsDir() {
  // Logs live next to the portable EXE directory.
  try {
    const portableDir = String(process.env.PORTABLE_EXECUTABLE_DIR || "");
    if (portableDir) return portableDir;
  } catch {}

  try {
    const exe = String(process.execPath || "");
    const exeDir = exe ? path.dirname(exe) : "";
    if (exeDir) return exeDir;
  } catch {}

  return __dirname;
}

// Read the numeric build sequence stored next to the portable EXE.
function getBuildSeq() {
  try {
    const exeDir = path.dirname(String(process.execPath || "")) || '';
    const seqPath = exeDir ? path.join(exeDir, 'InAccord.Launcher.build-seq.txt') : '';
    if (seqPath && fs.existsSync(seqPath)) {
      const t = String(fs.readFileSync(seqPath, 'utf8') || '').trim();
      const n = Number.parseInt(t, 10);
      if (Number.isFinite(n)) return String(n);
    }
  } catch {}
  return null;
}

// Improved build-sequence retrieval: try sequence file, then app version (patch number),
// then package.json inside resources. Returns string or null.
function getBuildSeq() {
  try {
    // 1) explicit build-seq file next to EXE or portable bundle dir (try multiple dirs and both common names)
    const portableDir = String(process.env.PORTABLE_EXECUTABLE_DIR || '');
    const exeDir = path.dirname(String(process.execPath || '')) || '';
    const tryDirs = [portableDir, exeDir, __dirname].filter(Boolean);
    const seqNames = ['In-Accord.Launcher.build-seq.txt', 'InAccord.Launcher.build-seq.txt'];
    try {
      for (const d of tryDirs) {
        for (const name of seqNames) {
          const seqPath = d ? path.join(d, name) : '';
          try {
            if (seqPath && fs.existsSync(seqPath)) {
              const t = String(fs.readFileSync(seqPath, 'utf8') || '').trim();
              const n = Number.parseInt(t, 10);
              if (Number.isFinite(n)) {
                try { bootLog(`[build-seq] read ${seqPath} => ${String(n)}`); } catch {}
                return String(n);
              }
            }
          } catch {}
        }
      }
    } catch {}

    // 2) try Electron app version (common when build writes version into package.json)
    try {
      if (app && typeof app.getVersion === 'function') {
        const v = String(app.getVersion() || '').trim();
        if (v) {
          const parts = v.split('.');
          if (parts.length >= 3) {
            const last = Number.parseInt(parts[2], 10);
            if (Number.isFinite(last)) return String(last);
          }
          return v;
        }
      }
    } catch {}

    // 3) try reading package.json from resources (app.asar) as last resort
    try {
      const resPkgPaths = [
        path.join(process.resourcesPath || '', 'app.asar', 'package.json'),
        path.join(process.resourcesPath || '', 'package.json')
      ];
      for (const p of resPkgPaths) {
        try {
          if (p && fs.existsSync(p)) {
            const pj = JSON.parse(fs.readFileSync(p, 'utf8') || '{}');
            if (pj && pj.version) {
              const parts = String(pj.version).split('.');
              if (parts.length >= 3) {
                const last = Number.parseInt(parts[2], 10);
                if (Number.isFinite(last)) return String(last);
              }
              return String(pj.version);
            }
          }
        } catch {}
      }
    } catch {}
  } catch {}
  return null;
}

function bootLog(line) {
  try {
    const outDir = getLauncherLogsDir();
    const out = path.join(outDir, "launcher-boot.log");
    fs.appendFileSync(out, `${safeNow()} ${String(line || "")}\n`);
  } catch {}
}

// Crash hardening for systems where GPU process cannot start.
try {app.disableHardwareAcceleration();} catch {}
try {app.commandLine.appendSwitch("disable-gpu");} catch {}
try {app.commandLine.appendSwitch("disable-gpu-compositing");} catch {}
try {app.commandLine.appendSwitch("use-gl", "swiftshader");} catch {}
try {app.commandLine.appendSwitch("use-angle", "swiftshader");} catch {}
try {app.commandLine.appendSwitch("no-sandbox");} catch {}
try {app.commandLine.appendSwitch("disable-gpu-sandbox");} catch {}
try {app.commandLine.appendSwitch("disable-gpu-watchdog");} catch {}
try {app.commandLine.appendSwitch("disable-gpu-process-crash-limit");} catch {}

try {
  bootLog(`[startup] pid=${process.pid} execPath=${String(process.execPath || "")} portableDir=${String(process.env.PORTABLE_EXECUTABLE_DIR || "")}`);
} catch {}

// Ensure only a single instance of the launcher runs. Subsequent invocations
// will notify the primary instance (via 'second-instance') and then exit.
try {
  try {
    const gotLock = (typeof app.requestSingleInstanceLock === 'function') ? app.requestSingleInstanceLock() : true;
    if (!gotLock) {
      try { bootLog('[single-instance] second instance detected - exiting'); } catch {}
      try { app.quit(); } catch {}
    } else {
      try {
        app.on('second-instance', (event, argv, workingDir) => {
          try { bootLog(`[single-instance] second-instance invoked argv=${safeJson(argv)} cwd=${String(workingDir||'')}`); } catch {}
          try {
            if (mainWindow) {
              try { if (mainWindow.isMinimized && mainWindow.isMinimized()) mainWindow.restore(); } catch {}
              try { mainWindow.show(); mainWindow.focus(); } catch {}
            }
            // Ensure only one tray exists (primary instance manages tray lifecycle)
          } catch {}
        });
      } catch (e) { try { bootLog(`[single-instance listen failed] ${String(e && e.stack ? e.stack : e)}`); } catch {} }
    }
  } catch (e) { try { bootLog(`[single-instance check failed] ${String(e && e.stack ? e.stack : e)}`); } catch {} }
} catch {}

// Ensure Windows AppUserModelID is set so the tray icon and notification area map to our product.
try {
  // persistent SID ensures the AppUserModelID is stable across restarts and builds
  let persistentSid = null;
  function uuidv4() {
    // simple RFC4122 v4 UUID generator
    try {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    } catch { return null; }
  }

  function getSidPath() {
    try {
      const exeDir = String(process.env.PORTABLE_EXECUTABLE_DIR || '') || path.dirname(String(process.execPath || '')) || '';
      if (exeDir) return path.join(exeDir, 'In-Accord.Launcher.sid.txt');
    } catch {}
    try { return path.join(__dirname, 'In-Accord.Launcher.sid.txt'); } catch { return null; }
  }

  function getPersistentSid() {
    try {
      const p = getSidPath();
      if (!p) return null;
      try { if (fs.existsSync(p)) { const t = String(fs.readFileSync(p, 'utf8') || '').trim(); if (t) return t; } } catch {}
      const id = uuidv4();
      if (id) {
        try { fs.writeFileSync(p, String(id), { encoding: 'utf8' }); } catch {}
        return id;
      }
    } catch {}
    return null;
  }
  try { persistentSid = getPersistentSid(); } catch {}
  try { if (typeof app.setAppUserModelId === 'function') app.setAppUserModelId('com.in-accord.launcher' + (persistentSid ? ('.' + persistentSid) : '')); } catch {}
  try { if (app && typeof app.name === 'string') app.name = 'In-Accord'; } catch {}
} catch {}

process.on("uncaughtException", (err) => {
  bootLog(`[uncaughtException] ${String(err && err.stack ? err.stack : err)}`);
});

process.on("unhandledRejection", (reason) => {
  bootLog(`[unhandledRejection] ${String(reason && reason.stack ? reason.stack : reason)}`);
});

function getRoamingAppDataPath() {
  const candidates = [];
  try {if (process.env.APPDATA) candidates.push(String(process.env.APPDATA));} catch {}
  try {
    const up = String(process.env.USERPROFILE || "");
    if (up) candidates.push(path.join(up, "AppData", "Roaming"));
  } catch {}
  try {
    const home = os.homedir?.() ?? "";
    if (home) candidates.push(path.join(home, "AppData", "Roaming"));
  } catch {}

  for (const c of candidates) {
    try {if (c && fs.existsSync(c)) return c;} catch {}
  }

  try {return String(process.env.APPDATA || "");} catch {return "";}
}

function getLocalAppDataPath() {
  const candidates = [];
  try {if (process.env.LOCALAPPDATA) candidates.push(String(process.env.LOCALAPPDATA));} catch {}
  try {
    const up = String(process.env.USERPROFILE || "");
    if (up) candidates.push(path.join(up, "AppData", "Local"));
  } catch {}
  try {
    const home = os.homedir?.() ?? "";
    if (home) candidates.push(path.join(home, "AppData", "Local"));
  } catch {}

  for (const c of candidates) {
    try {if (c && fs.existsSync(c)) return c;} catch {}
  }

  try {return String(process.env.LOCALAPPDATA || "");} catch {return "";}
}

function getChannelBaseDir(channel) {
  const appData = getRoamingAppDataPath();
  const c = String(channel || "stable").toLowerCase();
  if (!appData) return "";
  if (c === "ptb") return path.join(appData, "discordptb");
  if (c === "canary") return path.join(appData, "discordcanary");
  if (c === "development" || c === "dev") return path.join(appData, "discorddevelopment");

  // Stable can be either %APPDATA%\Discord or %APPDATA%\discord; prefer existing.
  const stableLower = path.join(appData, "discord");
  const stableUpper = path.join(appData, "Discord");
  try {if (fs.existsSync(stableUpper)) return stableUpper;} catch {}
  try {if (fs.existsSync(stableLower)) return stableLower;} catch {}
  return stableUpper;
}

function getInAccordBaseDir(channel) {
  const base = getChannelBaseDir(channel);
  if (!base) return "";
  return path.join(base, "InAccord");
}

function ensureInAccordBaseDir(channel) {
  const base = getInAccordBaseDir(channel);
  if (!base) throw new Error("APPDATA not set; cannot resolve InAccord base dir");
  try {fs.mkdirSync(base, {recursive: true});} catch {}
  return base;
}

function payloadFileNameForChannel(file, channel) {
  // BetterDiscord-style: channel separation is by roaming folder, not suffix filenames.
  void channel;
  return String(file || "");
}

function resolvePayloadFile(file) {
  const p = path.join(__dirname, "payload", file);
  try {if (fs.existsSync(p)) return p;} catch {}
  return null;
}

function copyAsarReadableFile(src, dest) {
  const buf = fs.readFileSync(src);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.writeFileSync(dest, buf);
}

function compareVersionsDesc(a, b) {
  const pa = String(a).split(".").map(x => parseInt(x, 10)).map(n => Number.isFinite(n) ? n : 0);
  const pb = String(b).split(".").map(x => parseInt(x, 10)).map(n => Number.isFinite(n) ? n : 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return db - da;
  }
  return 0;
}

function findLatestAppDir(localBaseDir) {
  try {
    if (!localBaseDir || !fs.existsSync(localBaseDir)) return null;
    const dirs = fs.readdirSync(localBaseDir, {withFileTypes: true})
      .filter(e => e.isDirectory() && /^app-/i.test(e.name))
      .map(e => e.name)
      .sort((a, b) => compareVersionsDesc(a.slice(4), b.slice(4)));
    return dirs.length ? path.join(localBaseDir, dirs[0]) : null;
  } catch {
    return null;
  }
}

function discordLocalAppName(channel) {
  const c = String(channel || "stable").toLowerCase();
  if (c === "ptb") return "DiscordPTB";
  if (c === "canary") return "DiscordCanary";
  if (c === "development" || c === "dev") return "DiscordDevelopment";
  return "Discord";
}

function findLatestWinAppDirByChannel(channel) {
  const local = getLocalAppDataPath();
  if (!local) return null;
  const baseDir = path.join(local, discordLocalAppName(channel));
  return findLatestAppDir(baseDir);
}

function findDiscordDesktopCoreDirWin(appDir) {
  // Modern layout: modules/discord_desktop_core-*/discord_desktop_core
  try {
    const modulesDir = path.join(appDir, "modules");
    if (!modulesDir || !fs.existsSync(modulesDir)) return path.join(appDir, "resources", "discord_desktop_core");

    const wraps = fs.readdirSync(modulesDir, {withFileTypes: true})
      .filter(e => e.isDirectory() && /^discord_desktop_core/i.test(e.name))
      .map(e => e.name);

    const extractWrapVersion = (name) => {
      try {
        const n = String(name || "");
        const m = n.match(/^discord_desktop_core[-_]?(.+)$/i);
        const v = m && m[1] ? String(m[1]) : "";
        return v.replace(/^[-_.]+/, "") || "0";
      } catch {return "0";}
    };

    wraps.sort((a, b) => compareVersionsDesc(extractWrapVersion(a), extractWrapVersion(b)));
    const wrap = wraps[0];
    if (wrap) {
      const candidate = path.join(modulesDir, wrap, "discord_desktop_core");
      if (candidate && fs.existsSync(candidate)) return candidate;
    }
  } catch {}

  // Legacy layout.
  return path.join(appDir, "resources", "discord_desktop_core");
}

function tryReadFileUtf8(p) {
  try {return (p && fs.existsSync(p)) ? fs.readFileSync(p, "utf8") : null;} catch {return null;}
}

function isDiscordCoreIndexPatched(channel) {
  try {
    if (process.platform !== "win32") return {ok: true, patched: false, reason: "non-win32"};

    const c = String(channel || "stable").toLowerCase();
    const appDir = findLatestWinAppDirByChannel(c);
    if (!appDir) return {ok: true, patched: false, reason: "appDir-not-found"};

    const coreDir = findDiscordDesktopCoreDirWin(appDir);
    const indexPath = path.join(coreDir, "index.js");
    if (!fs.existsSync(indexPath)) return {ok: true, patched: false, reason: "index-missing", appDir, coreDir, indexPath};

    const txt = tryReadFileUtf8(indexPath) || "";
    const hasMarker = txt.includes(CORE_PATCH_MARKER);

    const pkgAbs = getInAccordBaseDir(c);
    const pkgLiteral = JSON.stringify(String(pkgAbs));
    const pointsAtCurrent = hasMarker && (txt.includes(`require(${pkgLiteral});`) || txt.includes(`require(${pkgLiteral})`));

    const pkgExists = (() => {
      try {
        if (!pkgAbs) return false;
        if (!fs.existsSync(pkgAbs)) return false;
        if (!fs.existsSync(path.join(pkgAbs, "package.json"))) return false;
        if (!fs.existsSync(path.join(pkgAbs, "main.js"))) return false;
        return true;
      } catch {return false;}
    })();

    return {ok: true, patched: !!(hasMarker && pointsAtCurrent && pkgExists), appDir, coreDir, indexPath, pkgAbs, pkgExists};
  } catch (e) {
    return {ok: false, patched: false, error: String(e && e.stack ? e.stack : e)};
  }
}

function patchDiscordCoreIndex(channel) {
  try {
    if (process.platform !== "win32") return {ok: true, patched: false, reason: "non-win32"};

    const c = String(channel || "stable").toLowerCase();
    const appDir = findLatestWinAppDirByChannel(c);
    if (!appDir) return {ok: false, patched: false, reason: "appDir-not-found"};

    const coreDir = findDiscordDesktopCoreDirWin(appDir);
    const indexPath = path.join(coreDir, "index.js");

    const original = (() => {
      try {if (fs.existsSync(indexPath)) return fs.readFileSync(indexPath, "utf8");} catch {}
      return "";
    })();

    const pkgAbs = getInAccordBaseDir(c);
    const pkgLiteral = JSON.stringify(String(pkgAbs));

    const pointsAtCurrent = original.includes(`require(${pkgLiteral});`) || original.includes(`require(${pkgLiteral})`);
    const pkgExists = (() => {
      try {
        if (!pkgAbs) return false;
        if (!fs.existsSync(pkgAbs)) return false;
        if (!fs.existsSync(path.join(pkgAbs, "package.json"))) return false;
        if (!fs.existsSync(path.join(pkgAbs, "main.js"))) return false;
        return true;
      } catch {return false;}
    })();

    if (original.includes(CORE_PATCH_MARKER) && pointsAtCurrent && pkgExists) {
      return {ok: true, patched: true, reason: "already-patched", appDir, coreDir, indexPath, pkgAbs, pkgExists};
    }

    const backup = path.join(coreDir, "index.js.inaccord.bak");
    try {
      if (original && !fs.existsSync(backup)) fs.writeFileSync(backup, original, "utf8");
    } catch (e) {
      return {ok: false, patched: false, reason: "backup-write-failed", error: String(e && e.stack ? e.stack : e), appDir, coreDir, indexPath, backup};
    }

    const patched =
      `// InAccord core patch (${CORE_PATCH_MARKER})\n` +
      `try { require(${pkgLiteral}); } catch (e) {\n` +
      `  try {\n` +
      `    const fs = require('fs');\n` +
      `    const path = require('path');\n` +
      `    const out = path.join(${pkgLiteral}, 'InAccord.core_index_error.' + ${JSON.stringify(c)} + '.json');\n` +
      `    const msg = (e && (e.stack || e.message)) ? String(e.stack || e.message) : String(e);\n` +
      `    fs.writeFileSync(out, JSON.stringify({ ts: new Date().toISOString(), pid: process.pid, execPath: process.execPath, package: ${pkgLiteral}, error: msg }, null, 2));\n` +
      `  } catch {}\n` +
      `}\n` +
      `module.exports = require('./core.asar');\n`;

    fs.writeFileSync(indexPath, patched, "utf8");

    return {ok: true, patched: true, reason: original.includes(CORE_PATCH_MARKER) ? "repatched-loader-updated" : "patched", appDir, coreDir, indexPath, backup, pkgAbs, pkgExists};
  } catch (e) {
    return {ok: false, patched: false, error: String(e && e.stack ? e.stack : e)};
  }
}

function getDiscordResourcesAsarPath(channel) {
  try {
    if (process.platform !== "win32") return "";
    const appDir = findLatestWinAppDirByChannel(channel);
    if (!appDir) return "";
    const p = path.join(appDir, "resources", "app.asar");
    try {if (fs.existsSync(p)) return p;} catch {}
  } catch {}
  return "";
}

function patchDiscordAppAsar(channel) {
  try {
    if (process.platform !== "win32") return {ok: true, patched: false, reason: "non-win32"};
    if (!asar) return {ok: false, patched: false, reason: "asar-lib-missing"};

    const asarPath = getDiscordResourcesAsarPath(channel);
    if (!asarPath) return {ok: true, patched: false, reason: "asar-not-found"};

    // We patch by replacing bootstrap entry scripts to include our marker and require our package.
    // This is best-effort; core index patch is the primary mechanism.
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inaccord-asar-"));
    const extractDir = path.join(tmpRoot, "app");
    const outAsar = path.join(tmpRoot, "app.asar");

    asar.extractAll(asarPath, extractDir);

    const pkgFile = path.join(extractDir, "package.json");
    let mainRel = "";
    try {
      const pkgTxt = fs.readFileSync(pkgFile, "utf8");
      const pkg = JSON.parse(pkgTxt);
      if (pkg && pkg.main) mainRel = String(pkg.main);
    } catch {}

    const candidates = [];
    if (mainRel) candidates.push(mainRel);
    candidates.push("./bootstrap.js", "./index.js", "./app_bootstrap/index.js");

    const pkgAbs = getInAccordBaseDir(channel);
    const pkgLiteral = JSON.stringify(String(pkgAbs));

    let anyChanged = false;
    const patchedFiles = [];

    for (const rel of candidates) {
      try {
        const abs = path.join(extractDir, rel);
        if (!fs.existsSync(abs)) continue;
        const original = fs.readFileSync(abs, "utf8");
        if (original.includes(ASAR_PATCH_MARKER) || original.includes(CORE_PATCH_MARKER)) continue;
        const next =
          `// ${ASAR_PATCH_MARKER}\n` +
          `try { require(${pkgLiteral}); } catch {}\n` +
          String(original || "");
        fs.writeFileSync(abs, next, "utf8");
        anyChanged = true;
        patchedFiles.push(rel);
      } catch {}
    }

    if (anyChanged) {
      if (typeof asar.createPackage === "function") {
        asar.createPackage(extractDir, outAsar, (err) => {
          if (err) throw err;
        });
        fs.copyFileSync(outAsar, asarPath);
      }
    }

    try {fs.rmSync(tmpRoot, {recursive: true, force: true});} catch {}
    return {ok: true, patched: anyChanged, reason: anyChanged ? "patched" : "already-patched", asarPath, patchedFiles: patchedFiles.length ? patchedFiles : null};
  } catch (e) {
    return {ok: false, patched: false, error: String(e && e.stack ? e.stack : e)};
  }
}

function isDiscordAppAsarPatched(channel) {
  try {
    if (process.platform !== "win32") return {ok: true, patched: false, reason: "non-win32"};
    if (!asar) return {ok: false, patched: false, reason: "asar-lib-missing"};

    const asarPath = getDiscordResourcesAsarPath(channel);
    if (!asarPath) return {ok: true, patched: false, reason: "asar-not-found"};

    // Best-effort: check if the marker string exists in one of the typical files.
    // Use extractFile if available.
    const filesToCheck = ["package.json", "./bootstrap.js", "./index.js", "./app_bootstrap/index.js"];
    for (const rel of filesToCheck) {
      try {
        if (typeof asar.extractFile !== "function") break;
        const buf = asar.extractFile(asarPath, rel);
        const txt = Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf || "");
        if (txt && (txt.includes(ASAR_PATCH_MARKER) || txt.includes(CORE_PATCH_MARKER))) return {ok: true, patched: true, asarPath, rel};
      } catch {
        // ignore
      }
    }

    return {ok: true, patched: false, asarPath};
  } catch (e) {
    return {ok: false, patched: false, error: String(e && e.stack ? e.stack : e)};
  }
}

function getMarkerPathsForChannel(channel) {
  const c = String(channel || "stable").toLowerCase();
  const base = getInAccordBaseDir(c);
  return {
    base,
    preloadLoaded: path.join(base, `InAccord.preload_loaded.${c}.json`),
    running: path.join(base, `InAccord.running.${c}.json`),
    injectLog: path.join(base, `InAccord_inject.${c}.log`),
    injectStatus: path.join(base, `InAccord.inject_status.${c}.json`),
    mainhookLog: path.join(base, `InAccord_mainhook.${c}.log`),
    mainhookLoaded: path.join(base, `InAccord.mainhook_loaded.${c}.json`)
  };
}

function tailFileSafe(p, maxLines = 60) {
  try {
    if (!p || !fs.existsSync(p)) return [];
    const txt = fs.readFileSync(p, "utf8");
    const lines = txt.split(/\r?\n/).filter(Boolean);
    return lines.slice(-Math.max(1, maxLines | 0));
  } catch {
    return [];
  }
}

function collapseConsecutiveDuplicates(lines) {
  try {
    if (!Array.isArray(lines)) return lines;
    const out = [];
    let prev = null;
    for (const ln of lines) {
      const s = String(ln || "");
      if (!s) continue;
      if (s === prev) continue;
      out.push(s);
      prev = s;
    }
    return out;
  } catch {
    return lines;
  }
}

function pickNewestFile(paths) {
  try {
    let best = null;
    let bestMs = -1;
    for (const p of paths || []) {
      const st = statSafe(p);
      const ms = st ? Number(st.mtimeMs || 0) : 0;
      if (st && st.isFile() && ms >= bestMs) {
        best = p;
        bestMs = ms;
      }
    }
    return best;
  } catch {
    return null;
  }
}

function pickLatestLogFileInDir(dir) {
  try {
    if (!dir || !fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, {withFileTypes: true});

    const preferred = [];
    const anyFiles = [];

    for (const ent of entries) {
      if (!ent || !ent.isFile || !ent.isFile()) continue;
      const name = String(ent.name || "");
      if (!name) continue;

      const p = path.join(dir, name);
      anyFiles.push(p);

      const lower = name.toLowerCase();
      if (lower.includes(".log") || lower.endsWith(".txt") || lower.endsWith(".json")) preferred.push(p);
    }

    return pickNewestFile(preferred) || pickNewestFile(anyFiles);
  } catch {
    return null;
  }
}

function getBootLogPath() {
  try {
    const outDir = getLauncherLogsDir();
    return outDir ? path.join(outDir, "launcher-boot.log") : "";
  } catch {
    return "";
  }
}

// Create the system tray if missing. This is a top-level helper so the tray
// can be created on startup (ensuring the tray icon is always present) and
// reused by multiple code paths. Safe no-op if tray already exists.
function createTrayIfMissing() {
  try {
    if (appTray) return;
    const { nativeImage, Menu } = electron;
    const canonicalRoot = 'E:\\In-Accord-Apps\\dist\\launcher-build-win32\\build-source\\launcher-ui';
    const candidates = [
      path.join(__dirname, 'build', '.tmp-icon', 'icon-16.png'),
      path.join(__dirname, 'build', '.tmp-icon', 'icon-24.png'),
      path.join(__dirname, 'build', '.tmp-icon', 'icon-32.png'),
      path.join(__dirname, 'build', '.tmp-icon', 'icon-48.png'),
      process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-16.png') : null,
      process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-24.png') : null,
      process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-32.png') : null,
      process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-48.png') : null,
      path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-16.png'),
      path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-24.png'),
      path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-32.png'),
      path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-48.png')
    ].filter(Boolean);

    let chosen = null;
    for (const c of candidates) {
      try { if (c && fs.existsSync(c)) { chosen = c; break; } } catch {}
    }

    if (!chosen) bootLog(`[tray-create] no icon candidate found; tried: ${JSON.stringify(candidates)}`);
    else bootLog(`[tray-create] using icon path: ${String(chosen)}`);

    let img = null;
    if (chosen) { try { img = nativeImage.createFromPath(chosen); } catch { img = null; } }
    if (!img || (typeof img.isEmpty === 'function' && img.isEmpty())) {
      try {
        const svg = `data:image/svg+xml;utf8,` + encodeURIComponent(`
          <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'>
            <rect width='16' height='16' rx='3' ry='3' fill='%234f8ef7' />
            <rect x='3' y='7' width='10' height='2' rx='1' ry='1' fill='white'/>
          </svg>
        `);
        img = nativeImage.createFromDataURL(svg);
      } catch { try { img = nativeImage.createEmpty(); } catch { img = null; } }
    }

    appTray = new electron.Tray(img);
    appTray.setToolTip('In-Accord Launcher (minimized)');
    const buildLabel = `Build: ${cachedBuildSeq || getBuildSeq() || 'N/A'}`;
    try { bootLog(`[tray-create] menu buildLabel=${buildLabel}`); } catch {}
    const menu = Menu.buildFromTemplate([
      { label: buildLabel, enabled: false },
      { type: 'separator' },
      { label: 'Restore', click: () => { try { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } catch {} } },
      { type: 'separator' },
      { label: 'Quit', click: () => { try { allowQuit = true; app.quit(); } catch {} } }
    ]);
    try { appTray.setContextMenu(menu); } catch {}
    appTray.on('click', () => { try { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } catch {}; });
    appTray.on('right-click', () => { try { if (appTray) appTray.popUpContextMenu(menu); } catch {} });
  } catch (e) { bootLog(`[tray-create failed] ${String(e && e.stack ? e.stack : e)}`); }
}

function tryFileUrlToLocalPath(url) {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol !== "file:") return null;
    let p = decodeURIComponent(u.pathname || "");
    if (process.platform === "win32" && p.startsWith("/")) p = p.slice(1);
    p = p.replace(/\//g, path.sep);
    return p;
  } catch {
    return null;
  }
}

function readJsonSafe(p) {
  try {
    if (!p || !fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function validateInstalledPayload(channel) {
  const normalized = String(channel || "stable").toLowerCase();
  const targetDir = getInAccordBaseDir(normalized);
  const loaderFiles = [
    "main.js",
    "package.json",
    "preload.js",
    "InAccord.js",
    "editor/preload.js",
    "editor/script.js",
    "editor/index.html"
  ];

  const details = [];
  let ok = true;

  for (const file of loaderFiles) {
    const dest = targetDir ? path.join(targetDir, payloadFileNameForChannel(file, normalized)) : null;
    const item = {file, dest, exists: false, bytes: 0};
    try {
      if (dest && fs.existsSync(dest)) {
        item.exists = true;
        const s = fs.statSync(dest);
        item.bytes = s.size;
      }
    } catch {}

    if (!item.exists || !item.bytes) ok = false;
    details.push(item);
  }

  return {ok, channel: normalized, targetDir, files: details};
}

function installPayloadToChannel(channel) {
  const normalized = String(channel || "stable").toLowerCase();
  const targetDir = ensureInAccordBaseDir(normalized);

  const loaderFiles = [
    "main.js",
    "package.json",
    "preload.js",
    "InAccord.js",
    "editor/preload.js",
    "editor/script.js",
    "editor/index.html"
  ];

  const copied = [];
  for (const file of loaderFiles) {
    const src = resolvePayloadFile(file);
    if (!src) throw new Error(`Missing packaged payload file: ${file}`);
    const dest = path.join(targetDir, payloadFileNameForChannel(file, normalized));
    copyAsarReadableFile(src, dest);
    copied.push({file, dest});
  }

  const installedFile = path.join(targetDir, `InAccord.installed.${normalized}.json`);
  try {
    fs.writeFileSync(installedFile, safeJson({channel: normalized, installedAt: safeNow(), files: copied}), "utf8");
  } catch {}

  return {targetDir, copied, installedFile};
}

function restoreDiscordCorePatch(channel) {
  try {
    if (process.platform !== "win32") return {ok: true, restored: false, reason: "non-win32"};
    const appDir = findLatestWinAppDirByChannel(channel);
    if (!appDir) return {ok: true, restored: false, reason: "appDir-not-found"};

    const coreDir = findDiscordDesktopCoreDirWin(appDir);
    const indexPath = path.join(coreDir, "index.js");
    if (!fs.existsSync(indexPath)) return {ok: true, restored: false, reason: "index-missing", appDir};

    const backupCandidates = [
      path.join(coreDir, "index.js.inaccord.bak"),
      path.join(coreDir, "index.js.ia.bak")
    ];
    const backup = backupCandidates.find(p => {try {return fs.existsSync(p);} catch {return false;} });

    let restored = false;
    if (backup) {
      try {fs.copyFileSync(backup, indexPath); restored = true;} catch {}
    }

    return {ok: true, restored, backup: backup || null, appDir, coreDir, indexPath};
  } catch (e) {
    return {ok: false, restored: false, error: String(e && e.stack ? e.stack : e)};
  }
}

function uninstallFromChannel(channel) {
  const normalized = String(channel || "stable").toLowerCase();
  const targetDir = getInAccordBaseDir(normalized);
  if (!targetDir) throw new Error("APPDATA not set; cannot resolve uninstall paths");

  // Remove only loader files we installed. Keep user data.
  const loaderFiles = ["main.js", "package.json", "preload.js", "InAccord.js", "coreloader.js", "mainhook.js"];
  for (const f of loaderFiles) {
    try {
      const p = path.join(targetDir, payloadFileNameForChannel(f, normalized));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {}
  }

  try {
    const m = getMarkerPathsForChannel(normalized);
    for (const f of [m.preloadLoaded, m.running, m.injectLog, m.injectStatus, m.mainhookLoaded, m.mainhookLog]) {
      try {if (f && fs.existsSync(f)) fs.unlinkSync(f);} catch {}
    }
  } catch {}

  const coreRestore = restoreDiscordCorePatch(normalized);
  return {ok: true, channel: normalized, removedDir: targetDir, coreRestore};
}

function resolveLauncherModule() {
  try {
    // In portable builds, `__dirname` is typically `...\resources\app.asar`.
    // The launcher shim is bundled *inside* app.asar as `./launcher.js`.
    // Older builds attempted to load `..\launcher.js` (resources\launcher.js),
    // which is not guaranteed to exist and caused a hard crash.
    const bundledPath = path.join(__dirname, "launcher.js");
    const externalPath = path.join(__dirname, "..", "launcher.js");
    try {
      bootLog(`[launcher] resolve bundled=${bundledPath} exists=${!!statSafe(bundledPath)} external=${externalPath} exists=${!!statSafe(externalPath)}`);
    } catch {}
    try {
      const launcher = require(bundledPath);
      try {bootLog(`[launcher] loaded ${bundledPath}`);} catch {}
      return {launcher, resolvedLauncher: bundledPath};
    }
    catch {
      // Fallback: external resource next to app.asar (if present).
      const launcher = require(externalPath);
      try {bootLog(`[launcher] loaded ${externalPath}`);} catch {}
      return {launcher, resolvedLauncher: externalPath};
    }
  } catch (e) {
    try {bootLog(`[launcher] load failed ${String(e && e.stack ? e.stack : e)}`);} catch {}
    return {launcher: null, resolvedLauncher: null, error: String(e && e.stack ? e.stack : e)};
  }
}

function normalizeChannel(c) {
  const x = String(c || "stable").toLowerCase();
  if (x === "ptb") return "ptb";
  if (x === "canary") return "canary";
  if (x === "development" || x === "dev") return "development";
  return "stable";
}

let mainWindow = null;
let appTray = null;
let allowQuit = false;
// Cache the build sequence at startup so UI and tray use the same value
let cachedBuildSeq = null;
function loadCachedBuildSeq() {
  try {
    cachedBuildSeq = getBuildSeq();
    try { bootLog(`[cached-build-seq] ${String(cachedBuildSeq)}`); } catch {}
  } catch {}
}

// Rebuild the tray context menu to reflect the current cached build sequence.
function rebuildTrayMenu() {
  try {
    if (!appTray) return;
    try {
      const { Menu } = electron;
      const buildLabel = `Build: ${cachedBuildSeq || getBuildSeq() || 'N/A'}`;
      const menu = Menu.buildFromTemplate([
        { label: buildLabel, enabled: false },
        { type: 'separator' },
        { label: 'Restore', click: () => { try { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } catch {} } },
        { type: 'separator' },
        { label: 'Quit', click: () => { try { allowQuit = true; app.quit(); } catch {} } }
      ]);
      try { appTray.setContextMenu(menu); } catch {}
      try { bootLog(`[tray-menu updated] ${buildLabel}`); } catch {}
    } catch (e) { bootLog(`[rebuildTrayMenu failed] ${String(e && e.stack ? e.stack : e)}`); }
  } catch {}
}

// Poll for changes to the build-seq (works in portable contexts where file may be updated
// after the process starts). If the sequence changes, update the cached value and rebuild
// the tray menu so UI/tray remain in sync.
function pollBuildSeqChanges(intervalMs = 2000) {
  try {
    setInterval(() => {
      try {
        const cur = getBuildSeq();
        if (String(cur || '') !== String(cachedBuildSeq || '')) {
          try { bootLog(`[cached-build-seq changed] ${String(cachedBuildSeq)} -> ${String(cur)}`); } catch {}
          cachedBuildSeq = cur;
          try { rebuildTrayMenu(); } catch {}
        }
      } catch (e) {
        try { bootLog(`[pollBuildSeqChanges error] ${String(e && e.stack ? e.stack : e)}`); } catch {}
      }
    }, intervalMs);
  } catch (e) { try { bootLog(`[pollBuildSeqChanges failed] ${String(e && e.stack ? e.stack : e)}`); } catch {} }
}
const startMinimized = Array.isArray(process.argv) && process.argv.indexOf('--start-minimized') !== -1;

function createWindow() {
  const preloadPath = path.join(__dirname, "preload.js");
  const indexPath = path.join(__dirname, "index.html");

  try {bootLog(`[paths] __dirname=${__dirname}`);} catch {}
  try {bootLog(`[paths] preload=${preloadPath} exists=${fs.existsSync(preloadPath)}`);} catch {}
  try {bootLog(`[paths] index=${indexPath} exists=${fs.existsSync(indexPath)}`);} catch {}

  const win = new BrowserWindow({
    width: 697,
    height: 851,
    minWidth: 640,
    minHeight: 620,
    resizable: true,
    center: true,
    alwaysOnTop: false,
    frame: false,
    minimizable: true,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: "#0f1220",
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
    bootLog(`[did-fail-load] code=${errorCode} desc=${String(errorDescription || "")} url=${String(validatedURL || "")} mainFrame=${!!isMainFrame}`);
  });

  win.loadFile(indexPath).catch((e) => {
    bootLog(`[loadFile failed] ${String(e && e.stack ? e.stack : e)}`);
  });

  // Keep a global reference for tray actions
  mainWindow = win;

  // Create tray helper so multiple code paths reuse the same behavior
  function createAppTrayIfMissing() {
    try {
      if (appTray) return;
      const {nativeImage, Menu} = electron;
      const canonicalRoot = 'E:\\In-Accord-Apps\\dist\\launcher-build-win32\\build-source\\launcher-ui';
      const candidates = [
        path.join(__dirname, 'build', '.tmp-icon', 'icon-16.png'),
        path.join(__dirname, 'build', '.tmp-icon', 'icon-24.png'),
        path.join(__dirname, 'build', '.tmp-icon', 'icon-32.png'),
        path.join(__dirname, 'build', '.tmp-icon', 'icon-48.png'),
        process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-16.png') : null,
        process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-24.png') : null,
        process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-32.png') : null,
        process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-48.png') : null,
        path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-16.png'),
        path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-24.png'),
        path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-32.png'),
        path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-48.png')
      ].filter(Boolean);

      let chosen = null;
      for (const c of candidates) {
        try { if (c && fs.existsSync(c)) { chosen = c; break; } } catch {}
      }

      if (!chosen) bootLog(`[tray] no icon candidate found; tried: ${JSON.stringify(candidates)}`);
      else bootLog(`[tray] using icon path: ${String(chosen)}`);

      let img = null;
      if (chosen) { try { img = nativeImage.createFromPath(chosen); } catch { img = null; } }
      if (!img || (typeof img.isEmpty === 'function' && img.isEmpty())) {
        try {
          const svg = `data:image/svg+xml;utf8,` + encodeURIComponent(`
            <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'>
              <rect width='16' height='16' rx='3' ry='3' fill='%234f8ef7' />
              <rect x='3' y='7' width='10' height='2' rx='1' ry='1' fill='white'/>
            </svg>
          `);
          img = nativeImage.createFromDataURL(svg);
        } catch { try { img = nativeImage.createEmpty(); } catch { img = null; } }
      }

      appTray = new electron.Tray(img);
    appTray.setToolTip('In-Accord Launcher (minimized)');
    const buildLabel = `Build: ${cachedBuildSeq || getBuildSeq() || 'N/A'}`;
      try { bootLog(`[tray] menu buildLabel=${buildLabel}`); } catch {}
      const menu = Menu.buildFromTemplate([
        { label: buildLabel, enabled: false },
        { type: 'separator' },
        { label: 'Restore', click: () => { try { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } catch {} } },
        { type: 'separator' },
        { label: 'Quit', click: () => { try { allowQuit = true; app.quit(); } catch {} } }
      ]);
      try { appTray.setContextMenu(menu); } catch {}
      appTray.on('click', () => { try { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } catch {}; });
      appTray.on('right-click', () => { try { if (appTray) appTray.popUpContextMenu(menu); } catch {} });
    } catch (e) { bootLog(`[tray create failed] ${String(e && e.stack ? e.stack : e)}`); }
  }

  // Keep tray around when minimized or when the window is closed — unless Quit was chosen
  try {
    win.on('minimize', (ev) => {
      try { ev.preventDefault(); win.hide(); bootLog('[tray-minimize] window minimized -> hiding and creating tray'); createAppTrayIfMissing(); } catch (e) { bootLog(`[tray-minimize error] ${String(e)}`); }
    });

    win.on('close', (ev) => {
      try {
        if (!allowQuit) { ev.preventDefault(); win.hide(); bootLog('[tray-close] intercepted close -> hiding and keeping tray'); createAppTrayIfMissing(); }
        else { bootLog('[tray-close] quitting: destroying tray and allowing exit'); if (appTray) { try { appTray.destroy(); } catch {} appTray = null; } }
      } catch (e) { bootLog(`[tray-close error] ${String(e)}`); }
    });

    const clearTray = () => { try { if (appTray) { appTray.destroy(); appTray = null; } } catch (e) { bootLog(`[tray-destroy error] ${String(e)}`); } };
    // Do not destroy the tray on restore/show; keep tray persistent until Quit is chosen
    win.on('restore', () => { /* keep tray */ });
    win.on('show', () => { /* keep tray */ });
    win.on('focus', () => { /* no-op */ });
  } catch (e) { bootLog(`[tray-events attach failed] ${String(e)}`); }

  // Ensure tray icon is created when the window is minimized (for users who minimize via titlebar or OS)
  try {
    win.on('minimize', () => {
      try {
        // reuse the minimize-to-tray handler logic by invoking the same creation steps
        // create tray if not present
        if (!appTray) {
          try {
            const {nativeImage, Menu} = electron;
                    const canonicalRoot = 'E:\\In-Accord-Apps\\dist\\launcher-build-win32\\build-source\\launcher-ui';
                    const candidates = [
                      path.join(__dirname, 'build', '.tmp-icon', 'icon-16.png'),
                      path.join(__dirname, 'build', '.tmp-icon', 'icon-24.png'),
                      path.join(__dirname, 'build', '.tmp-icon', 'icon-32.png'),
                      path.join(__dirname, 'build', '.tmp-icon', 'icon-48.png'),
                      process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-16.png') : null,
                      process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-24.png') : null,
                      process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-32.png') : null,
                      process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-48.png') : null,
                      // canonical build-source locations (explicit)
                      path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-16.png'),
                      path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-24.png'),
                      path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-32.png'),
                      path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-48.png')
                    ].filter(Boolean);

            let chosen = null;
            for (const c of candidates) {
              try { if (c && fs.existsSync(c)) { chosen = c; break; } } catch {}
            }

            if (!chosen) bootLog(`[tray-minimize] no icon candidate found; tried: ${JSON.stringify(candidates)}`);
            else bootLog(`[tray-minimize] using icon path: ${String(chosen)}`);

            let img = null;
            if (chosen) { try { img = nativeImage.createFromPath(chosen); } catch { img = null; } }
            if (!img || (typeof img.isEmpty === 'function' && img.isEmpty())) {
              try {
                const svg = `data:image/svg+xml;utf8,` + encodeURIComponent(`
                  <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'>
                    <rect width='16' height='16' rx='3' ry='3' fill='%234f8ef7' />
                    <rect x='3' y='7' width='10' height='2' rx='1' ry='1' fill='white'/>
                  </svg>
                `);
                img = nativeImage.createFromDataURL(svg);
              } catch { try { img = nativeImage.createEmpty(); } catch { img = null; } }
            }

            appTray = new electron.Tray(img);
            appTray.setToolTip('In-Accord Launcher (minimized)');
            const buildLabel = `Build: ${cachedBuildSeq || getBuildSeq() || 'N/A'}`;
            try { bootLog(`[tray-minimize] menu buildLabel=${buildLabel}`); } catch {}
            const menu = Menu.buildFromTemplate([
                { label: buildLabel, enabled: false },
                { type: 'separator' },
                { label: 'Restore', click: () => { try { if (mainWindow) { mainWindow.restore(); mainWindow.focus(); } } catch {} } },
              { type: 'separator' },
                { label: 'Quit', click: () => { try { allowQuit = true; app.quit(); } catch {} } }
            ]);
            try { appTray.setContextMenu(menu); } catch {}
            appTray.on('click', () => { try { if (mainWindow) { mainWindow.restore(); mainWindow.focus(); } } catch {}; /* keep tray */ });
            appTray.on('right-click', () => { try { if (appTray) appTray.popUpContextMenu(menu); } catch {} });
          } catch (e) { bootLog(`[tray-minimize create failed] ${String(e && e.stack ? e.stack : e)}`); }
        }
      } catch {}
    });

    win.on('restore', () => {
      try { if (appTray) { appTray.destroy(); appTray = null; } } catch {}
    });
  } catch {}

    win.on('closed', () => {
    try { mainWindow = null; } catch {}
    // keep tray alive after window is closed; the Quit menu will set allowQuit and exit
  });

  // If requested via command-line, minimize immediately so tray flow executes (useful for testing)
  try {
    if (startMinimized) {
      try { win.minimize(); } catch (e) { bootLog(`[startMinimized minimize failed] ${String(e && e.stack ? e.stack : e)}`); }
    }
  } catch (e) { /* ignore */ }

  return win;
}

// Tray handlers
ipcMain.handle('minimize-to-tray', async () => {
  try {
    if (!mainWindow) return {ok: false, error: 'window-missing'};
    try { mainWindow.minimize(); } catch {}

    // create a tray icon if not present
    if (!appTray) {
      try {
        const {nativeImage, Menu} = electron;

        // Candidate icon relative locations (try multiple sizes and locations)
            const canonicalRoot = 'E:\\In-Accord-Apps\\dist\\launcher-build-win32\\build-source\\launcher-ui';
            const candidates = [
              path.join(__dirname, 'build', '.tmp-icon', 'icon-16.png'),
              path.join(__dirname, 'build', '.tmp-icon', 'icon-24.png'),
              path.join(__dirname, 'build', '.tmp-icon', 'icon-32.png'),
              path.join(__dirname, 'build', '.tmp-icon', 'icon-48.png'),
              // try resourcesPath (packaged)
              process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-16.png') : null,
              process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-24.png') : null,
              process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-32.png') : null,
              process.resourcesPath ? path.join(process.resourcesPath, 'build', '.tmp-icon', 'icon-48.png') : null,
              // explicit canonical build-source paths
              path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-16.png'),
              path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-24.png'),
              path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-32.png'),
              path.join(canonicalRoot, 'build', '.tmp-icon', 'icon-48.png')
            ].filter(Boolean);

        let chosen = null;
        for (const c of candidates) {
          try { if (c && fs.existsSync(c)) { chosen = c; break; } } catch {}
        }

        if (!chosen) {
          bootLog(`[tray] no icon candidate found; tried: ${JSON.stringify(candidates)}`);
        } else {
          bootLog(`[tray] using icon path: ${String(chosen)}`);
        }

        let img = null;
        if (chosen) {
          try { img = nativeImage.createFromPath(chosen); } catch { img = null; }
        }
        // Fallback: use embedded SVG data URL to guarantee a visible tray icon
        if (!img || img.isEmpty && typeof img.isEmpty === 'function' && img.isEmpty()) {
          try {
            const svg = `data:image/svg+xml;utf8,` + encodeURIComponent(`
              <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'>
                <rect width='16' height='16' rx='3' ry='3' fill='%234f8ef7' />
                <rect x='3' y='7' width='10' height='2' rx='1' ry='1' fill='white'/>
              </svg>
            `);
            img = nativeImage.createFromDataURL(svg);
          } catch (e) {
            try { img = nativeImage.createEmpty(); } catch { img = null; }
          }
        }
        appTray = new electron.Tray(img);
        appTray.setToolTip('In-Accord Launcher (minimized)');

        const buildLabel = `Build: ${cachedBuildSeq || getBuildSeq() || 'N/A'}`;
        try { bootLog(`[tray-minimize ipc] menu buildLabel=${buildLabel}`); } catch {}
        const menu = Menu.buildFromTemplate([
          { label: buildLabel, enabled: false },
          { type: 'separator' },
          { label: 'Restore', click: () => { try { if (mainWindow) { mainWindow.restore(); mainWindow.focus(); } } catch {} } },
          { type: 'separator' },
          { label: 'Quit', click: () => { try { allowQuit = true; app.quit(); } catch {} } }
        ]);
        try { appTray.setContextMenu(menu); } catch {}

        appTray.on('click', () => {
          try { if (mainWindow) { mainWindow.restore(); mainWindow.focus(); } } catch {}
          // keep tray persistent even after restoring
        });
        appTray.on('right-click', () => {
          try { if (appTray) appTray.popUpContextMenu(menu); } catch {}
        });
      } catch (e) {
        bootLog(`[tray create failed] ${String(e && e.stack ? e.stack : e)}`);
      }
    }

    return {ok: true};
  } catch (e) {
    return {ok: false, error: String(e && e.stack ? e.stack : e)};
  }
});

ipcMain.handle('restore-from-tray', async () => {
  try {
    if (mainWindow) {
      try { mainWindow.restore(); mainWindow.focus(); } catch {}
    }
    // Keep the tray persistent; only Quit should remove it
    return {ok: true};
  } catch (e) {
    return {ok: false, error: String(e && e.stack ? e.stack : e)};
  }
});

// IPC
ipcMain.handle("install", async (_event, channel, targetPlatform) => {
  try {
    void targetPlatform;
    const normalizedChannel = normalizeChannel(channel);

    const payload = installPayloadToChannel(normalizedChannel);
    const corePatch = patchDiscordCoreIndex(normalizedChannel);
    const asarPatch = patchDiscordAppAsar(normalizedChannel);

    return {code: 0, output: safeJson({ok: true, channel: normalizedChannel, payload, corePatch, asarPatch})};
  } catch (e) {
    const msg = String(e && e.stack ? e.stack : e);
    bootLog(`[install failed] ${msg}`);
    return {code: 1, output: msg};
  }
});

ipcMain.handle("uninstall", async (_event, channel) => {
  try {
    const normalizedChannel = normalizeChannel(channel);
    const result = uninstallFromChannel(normalizedChannel);
    return {code: 0, output: safeJson({ok: true, channel: normalizedChannel, result})};
  } catch (e) {
    const msg = String(e && e.stack ? e.stack : e);
    bootLog(`[uninstall failed] ${msg}`);
    return {code: 1, output: msg};
  }
});

ipcMain.handle("launch", async (_event, channel, targetPlatform) => {
  try {
    const normalizedChannel = normalizeChannel(channel);

    try {installPayloadToChannel(normalizedChannel);} catch (e) {bootLog(`[launch pre-install failed] ${String(e && e.stack ? e.stack : e)}`);}
    try {patchDiscordCoreIndex(normalizedChannel);} catch (e) {bootLog(`[launch pre-patch core index failed] ${String(e && e.stack ? e.stack : e)}`);}

    const {launcher, resolvedLauncher, error} = resolveLauncherModule();
    if (!launcher || typeof launcher.launchChannel !== "function") throw new Error(`launcher module missing launchChannel(): ${error || "unknown"}`);

    const opts = {channel: normalizedChannel, patchStable: normalizedChannel === "stable", targetPlatform};
    const result = await launcher.launchChannel(opts);
    return {code: 0, output: JSON.stringify(result), resolvedLauncher};
  } catch (e) {
    const msg = String(e && e.stack ? e.stack : e);
    bootLog(`[launch failed] ${msg}`);
    return {code: 1, output: msg};
  }
});

ipcMain.handle("show-error", async (_event, message) => {
  try {dialog.showErrorBox("Launcher", message || "An error occurred");} catch (e) {bootLog(`[show-error failed] ${String(e && e.stack ? e.stack : e)}`);}
});

ipcMain.handle("copy-to-clipboard", async (_event, text) => {
  try {
    clipboard.writeText(String(text || ""));
    return {ok: true};
  } catch (e) {
    return {ok: false, error: String(e && e.stack ? e.stack : e)};
  }
});

ipcMain.handle("open-external", async (_event, url) => {
  try {
    const u = String(url || "").trim();
    if (!u) return {ok: false, error: "missing url"};

    const localFromFileUrl = tryFileUrlToLocalPath(u);
    const localPath = localFromFileUrl || ((fs.existsSync(u) && path.isAbsolute(u)) ? u : null);

    if (localPath) {
      const st = statSafe(localPath);

      if (st && st.isDirectory()) {
        const latest = pickLatestLogFileInDir(localPath);
        const target = latest || localPath;
        const err = await shell.openPath(target);
        if (err) {
          const boot = getBootLogPath();
          if (boot && fs.existsSync(boot)) {
            await shell.openPath(boot);
            return {ok: true, opened: boot, fallback: true};
          }
          return {ok: false, error: String(err)};
        }
        return {ok: true, opened: target};
      }

      if (st && st.isFile()) {
        const err = await shell.openPath(localPath);
        if (err) return {ok: false, error: String(err)};
        return {ok: true, opened: localPath};
      }

      const boot = getBootLogPath();
      if (boot && fs.existsSync(boot)) {
        await shell.openPath(boot);
        return {ok: true, opened: boot, fallback: true};
      }

      return {ok: false, error: "path not found"};
    }

    await shell.openExternal(u);
    return {ok: true, opened: u};
  } catch (e) {
    return {ok: false, error: String(e && e.stack ? e.stack : e)};
  }
});

ipcMain.handle("get-asset-path", async (_event, name) => {
  try {
    const n = String(name || "").trim();
    if (!n) return {ok: false, error: "missing name"};

    const tried = [];

    // Candidate locations: __dirname (running from source), resourcesPath (packaged), and direct name
    const canonicalRoot = 'E:\\In-Accord-Apps\\dist\\launcher-build-win32\\build-source\\launcher-ui';
    const candidates = [
      path.join(__dirname, n),
      path.join(__dirname, String(n).replace(/^\\+/, '')),
      process.resourcesPath ? path.join(process.resourcesPath, n) : null,
      path.join(canonicalRoot, n),
      // fallback: try name as absolute or relative to cwd
      path.resolve(n)
    ].filter(Boolean);

    let found = null;
    for (const c of candidates) {
      try {
        tried.push(c);
        if (fs.existsSync(c)) { found = c; break; }
      } catch {}
    }

    if (found) {
      try { bootLog(`[get-asset-path] name=${n} found=${found}`); } catch {}
      return {ok: true, path: found, exists: true, tried};
    }

    try { bootLog(`[get-asset-path] name=${n} not found; tried=${JSON.stringify(tried)}`); } catch {}
    // Return the first candidate path (even if missing) to keep existing UI behavior, plus tried list
    return {ok: true, path: candidates[0] || '', exists: false, tried};
  } catch (e) {
    return {ok: false, error: String(e && e.stack ? e.stack : e)};
  }
});

ipcMain.handle("get-status", async () => {
  try {
    const channels = ["stable", "ptb", "canary", "development"];
    const perChannel = {};

    for (const c of channels) {
      const markers = getMarkerPathsForChannel(c);
      perChannel[c] = {
        payload: validateInstalledPayload(c),
        coreIndex: isDiscordCoreIndexPatched(c),
        appAsar: isDiscordAppAsarPatched(c),
        markers: {
          paths: markers,
          preloadLoaded: readJsonSafe(markers.preloadLoaded),
          running: readJsonSafe(markers.running),
          injectStatus: readJsonSafe(markers.injectStatus),
          mainhookLoaded: readJsonSafe(markers.mainhookLoaded),
          mainhookLogTail: collapseConsecutiveDuplicates(tailFileSafe(markers.mainhookLog, 60) || []),
          injectLogTail: collapseConsecutiveDuplicates(tailFileSafe(markers.injectLog, 160) || [])
        }
      };
    }

    let launcherExe = null;
    try {
      const p = String(process.execPath || "");
      if (p && fs.existsSync(p)) {
        const st = fs.statSync(p);
        launcherExe = {path: p, bytes: st.size, mtimeMs: st.mtimeMs};
      }
    } catch {}

    let buildSeq = null;
    try {
      if (cachedBuildSeq !== null && typeof cachedBuildSeq !== 'undefined') {
        const n = Number.parseInt(String(cachedBuildSeq || '').trim(), 10);
        if (Number.isFinite(n)) buildSeq = n;
        else buildSeq = String(cachedBuildSeq || null);
      } else {
        const exeDir = path.dirname(String(process.execPath || ""));
        const seqNames = ['In-Accord.Launcher.build-seq.txt', 'InAccord.Launcher.build-seq.txt'];
        for (const name of seqNames) {
          try {
            const seqPath = exeDir ? path.join(exeDir, name) : '';
            if (seqPath && fs.existsSync(seqPath)) {
              const t = String(fs.readFileSync(seqPath, "utf8") || "").trim();
              const n = Number.parseInt(t, 10);
              if (Number.isFinite(n)) { buildSeq = n; break; }
            }
          } catch {}
        }
      }
    } catch {}

    return {
      ok: true,
      now: safeNow(),
      platform: process.platform,
      version: (app && typeof app.getVersion === "function") ? app.getVersion() : null,
      execPath: process.execPath,
      launcherExe,
      buildSeq,
      resourcesPath: process.resourcesPath,
      launcherLogsDir: getLauncherLogsDir(),
      inAccordBaseDir: getInAccordBaseDir("stable"),
      channels: perChannel
    };
  } catch (e) {
    const msg = String(e && e.stack ? e.stack : e);
    bootLog(`[get-status failed] ${msg}`);
    return {ok: false, error: msg};
  }
});

// Ensure the application has a Start Menu shortcut on Windows so the AppUserModelID
// is properly associated and the app appears in Windows notification area settings.
function ensureStartMenuShortcut() {
  try {
    if (process.platform !== 'win32') return;

    const portableDir = String(process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath) || '');
    const exeName = path.basename(String(process.execPath || 'In-Accord Launcher.exe'));
    const targetExe = path.join(portableDir || path.dirname(process.execPath), exeName);

    // Location in Start Menu Programs
    const programs = path.join(getRoamingAppDataPath(), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    const shortcutPath = path.join(programs, 'In-Accord Launcher.lnk');

    try { if (fs.existsSync(shortcutPath)) { bootLog(`[shortcut] already exists: ${shortcutPath}`); return; } } catch {}

    // Ensure programs dir exists (should normally), do not create higher-level folders beyond Programs
    try { if (!fs.existsSync(programs)) { bootLog(`[shortcut] Start Menu Programs folder missing: ${programs}`); return; } } catch (e) { bootLog(`[shortcut] check programs failed: ${String(e)}`); return; }

    // Use PowerShell COM interop to create a .lnk shortcut pointing at the canonical exe.
    // This runs a short, single-command PowerShell that uses WScript.Shell.CreateShortcut.
    const psCmd = `\$s=(New-Object -ComObject WScript.Shell).CreateShortcut(\"${shortcutPath.replace(/\\/g,'\\\\')}\");` +
                  `\$s.TargetPath=\"${targetExe.replace(/\\/g,'\\\\')}\";` +
                  `\$s.WorkingDirectory=\"${(portableDir || path.dirname(process.execPath)).replace(/\\/g,'\\\\')}\";` +
                  `\$s.Description=\"In-Accord Launcher\";` +
                  `\$s.Save();`;

    try {
      child_process.execFile('powershell', ['-NoProfile', '-Command', psCmd], { windowsHide: true }, (err, stdout, stderr) => {
        if (err) {
          bootLog(`[shortcut create failed] err=${String(err)} stdout=${String(stdout||'')} stderr=${String(stderr||'')}`);
        } else {
          bootLog(`[shortcut created] ${shortcutPath}`);
        }
      });
    } catch (e) {
      bootLog(`[shortcut create error] ${String(e && e.stack ? e.stack : e)}`);
    }
  } catch (e) {
    bootLog(`[ensureStartMenuShortcut] ${String(e && e.stack ? e.stack : e)}`);
  }
}

function openDevToolsWarning(win) {
  // Never auto-open devtools.
  void win;
}

app.whenReady().then(() => {
  try {
    // Ensure a Start Menu shortcut exists (Windows) so AppUserModelID is associated
    try { ensureStartMenuShortcut(); } catch (e) { bootLog(`[ensureStartMenuShortcut failed] ${String(e && e.stack ? e.stack : e)}`); }
    // Load and cache build sequence once at startup so UI and tray show the same value
    try { loadCachedBuildSeq(); } catch (e) { bootLog(`[loadCachedBuildSeq failed] ${String(e && e.stack ? e.stack : e)}`); }
    createWindow();
    // Ensure the tray is present immediately on startup so the systray icon is always there.
    try { createTrayIfMissing(); } catch (e) { bootLog(`[createTrayIfMissing on ready failed] ${String(e && e.stack ? e.stack : e)}`); }
    // Start polling the build-seq file so the tray/menu stay in sync if the file is updated
    // after the process starts (e.g. packaging or external tooling updates the seq).
    try { pollBuildSeqChanges(2000); } catch (e) { bootLog(`[pollBuildSeqChanges start failed] ${String(e && e.stack ? e.stack : e)}`); }
  } catch (e) {bootLog(`[createWindow failed] ${String(e && e.stack ? e.stack : e)}`);} 
}).catch((e) => {
  bootLog(`[whenReady failed] ${String(e && e.stack ? e.stack : e)}`);
});

app.on("window-all-closed", () => {
  try {
    // Only quit the app automatically if Quit was explicitly chosen.
    if (allowQuit) try { app.quit(); } catch {}
    // Otherwise keep the process alive so the tray remains available.
  } catch {}
});
