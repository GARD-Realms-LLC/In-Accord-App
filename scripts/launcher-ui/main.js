const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const fs = require('fs');
// Resolve launcher path across dev and packaged (asar/unpacked) layouts
function resolveLauncherPath() {
  const candidates = [
    // dev layout (scripts next to launcher-ui)
    path.join(__dirname, '..', 'scripts', 'launcher.js'),
    // app root (when running unpacked or from source)
    path.join(app.getAppPath(), 'scripts', 'launcher.js'),
    // inside app.asar
    path.join(process.resourcesPath, 'app.asar', 'scripts', 'launcher.js'),
    // inside resources directly (some packagers extract files here)
    path.join(process.resourcesPath, 'scripts', 'launcher.js'),
    // asar unpacked location (if specified in unpack config)
    path.join(process.resourcesPath, 'app.asar.unpacked', 'scripts', 'launcher.js')
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (e) {}
  }
  return null;
}
const path = require('path');
const { spawn } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 756,
    height: 630,
    resizable: true,
    center: true,
    alwaysOnTop: true,
    minimizable: true,
    maximizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  // Set dark background color for native window
  try { win.setBackgroundColor('#0f1220'); } catch {}
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  // UI only: do not auto-run injector/launcher here. Users can click Install/Launch.
  // This prevents crashes caused by auto-inject timing issues and ensures the
  // modal appears reliably for non-technical users.
}

// detectPreferredChannel removed to avoid auto-run side effects

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

<<<<<<< Updated upstream
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
=======
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
        .map(e => e.name);

      // IMPORTANT:
      // Do NOT pick by lexicographic sort. Example: "discord_desktop_core-10" sorts
      // before "discord_desktop_core-2" lexicographically, which makes us patch the
      // wrong folder and Discord never loads In-Accord (no coreloader/mainhook/preload markers).
      const extractWrapVersion = (name) => {
        try {
          const n = String(name || '');
          const m = n.match(/^discord_desktop_core[-_]?(.+)$/i);
          const v = m && m[1] ? String(m[1]) : '';
          return v.replace(/^[\-_.]+/, '') || '0';
        } catch {
          return '0';
        }
      };

      wraps.sort((a, b) => compareVersionsDesc(extractWrapVersion(a), extractWrapVersion(b)));
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
    // Additionally, write a small marker file under %APPDATA%\InAccord so we can
    // prove whether Discord is actually executing this patched index.js.
    // This is critical for the "payload installed but all markers missing" case.
    const patched =
      `// InAccord core patch (${CORE_PATCH_MARKER})\n` +
      `;(function(){\n` +
      `  try {\n` +
      `    const fs = require('fs');\n` +
      `    const path = require('path');\n` +
      `    const os = require('os');\n` +
      `    const c = ${JSON.stringify(c)};\n` +
      `    let appData = '';\n` +
      `    try { appData = String(process.env.APPDATA || ''); } catch {}\n` +
      `    if (!appData) { try { const up = String(process.env.USERPROFILE || ''); if (up) appData = path.join(up, 'AppData', 'Roaming'); } catch {} }\n` +
      `    if (!appData) { try { appData = path.join(os.homedir(), 'AppData', 'Roaming'); } catch {} }\n` +
      `    if (appData) {\n` +
      `      const base = path.join(appData, 'InAccord');\n` +
      `      try { fs.mkdirSync(base, { recursive: true }); } catch {}\n` +
      `      const out = path.join(base, 'InAccord.core_index_ran.' + c + '.json');\n` +
      `      fs.writeFileSync(out, JSON.stringify({ ts: new Date().toISOString(), pid: process.pid, execPath: process.execPath, loader: ${loaderLiteral} }, null, 2));\n` +
      `    }\n` +
      `  } catch {}\n` +
      `})();\n` +
      `try { require(${loaderLiteral}); } catch (e) {\n` +
      `  try {\n` +
      `    const fs = require('fs');\n` +
      `    const path = require('path');\n` +
      `    const os = require('os');\n` +
      `    const c = ${JSON.stringify(c)};\n` +
      `    let appData = '';\n` +
      `    try { appData = String(process.env.APPDATA || ''); } catch {}\n` +
      `    if (!appData) { try { const up = String(process.env.USERPROFILE || ''); if (up) appData = path.join(up, 'AppData', 'Roaming'); } catch {} }\n` +
      `    if (!appData) { try { appData = path.join(os.homedir(), 'AppData', 'Roaming'); } catch {} }\n` +
      `    if (appData) {\n` +
      `      const base = path.join(appData, 'InAccord');\n` +
      `      try { fs.mkdirSync(base, { recursive: true }); } catch {}\n` +
      `      const out = path.join(base, 'InAccord.core_index_error.' + c + '.json');\n` +
      `      const msg = (e && (e.stack || e.message)) ? String(e.stack || e.message) : String(e);\n` +
      `      fs.writeFileSync(out, JSON.stringify({ ts: new Date().toISOString(), pid: process.pid, execPath: process.execPath, loader: ${loaderLiteral}, error: msg }, null, 2));\n` +
      `    }\n` +
      `  } catch {}\n` +
      `}\n` +
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
>>>>>>> Stashed changes

