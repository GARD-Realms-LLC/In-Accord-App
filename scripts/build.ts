import Bun from "bun";
import path from "node:path";
import fs from "node:fs";
import pkg from "../package.json";
import styleLoader from "bun-style-loader";
import * as esbuild from "esbuild";


const fileURL = Bun.fileURLToPath(import.meta.url);
const rootDir = path.join(path.dirname(fileURL), "..");
const isProduction = process.argv.includes("--minify");

// NOTE: Do not shell out to git during builds. If callers want this metadata,
// they can provide it via env vars.
const BRANCH_NAME = (Bun.env.BRANCH_NAME ?? "").trim();
const COMMIT_HASH = (Bun.env.COMMIT_HASH ?? "").trim();
const DEVELOPMENT = Bun.env.NODE_ENV ?? "development";
const MONACO_VERSION = pkg.dependencies?.["monaco-editor"] ?? pkg.devDependencies?.["monaco-editor"] ?? "0.52.2";

interface EntryPoint {
    in: string;
    out: string;
}

const moduleConfigs: Record<string, EntryPoint> = {
    InAccord: {"in": "src/InAccord/index.ts", "out": "InAccord"},
    main: {"in": "src/electron/main/index.ts", "out": "main"},
    preload: {"in": "src/electron/preload/index.ts", "out": "preload"},
    mainhook: {"in": "src/electron/mainhook/index.ts", "out": "mainhook"},
    coreloader: {"in": "src/electron/coreloader/index.ts", "out": "coreloader"},
    editorPreload: {"in": "src/editor/preload.ts", "out": "editor/preload"},
    editor: {"in": "src/editor/script.ts", "out": "editor/script"},
    editorHtml: {"in": "src/editor/index.html", "out": "editor/index"}
};

let modulesRequested = process.argv.filter(a => a.startsWith("--module=")).map(a => a.replace("--module=", ""));
if (!modulesRequested.length) modulesRequested = Object.keys(moduleConfigs);

const entryPoints = modulesRequested.map(m => moduleConfigs[m]);

function baseAliases() {
    return {
        react: path.join(rootDir, "src", "InAccord", "modules", "react.ts"),
        "@common": path.join(rootDir, "src", "common"),
        "@api": path.join(rootDir, "src", "InAccord", "api"),
        "@modules": path.join(rootDir, "src", "InAccord", "modules"),
        "@stores": path.join(rootDir, "src", "InAccord", "stores"),
        "@ui": path.join(rootDir, "src", "InAccord", "ui"),
        "@utils": path.join(rootDir, "src", "InAccord", "utils"),
        "@structs": path.join(rootDir, "src", "InAccord", "structs"),
        "@polyfill": path.join(rootDir, "src", "InAccord", "polyfill"),
        "@data": path.join(rootDir, "src", "InAccord", "data"),
        "@builtins": path.join(rootDir, "src", "InAccord", "builtins"),
        "@assets": path.join(rootDir, "assets"),
        "@styles": path.join(rootDir, "src", "InAccord", "styles"),
        "@webpack": path.join(rootDir, "src", "InAccord", "webpack", "index.ts"),
    };
}

function defineConsts() {
    return {
        "process.env.__VERSION__": JSON.stringify(pkg.version),
        "process.env.__MONACO_VERSION__": JSON.stringify(MONACO_VERSION),
        "process.env.__BRANCH__": JSON.stringify(BRANCH_NAME),
        "process.env.__COMMIT__": JSON.stringify(COMMIT_HASH),
        "process.env.__BUILD__": JSON.stringify(DEVELOPMENT)
    };
}

function buildOptionsNode(entryPoints: EntryPoint[]) {
    return {
        entryPoints,
        bundle: true,
        outdir: path.join(rootDir, "dist"),
        format: "cjs",
        platform: "node",
        jsx: "transform",
        alias: baseAliases(),
        external: ["fs", "original-fs", "path", "vm", "electron", "@electron/remote", "module", "request", "events", "child_process", "net", "http", "https", "crypto", "os", "url"],
        target: ["chrome128", "node20"],
        loader: {
            ".js": "jsx",
            ".css": "css",
            ".html": "copy",
            ".png": "dataurl"
        },
        plugins: [styleLoader() as unknown as esbuild.Plugin],
        logLevel: "info",
        treeShaking: true,
        charset: "utf8",
        minify: isProduction,
        legalComments: "none",
        define: defineConsts()
    } satisfies esbuild.BuildOptions;
}

