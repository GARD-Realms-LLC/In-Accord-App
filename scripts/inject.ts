import fs from "fs";
import path from "path";
import bun from "bun";

import doSanityChecks from "./helpers/validate";
import buildPackage from "./helpers/package";
import copyFiles from "./helpers/copy";

const args = process.argv.slice(2);

const useiaRelease = args[0]?.toLowerCase() === "release";
const releaseInput = (useiaRelease ? args[1] : args[0])?.toLowerCase();
const release = releaseInput === "canary" ? "Discord Canary" : releaseInput === "ptb" ? "Discord PTB" : "Discord";

const restoreMode = args.includes("restore") || args.includes("uninject") || args.includes("undo");

const iaPath = useiaRelease
    ? path.resolve(__dirname, "..", "dist", "InAccord.asar")
    : path.resolve(__dirname, "..", "dist");

async function getDiscordCorePath() {
    let resourcePath = "";

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
        }

        console.log(`\nRestore complete for ${release}. Please restart Discord.`);
        return;
    }

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
})();
