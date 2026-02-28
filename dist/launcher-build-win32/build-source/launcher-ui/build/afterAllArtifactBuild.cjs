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
        // outDir may be a subfolder (e.g. launcher-build-win32-latest/.builder).
        // Always mirror final artifacts into the parent folder (launcher-build-win32-latest)
        // so there is exactly one canonical folder to use.
        const parentOutDir = outDir ? path.resolve(outDir, "..") : "";
        const logPath = outDir ? path.join(outDir, "inaccord_afterAll_icon.log") : null;
        const log = (line) => {
            try {
                if (logPath) fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);
            }
            catch {}
            try {console.log(`[afterAllArtifactBuild] ${line}`);} catch {}
        };

        // Auto-increment build sequence number in the canonical output folder.
        // This does NOT modify the EXE, so it will not break NSIS integrity.
        try {
            if (parentOutDir && fs.existsSync(parentOutDir)) {
                const seqPath = path.join(parentOutDir, 'In-Accord.Launcher.build-seq.txt');
                let seq = 0;

                // If the canonical top-level build-seq was already written prior to packaging (preferred),
                // use that value so we don't diverge. Otherwise fall back to migration + auto-increment.
                try {
                    if (fs.existsSync(seqPath)) {
                        const t = String(fs.readFileSync(seqPath, 'utf8') || '').trim();
                        const n = Number.parseInt(t, 10);
                        if (Number.isFinite(n)) {
                            seq = n;
                            log(`using existing top-level build-seq=${seq}`);
                        }
                    }
                }
                catch (e) { /* ignore */ }

                if (!seq) {
                    // If this is a fresh folder (e.g. renamed from launcher-build-win32-latest -> launcher-build-win32),
                    // migrate the last sequence value forward so it never resets, then increment.
                    try {
                        if (!fs.existsSync(seqPath)) {
                            const distDir = path.resolve(parentOutDir, '..');
                            const oldDir = path.join(distDir, 'launcher-build-win32-latest');
                            const oldSeq = path.join(oldDir, 'InAccord.Launcher.build-seq.txt');
                            if (fs.existsSync(oldSeq)) {
                                fs.copyFileSync(oldSeq, seqPath);
                                log(`migrated build-seq from ${oldSeq}`);
                            }
                        }
                    }
                    catch {}

                    try {
                        if (fs.existsSync(seqPath)) {
                            const t = String(fs.readFileSync(seqPath, 'utf8') || '').trim();
                            const n = Number.parseInt(t, 10);
                            if (Number.isFinite(n)) seq = n;
                        }
                    }
                    catch {}
                    seq++;
                    try {fs.writeFileSync(seqPath, String(seq) + "\n", 'utf8');} catch {}
                    try {log(`build-seq=${seq}`);} catch {}
                }

                // Also write a small JSON for diagnostics.
                try {
                    const metaPath = path.join(parentOutDir, 'In-Accord.Launcher.build.json');
                    fs.writeFileSync(metaPath, JSON.stringify({
                        seq,
                        ts: new Date().toISOString()
                    }, null, 2), 'utf8');
                }
                catch {}

                // Per build policy, do NOT attempt to modify packaged app.asar during after-build.
                // Rationale: touching in-place packaged resources can cause file-in-use conflicts on Windows
                // and may trigger build-time failures if other processes hold handles. The build-seq is
                // already written prepack into `launcher-ui/build/In-Accord.Launcher.build-seq.txt` and
                // the authoritative top-level `In-Accord.Launcher.build-seq.txt` is written above; the
                // runtime reads that external file first. Therefore asar modification is intentionally disabled.
                try { log('asar injection disabled by build policy; relying on prepack and top-level build-seq'); } catch (e) {}

                // Restorepoint record (single file, append-only) in the same required output folder.
                // Includes hashes so we can identify exactly what changed per build.
                try {
                    const crypto = require('crypto');
                    const sha256File = (p) => {
                        try {
                            const buf = fs.readFileSync(p);
                            return crypto.createHash('sha256').update(buf).digest('hex');
                        }
                        catch {return null;}
                    };

                    const restorePath = path.join(parentOutDir, 'In-Accord.Launcher.restorepoints.ndjson');
                    const entry = {
                        seq,
                        ts: new Date().toISOString(),
                        outDir,
                        parentOutDir,
                        exe: null,
                        sources: {}
                    };

                    try {
                        const exeP = path.join(parentOutDir, 'InAccord Launcher.exe');
                        if (fs.existsSync(exeP)) {
                            const st = fs.statSync(exeP);
                            entry.exe = {path: exeP, bytes: st.size, mtimeMs: st.mtimeMs, sha256: sha256File(exeP)};
                        }
                    }
                    catch {}

                    // Hash the launcher UI sources that define runtime behavior.
                    const repoRoot = path.resolve(__dirname, '..');
                    const srcFiles = [
                        path.join(repoRoot, 'main.js'),
                        path.join(repoRoot, 'index.html'),
                        path.join(repoRoot, 'package.json'),
                        path.join(__dirname, 'afterAllArtifactBuild.cjs'),
                        path.join(__dirname, 'beforePack.cjs')
                    ];
                    for (const p of srcFiles) {
                        try {
                            if (!fs.existsSync(p)) continue;
                            entry.sources[path.relative(repoRoot, p).replace(/\\/g, '/')] = sha256File(p);
                        }
                        catch {}
                    }

                    fs.appendFileSync(restorePath, JSON.stringify(entry) + "\n");
                }
                catch (e) {
                    log(`restorepoint failed: ${String(e && e.stack ? e.stack : e)}`);
                }
            }
        }
        catch (e) {
            log(`build-seq failed: ${String(e && e.stack ? e.stack : e)}`);
        }

        if (!outDir || !fs.existsSync(outDir)) {
            log(`outDir missing: ${String(outDir)}`);
            return;
        }

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
                const entries = fs.readdirSync(dir, {withFileTypes: true});
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
        log(`exeCandidates=${sorted.length}`);

        // Keep EXACTLY ONE portable launcher EXE in the parent output folder.
        // This prevents multiple similarly-named EXEs (versioned + mirrored + alias) from accumulating.
        try {
            if (parentOutDir && fs.existsSync(parentOutDir)) {
                const desiredName = "In-Accord Launcher.exe";
                const desiredDest = path.join(parentOutDir, desiredName);

                // Pick the portable artifact EXE (prefer one located directly in outDir, not win-unpacked).
                let picked = "";
                for (const p of sorted) {
                    try {
                        const rel = path.relative(outDir, p).replace(/\\/g, "/");
                        if (rel.includes("win-unpacked/")) continue;
                        if (!/\.exe$/i.test(p)) continue;
                        picked = p;
                        break;
                    }
                    catch {}
                }
                if (!picked) picked = sorted[0];

                // Overwrite the single canonical EXE using a retrying, atomic-ish copy
                // to reduce intermittent EBUSY (file-in-use) failures on Windows.
                const delay = (ms) => new Promise((res) => setTimeout(res, ms));
                const safeCopyWithRetries = async (src, dest, attempts = 6) => {
                    for (let i = 0; i < attempts; i++) {
                        const tmp = dest + `.tmp.${Date.now()}.${i}`;
                        try {
                            try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
                            fs.copyFileSync(src, tmp);
                            try { fs.unlinkSync(dest); } catch {}
                            fs.renameSync(tmp, dest);
                            try { log(`wrote single exe -> ${dest} source=${src} attempt=${i+1}`); } catch {}
                            return true;
                        } catch (e) {
                            try { log(`safeCopy attempt ${i+1} failed: ${String(e && e.stack ? e.stack : e)}`); } catch {}
                            try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
                            await delay(100 * Math.pow(2, i));
                        }
                    }
                    try { log(`safeCopy failed after ${attempts} attempts src=${src} dest=${dest}`); } catch {}
                    return false;
                };

                try {
                    // Ensure we await inside this async hook
                    const ok = await safeCopyWithRetries(picked, desiredDest);
                    if (!ok) {
                        try { fs.copyFileSync(picked, desiredDest); log(`wrote single exe (fallback) -> ${desiredDest} source=${picked}`); } catch (e) { log(`final direct copy failed: ${String(e)}`); }
                    }
                } catch (e) {
                    try { log(`safe copy wrapper failed: ${String(e && e.stack ? e.stack : e)}`); } catch {}
                }

                // Delete extra launcher exe variants in the parent output folder.
                // Do NOT delete setup installers or other unrelated exes.
                try {
                    const entries = fs.readdirSync(parentOutDir, {withFileTypes: true});
                    for (const e of entries) {
                        try {
                            if (!e.isFile()) continue;
                            if (!/\.exe$/i.test(e.name)) continue;
                            if (e.name === desiredName) continue;
                            // Remove known duplicate launcher outputs.
                            if (e.name.toLowerCase() === 'ia-launcher-win.exe') {
                                fs.unlinkSync(path.join(parentOutDir, e.name));
                                log(`removed extra launcher exe -> ${e.name}`);
                                continue;
                            }
                            // Remove versioned launcher exe like "In-Accord Launcher 0.0.1.exe"
                            if (/^in-accord launcher\s+\d/i.test(e.name.toLowerCase())) {
                                fs.unlinkSync(path.join(parentOutDir, e.name));
                                log(`removed extra launcher exe -> ${e.name}`);
                                continue;
                            }
                        }
                        catch {}
                    }
                }
                catch {}

                // Remove the win-unpacked folder from the parent output.
                // The portable artifact is the only supported launch entry for this repo.
                // Keeping win-unpacked around causes people to run the wrong EXE and see stale UI/status.
                try {
                    const unpacked = path.join(parentOutDir, 'win-unpacked');
                    if (fs.existsSync(unpacked)) {
                        fs.rmSync(unpacked, {recursive: true, force: true});
                        log(`removed parent win-unpacked -> ${unpacked}`);
                    }
                }
                catch (e) {
                    log(`remove parent win-unpacked failed: ${String(e && e.stack ? e.stack : e)}`);
                }
            }
        }
        catch (e) {
            log(`single-exe mirror failed: ${String(e && e.stack ? e.stack : e)}`);
        }

        // Best-effort cleanup: remove the temporary outDir so it doesn't persist.
        // This keeps launcher-build-win32-latest clean (only one EXE + logs).
        try {
            if (outDir && fs.existsSync(outDir)) {
                fs.rmSync(outDir, {recursive: true, force: true});
                log(`cleaned temp outDir -> ${outDir}`);
            }
        }
        catch (e) {
            log(`cleanup temp outDir failed: ${String(e && e.stack ? e.stack : e)}`);
        }
    }
    catch (e) {
        try {
            console.log(`[afterAllArtifactBuild] failed: ${String(e && e.stack ? e.stack : e)}`);
        }
        catch {}
    }
};
