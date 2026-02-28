const path = require("path");
const fs = require("fs");

/**
 * electron-builder hook: beforePack
 * Generate a multi-size Windows ICO from the repo PNG.
 *
 * @param {import('electron-builder').BeforePackContext} context
 */
module.exports = async function beforePack(context) {
    try {
        void context;

        const iconSrcPng = path.resolve(__dirname, "..", "..", "..", "Images", "Discord Dev.png");
        const splashSrcPng = path.resolve(__dirname, "..", "..", "..", "Images", "splash.png");

        const outIco = path.resolve(__dirname, "icon.ico");
        const outSplashHeaderIco = path.resolve(__dirname, "splashHeader.ico");
        const logPath = path.resolve(__dirname, "icon_generation.log");

        const log = (line) => {
            try { fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`); } catch {}
        };

        // --- Build-seq synchronization and auto-bump block ---
        // Use the canonical, absolute build-seq file path (user canonical path) so bumping
        // is deterministic regardless of packaging CWD. This file is authoritative and
        // will be incremented once per packaging run. After bumping we will propagate
        // the number into the packaged `package.json` patch field.
        try {
            const canonicalAbsolute = 'E:\\In-Accord-Apps\\dist\\launcher-build-win32\\In-Accord.Launcher.build-seq.txt';
            let bumped = false;

            // Create a lightweight restorepoint file (append-only) before mutating the canonical seq.
            try {
                const rpDir = path.resolve(__dirname, '..', '..');
                const rpPath = path.resolve(rpDir, `restorepoint.beforePack.${Date.now()}.ndjson`);
                try {
                    const snapshot = {
                        ts: new Date().toISOString(),
                        file: canonicalAbsolute,
                        before: (fs.existsSync(canonicalAbsolute) ? String(fs.readFileSync(canonicalAbsolute, 'utf8') || '').trim() : null)
                    };
                    try { fs.writeFileSync(rpPath, JSON.stringify(snapshot) + '\n', 'utf8'); } catch (e) { /* best-effort */ }
                } catch {}
            } catch {}

            try {
                if (fs.existsSync(canonicalAbsolute)) {
                    const raw = String(fs.readFileSync(canonicalAbsolute, 'utf8') || '').trim();
                    const cur = Number.parseInt(raw, 10) || 0;
                    const next = Number.isFinite(cur) ? (cur + 1) : 1;
                    fs.writeFileSync(canonicalAbsolute, String(next) + '\n', 'utf8');
                    try { log(`bumped canonical seq ${canonicalAbsolute} ${cur} -> ${next}`); } catch {}
                    bumped = true;
                } else {
                    try { log(`canonical seq missing at ${canonicalAbsolute}`); } catch {}
                }
            } catch (e) { try { log(`bump write failed ${canonicalAbsolute}: ${String(e)}`); } catch {} }

            // Fallback: if for some reason the canonical absolute file was not present, try the relative candidates.
            if (!bumped) {
                const bumpCandidates = [
                    path.resolve(__dirname, '..', '..', '..', 'In-Accord.Launcher.build-seq.txt'),
                    path.resolve(__dirname, '..', '..', 'In-Accord.Launcher.build-seq.txt'),
                    path.resolve(__dirname, '..', '..', '..', '..', 'In-Accord.Launcher.build-seq.txt')
                ];
                for (const bp of bumpCandidates) {
                    try {
                        if (!bp) continue;
                        if (fs.existsSync(bp)) {
                            try {
                                const raw = String(fs.readFileSync(bp, 'utf8') || '').trim();
                                const cur = Number.parseInt(raw, 10) || 0;
                                const next = Number.isFinite(cur) ? (cur + 1) : 1;
                                fs.writeFileSync(bp, String(next) + '\n', 'utf8');
                                try { log(`bumped canonical seq ${bp} ${cur} -> ${next}`); } catch {}
                                bumped = true;
                                break;
                            } catch (e) { try { log(`bump write failed ${bp}: ${String(e)}`); } catch {} }
                        }
                    } catch {}
                }
            }

            if (!bumped) try { log('no canonical seq file found to bump'); } catch {}
        } catch (e) { try { log(`seq bump outer failed: ${String(e && e.stack ? e.stack : e)}`); } catch {} }

        // --- Build-seq synchronization block ---
        // If a canonical top-level build sequence exists (next to the launcher-build-win32 folder),
        // ensure the packaged launcher UI's package.json patch number matches it so versions do not go out of sync.
        try {
            // Try multiple likely locations for the canonical top-level build-seq.
            const candidates = [
                path.resolve(__dirname, '..', '..', '..', 'In-Accord.Launcher.build-seq.txt'), // e.g. dist/launcher-build-win32/
                path.resolve(__dirname, '..', '..', 'In-Accord.Launcher.build-seq.txt'), // e.g. build-source/
                path.resolve(__dirname, '..', '..', '..', '..', 'In-Accord.Launcher.build-seq.txt') // one level higher fallback
            ];
            let canonicalSeqPath = null;
            for (const c of candidates) {
                try { if (c && fs.existsSync(c)) { canonicalSeqPath = c; break; } } catch {}
            }
            try { log(`checking canonical seq candidates -> ${JSON.stringify(candidates)}`); } catch {}
            if (canonicalSeqPath) {
                try { log(`using canonical seq at ${canonicalSeqPath}`); } catch {}
                const raw = String(fs.readFileSync(canonicalSeqPath, 'utf8') || '').trim();
                const seq = Number.parseInt(raw, 10);
                if (Number.isFinite(seq)) {
                    try {
                        const pkgPath = path.resolve(__dirname, '..', 'package.json');
                        if (fs.existsSync(pkgPath)) {
                            const pj = JSON.parse(fs.readFileSync(pkgPath, 'utf8') || '{}');
                            const ver = String(pj.version || '0.0.0');
                            const parts = ver.split('.').slice(0,2);
                            while (parts.length < 2) parts.push('0');
                            const newVer = `${parts[0]}.${parts[1]}.${String(seq)}`;
                            if (pj.version !== newVer) {
                                try { fs.writeFileSync(pkgPath, JSON.stringify(Object.assign({}, pj, { version: newVer }), null, 2) + '\n', 'utf8'); } catch (e) { log(`write package.json failed: ${String(e)}`); }
                                try { log(`synced package.json version ${ver} -> ${newVer}`); } catch {}
                            } else {
                                try { log(`package.json already in sync (${newVer})`); } catch {}
                            }

                            // Also write a small hint file in the build folder so other hooks can read the authoritative seq.
                            try {
                                const hintPath = path.resolve(__dirname, 'In-Accord.Launcher.build-seq.txt');
                                fs.writeFileSync(hintPath, String(seq) + '\n', 'utf8');
                                try { log(`wrote local build hint -> ${hintPath}`); } catch {}
                            } catch (e) { try { log(`write hint failed: ${String(e)}`); } catch {} }
                        }
                    } catch (e) { try { log(`pkg sync failed: ${String(e && e.stack ? e.stack : e)}`); } catch {} }
                }
            }
        }
        catch (e) { try { log(`seq sync outer failed: ${String(e && e.stack ? e.stack : e)}`); } catch {} }

        const ensureLauncherSplashAsset = () => {
            try {
                const dest = path.resolve(__dirname, "..", "assets", "splash.png");
                if (!fs.existsSync(splashSrcPng)) {
                    log(`splash src missing: ${splashSrcPng}`);
                    return;
                }
                // Do not create folders here; if assets/ doesn't exist, log it.
                const destDir = path.dirname(dest);
                if (!fs.existsSync(destDir)) {
                    log(`launcher assets dir missing: ${destDir}`);
                    return;
                }
                fs.copyFileSync(splashSrcPng, dest);
                try {
                    const st = fs.statSync(dest);
                    log(`synced launcher splash asset ${dest} bytes=${st.size}`);
                }
                catch {}
            }
            catch (e) {
                log(`sync splash asset failed: ${String(e && e.stack ? e.stack : e)}`);
            }
        };

        const makeSquareIcoFromPng = async (srcPngPath, outIcoPath, label) => {
            if (!fs.existsSync(srcPngPath)) {
                log(`${label} src missing: ${srcPngPath}`);
                return false;
            }

            let icoBuf = null;
            try {
                const { PNG } = await import("pngjs");
                const inputBuf = fs.readFileSync(srcPngPath);
                const src = PNG.sync.read(inputBuf);

                const size = Math.max(src.width || 0, src.height || 0) || 256;
                const dst = new PNG({ width: size, height: size, fill: true });
                dst.data.fill(0);

                const dx = Math.floor((size - src.width) / 2);
                const dy = Math.floor((size - src.height) / 2);
                try {
                    PNG.bitblt(src, dst, 0, 0, src.width, src.height, dx, dy);
                }
                catch (e) {
                    for (let y = 0; y < src.height; y++) {
                        for (let x = 0; x < src.width; x++) {
                            const si = (src.width * y + x) << 2;
                            const di = (size * (y + dy) + (x + dx)) << 2;
                            dst.data[di] = src.data[si];
                            dst.data[di + 1] = src.data[si + 1];
                            dst.data[di + 2] = src.data[si + 2];
                            dst.data[di + 3] = src.data[si + 3];
                        }
                    }
                    log(`${label} png pad manual-copy used: ${String(e && e.stack ? e.stack : e)}`);
                }

                const squarePngPath = path.resolve(__dirname, `${label}-square.png`);
                fs.writeFileSync(squarePngPath, PNG.sync.write(dst));

                const mod = await import("png-to-ico");
                icoBuf = await mod.default(squarePngPath);
                log(`${label} generated ico via png-to-ico (square padded) size=${size}`);
                try { fs.unlinkSync(squarePngPath); } catch {}
            }
            catch (e) {
                log(`${label} png-to-ico failed: ${String(e && e.stack ? e.stack : e)}`);
                return false;
            }

            try {
                const tmpOut = outIcoPath + ".tmp";
                try { fs.unlinkSync(tmpOut); } catch {}
                fs.writeFileSync(tmpOut, icoBuf);
                try { fs.unlinkSync(outIcoPath); } catch {}
                fs.renameSync(tmpOut, outIcoPath);
                try {
                    const stat = fs.statSync(outIcoPath);
                    log(`${label} wrote ${outIcoPath} bytes=${stat.size}`);
                }
                catch {}
                return true;
            }
            catch (e) {
                log(`${label} write ico failed: ${String(e && e.stack ? e.stack : e)}`);
                return false;
            }
        };

        // 1) Always sync launcher UI logo image.
        ensureLauncherSplashAsset();

        // 2) Generate the main app icon (Discord Dev.png -> build/icon.ico).
        await makeSquareIcoFromPng(iconSrcPng, outIco, "appIcon");

        // 3) Generate one-click installer header icon.
        // Requirement: ONLY use Images/Discord Dev.png as icon source.
        // Keep splash.png as a splash asset, but do not use it for icons.
        await makeSquareIcoFromPng(iconSrcPng, outSplashHeaderIco, "splashHeader");
    }
    catch {
        // Do not fail packaging if icon generation fails.
    }
};
