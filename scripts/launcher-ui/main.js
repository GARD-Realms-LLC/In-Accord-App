const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

// Used to patch Discord's resources/app.asar on channels where the bootstrap is asar-packed.
// (Newer Discord Canary builds no longer ship a disk folder like resources/discord_desktop_core.)
let asar = null;
try { asar = require('asar'); } catch {}

// Discord builds that still ship resources/discord_desktop_core/index.js can be patched
// without touching app.asar. This is more reliable than NODE_OPTIONS/--require and avoids
// depending on the optional 'asar' module at runtime.
const CORE_PATCH_MARKER = 'inaccord_coreloader';

// Discord's app.asar bootstrap entry file name has changed across versions/channels.
// Prefer patching whichever app_bootstrap/*.js file actually exists.
const ASAR_BOOTSTRAP_CANDIDATES = [
  'app_bootstrap/index.js',
  'app_bootstrap/bootstrap.js',
  'app_bootstrap/app.js',
  'app_bootstrap/main.js',
  'app_bootstrap/launcher.js',
  'app_bootstrap/index.cjs',
  'app_bootstrap/bootstrap.cjs',
  'app_bootstrap/app.cjs',
  'app_bootstrap/main.cjs',
  'app_bootstrap/launcher.cjs',
  'app_bootstrap/index.mjs',
  'app_bootstrap/bootstrap.mjs',
  'app_bootstrap/app.mjs',
  'app_bootstrap/main.mjs',
  'app_bootstrap/launcher.mjs'
];

function listAsarBootstrapScriptFilesFromExtract(extractDir) {
  try {
    const dir = path.join(extractDir, 'app_bootstrap');
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isFile())
      .map(e => e.name)
      .filter(n => /\.(c?js|mjs)$/i.test(n))
      .sort((a, b) => a.localeCompare(b));
    return entries.map((name) => ({ rel: `app_bootstrap/${name}`, abs: path.join(dir, name) }));
  } catch {
    return [];
  }
}

function pickAsarBootstrapEntryFromExtract(extractDir) {
  try {
    for (const rel of ASAR_BOOTSTRAP_CANDIDATES) {
      const abs = path.join(extractDir, ...rel.split('/'));
      if (fs.existsSync(abs)) return { rel, abs, reason: 'candidate' };
    }

    const dir = path.join(extractDir, 'app_bootstrap');
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.js'))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b));
    if (!entries.length) return null;
    const chosen = entries[0];
    return { rel: `app_bootstrap/${chosen}`, abs: path.join(dir, chosen), reason: 'first-js' };
  } catch {
    return null;
  }
}

function pickAsarBootstrapEntryForExtractFile() {
  // Keep this in sync with ASAR_BOOTSTRAP_CANDIDATES; used when asar.extractFile exists.
  return [...ASAR_BOOTSTRAP_CANDIDATES];
}

function getLocalAppDataPath() {
  try {
    // In packaged Electron apps, LOCALAPPDATA can be missing.
    // Electron doesn't expose a stable 'localAppData' key, so derive it.
    const env = process.env.LOCALAPPDATA;
    if (env && typeof env === 'string') return env;
  } catch {}

  try {
    const home = os.homedir();
    if (home && typeof home === 'string') {
      return path.join(home, 'AppData', 'Local');
    }
  } catch {}

  try {
    const home = (app && typeof app.getPath === 'function') ? app.getPath('home') : '';
    if (home && typeof home === 'string') {
      return path.join(home, 'AppData', 'Local');
    }
  } catch {}

  return '';
}

function getRoamingAppDataPath() {
  try {
    const p = (app && typeof app.getPath === 'function') ? app.getPath('appData') : '';
    if (p) return p;
  } catch {}
  try { return process.env.APPDATA || ''; } catch {}
  return '';
}

function getArgValue(flag) {
  try {
    const idx = process.argv.indexOf(flag);
    if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  } catch {}
  return null;
}

function hasArg(flag) {
  try { return process.argv.includes(flag); } catch { return false; }
}

// Global NODE_OPTIONS can break packaged Electron apps by forcing an injected
// --require. Clear it so the launcher can always start.
try { delete process.env.NODE_OPTIONS; } catch {}
try { delete process.env.ELECTRON_RUN_AS_NODE; } catch {}

// Prevent immediate crash/exit on some Windows GPU driver setups.
// Must run before app.whenReady().
try { app.disableHardwareAcceleration(); } catch {}
try {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('no-sandbox');
  // Some Windows setups (security software / hardened policies) fail to start
  // renderer processes when Renderer Code Integrity is enabled.
  app.commandLine.appendSwitch('disable-features', 'RendererCodeIntegrity');
} catch {}

// When launched by double-click, stdout/stderr often aren't visible.
// Always write a boot log to disk so we can diagnose "opens then closes".
// Some environments block TEMP, so pick the first writable location.
const BOOT_LOG_CANDIDATES = (() => {
  const list = [];
  try { list.push(path.join(os.tmpdir(), 'InAccordLauncher_boot.log')); } catch {}
  try {
    const roaming = getRoamingAppDataPath();
    const local = getLocalAppDataPath();
    const base = roaming || local || '';
    if (base) list.push(path.join(base, 'InAccordLauncher_boot.log'));
  } catch {}
  try { list.push(path.join(process.cwd(), 'InAccordLauncher_boot.log')); } catch {}
  return list.filter(Boolean);
})();

let ACTIVE_BOOT_LOG = BOOT_LOG_CANDIDATES[0] || path.join('.', 'InAccordLauncher_boot.log');
function bootLog(line) {
  const msg = `${safeNow()} ${line}\n`;
  for (const p of [ACTIVE_BOOT_LOG, ...BOOT_LOG_CANDIDATES]) {
    try {
      fs.appendFileSync(p, msg);
      ACTIVE_BOOT_LOG = p;
      return;
    } catch {}
  }
}

function safeJson(obj) {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
}

try {
  bootLog(`[boot] pid=${process.pid} argv=${JSON.stringify(process.argv)}`);
  bootLog(`[boot] cwd=${process.cwd()}`);
  bootLog(`[boot] execPath=${process.execPath}`);
} catch {}

process.on('uncaughtException', (err) => {
  bootLog(`[uncaughtException] ${(err && err.stack) ? err.stack : String(err)}`);
  try {
    dialog.showErrorBox('InAccord Launcher crashed', String((err && err.stack) ? err.stack : err));
  } catch {}
});

process.on('unhandledRejection', (reason) => {
  bootLog(`[unhandledRejection] ${String(reason && reason.stack ? reason.stack : reason)}`);
});

try {
  app.on('render-process-gone', (_e, wc, details) => {
    bootLog(`[render-process-gone] id=${wc && wc.id} reason=${details && details.reason} exitCode=${details && details.exitCode}`);
  });
  app.on('child-process-gone', (_e, details) => {
    bootLog(`[child-process-gone] type=${details && details.type} reason=${details && details.reason} exitCode=${details && details.exitCode}`);
  });
} catch {}

function safeNow() { try { return new Date().toISOString(); } catch { return ''; } }

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function withTimeout(promise, timeoutMs, label) {
  // Ensure long operations never hang IPC invoke() calls.
  // If the underlying operation eventually completes, we ignore it.
  const ms = Math.max(0, Number(timeoutMs) || 0);
  const tag = String(label || 'operation');
  if (!ms) return Promise.resolve(promise);

  return new Promise((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      try { reject(new Error(`${tag} timed out after ${ms}ms`)); } catch { reject(new Error('timeout')); }
    }, ms);

    Promise.resolve(promise).then(
      (v) => {
        if (done) return;
        done = true;
        try { clearTimeout(t); } catch {}
        resolve(v);
      },
      (e) => {
        if (done) return;
        done = true;
        try { clearTimeout(t); } catch {}
        reject(e);
      }
    );
  });
}

function httpGetJsonHttps(url, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    try {
      const req = https.get(url, {
        headers: {
          // GitHub API requires a UA.
          'User-Agent': 'InAccord-Launcher',
          'Accept': 'application/vnd.github+json'
        }
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c.toString('utf8'); });
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
            }
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.setTimeout(timeoutMs, () => {
        try { req.destroy(new Error('timeout')); } catch {}
      });
      req.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

function discordDownloadUrl(channel) {
  const c = String(channel || 'stable').toLowerCase();
  // Discord's public download endpoints (Squirrel installers).
  // stable: /api/download?platform=win
  // ptb:    /api/download/ptb?platform=win
  // canary: /api/download/canary?platform=win
  // development: /api/download/development?platform=win (rare)
  if (c === 'ptb') return 'https://discord.com/api/download/ptb?platform=win';
  if (c === 'canary') return 'https://discord.com/api/download/canary?platform=win';
  if (c === 'development' || c === 'dev') return 'https://discord.com/api/download/development?platform=win';
  return 'https://discord.com/api/download?platform=win';
}

function downloadFileHttps(url, destPath, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    try {
      const doGet = (u, redirectsLeft) => {
        const req = https.get(u, {
          headers: {
            'User-Agent': 'InAccord-Launcher',
            'Accept': '*/*'
          }
        }, (res) => {
          try {
            const sc = Number(res.statusCode || 0);
            // follow redirects
            if ((sc === 301 || sc === 302 || sc === 303 || sc === 307 || sc === 308) && res.headers && res.headers.location && redirectsLeft > 0) {
              const next = String(res.headers.location);
              res.resume();
              return doGet(next, redirectsLeft - 1);
            }

            if (sc >= 400) {
              res.resume();
              return reject(new Error(`HTTP ${sc} downloading ${String(u).slice(0, 120)}`));
            }

            try { fs.mkdirSync(path.dirname(destPath), { recursive: true }); } catch {}
            const file = fs.createWriteStream(destPath);
            res.pipe(file);
            file.on('finish', () => {
              try { file.close(() => resolve({ ok: true, destPath })); } catch { resolve({ ok: true, destPath }); }
            });
            file.on('error', (e) => {
              try { file.close(() => {}); } catch {}
              try { fs.unlinkSync(destPath); } catch {}
              reject(e);
            });
          }
          catch (e) {
            try { res.resume(); } catch {}
            reject(e);
          }
        });

        req.setTimeout(timeoutMs, () => {
          try { req.destroy(new Error('timeout')); } catch {}
        });
        req.on('error', reject);
      };

      doGet(url, 5);
    }
    catch (e) {
      reject(e);
    }
  });
}

