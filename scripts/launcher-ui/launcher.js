#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// Wrapper/duplicate of ../launcher.js so the packaged app always contains a local
// launcher.js under scripts/launcher-ui and can require it reliably from the
// Electron main process when packaged.

function findLatestAppDir(baseDir) {
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^app-/.test(e.name))
      .map(d => d.name)
      .sort()
      .reverse();
    if (entries.length === 0) return null;
    return path.join(baseDir, entries[0]);
  } catch (e) {
    return null;
  }
}

async function launchChannel(opts = {}) {
  // Minimal proxy to the real launcher logic; prefer using the sibling ../launcher.js
  try {
    const real = require(path.join(__dirname, '..', 'launcher.js'));
    if (real && typeof real.launchChannel === 'function') return await real.launchChannel(opts);
  } catch (e) {
    // Fallback: implement a minimal launch routine here if the parent launcher is not available
    const channelOpt = (opts && opts.channel) || 'canary';
    const preloadOpt = (opts && opts.preload) || path.resolve(__dirname, '..', '..', 'dist', 'preload.js');
    const platform = (opts && opts.overridePlatform) || os.platform();
    if (platform === 'win32') {
      const local = process.env.LOCALAPPDATA;
      const channelName = channelOpt === 'stable' ? 'Discord' : channelOpt === 'ptb' ? 'DiscordPTB' : 'DiscordCanary';
      const updateExe = path.join(local, channelName, 'Update.exe');
      if (!fs.existsSync(updateExe)) throw new Error('Update.exe not found at ' + updateExe);
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
    throw new Error('Unsupported platform for fallback launcher: ' + platform);
  }
}

module.exports = { launchChannel };

if (require.main === module) {
  (async () => {
    try {
      await launchChannel();
      process.exit(0);
    } catch (err) {
      console.error(err && err.stack ? err.stack : String(err));
      process.exit(1);
    }
  })();
}
