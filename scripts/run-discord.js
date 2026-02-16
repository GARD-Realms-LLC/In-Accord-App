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

console.log("\n✅ Done. Fully quit Discord, then open it again to see InAccord running.");