function buildOptionsRenderer(entryPoints: EntryPoint[]) {
    return {
        entryPoints,
        bundle: true,
        outdir: path.join(rootDir, "dist"),
        format: "iife",
        platform: "browser",
        jsx: "transform",
        alias: baseAliases(),
        // No externals: the renderer bundle must run without Node require/shims.
        external: [],
        target: ["chrome128"],
        loader: {
            ".js": "jsx",
            ".css": "css",
            ".html": "copy",
            ".png": "dataurl"
        },
        plugins: [styleLoader() as unknown as esbuild.Plugin],
        logLevel: "info",
        treeShaking: true,
        charset: "utf8",
        minify: isProduction,
        legalComments: "none",
        define: defineConsts()
    } satisfies esbuild.BuildOptions;
}

async function runBuild() {
    const before = performance.now();
    const names = modulesRequested.join(", ");

    console.log("");
    console.log(`Building ${names}...`);

    if (process.argv.includes("--watch")) {
        // Watch mode: keep it simple and watch everything through the node build.
        const ctx = await esbuild.context(buildOptionsNode(entryPoints));
        await ctx.watch();
    }
    else {
        // Build renderer (InAccord) separately as a browser-safe IIFE with no externals.
        const rendererEntries = entryPoints.filter((e) => e.out === "InAccord");
        const nodeEntries = entryPoints.filter((e) => e.out !== "InAccord");

        if (rendererEntries.length) {
            await esbuild.build(buildOptionsRenderer(rendererEntries));
        }
        if (nodeEntries.length) {
            await esbuild.build(buildOptionsNode(nodeEntries));
        }
    }

    const after = performance.now();
    console.log(`Finished building ${names} in ${(after - before).toFixed(2)}ms`);

    // Keep the launcher payload copies in sync (the launcher installs these to %APPDATA%\...\InAccord).
    // This avoids a common failure mode where the UI/launcher runs stale preload/mainhook code.
    try {
        const payloadDir = path.join(rootDir, "scripts", "launcher-ui", "payload");
        try {
            fs.mkdirSync(payloadDir, {recursive: true});
        }
        catch {}

        const pairs: Array<[string, string]> = [
            [path.join(rootDir, "dist", "preload.js"), path.join(payloadDir, "preload.js")],
            [path.join(rootDir, "dist", "mainhook.js"), path.join(payloadDir, "mainhook.js")],
            [path.join(rootDir, "dist", "coreloader.js"), path.join(payloadDir, "coreloader.js")],
            [path.join(rootDir, "dist", "InAccord.js"), path.join(payloadDir, "InAccord.js")]
        ];

        for (const [src, dest] of pairs) {
            try {
                const s = Bun.file(src);
                if (await s.exists()) {
                    await Bun.write(dest, s);
                }
            }
            catch {}
        }

        console.log(`Synced launcher payload from dist -> ${payloadDir}`);
    }
    catch {}

    // Sync launcher UI assets (logo/splash) from the repo into the launcher source folder.
    // This keeps the packaged launcher consistent without requiring manual copying.
    try {
        const srcSplash = path.join(rootDir, "Images", "splash.png");
        const destDir = path.join(rootDir, "scripts", "launcher-ui", "assets");
        const destSplash = path.join(destDir, "splash.png");
        try {
            fs.mkdirSync(destDir, {recursive: true});
        }
        catch {}

        if (fs.existsSync(srcSplash)) {
            await Bun.write(destSplash, Bun.file(srcSplash));
            console.log(`Synced launcher asset splash.png -> ${destSplash}`);
        }
    }
    catch {}
    console.log("");
    console.log(`Type:    ${DEVELOPMENT}`);
    console.log(`Version: ${pkg.version}`);
    console.log(`Branch:  ${BRANCH_NAME}`);
    console.log(`Commit:  ${COMMIT_HASH}`);
    console.log("");
}

runBuild().catch(console.error);