function runCommand(command, args, opts = {}) {
  return new Promise((resolve) => {
    // Ensure spawned processes do not create visible consoles/windows on Windows.
    const spawnOpts = Object.assign({ stdio: 'pipe', windowsHide: true }, opts);
    const child = spawn(command, args, spawnOpts);
    let out = '';
    child.stdout && child.stdout.on('data', d => out += d.toString());
    child.stderr && child.stderr.on('data', d => out += d.toString());
    child.on('close', code => resolve({ code, output: out }));
    child.on('error', err => resolve({ code: 1, output: String(err) }));
  });
}

ipcMain.handle('install', async (event, channel, targetPlatform) => {
  // Call launcher.js programmatically inside the Electron main process so the
  // packaged EXE does not depend on an external 'node' binary.
  try {
    // Try local wrapper first (packaged alongside this main.js)
    let launcher = null;
    let launcherPath = null;
    try {
      const localPath = path.join(__dirname, 'launcher.js');
      launcher = require(localPath);
      launcherPath = localPath;
    } catch (e) {
      // Fallback to resolving elsewhere in app resources
      launcherPath = resolveLauncherPath();
      if (launcherPath) {
        launcher = require(launcherPath);
      } else {
        // As a last resort, use an internal lightweight launcher implementation
        launcherPath = 'internal';
        launcher = {
          launchChannel: async function(opts = {}) {
            const os = require('os');
            const fs = require('fs');
            const spawn = require('child_process').spawn;
            const channelOpt = opts.channel || 'canary';
            const preloadOpt = opts.preload || path.resolve(__dirname, '..', '..', 'dist', 'preload.js');
            const platform = (opts && opts.targetPlatform) || os.platform();
            if (platform === 'win32') {
              const local = process.env.LOCALAPPDATA;
              const channelName = channelOpt === 'stable' ? 'Discord' : channelOpt === 'ptb' ? 'DiscordPTB' : 'DiscordCanary';
              const updateExe = path.join(local, channelName, 'Update.exe');
              if (!fs.existsSync(updateExe)) throw new Error('Update.exe not found at ' + updateExe);
              // find latest app-* directory
              const findLatestAppDir = (baseDir) => {
                try {
                  const entries = fs.readdirSync(baseDir, { withFileTypes: true })
                    .filter(e => e.isDirectory() && /^app-/.test(e.name))
                    .map(d => d.name)
                    .sort()
                    .reverse();
                  if (entries.length === 0) return null;
                  return path.join(baseDir, entries[0]);
                } catch (e) { return null; }
              };
              const appDir = findLatestAppDir(path.join(local, channelName));
              if (!appDir) throw new Error('No app-* directory found for ' + channelName);
              const env = Object.assign({}, process.env);
              if (channelOpt !== 'stable') {
                env.DISCORD_PRELOAD = preloadOpt;
                env.DISCORD_APP_PATH = appDir;
              }
              const exeName = channelOpt === 'stable' ? 'Discord.exe' : channelOpt === 'ptb' ? 'DiscordPTB.exe' : 'DiscordCanary.exe';
              const child = spawn(updateExe, ['--processStart', exeName], { detached: true, stdio: 'ignore', env });
              child.unref();
              return { success: true };
            }
            // macOS / Linux minimal fallback
            if (platform === 'darwin') {
              if (channelOpt !== 'stable') process.env.DISCORD_PRELOAD = preloadOpt;
              const appName = channelOpt === 'stable' ? 'Discord' : channelOpt === 'ptb' ? 'DiscordPTB' : 'DiscordCanary';
              spawn('open', ['-a', appName], { detached: true, stdio: 'ignore', env: process.env }).unref();
              return { success: true };
            }
            if (platform === 'linux') {
              const bin = channelOpt === 'stable' ? 'discord' : channelOpt === 'ptb' ? 'discord-ptb' : 'discord-canary';
              if (channelOpt !== 'stable') process.env.DISCORD_PRELOAD = preloadOpt;
              const child = spawn(bin, [], { detached: true, stdio: 'ignore', env: process.env });
              child.on('error', (e) => { throw e; });
              child.unref();
              return { success: true };
            }
            throw new Error('Unsupported platform: ' + platform);
          }
        };
      }
    }
    const opts = { channel: channel || null, patchStable: channel === 'stable', targetPlatform };
    const result = await launcher.launchChannel(opts);
    return { code: 0, output: JSON.stringify(result), resolvedLauncher: launcherPath };
  } catch (err) {
    return { code: 1, output: String(err && err.stack ? err.stack : err) };
  }
});

