#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

function usage() {
  console.log('Usage: node scripts/launcher.js --channel <stable|ptb|canary> [--patch-stable] [--preload <path>]');
  process.exit(1);
}

const args = process.argv.slice(2);

// Defaults
let channel = null;
let patchStable = false;
let preload = path.resolve(__dirname, '..', 'dist', 'preload.js');
let overridePlatform = null;

// Ensure preload is available on disk. When this script is packaged into a single exe (pkg)
// the path above may exist only inside the virtual snapshot (e.g., C:\snapshot\...).
// Discord requires a real filesystem path for DISCORD_PRELOAD, so if the resolved preload
// doesn't exist on disk we attempt to read the embedded preload and write it to a temp file.
if (!fs.existsSync(preload)) {
  // First, check for an explicitly embedded preload provided via environment (set by launcher_pkg.js)
  if (process.env.INACCORD_EMBEDDED_PRELOAD) {
    try {
      const tmpName = `ia-preload-${Date.now()}.js`;
      const tmpPath = path.join(os.tmpdir(), tmpName);
      fs.writeFileSync(tmpPath, process.env.INACCORD_EMBEDDED_PRELOAD, 'utf8');
      console.log('Wrote embedded preload from INACCORD_EMBEDDED_PRELOAD to temp file:', tmpPath);
      preload = tmpPath;
    } catch (e) {
      console.warn('Failed to write embedded preload to disk:', e && e.message ? e.message : e);
    }
  } else {
    try {
      const embedded = fs.readFileSync(preload, 'utf8');
      const tmpName = `ia-preload-${Date.now()}.js`;
      const tmpPath = path.join(os.tmpdir(), tmpName);
      fs.writeFileSync(tmpPath, embedded, 'utf8');
      console.log('Extracted embedded preload to temp file:', tmpPath);
      preload = tmpPath;
    } catch (e) {
      // If extraction fails, leave preload as-is and let downstream code handle missing file.
      console.warn('Could not extract embedded preload to disk:', e && e.message ? e.message : e);
    }
  }
}

// If no args provided, auto-detect available Discord channels (prefer PTB, then Canary, then Stable).
if (args.length === 0) {
  const local = process.env.LOCALAPPDATA || '';
  if (local && fs.existsSync(path.join(local, 'DiscordPTB'))) channel = 'ptb';
  else if (local && fs.existsSync(path.join(local, 'DiscordCanary'))) channel = 'canary';
  else if (local && fs.existsSync(path.join(local, 'Discord'))) channel = 'stable';
  if (!channel) {
    console.error('No Discord installation detected. Provide --channel <stable|ptb|canary>');
    usage();
  }
  console.log('No arguments provided — auto-selected channel:', channel);
} else {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '--channel' || a === '-c') && args[i+1]) { channel = args[++i]; }
    else if (a === '--patch-stable') { patchStable = true; }
    else if ((a === '--preload' || a === '-p') && args[i+1]) { preload = path.resolve(args[++i]); }
    else if ((a === '--target-platform') && args[i+1]) { overridePlatform = args[++i]; }
    else if (a === '--help' || a === '-h') usage();
  }
}

