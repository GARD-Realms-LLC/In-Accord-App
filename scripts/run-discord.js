#!/usr/bin/env node

const {spawnSync} = require("child_process");

const args = process.argv.slice(2).map((a) => a.toLowerCase());

const help = `
InAccord quick runner

Usage:
  node scripts/run-discord.js [stable|ptb|canary] [--release]

Examples:
  node scripts/run-discord.js
  node scripts/run-discord.js ptb
  node scripts/run-discord.js canary --release

What it does:
  1) bun run build
  2) (optional) bun scripts/pack.ts
  3) bun scripts/inject.ts [channel]
`;

if (args.includes("-h") || args.includes("--help")) {
    console.log(help.trim());
    process.exit(0);
}

const channel = ["stable", "ptb", "canary"].find((c) => args.includes(c)) || "stable";
const useRelease = args.includes("--release");
const doPatchStable = args.includes("--patch-stable");

function run(command, commandArgs, label) {
    console.log(`\n▶ ${label}`);
    const result = spawnSync(command, commandArgs, {
        stdio: "inherit",
        shell: process.platform === "win32"
    });

    if (result.error) {
        console.error(`\n✖ Failed to run ${command}:`, result.error.message);
        process.exit(1);
    }

    if (typeof result.status === "number" && result.status !== 0) {
        process.exit(result.status);
    }
}

const injectArgs = ["scripts/inject.ts"];
if (useRelease) injectArgs.push("release");
if (channel !== "stable") injectArgs.push(channel);

console.log(`\nInAccord target: ${channel.toUpperCase()}${useRelease ? " (release bundle)" : " (dist folder)"}`);

run("bun", ["run", "build"], "Build project");
if (useRelease) run("bun", ["scripts/pack.ts"], "Pack release bundle (.asar)");
run("bun", injectArgs, "Inject into Discord");

// Optional: patch Stable in-place (writes index.js into discord_desktop_core). This is
// an opt-in operation and will modify the user's Discord install. Use with caution.
if (doPatchStable) {
  if (channel !== "stable") {
    console.log("--patch-stable only applies to the stable channel. Use 'stable' or omit channel.");
  }
  else {
    run("bun", ["scripts/inject.ts"], "Patch Stable (inject InAccord into Discord)");
  }
}

console.log("\n✅ Done. Fully quit Discord, then open it again to see InAccord running.");

// Optional launcher: if caller passes --launch, start the selected Discord using the
// platform-specific updater/launcher and only set DISCORD_PRELOAD for non-stable channels.
if (args.includes("--launch")) {
  const fs = require("fs");
  const {spawn} = require("child_process");
  const path = require("path");

  const preload = path.resolve(__dirname, "..", "dist", "preload.js");

  const esc = (s) => (s || "").replace(/"/g, '\\"');

  try {
    if (process.platform === "win32") {
      const baseDir = path.join(process.env.LOCALAPPDATA || "", (channel === "canary" ? "DiscordCanary" : channel === "ptb" ? "DiscordPTB" : "Discord"));
      const updateExe = path.join(baseDir, "Update.exe");
      if (!fs.existsSync(updateExe)) throw new Error(`Update.exe not found: ${updateExe}`);

      // Find latest app-* folder if present
      let appPath = null;
      if (fs.existsSync(baseDir)) {
        const versions = fs.readdirSync(baseDir).filter((f) => fs.lstatSync(path.join(baseDir, f)).isDirectory() && f.startsWith("app-")).sort().reverse();
        if (versions.length) appPath = path.join(baseDir, versions[0]);
      }

      // Build cmd wrapper that sets env vars and starts Update.exe so the child inherits them
      const cmdParts = [];
      if (channel !== "stable") cmdParts.push(`set "DISCORD_PRELOAD=${esc(preload)}"`);
      if (appPath) cmdParts.push(`set "DISCORD_APP_PATH=${esc(appPath)}"`);
      const processName = channel === "canary" ? "DiscordCanary.exe" : channel === "ptb" ? "DiscordPTB.exe" : "Discord.exe";
      const startCmd = `start "" "${esc(updateExe)}" --processStart "${processName}"`;
      const cmd = cmdParts.length ? `${cmdParts.join(' && ')} && ${startCmd}` : startCmd;

      console.log(`baseDir: ${baseDir}`);
      console.log(`updateExe: ${updateExe}`);
      console.log(`appPath: ${appPath}`);
      console.log(`processName: ${processName}`);
      console.log(`cmd: ${cmd}`);
      spawn("cmd.exe", ["/c", cmd], {detached: true, stdio: "ignore"}).unref();
    }
    else if (process.platform === "darwin") {
      const appName = channel === "canary" ? "Discord Canary" : channel === "ptb" ? "Discord PTB" : "Discord";
      const env = Object.assign({}, process.env);
      if (channel !== "stable") env.DISCORD_PRELOAD = preload;
      console.log(`Opening ${appName} on macOS`);
      spawn("open", ["-a", appName], {env, detached: true, stdio: "ignore"}).unref();
    }
    else {
      const homedir = process.env.XDG_CONFIG_HOME || (process.env.HOME ? path.join(process.env.HOME, ".config") : "");
      const base = path.join(homedir, (channel === "canary" ? "discordcanary" : channel === "ptb" ? "discordptb" : "discord"));
      if (!fs.existsSync(base)) throw new Error(`Cannot find Discord directory: ${base}`);
      const versions = fs.readdirSync(base).filter((f) => fs.lstatSync(path.join(base, f)).isDirectory() && f.startsWith("app-")).sort().reverse();
      if (!versions.length) throw new Error(`No app-* versions found in ${base}`);
      const bin = path.join(base, versions[0], "Discord");
      if (!fs.existsSync(bin)) throw new Error(`Discord binary not found at ${bin}`);
      const env = Object.assign({}, process.env);
      if (channel !== "stable") env.DISCORD_PRELOAD = preload;
      console.log(`Launching ${channel} on Linux: ${bin}`);
      spawn(bin, {env, detached: true, stdio: "ignore"}).unref();
    }
  }
  catch (err) {
    console.error("Failed to launch Discord:", err && err.message ? err.message : err);
    process.exit(1);
  }
}
