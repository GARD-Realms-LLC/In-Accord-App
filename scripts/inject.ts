import fs from "fs";
import path from "path";
<<<<<<< Updated upstream
import bun from "bun";
=======
>>>>>>> Stashed changes

import doSanityChecks from "./helpers/validate";
import buildPackage from "./helpers/package";
import copyFiles from "./helpers/copy";

const args = process.argv.slice(2);

const useiaRelease = args[0]?.toLowerCase() === "release";
const releaseInput = (useiaRelease ? args[1] : args[0])?.toLowerCase();
const release = releaseInput === "canary" ? "Discord Canary" : releaseInput === "ptb" ? "Discord PTB" : "Discord";

const restoreMode = args.includes("restore") || args.includes("uninject") || args.includes("undo");

<<<<<<< Updated upstream
const iaPath = useiaRelease
    ? path.resolve(__dirname, "..", "dist", "InAccord.asar")
    : path.resolve(__dirname, "..", "dist");
=======
// BetterDiscord-style:
// - dev: require() the dist directory (runs dist/package.json -> main.js)
// - release: require() the packaged asar
const distDir = path.resolve(__dirname, "..", "dist");
const iaPath = useiaRelease
    ? path.join(distDir, "InAccord.asar")
    : distDir;
>>>>>>> Stashed changes

async function getDiscordCorePath() {
    let resourcePath = "";

<<<<<<< Updated upstream
    if (process.platform === "win32") {
        const basedir = path.join(process.env.LOCALAPPDATA!, release.replace(/ /g, ""));
        if (!fs.existsSync(basedir)) throw new Error(`Cannot find directory for ${release}`);

        const version = fs.readdirSync(basedir)
            .filter(f => fs.lstatSync(path.join(basedir, f)).isDirectory() && f.split(".").length > 1)
            .sort()
            .reverse()[0];

        const coreWrap = fs.readdirSync(path.join(basedir, version, "modules"))
            .filter(e => e.indexOf("discord_desktop_core") === 0)
            .sort()
            .reverse()[0];

        resourcePath = path.join(basedir, version, "modules", coreWrap, "discord_desktop_core");
    }
    else if (process.env.WSL_DISTRO_NAME) {
        const appdata = (await bun.$`wslpath "$(cmd.exe /c "echo %LOCALAPPDATA%" 2>/dev/null | tr -d '\r')"`.text()).trim();
        const basedir = path.join(appdata, release.replace(/ /g, ""));
        if (!fs.existsSync(basedir)) throw new Error(`Cannot find directory for ${release}`);

        const version = fs.readdirSync(basedir)
            .filter(f => fs.lstatSync(path.join(basedir, f)).isDirectory() && f.split(".").length > 1)
            .sort()
            .reverse()[0];

        const coreWrap = fs.readdirSync(path.join(basedir, version, "modules"))
            .filter(e => e.indexOf("discord_desktop_core") === 0)
            .sort()
            .reverse()[0];

        resourcePath = path.join(basedir, version, "modules", coreWrap, "discord_desktop_core");
    }
    else {
        let userData = process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : path.join(process.env.HOME!, ".config");
        if (process.platform === "darwin") userData = path.join(process.env.HOME!, "Library", "Application Support");

        const basedir = path.join(userData, release.toLowerCase().replace(" ", ""));
        if (!fs.existsSync(basedir)) return "";

        const version = fs.readdirSync(basedir)
            .filter(f => fs.lstatSync(path.join(basedir, f)).isDirectory() && f.split(".").length > 1)
            .sort()
            .reverse()[0];

        if (!version) return "";

        resourcePath = path.join(basedir, version, "modules", "discord_desktop_core");
    }

    if (fs.existsSync(resourcePath)) return resourcePath;
    return "";
}

