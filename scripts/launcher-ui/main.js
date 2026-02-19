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

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

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
    const opts = { channel: channel || null, targetPlatform };
    const result = await launcher.launchChannel(opts);
    return { code: 0, output: JSON.stringify(result), resolvedLauncher: launcherPath };
  } catch (err) {
    return { code: 1, output: String(err && err.stack ? err.stack : err) };
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