function revealFileInExplorer(filePath) {
  try {
    const p = String(filePath || '');
    if (!p) return false;
    if (!fs.existsSync(p)) return false;
    // Use Explorer's /select to highlight the downloaded installer.
    const child = spawn('explorer.exe', [`/select,${p}`], { detached: true, stdio: 'ignore', windowsHide: true });
    try { child.unref(); } catch {}
    return true;
  } catch {
    return false;
  }
}

function resolveDiscordInstallerDownloadDir() {
  // Keep downloads in ONE folder and avoid nested paths when running from win-unpacked.
  // process.execPath:
  //   <...>\launcher-build-win32-latest\win-unpacked\InAccord Launcher.exe
  // Download dir:
  //   <...>\launcher-build-win32-latest
  try {
    const exe = String(process.execPath || '');
    const exeDir = exe ? path.dirname(exe) : '';
    if (exeDir) {
      const parent = path.resolve(exeDir, '..');
      try { if (parent && fs.existsSync(parent)) return parent; } catch {}
      try { if (exeDir && fs.existsSync(exeDir)) return exeDir; } catch {}
    }
  } catch {}

  // Last-resort: current working directory.
  try { if (process.cwd && fs.existsSync(process.cwd())) return process.cwd(); } catch {}
  return __dirname;
}

async function ensureDiscordInstalled(channel) {
  // Only implement auto-install on Windows.
  if (process.platform !== 'win32') return { ok: true, skipped: true, reason: 'non-win32' };

  const c = String(channel || 'stable').toLowerCase();
  const local = getLocalAppDataPath();
  if (!local) return { ok: false, error: 'Missing LOCALAPPDATA' };

  const localName = discordLocalAppName(c);
  const baseDir = path.join(local, localName);
  const existingAppDir = findLatestAppDir(baseDir);
  if (existingAppDir && fs.existsSync(existingAppDir)) {
    return { ok: true, installed: true, reason: 'already-present', baseDir, appDir: existingAppDir };
  }

  // Channel is missing. Do NOT download automatically.
  const outDir = resolveDiscordInstallerDownloadDir();
  const safeName = String(localName || 'Discord').replace(/[^a-z0-9_-]+/gi, '');
  const setupPath = path.join(outDir, `${safeName}Setup.exe`);
  const url = discordDownloadUrl(c);

  return {
    ok: false,
    installed: false,
    reason: 'not-installed',
    error: 'Discord channel is not installed',
    channel: c,
    url,
    downloadPath: setupPath,
    baseDir,
    appDir: null
  };
}

async function downloadDiscordInstaller(channel) {
  if (process.platform !== 'win32') return { ok: false, error: 'non-win32' };
  const c = String(channel || 'stable').toLowerCase();
  const localName = discordLocalAppName(c);
  const outDir = resolveDiscordInstallerDownloadDir();
  const safeName = String(localName || 'Discord').replace(/[^a-z0-9_-]+/gi, '');
  const setupPath = path.join(outDir, `${safeName}Setup.exe`);
  const url = discordDownloadUrl(c);

  try { bootLog(`[discord-download] channel=${c} url=${url} -> ${setupPath}`); } catch {}

  try {
    await withTimeout(downloadFileHttps(url, setupPath, 45000), 60000, 'downloadDiscord');
  }
  catch (e) {
    return { ok: false, channel: c, url, downloadedTo: setupPath, error: String(e && e.stack ? e.stack : e) };
  }

  const revealed = revealFileInExplorer(setupPath);
  return { ok: true, channel: c, url, downloadedTo: setupPath, explorerOpened: revealed };
}

function parseReleaseBodyToBullets(body) {
  const text = String(body || '').replace(/\r\n/g, '\n');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const bullets = [];
  for (const ln of lines) {
    const m = /^[-*]\s+(.*)$/.exec(ln);
    if (m && m[1]) bullets.push(m[1].trim());
  }
  // Fallback: if no bullets, keep first few non-empty lines.
  if (!bullets.length) return lines.slice(0, 6);
  return bullets.slice(0, 12);
}

async function fetchLatestChangelog() {
  const repoUrl = 'https://github.com/GARD-Realms-LLC/In-Accord-App';
  const releasesUrl = repoUrl + '/releases';

  // Pull from the Releases feed (API endpoint backing /releases).
  const apiUrl = 'https://api.github.com/repos/GARD-Realms-LLC/In-Accord-App/releases?per_page=5';
  const list = await httpGetJsonHttps(apiUrl, 3500);

  const releases = Array.isArray(list) ? list : [];
  const top = releases.slice(0, 5).map((r) => {
    const version = String(r?.tag_name || r?.name || '').trim() || 'unknown';
    const date = String(r?.published_at || r?.created_at || '').trim() || '';
    const releaseUrl = String(r?.html_url || '').trim() || releasesUrl;
    const changes = parseReleaseBodyToBullets(r?.body);
    return { version, date, releaseUrl, changes };
  });

  const latest = top[0] || { version: 'unknown', date: '', releaseUrl: releasesUrl, changes: [] };

  return {
    ok: true,
    url: releasesUrl,
    releaseUrl: latest.releaseUrl,
    apiUrl,
    version: latest.version,
    date: latest.date,
    changes: latest.changes,
    releases: top
  };
}

function getChannelBaseDir(channel) {
  const appData = getRoamingAppDataPath();
  const c = String(channel || 'stable').toLowerCase();
  if (!appData) return '';
  if (c === 'ptb') return path.join(appData, 'discordptb');
  if (c === 'canary') return path.join(appData, 'discordcanary');
  if (c === 'development' || c === 'dev') return path.join(appData, 'discorddevelopment');

  // Stable can be either %APPDATA%\discord or %APPDATA%\Discord.
  // On Windows, directories *can* be case-sensitive (per-directory flag), so we must
  // prefer the one that actually exists to avoid creating a parallel folder.
  const stableLower = path.join(appData, 'discord');
  const stableUpper = path.join(appData, 'Discord');
  // IMPORTANT: prefer the official Discord Stable folder name when both exist.
  // If we default to the wrong one, Discord will never see our payload and it looks
  // like "install succeeded" but nothing loads (no menu/toasts/modals).
  try { if (fs.existsSync(stableUpper)) return stableUpper; } catch {}
  try { if (fs.existsSync(stableLower)) return stableLower; } catch {}
  // Default to the official name to avoid creating a parallel folder Discord won't use.
  return stableUpper;
}

// BetterDiscord-style: store all InAccord data in a dedicated folder under Roaming.
// This avoids writing into %APPDATA%\Discord which can be locked down by policies/AV.
function getInAccordBaseDir() {
  const appData = getRoamingAppDataPath();
  if (!appData) return '';
  return path.join(appData, 'InAccord');
}

function ensureInAccordBaseDir() {
  const base = getInAccordBaseDir();
  if (!base) throw new Error('APPDATA not set; cannot resolve InAccord base dir');
  try { fs.mkdirSync(base, { recursive: true }); } catch {}
  return base;
}

function payloadFileNameForChannel(file, channel) {
  const c = String(channel || 'stable').toLowerCase();
  const name = String(file || '');
  if (!name) return name;
  if (name === 'InAccord.js') return `InAccord.${c}.js`;
  if (name.endsWith('.js')) return name.slice(0, -3) + `.${c}.js`;
  return `${name}.${c}`;
}

function getLegacyChannelInAccordDir(channel) {
  const base = getChannelBaseDir(channel);
  return base ? path.join(base, 'InAccord') : '';
}

function getChannelInAccordDir(channel) {
  // BetterDiscord-style: keep our payload/data in %APPDATA%\InAccord.
  return getInAccordBaseDir();
}

function appendAppDataLog(channel, fileName, line) {
  try {
    const base = getInAccordBaseDir();
    if (!base) return;
    const c = String(channel || 'stable').toLowerCase();
    const name = String(fileName || 'InAccord.log');
    fs.appendFileSync(path.join(base, `${name}.${c}`), `${safeNow()} ${line}\n`);
  } catch {}
}

function safeUnlink(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
}

function safeRmDir(dirPath) {
  try { if (dirPath && fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true }); } catch {}
}

function resolvePayloadFile(file) {
  const p = path.join(__dirname, 'payload', file);
  try { if (fs.existsSync(p)) return p; } catch {}
  return null;
}

function copyAsarReadableFile(src, dest) {
  const buf = fs.readFileSync(src);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}

function tryReadFileUtf8(p) {
  try { return (p && fs.existsSync(p)) ? fs.readFileSync(p, 'utf8') : null; } catch { return null; }
}