ipcMain.handle('launch', async (event, channel, targetPlatform) => {
  try {
    // Mirror the install handler: try local wrapper, then resolved path, then internal fallback
    let launcher = null;
    let launcherPath = null;
    try {
      const localPath = path.join(__dirname, 'launcher.js');
      launcher = require(localPath);
      launcherPath = localPath;
    } catch (e) {
      launcherPath = resolveLauncherPath();
      if (launcherPath) {
        launcher = require(launcherPath);
      } else {
        // internal fallback (same as install handler)
        launcherPath = 'internal';
        launcher = {
          launchChannel: async function(opts = {}) {
            const os = require('os');
            const fs = require('fs');
            const spawn = require('child_process').spawn;
            const channelOpt = opts.channel || 'canary';
            const preloadOpt = opts.preload || path.resolve(__dirname, '..', '..', 'dist', 'preload.js');
            const platform = (opts && opts.targetPlatform) || os.platform();
            if (platform === 'win32') {
              const local = process.env.LOCALAPPDATA;
              const channelName = channelOpt === 'stable' ? 'Discord' : channelOpt === 'ptb' ? 'DiscordPTB' : 'DiscordCanary';
              const updateExe = path.join(local, channelName, 'Update.exe');
              if (!fs.existsSync(updateExe)) throw new Error('Update.exe not found at ' + updateExe);
              const findLatestAppDir = (baseDir) => {
                try {
                  const entries = fs.readdirSync(baseDir, { withFileTypes: true })
                    .filter(e => e.isDirectory() && /^app-/.test(e.name))
                    .map(d => d.name)
                    .sort()
                    .reverse();
                  if (entries.length === 0) return null;
                  return path.join(baseDir, entries[0]);
                } catch (e) { return null; }
              };
              const appDir = findLatestAppDir(path.join(local, channelName));
              if (!appDir) throw new Error('No app-* directory found for ' + channelName);
              const env = Object.assign({}, process.env);
              if (channelOpt !== 'stable') {
                env.DISCORD_PRELOAD = preloadOpt;
                env.DISCORD_APP_PATH = appDir;
              }
              const exeName = channelOpt === 'stable' ? 'Discord.exe' : channelOpt === 'ptb' ? 'DiscordPTB.exe' : 'DiscordCanary.exe';
              const child = spawn(updateExe, ['--processStart', exeName], { detached: true, stdio: 'ignore', env });
              child.unref();
              return { success: true };
            }
            if (platform === 'darwin') {
              if (channelOpt !== 'stable') process.env.DISCORD_PRELOAD = preloadOpt;
              const appName = channelOpt === 'stable' ? 'Discord' : channelOpt === 'ptb' ? 'DiscordPTB' : 'DiscordCanary';
              spawn('open', ['-a', appName], { detached: true, stdio: 'ignore', env: process.env }).unref();
              return { success: true };
            }
            if (platform === 'linux') {
              const bin = channelOpt === 'stable' ? 'discord' : channelOpt === 'ptb' ? 'discord-ptb' : 'discord-canary';
              if (channelOpt !== 'stable') process.env.DISCORD_PRELOAD = preloadOpt;
              const child = spawn(bin, [], { detached: true, stdio: 'ignore', env: process.env });
              child.on('error', (e) => { throw e; });
              child.unref();
              return { success: true };
            }
            throw new Error('Unsupported platform: ' + platform);
          }
        };
      }
    }
<<<<<<< Updated upstream
    const opts = { channel: channel || null, targetPlatform };
    const result = await launcher.launchChannel(opts);
    return { code: 0, output: JSON.stringify(result), resolvedLauncher: launcherPath };
  } catch (err) {
    return { code: 1, output: String(err && err.stack ? err.stack : err) };
=======

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
    // app.asar patching is slow and commonly blocked by AV/locking, so we keep it timeboxed.
    // HOWEVER: some Stable installs appear to ignore the disk discord_desktop_core folder entirely.
    // In that case, corePatch can report success but Discord never runs it (no markers/logs).
    // So we always attempt the asar patch as a best-effort, but we never let it block install.
    const shouldAttemptAsarPatch = true;
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
>>>>>>> Stashed changes
  }
});

ipcMain.handle('show-error', async (event, message) => {
  dialog.showErrorBox('Launcher', message || 'An error occurred');
});

// Copy text to system clipboard for the renderer
ipcMain.handle('copy-to-clipboard', async (event, text) => {
  try {
    clipboard.writeText(String(text || ''));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// Open external links using the OS default handler (safer for packaged apps)
ipcMain.handle('open-external', async (event, url) => {
  try {
    const { shell } = require('electron');
    if (!url || typeof url !== 'string') throw new Error('Invalid URL');
    await shell.openExternal(url);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});
