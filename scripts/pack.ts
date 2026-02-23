import path from "path";
import * as asar from "asar";

import doSanityChecks from "./helpers/validate";
import buildPackage from "./helpers/package";


const dist = path.resolve(__dirname, "..", "dist");
const bundleFile = path.join(dist, "InAccord.asar");

const makeBundle = function () {
    console.log("");
    console.log("Generating bundle");
    const files = [
        // Keep this list explicit to avoid bundling launcher build artifacts/caches.
        "main.js",
        "package.json",
        "mainhook.js",
        "coreloader.js",
        "preload.js",
        "InAccord.js",
        "editor/preload.js",
        "editor/script.js",
        "editor/index.html"
    ];

    // Some asar implementations resolve file names relative to process.cwd() even when
    // a base dir is provided. Force cwd to dist during packaging.
    const cwd = process.cwd();
    try { process.chdir(dist); } catch {}

    asar.createPackageFromFiles(".", bundleFile, files)
        .then(() => {
            console.log(`    ✅ Successfully created bundle ${bundleFile}`);
        })
        .catch((err: any) => {
            console.log(`    ❌ Could not build bundle: ${err?.message || String(err)}`);
        })
        .finally(() => {
            try { process.chdir(cwd); } catch {}
        });
};

doSanityChecks(dist);
buildPackage(dist);
// cleanOldAsar();
makeBundle();