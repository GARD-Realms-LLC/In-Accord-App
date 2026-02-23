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