(async function main() {
    const discordPath = await getDiscordCorePath();

    doSanityChecks(iaPath);
    buildPackage(iaPath);
    console.log("");

    console.log(`Injecting into ${release}`);
    if (!fs.existsSync(discordPath)) throw new Error(`Cannot find directory for ${release}`);
    console.log(`    ✅ Found ${release} in ${discordPath}`);

    const indexJs = path.join(discordPath, "index.js");
    const backupJs = indexJs + ".ia.bak";

    if (restoreMode) {
        // Restore backup if present
        if (fs.existsSync(backupJs)) {
            try {
                fs.copyFileSync(backupJs, indexJs);
                fs.unlinkSync(backupJs);
                console.log(`    ✅ Restored original index.js from ${backupJs}`);
            }
            catch (err) {
                throw new Error(`Failed to restore backup: ${err && err.message || err}`);
            }
        }
        else {
            throw new Error(`No backup found to restore at ${backupJs}`);
=======
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
                    .map((e) => e.name);

                const extractWrapVersion = (name: string) => {
                    const n = String(name || "");
                    const m = n.match(/^discord_desktop_core[-_]?(.+)$/i);
                    const v = (m && m[1]) ? String(m[1]) : "";
                    return v.replace(/^[\-_.]+/, "") || "0";
                };

                entries.sort((a, b) => compareVersionsDesc(extractWrapVersion(a), extractWrapVersion(b)));
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
    //   require(<package path>);
    //   module.exports = require("./core.asar");
    //
    // IMPORTANT:
    // Do NOT hardcode a single absolute path. Discord updates and user moves can leave
    // discord_desktop_core/index.js pointing at a stale location, which looks like
    // "Stable loads but no InAccord UI".
    //
    // Instead, we emit a small resolver that tries:
    // - INACCORD_PACKAGE_PATH (explicit override)
    // - the build-time dist/asr path (dev convenience)
    // - %APPDATA%\InAccord\InAccord.asar (BetterDiscord-style roaming install)
    // - %APPDATA%\InAccord\dist (dev builds copied there)
    const marker = "INACCORD_CORE_PATCH_BD_STYLE";
    const original = fs.readFileSync(indexPath, "utf8");

    const pkgAbs = iaPath;
    const pkgExists = (() => {
        try { return !!(pkgAbs && fs.existsSync(pkgAbs)); }
        catch { return false; }
    })();

    // If it's already patched, accept it as long as it contains our marker.
    // We intentionally do not require that it points at an exact literal path,
    // because the patched code resolves paths dynamically at runtime.
    if (original.includes(marker)) {
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

    // We can still patch even if the dev build path doesn't exist, because
    // the runtime resolver also checks roaming install locations.

    const escapeForJsString = (value: string) => String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const pkgAbsEscaped = escapeForJsString(pkgAbs || "");

    const patched =
        `// ${marker}\n` +
        `(() => {\n` +
        `  try {\n` +
        `    const fs = require('fs');\n` +
        `    const path = require('path');\n` +
        `    const os = require('os');\n` +
        `\n` +
        `    const candidates = [];\n` +
        `    try { if (process.env.INACCORD_PACKAGE_PATH) candidates.push(String(process.env.INACCORD_PACKAGE_PATH)); } catch {}\n` +
        (pkgAbs ? `    try { candidates.push('${pkgAbsEscaped}'); } catch {}\n` : ``) +
        `\n` +
        `    const appData = (() => {\n` +
        `      try { if (process.env.APPDATA) return String(process.env.APPDATA); } catch {}\n` +
        `      try { if (process.env.USERPROFILE) return path.join(String(process.env.USERPROFILE), 'AppData', 'Roaming'); } catch {}\n` +
        `      try { return path.join(os.homedir(), 'AppData', 'Roaming'); } catch {}\n` +
        `      return '';\n` +
        `    })();\n` +
        `\n` +
        `    if (appData) {\n` +
        `      candidates.push(path.join(appData, 'InAccord', 'InAccord.asar'));\n` +
        `      candidates.push(path.join(appData, 'InAccord', 'dist'));\n` +
        `      candidates.push(path.join(appData, 'InAccord'));\n` +
        `    }\n` +
        `\n` +
        `    for (const c of candidates) {\n` +
        `      try {\n` +
        `        if (!c) continue;\n` +
        `        if (!fs.existsSync(c)) continue;\n` +
        `        require(c);\n` +
        `        break;\n` +
        `      } catch {}\n` +
        `    }\n` +
        `  } catch {}\n` +
        `})();\n` +
        `module.exports = require("./core.asar");\n`;

    fs.writeFileSync(indexPath, patched, "utf8");
    console.log("    ✅ Patched discord_desktop_core/index.js (BetterDiscord-style)");
    return true;
}

function restoreDiscordDesktopCoreIndex(release: string) {
    if (process.platform !== "win32") return false;

    const appDir = findLatestWinAppDir(release);
    if (!appDir) return false;

    const coreDir = (() => {
        try {
            const modulesDir = path.join(appDir, "modules");
            if (fs.existsSync(modulesDir)) {
                const entries = fs.readdirSync(modulesDir, {withFileTypes: true})
                    .filter((e) => e.isDirectory() && e.name.toLowerCase().startsWith("discord_desktop_core"))
                    .map((e) => e.name);

                const extractWrapVersion = (name: string) => {
                    const n = String(name || "");
                    const m = n.match(/^discord_desktop_core[-_]?(.+)$/i);
                    const v = (m && m[1]) ? String(m[1]) : "";
                    return v.replace(/^[\-_.]+/, "") || "0";
                };

                entries.sort((a, b) => compareVersionsDesc(extractWrapVersion(a), extractWrapVersion(b)));
                const wrap = entries[0];
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
            return true;
        }
        if (fs.existsSync(legacyBackupPath) && fs.existsSync(indexPath)) {
            fs.copyFileSync(legacyBackupPath, indexPath);
            console.log("    ✅ Restored discord_desktop_core/index.js from index.js.ia.bak");
            return true;
        }
    }
    catch (e: any) {
        console.log(`    ⚠️ Failed to restore discord_desktop_core/index.js (${e?.message || String(e)})`);
    }
    return false;
}

(async function main() {
    // For uninstall we don't need to rebuild, but sanity checks help ensure paths exist.
    if (!uninstallMode) {
        doSanityChecks(iaPath);
        buildPackage(iaPath);
    }
    console.log("");
    let patchedCount = 0;

    for (const release of releaseTargets) {
        if (uninstallMode) {
            console.log(`Uninstalling injection for ${release}`);
            if (restoreDiscordDesktopCoreIndex(release)) patchedCount++;
        }
        else {
            console.log(`Injecting into ${release}`);
            if (patchDiscordDesktopCoreIndex(release)) patchedCount++;
>>>>>>> Stashed changes
        }

        console.log(`\nRestore complete for ${release}. Please restart Discord.`);
        return;
    }

<<<<<<< Updated upstream
    // Create a backup of any existing index.js before modifying
    if (fs.existsSync(indexJs)) {
        if (!fs.existsSync(backupJs)) {
            try {
                fs.copyFileSync(indexJs, backupJs);
                console.log(`    ✅ Backed up existing index.js to ${backupJs}`);
            }
            catch (err) {
                console.warn(`    ⚠️ Failed to create backup of index.js: ${err && err.message || err}`);
            }
        }
        try { fs.unlinkSync(indexJs); } catch {}
    }

    if (process.env.WSL_DISTRO_NAME) {
        copyFiles(iaPath, path.join(discordPath, "InAccord"));
        fs.writeFileSync(indexJs, "require(\"./InAccord\");\nmodule.exports = require(\"./core.asar\");");
    }
    else {
        fs.writeFileSync(indexJs, `require("${iaPath.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}");\nmodule.exports = require("./core.asar");`);
    }

    console.log("    ✅ Wrote index.js");
    console.log("");
    console.log(`Injection successful, please restart ${release}.`);
=======
    if (!patchedCount) throw new Error("No Discord installs were patched.");
    console.log(uninstallMode
        ? `Uninstall successful for ${patchedCount} channel(s).`
        : `Injection successful for ${patchedCount} channel(s).`);
>>>>>>> Stashed changes
})();
