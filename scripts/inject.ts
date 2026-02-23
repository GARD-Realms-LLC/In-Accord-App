import fs from "fs";
import os from "os";
import path from "path";

// Used to patch Discord's resources/app.asar on newer Canary builds.
// NOTE: This repo depends on 'asar', but this workspace has no tsconfig, so
// TypeScript sometimes uses "classic" resolution and fails to resolve node_modules
// for ESM imports. We load it dynamically at runtime instead.

import doSanityChecks from "./helpers/validate";
import buildPackage from "./helpers/package";

const args = process.argv.slice(2);

const uninstallMode = args.some((a) => {
    const v = String(a || "").toLowerCase();
    return v === "uninstall" || v === "--uninstall" || v === "remove" || v === "--remove";
});

const useiaRelease = args[0]?.toLowerCase() === "release";
const releaseInput = (useiaRelease ? args[1] : args[0])?.toLowerCase();
const parseReleaseName = (input?: string) => {
    if (input === "canary") return "Discord Canary";
    if (input === "ptb") return "Discord PTB";
    if (input === "dev" || input === "development") return "Discord Development";
    return "Discord";
};

const requestedRelease = releaseInput ? parseReleaseName(releaseInput) : null;
const releaseTargets = requestedRelease
    ? [requestedRelease]
    : ["Discord", "Discord PTB", "Discord Canary", "Discord Development"];

const iaPath = path.resolve(__dirname, "..", "dist");

function compareVersionsDesc(a: string, b: string) {
    const pa = a.split(".").map((x) => parseInt(x, 10)).map((n) => Number.isFinite(n) ? n : 0);
    const pb = b.split(".").map((x) => parseInt(x, 10)).map((n) => Number.isFinite(n) ? n : 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const da = pa[i] ?? 0;
        const db = pb[i] ?? 0;
        if (da !== db) return db - da;
    }
    return 0;
}

function getWinInstallBaseDir(release: string) {
    const local = process.env.LOCALAPPDATA ?? "";
    if (!local) return "";
    if (release === "Discord PTB") return path.join(local, "DiscordPTB");
    if (release === "Discord Canary") return path.join(local, "DiscordCanary");
    if (release === "Discord Development") return path.join(local, "DiscordDevelopment");
    return path.join(local, "Discord");
}

function findLatestWinAppDir(release: string): string {
    try {
        const base = getWinInstallBaseDir(release);
        if (!base || !fs.existsSync(base)) return "";
        const entries = fs.readdirSync(base, {withFileTypes: true});
        const appDirs = entries
            .filter((e) => e.isDirectory() && e.name.toLowerCase().startsWith("app-"))
            .map((e) => e.name);
        if (!appDirs.length) return "";

        appDirs.sort((x, y) => {
            const vx = x.slice("app-".length);
            const vy = y.slice("app-".length);
            return compareVersionsDesc(vx, vy);
        });

        return path.join(base, appDirs[0]);
    }
    catch {
        return "";
    }
}

function patchDiscordDesktopCoreIndex(release: string) {
    if (process.platform !== "win32") return false;

    const appDir = findLatestWinAppDir(release);
    if (!appDir) {
        console.log(`    ⚠️ Skipped core patch for ${release} (install app dir not found)`);
        return false;
    }

    const coreDir = (() => {
        try {
            // BetterDiscord-style: modern Discord installs keep discord_desktop_core
            // under app-*/modules/discord_desktop_core-*/discord_desktop_core.
            const modulesDir = path.join(appDir, "modules");
            if (fs.existsSync(modulesDir)) {
                const entries = fs.readdirSync(modulesDir, {withFileTypes: true})
                    .filter((e) => e.isDirectory() && e.name.toLowerCase().startsWith("discord_desktop_core"))
                    .map((e) => e.name)
                    .sort()
                    .reverse();
                const wrap = entries[0];
                if (wrap) {
                    const candidate = path.join(modulesDir, wrap, "discord_desktop_core");
                    if (fs.existsSync(candidate)) return candidate;
                }
            }
        }
        catch {}

        // Fallback: older layouts.
        return path.join(appDir, "resources", "discord_desktop_core");
    })();
    const indexPath = path.join(coreDir, "index.js");
    if (!fs.existsSync(indexPath)) {
        console.log(`    ⚠️ Skipped core patch for ${release} (index.js not found)`);
        return false;
    }

    // BetterDiscord injection style (exact shape):
    //   require(<absolute loader>);
    //   module.exports = require("./core.asar");
    const marker = "INACCORD_CORE_PATCH_BD_STYLE";
    const original = fs.readFileSync(indexPath, "utf8");

    // Compute the current expected loader path and literal string.
    const channelBase = getChannelDataPath(release);
    const loaderAbs = channelBase ? path.join(channelBase, "InAccord", "coreloader.js") : "";
    const loaderLiteral = JSON.stringify(String(loaderAbs).replace(/\\/g, "\\\\").replace(/"/g, "\\\""));
    const pointsAtCurrentLoader = loaderAbs ? original.includes(`require(${loaderLiteral});`) : false;
    const loaderExists = (() => { try { return !!(loaderAbs && fs.existsSync(loaderAbs)); } catch { return false; } })();

    if (original.includes(marker) && pointsAtCurrentLoader && loaderExists) {
        console.log("    ✅ Core already patched");
        return true;
    }

    const backupPath = path.join(coreDir, "index.js.inaccord.bak");
    try {
        if (!fs.existsSync(backupPath)) {
            fs.writeFileSync(backupPath, original, "utf8");
        }
    }
    catch (e: any) {
        console.log(`    ⚠️ Failed to write core backup (${e?.message || String(e)})`);
        return false;
    }

    const patched =
        `// ${marker}\n` +
        `require(${loaderLiteral});\n` +
        `module.exports = require("./core.asar");\n`;

    fs.writeFileSync(indexPath, patched, "utf8");
    console.log(original.includes(marker)
        ? "    ✅ Re-patched discord_desktop_core/index.js (loader path updated)"
        : "    ✅ Patched discord_desktop_core/index.js (BetterDiscord-style)");
    return true;
}