// If stable was auto-selected and patchStable wasn't explicitly set, require a consent marker file for silent patching.
if (channel === 'stable' && !patchStable) {
  // Consent marker path: %USERPROFILE%\InAccord-Consent-allow-stable-patch
  const consentPath = path.join(process.env.USERPROFILE || os.homedir(), 'InAccord-Consent-allow-stable-patch');
  if (!fs.existsSync(consentPath)) {
    console.error('Stable was selected but no consent marker found for patching. To allow automatic stable patching, create the file:', consentPath);
    console.error('Or run this launcher with --patch-stable after confirming you consent to modify Discord installation.');
    process.exit(2);
  } else {
    console.log('Consent marker found — stable patching allowed.');
    patchStable = true;
  }
}

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
  // opts: { channel, patchStable, preload, targetPlatform, overridePlatform }
  const channelOpt = opts.channel || channel;
  const patchStableOpt = typeof opts.patchStable === 'boolean' ? opts.patchStable : patchStable;
  const preloadOpt = opts.preload || preload;
  const overridePlatformOpt = opts.overridePlatform || overridePlatform;
  const targetPlatform = opts.targetPlatform || null;
  const platform = overridePlatformOpt || os.platform();
  if (platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    const channelName = channelOpt === 'stable' ? 'Discord' : channelOpt === 'ptb' ? 'DiscordPTB' : 'DiscordCanary';
    const updateExe = path.join(local, channelName, 'Update.exe');
    if (!fs.existsSync(updateExe)) {
      throw new Error('Update.exe not found at ' + updateExe);
    }
    const appDir = findLatestAppDir(path.join(local, channelName));
    if (!appDir) { throw new Error('No app-* directory found for ' + channelName); }

    // Optionally patch Stable (inject index.js). For packaged exe we perform injection inline so no external script is required.
    if (channelOpt === 'stable' && patchStableOpt) {
      console.log('Applying reversible Stable patch (injecting) to', appDir);
      try {
        const coreDir = path.join(appDir, 'resources', 'discord_desktop_core');
        const indexPath = path.join(coreDir, 'index.js');
        const backupPath = path.join(coreDir, 'index.js.ia.bak');
        if (!fs.existsSync(coreDir)) throw new Error('discord_desktop_core not found at ' + coreDir);
        if (!fs.existsSync(indexPath)) throw new Error('index.js not found at ' + indexPath);
        if (fs.existsSync(backupPath)) throw new Error('Backup already exists at ' + backupPath + '. Aborting to avoid overwriting backup.');
        const original = fs.readFileSync(indexPath, 'utf8');
        const distPath = path.resolve(__dirname, '..', 'dist', 'InAccord.js');
        const injectCode = `try{ require(${JSON.stringify(distPath)}); }catch(e){ console.error('InAccord inject failed', e); }\n`;
        fs.copyFileSync(indexPath, backupPath);
        fs.writeFileSync(indexPath, injectCode + original, 'utf8');
        console.log('Injected InAccord into', indexPath, '\nBackup saved to', backupPath);
      }
      catch (e) {
        throw e;
      }
    }

    // For non-stable, set DISCORD_PRELOAD; for stable we avoid setting DISCORD_PRELOAD (injection used instead)
    const env = Object.assign({}, process.env);
    if (channelOpt !== 'stable') {
      env.DISCORD_PRELOAD = preloadOpt;
      env.DISCORD_APP_PATH = appDir;
      console.log('Setting DISCORD_PRELOAD =', preloadOpt);
    }

    const exeName = channelOpt === 'stable' ? 'Discord.exe' : channelOpt === 'ptb' ? 'DiscordPTB.exe' : 'DiscordCanary.exe';
    const child = spawn(updateExe, ['--processStart', exeName], { detached: true, stdio: 'ignore', env });
    child.unref();
    console.log('Launched', channelOpt, 'via', updateExe);
    return { success: true };
  }

  // macOS / Linux: try open or run binary directly
  if (platform === 'darwin') {
    if (channelOpt !== 'stable') {
      process.env.DISCORD_PRELOAD = preloadOpt;
    }
    const appName = channelOpt === 'stable' ? 'Discord' : channelOpt === 'ptb' ? 'DiscordPTB' : 'DiscordCanary';
    const args = ['-a', appName];
    const child = spawn('open', args, { detached: true, stdio: 'ignore', env: process.env });
    child.unref();
    console.log('Launched', appName);
    return { success: true };
  }

  // linux
  if (platform === 'linux') {
    // Best-effort: try to execute common binary names
    const bin = channelOpt === 'stable' ? 'discord' : channelOpt === 'ptb' ? 'discord-ptb' : 'discord-canary';
    if (channelOpt !== 'stable') process.env.DISCORD_PRELOAD = preloadOpt;
    const child = spawn(bin, [], { detached: true, stdio: 'ignore', env: process.env });
    child.on('error', (e) => { throw e; });
    child.unref();
    console.log('Launched', bin);
    return { success: true };
  }

  throw new Error('Unsupported platform: ' + platform);
}

// Expose programmatic API
module.exports = {
  launchChannel
};

// CLI entrypoint
if (require.main === module) {
  // If run directly, parse existing CLI args and call launchChannel then exit.
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
