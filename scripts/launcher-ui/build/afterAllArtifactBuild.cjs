const path = require("path");
const fs = require("fs");

/**
 * electron-builder hook: afterAllArtifactBuild
 * Runs after all artifacts are built (EXE is no longer held open by packer).
 *
 * @param {import('electron-builder').AfterAllArtifactBuildContext} context
 */
module.exports = async function afterAllArtifactBuild(context) {
    try {
        const outDir = context && context.outDir ? context.outDir : "";
        const iconPath = path.resolve(__dirname, "icon.ico");
        const logPath = outDir ? path.join(outDir, "inaccord_afterAll_icon.log") : null;
        const log = (line) => {
            try {
                if (logPath) fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);
            }
            catch {}
            try { console.log(`[afterAllArtifactBuild] ${line}`); } catch {}
        };

        if (!outDir || !fs.existsSync(outDir)) {
            log(`outDir missing: ${String(outDir)}`);
            return;
        }

        if (!fs.existsSync(iconPath)) {
            log(`icon missing: ${iconPath}`);
            return;
        }

        const { rcedit } = require("rcedit");

        const replaceIconOnExe = async (exePath, label) => {
            try {
                if (!exePath || !fs.existsSync(exePath)) return false;
                const tmpExePath = exePath + ".icon-tmp";
                try { fs.unlinkSync(tmpExePath); } catch {}
                fs.copyFileSync(exePath, tmpExePath);
                await rcedit(tmpExePath, { icon: iconPath });
                try { fs.unlinkSync(exePath); } catch {}
                fs.renameSync(tmpExePath, exePath);
                log(`rcedit ok (replaced) label=${label} path=${exePath}`);
                return true;
            }
            catch (e) {
                log(`rcedit failed label=${label} path=${exePath} err=${String(e && e.stack ? e.stack : e)}`);
                try { fs.unlinkSync(exePath + ".icon-tmp"); } catch {}
                return false;
            }
        };

        // Collect EXE candidates:
        // 1) Explicit artifact paths (installer, blockmap-related helper exes, etc.)
        // 2) Known output folders (win-unpacked, outDir root)
        // 3) Any EXE sitting directly under outDir (electron-builder often outputs there)
        const exeCandidates = new Set();

        const artifactPaths = Array.isArray(context && context.artifactPaths) ? context.artifactPaths : [];
        for (const p of artifactPaths) {
            if (typeof p === "string" && p && /\.exe$/i.test(p)) exeCandidates.add(p);
        }

        const scanDirs = [
            outDir,
            path.join(outDir, "win-unpacked")
        ];

        for (const dir of scanDirs) {
            try {
                if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const e of entries) {
                    if (e.isFile() && /\.exe$/i.test(e.name)) {
                        exeCandidates.add(path.join(dir, e.name));
                    }
                }
            }
            catch {}
        }

        const sorted = [...exeCandidates].sort((a, b) => a.localeCompare(b));
        if (!sorted.length) {
            log("no exe candidates found");
            return;
        }

        log(`outDir=${outDir}`);
        log(`iconPath=${iconPath}`);
        log(`exeCandidates=${sorted.length}`);

        // Patch every EXE we can see.
        for (const p of sorted) {
            const base = path.basename(p);
            const label = /setup/i.test(base) ? "installer" : /uninstaller/i.test(base) ? "uninstaller" : /launcher/i.test(base) ? "app" : "exe";
            // eslint-disable-next-line no-await-in-loop
            await replaceIconOnExe(p, label);
        }

        // Also update the top-level convenience EXE in dist/ (if present/used).
        // This is the file many people click directly: dist/ia-launcher-win.exe
        try {
            const distDir = path.resolve(outDir, "..");
            const aliasExe = path.join(distDir, "ia-launcher-win.exe");
            // Prefer the real unpacked app exe as the alias source.
            let sourceExe = "";
            try {
                const unpackedDir = path.join(outDir, "win-unpacked");
                const preferred = path.join(unpackedDir, "InAccord Launcher.exe");
                if (fs.existsSync(preferred)) sourceExe = preferred;
            }
            catch {}

            if (!sourceExe) {
                // Fallback: first exe candidate.
                sourceExe = sorted[0];
            }

            const tmpAlias = aliasExe + ".icon-tmp";
            try { fs.unlinkSync(tmpAlias); } catch {}
            try { fs.unlinkSync(aliasExe); } catch {}
            fs.copyFileSync(sourceExe, tmpAlias);
            await rcedit(tmpAlias, { icon: iconPath });
            fs.renameSync(tmpAlias, aliasExe);
            log(`alias ok (replaced): ${aliasExe} source=${sourceExe}`);
        }
        catch (e) {
            log(`alias failed: ${String(e && e.stack ? e.stack : e)}`);
        }
    }
    catch (e) {
        try {
            console.log(`[afterAllArtifactBuild] failed: ${String(e && e.stack ? e.stack : e)}`);
        }
        catch {}
    }
};