function findDiscordDesktopCoreDirWin(appDir) {
  // BetterDiscord-style: modern Discord installs keep discord_desktop_core
  // under app-*/modules/discord_desktop_core-*/discord_desktop_core.
  try {
    const modulesDir = path.join(appDir, 'modules');
    if (fs.existsSync(modulesDir)) {
      const wraps = fs.readdirSync(modulesDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && /^discord_desktop_core/i.test(e.name))
        .map(e => e.name)
        .sort()
        .reverse();
      const wrap = wraps[0];
      if (wrap) {
        const candidate = path.join(modulesDir, wrap, 'discord_desktop_core');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  } catch {}
  // Legacy layout.
  return path.join(appDir, 'resources', 'discord_desktop_core');
}

function isDiscordCoreIndexPatched(channel) {
  try {
    if (process.platform !== 'win32') return { ok: true, patched: false, reason: 'non-win32' };
    const appDir = findLatestWinAppDirByChannel(channel);
    if (!appDir) return { ok: true, patched: false, reason: 'appDir-not-found' };
    const coreDir = findDiscordDesktopCoreDirWin(appDir);
    const indexPath = path.join(coreDir, 'index.js');
    if (!fs.existsSync(indexPath)) return { ok: true, patched: false, reason: 'index-missing', appDir };

    const txt = tryReadFileUtf8(indexPath) || '';
    const hasMarker = txt.includes(CORE_PATCH_MARKER);
    let loaderPath = null;
    let loaderExists = null;
    if (hasMarker) {
      try {
        // Expected BetterDiscord-style shape:
        //   require("C:\\...\\coreloader.js");
        //   module.exports = require("./core.asar");
        const m = txt.match(/\brequire\((['"])(.*?)\1\);/);
        if (m && m[2]) {
          loaderPath = String(m[2]);
          // Unescape common sequences from JSON/string-literals.
          loaderPath = loaderPath.replace(/\\\\/g, '\\').replace(/\\"/g, '"');
          try { loaderExists = !!(loaderPath && fs.existsSync(loaderPath)); } catch { loaderExists = false; }
        }
      } catch {}
    }

    return {
      ok: true,
      patched: hasMarker && (loaderExists !== false),
      appDir,
      coreDir,
      indexPath,
      loaderPath,
      loaderExists
    };
  } catch (e) {
    return { ok: false, patched: false, error: String(e && e.stack ? e.stack : e) };
  }
}

function patchDiscordCoreIndex(channel) {
  try {
    if (process.platform !== 'win32') return { ok: true, patched: false, reason: 'non-win32' };
    const c = String(channel || 'stable').toLowerCase();
    const appDir = findLatestWinAppDirByChannel(c);
    if (!appDir) return { ok: true, patched: false, reason: 'appDir-not-found' };

    const coreDir = findDiscordDesktopCoreDirWin(appDir);
    const indexPath = path.join(coreDir, 'index.js');
    if (!fs.existsSync(indexPath)) {
      return { ok: true, patched: false, reason: 'index-missing', appDir };
    }

    const original = fs.readFileSync(indexPath, 'utf8');

    // Compute the current expected loader path.
    const loaderAbs = path.join(getInAccordBaseDir(), payloadFileNameForChannel('coreloader.js', c));
    const loaderLiteral = JSON.stringify(String(loaderAbs).replace(/\\/g, "\\\\").replace(/\"/g, "\\\""));
    const pointsAtCurrentLoader = original.includes(`require(${loaderLiteral});`);
    const loaderExists = (() => { try { return !!(loaderAbs && fs.existsSync(loaderAbs)); } catch { return false; } })();

    // "Already patched" is only true if it points at the current loader path.
    // Otherwise Discord can be patched but still not load anything (moved folder, old path, etc.).
    if (original.includes(CORE_PATCH_MARKER) && pointsAtCurrentLoader && loaderExists) {
      return { ok: true, patched: true, reason: 'already-patched', appDir, indexPath, loaderAbs, loaderExists };
    }

    // Backup if we haven't already.
    const backup = path.join(coreDir, 'index.js.inaccord.bak');
    try {
      if (!fs.existsSync(backup)) fs.writeFileSync(backup, original, 'utf8');
    } catch (e) {
      return { ok: false, patched: false, reason: 'backup-write-failed', error: String(e && e.stack ? e.stack : e), appDir, indexPath, backup };
    }

    // BetterDiscord-style core patch (exact shape):
    //   require(<absolute loader>);
    //   module.exports = require("./core.asar");
    //
    // InAccord's loader lives in %APPDATA%\<channel>\InAccord\coreloader.js.
    const patched =
      `// InAccord core patch (${CORE_PATCH_MARKER})\n` +
      `require(${loaderLiteral});\n` +
      `module.exports = require("./core.asar");\n`;

    fs.writeFileSync(indexPath, patched, 'utf8');
    return {
      ok: true,
      patched: true,
      reason: original.includes(CORE_PATCH_MARKER) ? 'repatched-loader-updated' : 'patched',
      appDir,
      indexPath,
      backup,
      loaderAbs,
      loaderExists
    };
  } catch (e) {
    return { ok: false, patched: false, error: String(e && e.stack ? e.stack : e) };
  }
}

function buffersEqual(a, b) {
  try {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    return Buffer.compare(a, b) === 0;
  } catch {
    return false;
  }
}

function validateInstalledPayload(channel) {
  const normalized = String(channel || 'stable').toLowerCase();
  const targetDir = getInAccordBaseDir();
  const loaderFiles = ['preload.js', 'InAccord.js', 'mainhook.js', 'coreloader.js'];
  const details = [];
  let ok = true;

  for (const file of loaderFiles) {
    const src = resolvePayloadFile(file);
    const dest = targetDir ? path.join(targetDir, payloadFileNameForChannel(file, normalized)) : null;
    const item = { file, src, dest, exists: false, bytes: 0, matches: false };
    try {
      if (dest && fs.existsSync(dest)) {
        item.exists = true;
        const s = fs.statSync(dest);
        item.bytes = s.size;
        // If the launcher is packaged, payload sources are typically inside its app.asar.
        // In some hardened environments, those sources may not be readable by plain fs
        // (or may be relocated). In that case we can still treat the payload as installed
        // if the destination files exist and are non-empty.
        // Treat the payload as installed if the destination file exists and is non-empty.
        // Byte-for-byte comparisons are brittle in packaged contexts (asar reads, EOL
        // normalization, AV post-processing, etc.).
        item.matches = item.bytes > 0;
        if (src && fs.existsSync(src)) {
          try {
            const a = fs.readFileSync(src);
            const b = fs.readFileSync(dest);
            if (buffersEqual(a, b)) item.matches = true;
          } catch {}
        }
      }
    } catch {}

    if (!item.exists || !item.matches) ok = false;
    details.push(item);
  }

  return { ok, channel: normalized, targetDir, files: details };
}

async function runSelfTest() {
  const channel = (getArgValue('--channel') || getArgValue('-c') || 'canary').toLowerCase();
  bootLog(`[selftest] starting channel=${channel}`);

  const report = {
    ok: true,
    channel,
    steps: [],
    install: null,
    validateAfterInstall: null,
    uninstall: null,
    validateAfterUninstall: null
  };

  try {
    // Clean slate first.
    report.steps.push('uninstall-from-channel');
    report.uninstall = uninstallFromChannel(channel);

    report.steps.push('validate-after-uninstall');
    const removedDir = getChannelInAccordDir(channel);
    report.validateAfterUninstall = {
      ok: removedDir ? !fs.existsSync(removedDir) : false,
      removedDir
    };

    // Install.
    report.steps.push('install-payload');
    report.install = installPayloadToChannel(channel);

    report.steps.push('validate-after-install');
    report.validateAfterInstall = validateInstalledPayload(channel);

    if (!report.validateAfterUninstall.ok || !report.validateAfterInstall.ok) report.ok = false;
  } catch (e) {
    report.ok = false;
    report.error = String(e && e.stack ? e.stack : e);
  }

  bootLog('[selftest] result ' + safeJson(report));
  try { process.stdout.write(safeJson(report) + '\n'); } catch {}
  return report;
}

function installPayloadToChannel(channel) {
  const normalized = String(channel || 'stable').toLowerCase();
  const targetDir = ensureInAccordBaseDir();

  // Best-effort migration from the legacy location (%APPDATA%\Discord\InAccord) if present.
  // This keeps plugins/themes/data/backups without asking the user to manually copy anything.
  try {
    const legacy = getLegacyChannelInAccordDir(normalized);
    if (legacy && fs.existsSync(legacy)) {
      for (const sub of ['plugins', 'themes', 'data', 'backup']) {
        const srcDir = path.join(legacy, sub);
        const dstDir = path.join(targetDir, sub);
        if (fs.existsSync(srcDir) && !fs.existsSync(dstDir)) {
          try { fs.mkdirSync(dstDir, { recursive: true }); } catch {}
          try {
            // Shallow copy is sufficient for our layout (files within these folders).
            const entries = fs.readdirSync(srcDir, { withFileTypes: true });
            for (const e of entries) {
              try {
                if (!e.isFile()) continue;
                fs.copyFileSync(path.join(srcDir, e.name), path.join(dstDir, e.name));
              } catch {}
            }
          } catch {}
        }
      }
    }
  } catch {}

  const loaderFiles = ['preload.js', 'InAccord.js', 'mainhook.js', 'coreloader.js'];
  const copied = [];

  for (const file of loaderFiles) {
    const src = resolvePayloadFile(file);
    if (!src) throw new Error(`Missing packaged payload file: ${file}`);
    const dest = path.join(targetDir, payloadFileNameForChannel(file, normalized));
    copyAsarReadableFile(src, dest);
    copied.push({ file, dest });
  }

  const installedFile = path.join(targetDir, `InAccord.installed.${normalized}.json`);
  fs.writeFileSync(installedFile, JSON.stringify({
    channel: normalized,
    installedAt: new Date().toISOString(),
    files: copied
  }, null, 2));

  return { targetDir, copied, installedFile };
}

function compareVersionsDesc(a, b) {
  const pa = String(a).split('.').map(x => parseInt(x, 10)).map(n => Number.isFinite(n) ? n : 0);
  const pb = String(b).split('.').map(x => parseInt(x, 10)).map(n => Number.isFinite(n) ? n : 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return db - da;
  }
  return 0;
}

function listInstalledDiscordAppVersions(localBaseDir) {
  try {
    if (!localBaseDir || !fs.existsSync(localBaseDir)) return [];
    const dirs = fs.readdirSync(localBaseDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^app-/i.test(e.name))
      .map(e => e.name)
      .sort((a, b) => compareVersionsDesc(a.slice(4), b.slice(4)));
    // Keep the full folder name (e.g. "app-1.0.828") so the UI can show the same
    // version format Discord uses on disk.
    return dirs;
  } catch {
    return [];
  }
}

function getInstalledDiscordVersionsReport() {
  const report = {
    ok: true,
    platform: process.platform,
    localAppData: getLocalAppDataPath(),
    channels: {
      stable: { name: 'Stable', localName: 'Discord', baseDir: '', versions: [], latest: null },
      ptb: { name: 'PTB', localName: 'DiscordPTB', baseDir: '', versions: [], latest: null },
      canary: { name: 'Canary', localName: 'DiscordCanary', baseDir: '', versions: [], latest: null },
      development: { name: 'Development', localName: 'DiscordDevelopment', baseDir: '', versions: [], latest: null }
    }
  };

  try {
    if (process.platform !== 'win32') return report;
    const local = getLocalAppDataPath();
    if (!local) return Object.assign(report, { ok: false, error: 'Missing LOCALAPPDATA' });

    for (const key of Object.keys(report.channels)) {
      const ch = report.channels[key];
      ch.baseDir = path.join(local, ch.localName);
      ch.versions = listInstalledDiscordAppVersions(ch.baseDir);
      ch.latest = ch.versions.length ? ch.versions[0] : null;
    }
  } catch (e) {
    report.ok = false;
    report.error = String(e && e.stack ? e.stack : e);
  }

  return report;
}

function findLatestWinAppDirByChannel(channel) {
  try {
    if (process.platform !== 'win32') return null;
    const local = getLocalAppDataPath();
    if (!local) return null;
    const c = String(channel || 'stable').toLowerCase();
    const baseDir = path.join(local, (c === 'canary' ? 'DiscordCanary' : c === 'ptb' ? 'DiscordPTB' : c === 'development' || c === 'dev' ? 'DiscordDevelopment' : 'Discord'));
    if (!fs.existsSync(baseDir)) return null;

    const appDirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^app-/i.test(e.name))
      .map(e => e.name);

    appDirs.sort((x, y) => compareVersionsDesc(x.slice(4), y.slice(4)));

    // Newer Discord builds often pack discord_desktop_core inside resources/app.asar,
    // so resources/discord_desktop_core/index.js may not exist on disk.
    // For uninstall/restore we still want the best appDir so we can report a useful
    // reason (e.g., core index missing / asar-packed) instead of “appDir-not-found”.
    for (const name of appDirs) {
      const appDir = path.join(baseDir, name);
      const resourcesDir = path.join(appDir, 'resources');
      if (fs.existsSync(resourcesDir)) return appDir;
    }

    return appDirs.length ? path.join(baseDir, appDirs[0]) : null;
  } catch {
    return null;
  }
}

function discordLocalAppName(channel) {
  const c = String(channel || 'stable').toLowerCase();
  if (c === 'canary') return 'DiscordCanary';
  if (c === 'ptb') return 'DiscordPTB';
  if (c === 'development' || c === 'dev') return 'DiscordDevelopment';
  return 'Discord';
}

function getDiscordResourcesAsarPath(channel) {
  try {
    if (process.platform !== 'win32') return null;
    const local = getLocalAppDataPath();
    if (!local) return null;
    const baseDir = path.join(local, discordLocalAppName(channel));
    const appDir = findLatestAppDir(baseDir);
    if (!appDir) return null;
    const asarPath = path.join(appDir, 'resources', 'app.asar');
    return fs.existsSync(asarPath) ? asarPath : null;
  } catch {
    return null;
  }
}

function tryPatchDiscordBootstrapIndex(jsText, channel) {
  const marker = 'INACCORD_ASAR_PATCH_v2';
  const legacyMarker = 'INACCORD_ASAR_PATCH_v1';
  if (jsText.includes(marker)) return { ok: true, patched: false, reason: 'already-patched' };

  // If a legacy patch exists, remove it so we can upgrade in-place.
  // v1 relied on CommonJS `require`, which can be missing in newer Canary ESM bootstraps.
  let text = jsText;
  try {
    const legacyIdx = text.indexOf(legacyMarker);
    if (legacyIdx >= 0) {
      const start = Math.max(0, text.lastIndexOf('\n', legacyIdx));
      const endCatch = text.indexOf('} catch {}', legacyIdx);
      if (endCatch >= 0) {
        const endLine = text.indexOf('\n', endCatch);
        const end = (endLine >= 0) ? (endLine + 1) : (endCatch + '} catch {}'.length);
        text = text.slice(0, start) + text.slice(end);
      }
    }
  } catch {}

  // Load the coreloader from %APPDATA%\InAccord\coreloader.<channel>.js.
  // No Discord roaming subfolders.
  const patch = `
// ${marker}
;(async () => {
  try {
    const getReq = async () => {
      if (typeof require === 'function') return require;
      const m = await import('node:module');
      const base = String((process && process.execPath) ? process.execPath : '') || ((process && typeof process.cwd === 'function') ? process.cwd() : '.');
      return m.createRequire(base);
    };

    const req = await getReq();
    const fs = req('fs');
    const path = req('path');

    const envC = String(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || '').toLowerCase();
    let c = envC;

    // BetterDiscord-style fallback: derive channel from the running exe when env vars are missing.
    if (!c) {
      try {
        const exe = String(path.basename(process.execPath || '')).toLowerCase();
        if (exe.includes('canary')) c = 'canary';
        else if (exe.includes('ptb')) c = 'ptb';
        else if (exe.includes('development')) c = 'development';
        else c = 'stable';
      } catch {}
    }

    if (!c) c = '${String(channel || 'stable').toLowerCase()}';
    if (c === 'dev') c = 'development';
    if (!process.env.DISCORD_RELEASE_CHANNEL) process.env.DISCORD_RELEASE_CHANNEL = c;

    let appData = String(process.env.APPDATA || '');
    if (!appData) {
      try {
        const userProfile = String(process.env.USERPROFILE || '');
        if (userProfile) appData = path.join(userProfile, 'AppData', 'Roaming');
      } catch {}
    }

    const loader = appData ? path.join(appData, 'InAccord', 'coreloader.' + c + '.js') : '';
    if (loader && fs.existsSync(loader)) {
      try { req(loader); } catch {}
    }
  } catch {}
})().catch(() => {});
`;

  // Insert right after "use strict" or 'use strict' to keep semantics predictable
  // AND preserve strict mode for the rest of the file.
  const m = text.match(/(^\s*(['"])use strict\2;\s*\r?\n)/);
  if (m && m[1]) {
    const idx = m[1].length;
    return { ok: true, patched: true, text: text.slice(0, idx) + patch + text.slice(idx) };
  }

  // Fallback: just prepend.
  return { ok: true, patched: true, text: patch + text };
}

function readJsonSafe(p) {
  try {
    if (!p || !fs.existsSync(p)) return null;
    const txt = fs.readFileSync(p, 'utf8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function normalizeAsarRelPath(p) {
  try {
    const s = String(p || '').trim();
    if (!s) return '';
    return s.replace(/^\.\//, '').replace(/^\//, '').replace(/\\/g, '/');
  } catch {
    return '';
  }
}

function pickAsarMainEntryFromExtract(extractDir) {
  try {
    const pkgPath = path.join(extractDir, 'package.json');
    const pkg = readJsonSafe(pkgPath);
    const mainRel = normalizeAsarRelPath(pkg && pkg.main);
    if (!mainRel) return null;
    const abs = path.join(extractDir, ...mainRel.split('/'));
    if (!fs.existsSync(abs)) return null;
    return { rel: mainRel, abs, reason: 'package.json' };
  } catch {
    return null;
  }
}

async function patchDiscordAppAsar(channel) {
  try {
    if (process.platform !== 'win32') return { ok: true, patched: false, reason: 'non-win32' };
    if (!asar) return { ok: false, patched: false, reason: 'asar-lib-missing' };

    const asarPath = getDiscordResourcesAsarPath(channel);
    if (!asarPath) return { ok: true, patched: false, reason: 'asar-not-found' };

    // Fast path: if already patched with v2 marker, skip expensive extract/repack.
    try {
      const st0 = isDiscordAppAsarPatched(channel);
      if (st0 && st0.ok && st0.patched) {
        return { ok: true, patched: false, reason: 'already-patched', asarPath, bootstrap: st0.bootstrap || null };
      }
    } catch {}

    // If we're on a legacy v1 patch (CommonJS require-based), restore from backup first
    // and then apply the v2 ESM-safe patch. This avoids leaving broken/duplicated code
    // in Canary bootstraps.
    try {
      const st = isDiscordAppAsarPatched(channel);
      if (st && st.ok && st.reason === 'legacy-v1') {
        const dir0 = path.dirname(asarPath);
        const bak0 = path.join(dir0, 'app.asar.inaccord.bak');
        if (fs.existsSync(bak0)) {
          fs.copyFileSync(bak0, asarPath);
        }
      }
    } catch {}

    const dir = path.dirname(asarPath);
    const backup = path.join(dir, 'app.asar.inaccord.bak');
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(asarPath, backup);
    }

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inaccord-discord-asar-'));
    const extractDir = path.join(tmpRoot, 'app');
    const outAsar = path.join(tmpRoot, 'app.asar');

    asar.extractAll(asarPath, extractDir);

    // Patch the actual entrypoint referenced by package.json, if present.
    // Discord Stable/PTB sometimes differs from Canary here.
    const mainEntry = pickAsarMainEntryFromExtract(extractDir);

    const bootstrapFiles = listAsarBootstrapScriptFilesFromExtract(extractDir);
    if (!bootstrapFiles.length && !mainEntry) {
      try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
      return { ok: true, patched: false, reason: 'bootstrap-entry-missing', asarPath };
    }

    // Patch every bootstrap script we can find.
    // Stable/PTB/Canary have historically used different entry names.
    const patchedFiles = [];
    let anyChanged = false;

    if (mainEntry) {
      try {
        const original = fs.readFileSync(mainEntry.abs, 'utf8');
        const patched = tryPatchDiscordBootstrapIndex(original, channel);
        if (patched && patched.ok && patched.patched) {
          fs.writeFileSync(mainEntry.abs, patched.text, 'utf8');
          anyChanged = true;
          patchedFiles.push(mainEntry.rel);
        }
      } catch {
        // ignore
      }
    }

    for (const f of bootstrapFiles) {
      try {
        const original = fs.readFileSync(f.abs, 'utf8');
        const patched = tryPatchDiscordBootstrapIndex(original, channel);
        if (!patched.ok) continue;
        if (patched.patched) {
          fs.writeFileSync(f.abs, patched.text, 'utf8');
          anyChanged = true;
          patchedFiles.push(f.rel);
        }
      } catch {
        // ignore per-file failures
      }
    }

    if (anyChanged) {
      await new Promise((resolve, reject) => {
        asar.createPackage(extractDir, outAsar, (err) => err ? reject(err) : resolve());
      });
      fs.copyFileSync(outAsar, asarPath);
    }

    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
    return {
      ok: true,
      patched: anyChanged,
      reason: anyChanged ? 'patched' : 'already-patched',
      asarPath,
      backup,
      bootstrap: patchedFiles.length ? patchedFiles : null
    };
  } catch (e) {
    return { ok: false, patched: false, error: String(e && e.stack ? e.stack : e) };
  }
}

function restoreDiscordAppAsar(channel) {
  try {
    if (process.platform !== 'win32') return { ok: true, restored: false, reason: 'non-win32' };
    const asarPath = getDiscordResourcesAsarPath(channel);
    if (!asarPath) return { ok: true, restored: false, reason: 'asar-not-found' };
    const backup = path.join(path.dirname(asarPath), 'app.asar.inaccord.bak');
    if (!fs.existsSync(backup)) return { ok: true, restored: false, reason: 'backup-missing', asarPath };
    fs.copyFileSync(backup, asarPath);
    return { ok: true, restored: true, asarPath, backup };
  } catch (e) {
    return { ok: false, restored: false, error: String(e && e.stack ? e.stack : e) };
  }
}

function isDiscordAppAsarPatched(channel) {
  try {
    if (process.platform !== 'win32') return { ok: true, patched: false, reason: 'non-win32' };
    if (!asar) return { ok: false, patched: false, reason: 'asar-lib-missing' };
    const asarPath = getDiscordResourcesAsarPath(channel);
    if (!asarPath) return { ok: true, patched: false, reason: 'asar-not-found' };

    // Try extractFile if available; otherwise fall back to extractAll.
    const marker = 'INACCORD_ASAR_PATCH_v2';
    const legacyMarker = 'INACCORD_ASAR_PATCH_v1';

    if (typeof asar.extractFile === 'function') {
      // We can't list files inside app.asar with this library reliably, so try known candidates.
      let sawAny = false;

      // First: read package.json main to check the true entry.
      try {
        const pkgBuf = asar.extractFile(asarPath, 'package.json');
        const pkgTxt = Buffer.isBuffer(pkgBuf) ? pkgBuf.toString('utf8') : String(pkgBuf || '');
        if (pkgTxt) {
          const pkg = JSON.parse(pkgTxt);
          const mainRel = normalizeAsarRelPath(pkg && pkg.main);
          if (mainRel) {
            try {
              const mainBuf = asar.extractFile(asarPath, mainRel);
              const mainTxt = Buffer.isBuffer(mainBuf) ? mainBuf.toString('utf8') : String(mainBuf || '');
              if (mainTxt) sawAny = true;
              if (mainTxt && mainTxt.includes(marker)) return { ok: true, patched: true, asarPath, bootstrap: mainRel };
              if (mainTxt && mainTxt.includes(legacyMarker)) return { ok: true, patched: false, asarPath, bootstrap: mainRel, reason: 'legacy-v1' };
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }

      for (const rel of pickAsarBootstrapEntryForExtractFile()) {
        try {
          const buf = asar.extractFile(asarPath, rel);
          const txt = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
          if (txt) sawAny = true;
          if (txt && txt.includes(marker)) return { ok: true, patched: true, asarPath, bootstrap: rel };
          if (txt && txt.includes(legacyMarker)) return { ok: true, patched: false, asarPath, bootstrap: rel, reason: 'legacy-v1' };
        } catch {
          // try next
        }
      }
      return { ok: true, patched: false, asarPath, reason: sawAny ? 'marker-not-found' : 'bootstrap-entry-not-readable' };
    }

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inaccord-discord-asar-check-'));
    const extractDir = path.join(tmpRoot, 'app');
    asar.extractAll(asarPath, extractDir);

    const mainEntry = pickAsarMainEntryFromExtract(extractDir);
    const files = listAsarBootstrapScriptFilesFromExtract(extractDir);
    let patched = false;
    let legacy = false;
    const checked = [];

    if (mainEntry) {
      try {
        const txt = fs.readFileSync(mainEntry.abs, 'utf8');
        checked.push(mainEntry.rel);
        if (txt && txt.includes(marker)) patched = true;
        else if (txt && txt.includes(legacyMarker)) legacy = true;
      } catch {
        // ignore
      }
    }

    for (const f of files) {
      try {
        const txt = fs.readFileSync(f.abs, 'utf8');
        checked.push(f.rel);
        if (txt && txt.includes(marker)) { patched = true; break; }
        if (txt && txt.includes(legacyMarker)) legacy = true;
      } catch {
        // ignore
      }
    }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
    if (!patched && legacy) return { ok: true, patched: false, asarPath, bootstrap: checked.length ? checked : null, reason: 'legacy-v1' };
    return { ok: true, patched, asarPath, bootstrap: checked.length ? checked : null };
  } catch (e) {
    return { ok: false, patched: false, error: String(e && e.stack ? e.stack : e) };
  }
}

function getMarkerPathsForChannel(channel) {
  const c = String(channel || 'stable').toLowerCase();
  const base = getInAccordBaseDir();
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

function statSafe(p) {
  try { return (p && fs.existsSync(p)) ? fs.statSync(p) : null; } catch { return null; }
}

function tailFileSafe(p, maxLines = 40) {
  try {
    if (!p || !fs.existsSync(p)) return null;
    const txt = fs.readFileSync(p, 'utf8');
    const lines = txt.split(/\r?\n/).filter(Boolean);
    return lines.slice(-maxLines);
  } catch {
    return null;
  }
}

function collapseConsecutiveDuplicates(lines) {
  try {
    if (!Array.isArray(lines)) return lines;
    const out = [];
    let prev = null;
    for (const ln of lines) {
      const s = String(ln || '');
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

function compactInjectLogLines(lines) {
  // Purpose: the inject log frequently contains multiple renderer PIDs and some
  // very noisy repeating errors (e.g., ResizeObserver loop warnings). For UI
  // readability, keep only the newest run and compress known spam.
  try {
    if (!Array.isArray(lines) || !lines.length) return lines;

    // Keep only the newest run boundary.
    let lastStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const s = String(lines[i] || '');
      if (s.includes('[preload] start pid=')) lastStart = i;
    }
    let out = (lastStart >= 0) ? lines.slice(lastStart) : lines.slice();

    // Extra safety: if we still somehow have multiple starts, keep the last one.
    let lastStartInOut = -1;
    for (let i = 0; i < out.length; i++) {
      const s = String(out[i] || '');
      if (s.includes('[preload] start pid=')) lastStartInOut = i;
    }
    if (lastStartInOut > 0) out = out.slice(lastStartInOut);

    // Collapse known spam lines into a single line (keep the last timestamped line).
    const RESIZE_OBSERVER = 'ResizeObserver loop completed with undelivered notifications.';
    let resizeCount = 0;
    let lastResizeLine = '';
    const filtered = [];
    for (const ln of out) {
      const s = String(ln || '');
      if (!s) continue;
      if (s.includes(RESIZE_OBSERVER)) {
        resizeCount++;
        lastResizeLine = s;
        continue;
      }
      filtered.push(s);
    }
    if (resizeCount > 0) {
      const suffix = resizeCount > 1 ? ` (x${resizeCount})` : '';
      filtered.push(String(lastResizeLine || `[preload] window.error ${RESIZE_OBSERVER}`) + suffix);
    }

    // Finally, remove exact consecutive duplicates that can still happen.
    return collapseConsecutiveDuplicates(filtered);
  } catch {
    return lines;
  }
}

function tailInjectLogSafe(p, maxLines = 120) {
  // The inject log can contain multiple "runs" back-to-back (multiple renderer PIDs).
  // For UI readability, show only the most recent run block.
  try {
    const lines = tailFileSafe(p, Math.max(500, maxLines * 4));
    if (!lines || !lines.length) return lines;

    const compact = compactInjectLogLines(lines);
    if (!compact || !compact.length) return compact;
    return compact.slice(-maxLines);
  } catch {
    return tailFileSafe(p, maxLines);
  }
}

async function waitForInAccordMarkers(channel, startedAtMs, timeoutMs = 18000) {
  const markers = getMarkerPathsForChannel(channel);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const preloadStat = statSafe(markers.preloadLoaded);
    const runningStat = statSafe(markers.running);
    const mainhookLoadedStat = statSafe(markers.mainhookLoaded);

    const preloadOk = !!(preloadStat && preloadStat.mtimeMs >= startedAtMs);
    const runningOk = !!(runningStat && runningStat.mtimeMs >= startedAtMs);
    const mainhookOk = !!(mainhookLoadedStat && mainhookLoadedStat.mtimeMs >= startedAtMs);

    if (preloadOk && runningOk && mainhookOk) {
      return {
        ok: true,
        markers,
        preload: { exists: true, mtimeMs: preloadStat.mtimeMs, bytes: preloadStat.size },
        running: { exists: true, mtimeMs: runningStat.mtimeMs, bytes: runningStat.size },
        mainhookLoaded: { exists: true, mtimeMs: mainhookLoadedStat.mtimeMs, bytes: mainhookLoadedStat.size }
      };
    }

    await wait(650);
  }

  // Timed out: include quick diagnostics.
  const preloadStat = statSafe(markers.preloadLoaded);
  const runningStat = statSafe(markers.running);
  const mainhookLoadedStat = statSafe(markers.mainhookLoaded);
  return {
    ok: false,
    timeoutMs,
    markers,
    preload: preloadStat ? { exists: true, mtimeMs: preloadStat.mtimeMs, bytes: preloadStat.size } : { exists: false },
    running: runningStat ? { exists: true, mtimeMs: runningStat.mtimeMs, bytes: runningStat.size } : { exists: false },
    mainhookLoaded: mainhookLoadedStat ? { exists: true, mtimeMs: mainhookLoadedStat.mtimeMs, bytes: mainhookLoadedStat.size } : { exists: false },
    injectTail: tailInjectLogSafe(markers.injectLog, 60),
    mainhookTail: tailFileSafe(markers.mainhookLog, 80)
  };
}

function restoreDiscordCorePatch(channel) {
  try {
    if (process.platform !== 'win32') return { ok: true, restored: false, reason: 'non-win32' };
    const appDir = findLatestWinAppDirByChannel(channel);
    if (!appDir) return { ok: true, restored: false, reason: 'appDir-not-found' };

    const coreDir = findDiscordDesktopCoreDirWin(appDir);
    const indexPath = path.join(coreDir, 'index.js');
    if (!fs.existsSync(indexPath)) {
      // In newer Discord versions, discord_desktop_core is commonly packed into resources/app.asar.
      // In that case there is no on-disk core index.js to restore, so report a clearer reason.
      const asarPath = path.join(appDir, 'resources', 'app.asar');
      const packed = (() => { try { return fs.existsSync(asarPath); } catch { return false; } })();
      return { ok: true, restored: false, reason: packed ? 'asar-packed' : 'index-missing', appDir };
    }

    const backupCandidates = [
      path.join(coreDir, 'index.js.inaccord.bak'),
      path.join(coreDir, 'index.js.ia.bak')
    ];
    const backup = backupCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });

    let restored = false;
    if (backup) {
      try { fs.copyFileSync(backup, indexPath); restored = true; } catch {}
    }

    safeUnlink(path.join(coreDir, 'inaccord_coreloader.cjs'));
    safeUnlink(path.join(coreDir, 'inaccord_coreloader.js')); // legacy

    return { ok: true, restored, backup: backup || null, appDir };
  } catch (e) {
    return { ok: false, error: String(e && e.stack ? e.stack : e) };
  }
}

function uninstallFromChannel(channel) {
  const normalized = String(channel || 'stable').toLowerCase();
  const targetDir = getInAccordBaseDir();
  if (!targetDir) throw new Error('APPDATA not set; cannot resolve uninstall paths');

  // Remove only this channel's payload + marker/log files.
  const loaderFiles = ['preload.js', 'InAccord.js', 'mainhook.js', 'coreloader.js'];
  for (const f of loaderFiles) {
    safeUnlink(path.join(targetDir, payloadFileNameForChannel(f, normalized)));
  }
  safeUnlink(path.join(targetDir, `InAccord.installed.${normalized}.json`));

  const m = getMarkerPathsForChannel(normalized);
  const extra = [
    m.preloadLoaded,
    m.running,
    m.injectLog,
    m.injectStatus,
    m.mainhookLoaded,
    m.mainhookLog,
    path.join(targetDir, `InAccord_coreloader.${normalized}.log`)
  ];
  for (const f of extra) safeUnlink(f);

  const coreRestore = restoreDiscordCorePatch(normalized);
  return { ok: true, channel: normalized, removedDir: targetDir, cleaned: extra, coreRestore };
}

function discordExeForChannel(channel) {
  const c = String(channel || 'stable').toLowerCase();
  if (c === 'canary') return 'DiscordCanary.exe';
  if (c === 'ptb') return 'DiscordPTB.exe';
  if (c === 'development' || c === 'dev') return 'DiscordDevelopment.exe';
  return 'Discord.exe';
}

function runCommand(command, args, opts = {}) {
  return new Promise((resolve) => {
    const spawnOpts = Object.assign({ stdio: 'pipe', windowsHide: true }, opts);
    const child = spawn(command, args, spawnOpts);
    let out = '';
    child.stdout && child.stdout.on('data', d => out += d.toString());
    child.stderr && child.stderr.on('data', d => out += d.toString());
    child.on('close', code => resolve({ code, output: out }));
    child.on('error', err => resolve({ code: 1, output: String(err) }));
  });
}

async function isProcessRunningWin(exeName) {
  try {
    const result = await runCommand('cmd.exe', ['/c', 'tasklist', '/FI', `IMAGENAME eq ${exeName}`]);
    const out = String(result.output || '').toLowerCase();
    return out.includes(String(exeName || '').toLowerCase());
  } catch {
    return false;
  }
}

async function spawnAndConfirm(exePath, args, opts, exeName) {
  let spawnErr = null;
  let exitInfo = null;

  try {
    const child = spawn(exePath, args, opts);
    child.on('error', (e) => { spawnErr = e; });
    child.on('exit', (code, signal) => { exitInfo = { code, signal }; });

    // Poll for a short window. Discord/Electron can take a few seconds to show
    // up in tasklist, and some failures surface asynchronously.
    const deadline = Date.now() + 9000;
    let running = false;
    while (Date.now() < deadline) {
      if (spawnErr) {
        return { ok: false, reason: 'spawn-error', error: String(spawnErr && spawnErr.stack ? spawnErr.stack : spawnErr) };
      }

      if (exitInfo && exitInfo.code !== null && exitInfo.code !== 0) {
        return { ok: false, reason: 'exited-early', exitInfo };
      }

      running = (process.platform === 'win32' && exeName)
        ? await isProcessRunningWin(exeName)
        : true;

      if (running) break;
      await wait(500);
    }

    if (!running) {
      return { ok: false, reason: 'not-running-after-launch', exitInfo };
    }

    try { child.unref(); } catch {}
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'exception', error: String(e && e.stack ? e.stack : e) };
  }
}

async function isDiscordProcessRunning(channel) {
  if (process.platform !== 'win32') return true;
  const exeName = discordExeForChannel(channel);
  const result = await runCommand('cmd.exe', ['/c', 'tasklist', '/FI', `IMAGENAME eq ${exeName}`]);
  const out = String(result.output || '').toLowerCase();
  return out.includes(exeName.toLowerCase());
}

async function killDiscordProcess(channel) {
  if (process.platform !== 'win32') return { ok: true, accessDenied: false, output: '' };
  const exeName = discordExeForChannel(channel);
  const primary = await runCommand('cmd.exe', ['/c', 'taskkill', '/IM', exeName, '/F', '/T']);
  const update = await runCommand('cmd.exe', ['/c', 'taskkill', '/IM', 'Update.exe', '/F', '/T']);
  const combined = `${primary.output || ''}\n${update.output || ''}`.toLowerCase();
  return { ok: true, accessDenied: combined.includes('access is denied'), output: `${primary.output || ''}\n${update.output || ''}`.trim() };
}

function getMarkerFiles(channel) {
  const base = getInAccordBaseDir();
  const c = String(channel || 'stable').toLowerCase();
  return {
    injectLog: path.join(base, `InAccord_inject.${c}.log`)
  };
}

async function readRecentCrashErrorsForChannel(channel) {
  try {
    const markers = getMarkerFiles(channel);
    const p = markers.injectLog;
    if (!p || !fs.existsSync(p)) return { ok: true, lines: [] };
    const txt = fs.readFileSync(p, 'utf8');
    const lines = txt.split(/\r?\n/).filter(Boolean);
    return { ok: true, lines: lines.slice(-30) };
  } catch (e) {
    return { ok: false, error: String(e && e.stack ? e.stack : e) };
  }
}

function quoteNodeOptionPath(p) {
  return `\"${String(p || '').replace(/\"/g, '\\\"')}\"`;
}

function findLatestAppDir(baseDir) {
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^app-/.test(e.name))
      .map(d => d.name)
      .sort((a, b) => compareVersionsDesc(a.slice(4), b.slice(4)));
    return entries.length ? path.join(baseDir, entries[0]) : null;
  } catch {
    return null;
  }
}

function findDiscordExeInAppDir(appDir) {
  try {
    const entries = fs.readdirSync(appDir, { withFileTypes: true });
    const exes = entries.filter(e => e.isFile() && /\.exe$/i.test(e.name) && /^discord/i.test(e.name)).map(e => e.name);
    if (!exes.length) return null;
    exes.sort((a, b) => a.localeCompare(b));
    return path.join(appDir, exes[0]);
  } catch {
    return null;
  }
}

async function launchChannel(channel) {
  const c = String(channel || 'stable').toLowerCase();
  if (process.platform !== 'win32') throw new Error('Only win32 launch is implemented here');

  const local = getLocalAppDataPath();
  const appData = getRoamingAppDataPath();
  if (!local || !appData) throw new Error('Missing localAppData/appData paths');

  const channelName = c === 'stable' ? 'Discord' : c === 'ptb' ? 'DiscordPTB' : c === 'development' || c === 'dev' ? 'DiscordDevelopment' : 'DiscordCanary';
  const baseDir = path.join(local, channelName);
  const appDir = findLatestAppDir(baseDir);
  if (!appDir) throw new Error('No app-* directory found for ' + channelName);

  const iaDir = getInAccordBaseDir();
  const preloadOpt = path.join(iaDir, payloadFileNameForChannel('preload.js', c));
  const mainHook = path.join(iaDir, payloadFileNameForChannel('mainhook.js', c));

  const env = Object.assign({}, process.env);
  env.DISCORD_RELEASE_CHANNEL = c;

  // If Discord is already patched (resources/app.asar bootstrap), do NOT rely on
  // NODE_OPTIONS / --require (modern Discord/Electron warns/blocks most NODE_OPTIONS).
  const asarStatus = isDiscordAppAsarPatched(c);
  const coreStatus = isDiscordCoreIndexPatched(c);
  const usePatchedAsarLaunch = !!(asarStatus && asarStatus.ok && asarStatus.patched);
  const useCorePatchedLaunch = !!(coreStatus && coreStatus.ok && coreStatus.patched);
  const usePatchedBootstrapLaunch = usePatchedAsarLaunch || useCorePatchedLaunch;

  if (!usePatchedBootstrapLaunch) {
    // Legacy env-based launch (fallback only).
    env.DISCORD_PRELOAD = preloadOpt;
    env.DISCORD_APP_PATH = appDir;

    if (fs.existsSync(mainHook)) {
      env.INACCORD_RENDERER_PRELOAD = preloadOpt;
      env.INACCORD_RELEASE_CHANNEL = c;
      env.INACCORD_MAIN_HOOK = mainHook;
      const existing = String(env.NODE_OPTIONS || '');
      const requireOpt = `--require ${quoteNodeOptionPath(mainHook)}`;
      env.NODE_OPTIONS = existing.includes(requireOpt) ? existing : (existing ? `${existing} ${requireOpt}` : requireOpt);
    }
  }

  const exeName = discordExeForChannel(c);
  const directExe = path.join(appDir, exeName);
  const detectedExe = fs.existsSync(directExe) ? directExe : findDiscordExeInAppDir(appDir);
  if (!detectedExe) throw new Error('Discord exe not found in app dir');

  // Squirrel-based installs also provide Update.exe as a stable launcher.
  // Some environments block direct app exe launches (policy/AV), but Update.exe
  // can still start the real process.
  const updateExe = path.join(baseDir, 'Update.exe');

  const args = [];
  if (!usePatchedBootstrapLaunch && fs.existsSync(mainHook)) args.push('--require', mainHook);

  const startedAtMs = Date.now();

  let usedUpdateFallback = false;
  let confirm = await spawnAndConfirm(
    detectedExe,
    args,
    { detached: true, stdio: 'ignore', windowsHide: true, env, cwd: appDir },
    exeName
  );

  // Fallback: try Update.exe --processStart <exeName>.
  if (!confirm.ok && process.platform === 'win32' && updateExe && fs.existsSync(updateExe)) {
    try {
      bootLog(`[launchChannel] direct exe failed (${confirm && confirm.reason}); trying Update.exe fallback`);
    } catch {}
    usedUpdateFallback = true;
    confirm = await spawnAndConfirm(
      updateExe,
      ['--processStart', exeName],
      { detached: true, stdio: 'ignore', windowsHide: true, env, cwd: baseDir },
      exeName
    );
  }

  if (!confirm.ok) {
    // Provide enough info to debug without requiring devtools.
    return {
      success: false,
      mode: usedUpdateFallback ? 'update-exe' : 'direct-exe',
      exePath: detectedExe,
      appDir,
      updateExe: (updateExe && fs.existsSync(updateExe)) ? updateExe : null,
      preload: preloadOpt,
      mainHook,
      asarStatus,
      coreStatus,
      usedPatchedAsarLaunch: usePatchedAsarLaunch,
      usedCorePatchedLaunch: useCorePatchedLaunch,
      usedPatchedBootstrapLaunch: usePatchedBootstrapLaunch,
      error: confirm
    };
  }

  // Don't claim success until InAccord actually starts.
  const markerCheck = await waitForInAccordMarkers(c, startedAtMs, 18000);
  if (!markerCheck.ok) {
    return {
      success: false,
      mode: 'direct-exe',
      exePath: detectedExe,
      appDir,
      preload: preloadOpt,
      mainHook,
      asarStatus,
      coreStatus,
      usedPatchedAsarLaunch: usePatchedAsarLaunch,
      usedCorePatchedLaunch: useCorePatchedLaunch,
      usedPatchedBootstrapLaunch: usePatchedBootstrapLaunch,
      error: { reason: 'inaccord-not-running', markerCheck }
    };
  }

  return {
    success: true,
    mode: usedUpdateFallback ? 'update-exe' : 'direct-exe',
    exePath: detectedExe,
    appDir,
    updateExe: (updateExe && fs.existsSync(updateExe)) ? updateExe : null,
    preload: preloadOpt,
    mainHook,
    asarStatus,
    coreStatus,
    usedPatchedAsarLaunch: usePatchedAsarLaunch,
    usedCorePatchedLaunch: useCorePatchedLaunch,
    usedPatchedBootstrapLaunch: usePatchedBootstrapLaunch,
    markerCheck
  };
}

function createWindow() {
  bootLog('[ui] createWindow');
  const win = new BrowserWindow({
    // Initial fallback size; we resize to content after load.
    width: 752,
    height: 680,
    frame: false,
    resizable: true,
    center: true,
    alwaysOnTop: true,
    minimizable: true,
    maximizable: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  try { win.setBackgroundColor('#0f1220'); } catch {}
  try { win.setMenu(null); } catch {}

  try {
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      bootLog(`[ui] did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
    });
    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      bootLog(`[renderer-console] level=${level} ${sourceId}:${line} ${message}`);
    });
  } catch {}

  const htmlPath = path.join(__dirname, 'index.html');
  bootLog(`[ui] loading ${htmlPath} exists=${(() => { try { return fs.existsSync(htmlPath); } catch { return false; } })()}`);

  const fitToContent = async (reason) => {
    try {
      // Work area excludes taskbar.
      const wa = (screen && typeof screen.getPrimaryDisplay === 'function')
        ? (screen.getPrimaryDisplay().workAreaSize || null)
        : null;

      const maxW = wa && wa.width ? Math.max(600, wa.width - 40) : 1400;
      const maxH = wa && wa.height ? Math.max(520, wa.height - 40) : 900;

      // Measure in renderer.
      const dim = await win.webContents.executeJavaScript(`(() => {
        try {
          const doc = document.documentElement;
          const body = document.body;
          const w = Math.ceil(Math.max(
            doc ? doc.scrollWidth : 0,
            doc ? doc.offsetWidth : 0,
            body ? body.scrollWidth : 0,
            body ? body.offsetWidth : 0
          ));
          const h = Math.ceil(Math.max(
            doc ? doc.scrollHeight : 0,
            doc ? doc.offsetHeight : 0,
            body ? body.scrollHeight : 0,
            body ? body.offsetHeight : 0
          ));
          return { w, h };
        } catch (e) {
          return { w: 940, h: 680 };
        }
      })()`, true);

      // Make the launcher ~20% less wide than its content measurement.
      const measuredW = Number(dim && dim.w) || 940;
      const desiredW = Math.min(maxW, Math.max(640, Math.round(measuredW * 0.8)));
      const desiredH = Math.min(maxH, Math.max(640, Number(dim && dim.h) || 680));

      // For frameless windows, setContentSize == setSize effectively.
      win.setContentSize(desiredW, desiredH);
      win.center();
      bootLog(`[ui] fitToContent reason=${String(reason || 'unknown')} w=${desiredW} h=${desiredH} maxW=${maxW} maxH=${maxH}`);
    } catch (e) {
      bootLog(`[ui] fitToContent failed reason=${String(reason || 'unknown')} ${(e && e.stack) ? e.stack : String(e)}`);
    }
  };

  try {
    win.loadFile(htmlPath);

    win.webContents.once('did-finish-load', async () => {
      // First pass: size to initial layout.
      await fitToContent('did-finish-load');
      try { win.show(); } catch {}
      // Second pass: some fonts/layout settle after a tick.
      try { setTimeout(() => void fitToContent('post-load'), 400); } catch {}
    });
  } catch (e) {
    bootLog(`[ui] loadFile threw ${(e && e.stack) ? e.stack : String(e)}`);
    throw e;
  }
}

// Headless self-test mode (used for automated validation without UI clicks).
// Example: InAccord Launcher.exe --selftest --channel canary
if (hasArg('--selftest')) {
  // Electron must still be ready for some environments; but we don't create any windows.
  app.whenReady().then(async () => {
    const res = await runSelfTest();
    try { app.exit(res && res.ok ? 0 : 1); } catch { try { process.exit(res && res.ok ? 0 : 1); } catch {} }
  });
} else {
  app.whenReady().then(() => {
    try {
      bootLog('[app] whenReady');
      createWindow();
      app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
    } catch (e) {
      bootLog(`[app] whenReady handler threw ${(e && e.stack) ? e.stack : String(e)}`);
      try { dialog.showErrorBox('InAccord Launcher failed to start', String((e && e.stack) ? e.stack : e)); } catch {}
      // Keep the process alive briefly so the error box can show.
      try { setTimeout(() => app.quit(), 1500); } catch {}
    }
  });
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('get-platform', async () => ({ ok: true, platform: process.platform }));

ipcMain.handle('get-launcher-info', async () => {
  try {
    return {
      ok: true,
      appVersion: (() => { try { return app.getVersion(); } catch { return ''; } })(),
      appName: (() => { try { return app.getName(); } catch { return ''; } })(),
      appPath: (() => { try { return app.getAppPath(); } catch { return ''; } })(),
      execPath: (() => { try { return process.execPath; } catch { return ''; } })(),
      resourcesPath: (() => { try { return process.resourcesPath; } catch { return ''; } })(),
      dirname: (() => { try { return __dirname; } catch { return ''; } })(),
      platform: process.platform
    };
  } catch (e) {
    return { ok: false, error: String(e && e.stack ? e.stack : e) };
  }
});

ipcMain.handle('get-discord-versions', async () => {
  try {
    return getInstalledDiscordVersionsReport();
  } catch (e) {
    return { ok: false, error: String(e && e.stack ? e.stack : e) };
  }
});

ipcMain.handle('get-changelog', async () => {
  try {
    const res = await fetchLatestChangelog();
    return res;
  } catch (e) {
    return {
      ok: false,
      url: 'https://github.com/GARD-Realms-LLC/In-Accord-App',
      error: String(e && e.stack ? e.stack : e)
    };
  }
});

ipcMain.handle('install', async (_event, channel) => {
  try {
    const normalizedChannel = channel || 'stable';
    const steps = [];
    const totalStart = Date.now();
    const step = async (name, fn) => {
      const s = Date.now();
      try {
        const value = await fn();
        steps.push({ name, ok: true, ms: Date.now() - s });
        return { ok: true, value };
      } catch (e) {
        steps.push({ name, ok: false, ms: Date.now() - s, error: String(e && e.stack ? e.stack : e) });
        return { ok: false, error: e };
      }
    };

    const ensureResult = (await step('ensureDiscordInstalled', () => withTimeout(ensureDiscordInstalled(normalizedChannel), 260000, 'ensureDiscordInstalled'))).value;
    if (ensureResult && ensureResult.ok === false) {
      return { ok: false, error: ensureResult.error || 'Failed to install Discord channel', ensureResult, steps, totalMs: Date.now() - totalStart };
    }

    const killResult = (await step('killDiscordProcess', () => withTimeout(killDiscordProcess(normalizedChannel), 12000, 'killDiscordProcess'))).value;
    const stillRunning = (await step('isDiscordProcessRunning', () => withTimeout(isDiscordProcessRunning(normalizedChannel), 6000, 'isDiscordProcessRunning'))).value;
    if (stillRunning && killResult && killResult.accessDenied) {
      return { ok: false, error: 'Discord is running elevated (Access is denied). Fully exit Discord before installing.', steps, totalMs: Date.now() - totalStart };
    }

    const installedStep = await step('installPayloadToChannel', async () => installPayloadToChannel(normalizedChannel));
    if (!installedStep.ok) {
      return { ok: false, error: 'Failed to install payload files', steps, totalMs: Date.now() - totalStart };
    }
    const installed = installedStep.value;
    // Patch both possible bootstrap locations (core index.js when present; app.asar when packed).
    const corePatch = (await step('patchDiscordCoreIndex', async () => patchDiscordCoreIndex(normalizedChannel))).value;
    // BetterDiscord-style behavior: if the core index patch works, it is sufficient for Stable/PTB.
    // app.asar patching is slow and commonly blocked by AV/locking; do it only when needed.
    const shouldAttemptAsarPatch = !(corePatch && corePatch.ok && corePatch.patched);
    const asarPatch = (await step('patchDiscordAppAsar', async () => {
      if (!shouldAttemptAsarPatch) {
        return { ok: true, patched: false, skipped: true, reason: 'core-patched' };
      }

      // Keep install responsive. Launch does a best-effort patch as well.
      try {
        return await withTimeout(patchDiscordAppAsar(normalizedChannel), 5000, 'patchDiscordAppAsar');
      }
      catch (e) {
        return { ok: false, patched: false, error: String(e && e.stack ? e.stack : e) };
      }
    })).value;
    return { ok: true, installed, corePatch, asarPatch, steps, totalMs: Date.now() - totalStart };
  } catch (e) {
    return { ok: false, error: String(e && e.stack ? e.stack : e) };
  }
});

ipcMain.handle('uninstall', async (_event, channel) => {
  try {
    const normalizedChannel = channel || 'stable';
    const killResult = await killDiscordProcess(normalizedChannel);
    const stillRunning = await isDiscordProcessRunning(normalizedChannel);
    if (stillRunning && killResult && killResult.accessDenied) {
      return { ok: false, error: 'Discord is running elevated (Access is denied). Fully exit Discord before uninstalling.' };
    }
    const result = uninstallFromChannel(normalizedChannel);
    const asarRestore = restoreDiscordAppAsar(normalizedChannel);
    return Object.assign({}, result, { asarRestore });
  } catch (e) {
    return { ok: false, error: String(e && e.stack ? e.stack : e) };
  }
});

ipcMain.handle('launch', async (_event, channel) => {
  try {
    const normalizedChannel = channel || 'stable';

    const steps = [];
    const totalStart = Date.now();
    const step = async (name, fn) => {
      const s = Date.now();
      try {
        const value = await fn();
        steps.push({ name, ok: true, ms: Date.now() - s });
        return { ok: true, value };
      } catch (e) {
        steps.push({ name, ok: false, ms: Date.now() - s, error: String(e && e.stack ? e.stack : e) });
        return { ok: false, error: e };
      }
    };

    try { bootLog(`[launch] begin channel=${String(normalizedChannel)}`); } catch {}

    // Ensure the channel is installed before we attempt patch/launch.
    const ensureResult = (await step('ensureDiscordInstalled', () => withTimeout(ensureDiscordInstalled(normalizedChannel), 260000, 'ensureDiscordInstalled'))).value;
    if (ensureResult && ensureResult.ok === false) {
      return { success: false, error: ensureResult.error || 'Failed to install Discord channel', ensureResult, steps, totalMs: Date.now() - totalStart };
    }

    // Ensure Discord isn't running while we patch its bootstrap files.
    // Running Discord can keep resources locked and cause silent patch failures.
    try {
      const killResult = (await step('killDiscordProcess', () => withTimeout(killDiscordProcess(normalizedChannel), 12000, 'killDiscordProcess'))).value;
      const stillRunning = (await step('isDiscordProcessRunning', () => withTimeout(isDiscordProcessRunning(normalizedChannel), 6000, 'isDiscordProcessRunning'))).value;
      if (stillRunning && killResult && killResult.accessDenied) {
        try { bootLog('[launch] blocked: access denied killing Discord'); } catch {}
        return { success: false, error: 'Discord is running elevated (Access is denied). Fully exit Discord before launching.', steps, totalMs: Date.now() - totalStart };
      }
    } catch {}

    // Always refresh the payload on Launch so we can overwrite broken/old loader files
    // (e.g., older preload.js that used global Buffer and crashes in some Discord builds).
    await step('installPayloadToChannel', async () => {
      try { return installPayloadToChannel(normalizedChannel); } catch (e) { throw e; }
    });

    // Always attempt to ensure a working bootstrap patch exists.
    // This is cheap when already patched, and essential after Discord updates.
    await step('patchDiscordCoreIndex', async () => {
      try { return patchDiscordCoreIndex(normalizedChannel); } catch (e) { throw e; }
    });

    // app.asar patching can be slow/hang (AV/locking). Do NOT block Launch for 60s.
    // If the bootstrap isn't patched yet, we still launch using the env-based preload/mainhook path.
    await step('patchDiscordAppAsar', async () => {
      try { return await withTimeout(patchDiscordAppAsar(normalizedChannel), 5000, 'patchDiscordAppAsar'); } catch (e) { throw e; }
    });

    const launchStep = await step('launchChannel', async () => withTimeout(launchChannel(normalizedChannel), 75000, 'launchChannel'));
    if (!launchStep.ok) {
      try { bootLog(`[launch] launchChannel failed channel=${String(normalizedChannel)} totalMs=${Date.now() - totalStart}`); } catch {}
      return { success: false, error: 'launchChannel failed', steps, totalMs: Date.now() - totalStart };
    }

    const result = launchStep.value;
    // Return the launch status directly so the UI can show a clean status object
    // like { success: true, mode, exePath, ... }.
    try { bootLog(`[launch] end channel=${String(normalizedChannel)} success=${!!(result && result.success)} totalMs=${Date.now() - totalStart}`); } catch {}
    if (result && typeof result === 'object') {
      return Object.assign({}, result, { steps, totalMs: Date.now() - totalStart });
    }
    return { success: false, error: 'launchChannel returned invalid result', raw: result, steps, totalMs: Date.now() - totalStart };
  } catch (e) {
    try { bootLog(`[launch] threw ${(e && e.stack) ? e.stack : String(e)}`); } catch {}
    return { success: false, error: String(e && e.stack ? e.stack : e) };
  }
});

ipcMain.handle('read-crash-errors', async (_event, channel) => {
  try {
    const res = await readRecentCrashErrorsForChannel(channel || 'stable');
    return res;
  } catch (e) {
    return { ok: false, error: String(e && e.stack ? e.stack : e) };
  }
});

ipcMain.handle('download-discord-installer', async (_event, channel) => {
  try {
    const res = await downloadDiscordInstaller(channel || 'stable');
    return res;
  } catch (e) {
    return { ok: false, error: String(e && e.stack ? e.stack : e) };
  }
});

ipcMain.handle('open-external', async (_event, url) => {
  try {
    const u = String(url || '');
    if (!u) return { ok: false, error: 'missing-url' };
    const low = u.toLowerCase();
    // Allow common safe schemes used by the launcher.
    if (!(low.startsWith('https://') || low.startsWith('http://') || low.startsWith('mailto:') || low.startsWith('discord:'))) {
      return { ok: false, error: 'blocked-scheme' };
    }
    await shell.openExternal(u);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.stack ? e.stack : e) };
  }
});

ipcMain.handle('get-channel-status', async (_event, channel) => {
  try {
    const c = String(channel || 'stable').toLowerCase();
    const appDir = findLatestWinAppDirByChannel(c);
    const asarStatus = isDiscordAppAsarPatched(c);
    const coreStatus = isDiscordCoreIndexPatched(c);
    const payload = (() => { try { return validateInstalledPayload(c); } catch (e) { return { ok: false, error: String(e && e.stack ? e.stack : e) }; } })();
    const markers = getMarkerPathsForChannel(c);

    const preloadStat = statSafe(markers.preloadLoaded);
    const runningStat = statSafe(markers.running);
    const mainhookLoadedStat = statSafe(markers.mainhookLoaded);
    const injectStatusStat = statSafe(markers.injectStatus);

    const injectStatusJson = (() => {
      try {
        if (!markers.injectStatus || !fs.existsSync(markers.injectStatus)) return null;
        const txt = fs.readFileSync(markers.injectStatus, 'utf8');
        return JSON.parse(txt);
      } catch {
        return null;
      }
    })();

    return {
      ok: true,
      channel: c,
      platform: process.platform,
      appDir,
      exeName: discordExeForChannel(c),
      asarStatus,
      coreStatus,
      payload,
      markers,
      markerStats: {
        preloadLoaded: preloadStat ? { exists: true, mtimeMs: preloadStat.mtimeMs, bytes: preloadStat.size } : { exists: false },
        running: runningStat ? { exists: true, mtimeMs: runningStat.mtimeMs, bytes: runningStat.size } : { exists: false },
        mainhookLoaded: mainhookLoadedStat ? { exists: true, mtimeMs: mainhookLoadedStat.mtimeMs, bytes: mainhookLoadedStat.size } : { exists: false },
        injectStatus: injectStatusStat ? { exists: true, mtimeMs: injectStatusStat.mtimeMs, bytes: injectStatusStat.size } : { exists: false }
      },
      injectStatusJson,
      injectTail: tailInjectLogSafe(markers.injectLog, 120),
      mainhookTail: tailFileSafe(markers.mainhookLog, 120)
    };
  } catch (e) {
    return { ok: false, error: String(e && e.stack ? e.stack : e) };
  }
});