async function patchDiscordAppAsar(release: string) {
    if (process.platform !== "win32") return false;
    let asarLib: any = null;
    try {
        // Works in ESM (Bun) and gives us a CommonJS require.
        const mod: any = await import("node:module");
        const req = mod?.createRequire ? mod.createRequire(import.meta.url) : null;
        if (req) asarLib = req("asar");
    }
    catch {}

    if (!asarLib) {
        console.log(`    ⚠️ Skipped app.asar patch for ${release} (asar module not available)`);
        return false;
    }

    const appDir = findLatestWinAppDir(release);
    if (!appDir) {
        console.log(`    ⚠️ Skipped app.asar patch for ${release} (install app dir not found)`);
        return false;
    }

    const asarPath = path.join(appDir, "resources", "app.asar");
    if (!fs.existsSync(asarPath)) {
        console.log(`    ⚠️ Skipped app.asar patch for ${release} (app.asar not found)`);
        return false;
    }

    const marker = "INACCORD_ASAR_PATCH_v3";
    const backup = path.join(path.dirname(asarPath), "app.asar.inaccord.bak");

    const buildPatchSnippet = (defaultChannel: string) => {
        const c = String(defaultChannel || "stable").toLowerCase();
        return `\n// ${marker}\n;(async () => {\n  try {\n    const req = (typeof require === 'function') ? require : (await import('node:module')).createRequire(import.meta.url);\n    const fs = req('fs');\n    const path = req('path');\n\n    let ch = String(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || '').toLowerCase();\n    if (!ch) {\n      try {\n        const exe = String(path.basename(process.execPath || '')).toLowerCase();\n        if (exe.includes('canary')) ch = 'canary';\n        else if (exe.includes('ptb')) ch = 'ptb';\n        else if (exe.includes('development')) ch = 'development';\n        else ch = 'stable';\n      } catch {}\n    }\n    if (!ch) ch = '${c}';\n    if (!process.env.DISCORD_RELEASE_CHANNEL) process.env.DISCORD_RELEASE_CHANNEL = ch;\n\n    let appData = String(process.env.APPDATA || '');\n    if (!appData) {\n      try {\n        const electron = req('electron');\n        const app = electron && electron.app;\n        if (app && typeof app.getPath === 'function') appData = String(app.getPath('appData') || '');\n      } catch {}\n    }\n    if (!appData) {\n      try {\n        const userProfile = String(process.env.USERPROFILE || '');\n        if (userProfile) appData = path.join(userProfile, 'AppData', 'Roaming');\n      } catch {}\n    }\n\n    const bases = (ch === 'ptb') ? ['discordptb'] : (ch === 'canary') ? ['discordcanary'] : (ch === 'development' || ch === 'dev') ? ['discorddevelopment'] : ['Discord','discord'];\n    for (const base of bases) {\n      const loader = appData ? path.join(appData, base, 'InAccord', 'coreloader.js') : '';\n      if (loader && fs.existsSync(loader)) {\n        try { req(loader); } catch (e) { try { console.error(e); } catch {} }\n        break;\n      }\n    }\n  } catch (e) { try { console.error(e); } catch {} }\n})().catch(() => {});\n`;
    };

    const tryPatchJs = (jsText: string, defaultChannel: string) => {
        const original = String(jsText || "");
        if (original.includes(marker)) return {changed: false, text: original, reason: "already"};

        // Upgrade in-place if an older marker exists.
        let text = original;
        for (const legacy of ["INACCORD_ASAR_PATCH_v2", "INACCORD_ASAR_PATCH_v1"]) {
            try {
                const idx = text.indexOf(legacy);
                if (idx < 0) continue;
                const start = Math.max(0, text.lastIndexOf("\n", idx));
                const endToken = "})().catch(() => {});";
                const endIdx = text.indexOf(endToken, idx);
                if (endIdx < 0) continue;
                let cut = endIdx + endToken.length;
                while (cut < text.length && (text[cut] === "\n" || text[cut] === "\r")) cut++;
                text = text.slice(0, start) + text.slice(cut);
            }
            catch {}
        }

        const patch = buildPatchSnippet(defaultChannel);
        const m = text.match(/(^\s*(['"])use strict\2;\s*\r?\n)/);
        if (m && m[1]) {
            const idx = m[1].length;
            return {changed: true, text: text.slice(0, idx) + patch + text.slice(idx), reason: "after-use-strict"};
        }
        return {changed: true, text: patch + text, reason: "prepend"};
    };

    const normalizeRel = (p: any) => {
        try {
            const s = String(p || "").trim();
            if (!s) return "";
            return s.replace(/^\.\//, "").replace(/^\//, "").replace(/\\/g, "/");
        }
        catch {
            return "";
        }
    };

    const listBootstrapScripts = (extractDir: string) => {
        try {
            const dir = path.join(extractDir, "app_bootstrap");
            if (!fs.existsSync(dir)) return [] as Array<{rel: string; abs: string}>;
            const entries = fs.readdirSync(dir, {withFileTypes: true})
                .filter((e) => e.isFile())
                .map((e) => e.name)
                .filter((n) => /\.(c?js|mjs)$/i.test(n))
                .sort((a, b) => a.localeCompare(b));
            return entries.map((name) => ({rel: `app_bootstrap/${name}`, abs: path.join(dir, name)}));
        }
        catch {
            return [];
        }
    };

    const readJsonSafe = (p: string) => {
        try {
            if (!p || !fs.existsSync(p)) return null;
            return JSON.parse(fs.readFileSync(p, "utf8"));
        }
        catch {
            return null;
        }
    };

    const patchFileUtf8 = (absPath: string, relPath: string, out: {patched: string[]; checked: string[]; anyChanged: boolean;}) => {
        try {
            const orig = fs.readFileSync(absPath, "utf8");
            const p = tryPatchJs(orig, release);
            if (p.changed) {
                fs.writeFileSync(absPath, p.text, "utf8");
                out.patched.push(relPath);
                out.anyChanged = true;
            }
            else {
                out.checked.push(relPath);
            }
        }
        catch {
            // ignore individual file failures
        }
    };

    // Backup once.
    try {
        if (!fs.existsSync(backup)) fs.copyFileSync(asarPath, backup);
    }
    catch (e: any) {
        console.log(`    ⚠️ Skipped app.asar patch for ${release} (backup failed: ${e?.message || String(e)})`);
        return false;
    }

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inaccord-asar-patch-"));
    const extractDir = path.join(tmpRoot, "app");
    const outAsar = path.join(tmpRoot, "app.asar");
    const report = {anyChanged: false, patched: [] as string[], checked: [] as string[]};

    try {
        asarLib.extractAll(asarPath, extractDir);

        // Patch package.json main entry if present.
        try {
            const pkg = readJsonSafe(path.join(extractDir, "package.json"));
            const mainRel = normalizeRel(pkg && (pkg as any).main);
            if (mainRel) {
                const abs = path.join(extractDir, ...mainRel.split("/"));
                if (fs.existsSync(abs)) patchFileUtf8(abs, mainRel, report);
            }
        }
        catch {}

        // Patch any bootstrap scripts.
        const boots = listBootstrapScripts(extractDir);
        for (const f of boots) patchFileUtf8(f.abs, f.rel, report);

        if (!report.anyChanged) {
            console.log(`    ✅ app.asar already patched (or no targets) for ${release}`);
            return true;
        }

        // Repack (async callback API).
        await new Promise<void>((resolve, reject) => {
            const keepAlive = setInterval(() => {}, 250);
            asarLib.createPackage(extractDir, outAsar, (err: any) => {
                try { clearInterval(keepAlive); } catch {}
                if (err) reject(err);
                else resolve();
            });
        });

        fs.copyFileSync(outAsar, asarPath);
        console.log(`    ✅ Patched resources/app.asar for ${release} (files=${report.patched.length})`);
        return true;
    }
    catch (e: any) {
        console.log(`    ⚠️ app.asar patch failed for ${release} (${e?.message || String(e)})`);
        return false;
    }
    finally {
        try { fs.rmSync(tmpRoot, {recursive: true, force: true}); } catch {}
    }
}

function restoreDiscordAppAsar(release: string) {
    if (process.platform !== "win32") return false;
    const appDir = findLatestWinAppDir(release);
    if (!appDir) return false;
    const asarPath = path.join(appDir, "resources", "app.asar");
    if (!fs.existsSync(asarPath)) return false;
    const backup = path.join(path.dirname(asarPath), "app.asar.inaccord.bak");
    if (!fs.existsSync(backup)) return false;
    try {
        fs.copyFileSync(backup, asarPath);
        console.log(`    ✅ Restored resources/app.asar from app.asar.inaccord.bak`);
        return true;
    }
    catch (e: any) {
        console.log(`    ⚠️ Failed to restore app.asar (${e?.message || String(e)})`);
        return false;
    }
}

function getChannelDataPath(release: string) {
    if (process.platform === "win32") {
        const appData = process.env.APPDATA ?? "";
        if (!appData) return "";

        if (release === "Discord PTB") return path.join(appData, "discordptb");
        if (release === "Discord Canary") return path.join(appData, "discordcanary");
        if (release === "Discord Development") return path.join(appData, "discorddevelopment");
        // Stable can be %APPDATA%\discord or %APPDATA%\Discord.
        // Prefer whichever exists to avoid creating a parallel folder.
        try {
            const upper = path.join(appData, "Discord");
            if (fs.existsSync(upper)) return upper;
        }
        catch {}
        try {
            const lower = path.join(appData, "discord");
            if (fs.existsSync(lower)) return lower;
        }
        catch {}
        return path.join(appData, "Discord");
    }

    if (process.platform === "darwin") {
        const home = process.env.HOME ?? "";
        if (!home) return "";

        const base = path.join(home, "Library", "Application Support");
        if (release === "Discord PTB") return path.join(base, "discordptb");
        if (release === "Discord Canary") return path.join(base, "discordcanary");
        if (release === "Discord Development") return path.join(base, "discorddevelopment");
        return path.join(base, "discord");
    }

    const configHome = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || "", ".config");
    if (!configHome) return "";
    if (release === "Discord PTB") return path.join(configHome, "discordptb");
    if (release === "Discord Canary") return path.join(configHome, "discordcanary");
    if (release === "Discord Development") return path.join(configHome, "discorddevelopment");
    return path.join(configHome, "discord");
}

async function syncChannelLoaders(release: string) {
    const channelDataPath = getChannelDataPath(release);
    if (!channelDataPath || !fs.existsSync(channelDataPath)) {
        console.log(`    ⚠️ Skipped ${release} (data path not found)`);
        return false;
    }

    const target = path.join(channelDataPath, "InAccord");
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, {recursive: true});
        console.log(`    ✅ Created ${target}`);
    }

    const loaderFiles = ["preload.js", "InAccord.js", "mainhook.js", "coreloader.js"];
    for (const file of loaderFiles) {
        const source = path.join(iaPath, file);
        if (!fs.existsSync(source)) throw new Error(`Missing dist file: ${source}`);
        fs.copyFileSync(source, path.join(target, file));
        console.log(`    ✅ Synced ${file}`);
    }

    // Also patch Discord so InAccord auto-loads without the launcher.
    // Windows-only: either resources/discord_desktop_core/index.js (older) or resources/app.asar (newer Canary).
    try {
        const okCore = patchDiscordDesktopCoreIndex(release);
        if (!okCore) {
            // Fallback for Canary/newer builds.
            await patchDiscordAppAsar(release);
        }
    }
    catch (e: any) {
        console.log(`    ⚠️ Core patch failed (${e?.message || String(e)})`);
    }

    const installedFile = path.join(target, "InAccord.installed.json");
    fs.writeFileSync(installedFile, JSON.stringify({
        release,
        source: iaPath,
        files: loaderFiles,
        installedAt: new Date().toISOString()
    }, null, 2));
    console.log("    ✅ Updated InAccord.installed.json");
    return true;
}

function safeUnlink(p: string) {
    try {
        if (p && fs.existsSync(p)) fs.unlinkSync(p);
    }
    catch {}
}

function uninstallChannelLoaders(release: string) {
    const channelDataPath = getChannelDataPath(release);
    if (!channelDataPath || !fs.existsSync(channelDataPath)) {
        console.log(`    ⚠️ Skipped ${release} (data path not found)`);
        return false;
    }

    const target = path.join(channelDataPath, "InAccord");
    if (fs.existsSync(target)) {
        try {
            fs.rmSync(target, {recursive: true, force: true});
            console.log(`    ✅ Removed ${target}`);
        }
        catch (e: any) {
            console.log(`    ⚠️ Failed to remove ${target} (${e?.message || String(e)})`);
        }
    }
    else {
        console.log(`    ✅ Not installed (no ${target})`);
    }

    // Remove markers/logs written outside the InAccord dir.
    const extras = [
        path.join(channelDataPath, "InAccord.preload_loaded.json"),
        path.join(channelDataPath, "InAccord.running.json"),
        path.join(channelDataPath, "InAccord_inject.log"),
        path.join(channelDataPath, "InAccord.mainhook_loaded.json"),
        path.join(channelDataPath, "InAccord_mainhook.log"),
        path.join(channelDataPath, "InAccord.cdp_injected.json"),
        path.join(channelDataPath, "InAccord_cdp.log"),
        path.join(channelDataPath, "InAccord.startup.log")
    ];
    for (const f of extras) safeUnlink(f);

    // Restore core patch (Windows-only) if our backup exists.
    if (process.platform === "win32") {
        const appDir = findLatestWinAppDir(release);
        if (appDir) {
            const coreDir = (() => {
                try {
                    const modulesDir = path.join(appDir, "modules");
                    if (fs.existsSync(modulesDir)) {
                        const wrap = fs.readdirSync(modulesDir, {withFileTypes: true})
                            .filter((e) => e.isDirectory() && e.name.toLowerCase().startsWith("discord_desktop_core"))
                            .map((e) => e.name)
                            .sort()
                            .reverse()[0];
                        if (wrap) {
                            const candidate = path.join(modulesDir, wrap, "discord_desktop_core");
                            if (fs.existsSync(candidate)) return candidate;
                        }
                    }
                }
                catch {}
                return path.join(appDir, "resources", "discord_desktop_core");
            })();
            const indexPath = path.join(coreDir, "index.js");
            const backupPath = path.join(coreDir, "index.js.inaccord.bak");
            const legacyBackupPath = path.join(coreDir, "index.js.ia.bak");

            try {
                if (fs.existsSync(backupPath) && fs.existsSync(indexPath)) {
                    fs.copyFileSync(backupPath, indexPath);
                    console.log("    ✅ Restored discord_desktop_core/index.js from index.js.inaccord.bak");
                }
                else if (fs.existsSync(legacyBackupPath) && fs.existsSync(indexPath)) {
                    fs.copyFileSync(legacyBackupPath, indexPath);
                    console.log("    ✅ Restored discord_desktop_core/index.js from index.js.ia.bak");
                }
            }
            catch (e: any) {
                console.log(`    ⚠️ Failed to restore discord_desktop_core/index.js (${e?.message || String(e)})`);
            }

            // Remove our injected loader file(s) if present.
            try { safeUnlink(path.join(coreDir, "inaccord_coreloader.cjs")); } catch {}
            try { safeUnlink(path.join(coreDir, "inaccord_coreloader.js")); } catch {} // legacy
        }

        // Restore app.asar patch if present (newer Canary builds).
        try {
            restoreDiscordAppAsar(release);
        }
        catch {}
    }

    return true;
}

(async function main() {
    // For uninstall we don't need to rebuild, but sanity checks help ensure paths exist.
    if (!uninstallMode) {
        doSanityChecks(iaPath);
        buildPackage(iaPath);
    }
    console.log("");
    let syncedCount = 0;

    for (const release of releaseTargets) {
        if (uninstallMode) {
            console.log(`Uninstalling loader files for ${release}`);
            if (uninstallChannelLoaders(release)) syncedCount++;
        }
        else {
            console.log(`Installing loader files for ${release}`);
            if (await syncChannelLoaders(release)) syncedCount++;
        }
        console.log("");
    }

    if (!syncedCount) throw new Error("No Discord channel data paths were found to install loader files.");
    console.log(uninstallMode
        ? `Loader uninstall successful for ${syncedCount} channel(s).`
        : `Loader install successful for ${syncedCount} channel(s).`);
})();
