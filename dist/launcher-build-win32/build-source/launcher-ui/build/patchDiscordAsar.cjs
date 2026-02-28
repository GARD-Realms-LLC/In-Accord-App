/*
  Patch a Discord resources/app.asar so it loads InAccord's coreloader.js early.

  Usage:
    node patchDiscordAsar.cjs "C:\\...\\resources\\app.asar" stable
*/

const fs = require("fs");
const path = require("path");
const os = require("os");

const DEBUG_LOG = path.join(__dirname, "patchDiscordAsar_debug.log");
function dbg(line) {
  try {
    fs.appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${line}\n`);
  } catch {}
}

let asar;
try {
  asar = require("asar");
} catch (e) {
  dbg(`asar require failed: ${String(e)}`);
  console.log(JSON.stringify({ ok: false, error: "asar-module-missing", details: String(e) }));
  process.exit(2);
}

const asarPath = process.argv[2] || "";
const channel = String(process.argv[3] || "stable").toLowerCase();
const marker = "INACCORD_ASAR_PATCH_v1";

function safeString(x) {
  try {
    if (x === null || x === undefined) return "";
    return String(x);
  } catch {
    return "";
  }
}

function normalizeRel(p) {
  const s = safeString(p).trim();
  if (!s) return "";
  return s.replace(/^\.\//, "").replace(/^\//, "").replace(/\\/g, "/");
}

function buildPatchSnippet(defaultChannel) {
  // IMPORTANT: no '&&' in this string (the caller environment can be strict).
  // Keep it self-contained and tolerant.
  const c = safeString(defaultChannel || "stable").toLowerCase();
  return `\n// ${marker}\ntry {\n  const fs = require('fs');\n  const path = require('path');\n  let appData = process.env.APPDATA || '';\n  if (!appData) {\n    try {\n      const electron = require('electron');\n      try {\n        if (electron) {\n          const app = electron.app;\n          if (app) {\n            if (typeof app.getPath === 'function') {\n              appData = app.getPath('appData') || '';\n            }\n          }\n        }\n      } catch {}\n    } catch {}\n  }\n\n  const envChannel = String(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || '${c}').toLowerCase();\n  let bases;\n  if (envChannel === 'ptb') bases = ['discordptb'];\n  else if (envChannel === 'canary') bases = ['discordcanary'];\n  else if (envChannel === 'development' || envChannel === 'dev') bases = ['discorddevelopment'];\n  else bases = ['Discord','discord'];\n\n  for (const base of bases) {\n    const loader = appData ? path.join(appData, base, 'InAccord', 'coreloader.js') : '';\n    if (loader) {\n      try {\n        if (fs.existsSync(loader)) {\n          require(loader);\n          break;\n        }\n      } catch {}\n    }\n  }\n} catch {}\n`;
}

function tryPatchJs(jsText) {
  const original = safeString(jsText);
  if (original.includes(marker)) return { changed: false, text: original, reason: "already" };

  const patch = buildPatchSnippet(channel);
  const m = original.match(/(^\s*(['"])use strict\2;\s*\r?\n)/);
  if (m && m[1]) {
    const idx = m[1].length;
    return { changed: true, text: original.slice(0, idx) + patch + original.slice(idx), reason: "after-use-strict" };
  }

  return { changed: true, text: patch + original, reason: "prepend" };
}

function listBootstrapScripts(extractDir) {
  try {
    const dir = path.join(extractDir, "app_bootstrap");
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((n) => /\.(c?js|mjs)$/i.test(n))
      .sort((a, b) => a.localeCompare(b));
    return entries.map((name) => ({ rel: `app_bootstrap/${name}`, abs: path.join(dir, name) }));
  } catch {
    return [];
  }
}

function readJsonSafe(p) {
  try {
    if (!p || !fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function patchFileUtf8(absPath, relPath, out) {
  try {
    const orig = fs.readFileSync(absPath, "utf8");
    const p = tryPatchJs(orig);
    if (p.changed) {
      fs.writeFileSync(absPath, p.text, "utf8");
      out.patched.push({ file: relPath, mode: p.reason });
      out.anyChanged = true;
    } else {
      out.checked.push(relPath);
    }
  } catch (e) {
    out.errors.push({ file: relPath, error: safeString(e && (e.stack || e.message || e)) });
  }
}

async function main() {
  const out = {
    ok: false,
    channel,
    asarPath,
    backup: null,
    anyChanged: false,
    patched: [],
    checked: [],
    errors: []
  };

  try {
    dbg(`start asarPath=${asarPath} channel=${channel}`);
    if (!asarPath || !fs.existsSync(asarPath)) {
      out.ok = false;
      out.error = "asar-not-found";
      dbg(`asar-not-found`);
      console.log(JSON.stringify(out, null, 2));
      process.exit(1);
    }

    const asarDir = path.dirname(asarPath);
    const backup = path.join(asarDir, "app.asar.inaccord.bak");
    out.backup = backup;
    try {
      dbg(`backup path=${backup}`);
      if (!fs.existsSync(backup)) fs.copyFileSync(asarPath, backup);
    } catch (e) {
      out.ok = false;
      out.error = "backup-failed";
      out.details = safeString(e && (e.stack || e.message || e));
      dbg(`backup-failed ${out.details}`);
      console.log(JSON.stringify(out, null, 2));
      process.exit(1);
    }

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inaccord-asar-patch-"));
    const extractDir = path.join(tmpRoot, "app");
    const outAsar = path.join(tmpRoot, "app.asar");

    dbg(`tmpRoot=${tmpRoot}`);

    try {
      asar.extractAll(asarPath, extractDir);
      dbg(`extractAll ok`);
    } catch (e) {
      const msg = safeString(e && (e.stack || e.message || e));
      dbg(`extractAll failed ${msg}`);
      out.ok = false;
      out.error = "extractAll-failed";
      out.details = msg;
      try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
      console.log(JSON.stringify(out, null, 2));
      process.exit(1);
    }

    // Patch the package.json main entry (if any).
    try {
      const pkg = readJsonSafe(path.join(extractDir, "package.json"));
      const mainRel = normalizeRel(pkg && pkg.main);
      dbg(`packageMain=${mainRel}`);
      if (mainRel) {
        const abs = path.join(extractDir, ...mainRel.split("/"));
        if (fs.existsSync(abs)) {
          dbg(`patching main ${mainRel}`);
          patchFileUtf8(abs, mainRel, out);
        } else {
          out.errors.push({ file: mainRel, error: "main-entry-missing-on-disk" });
          dbg(`main missing on disk ${mainRel}`);
        }
      }
    } catch (e) {
      out.errors.push({ file: "package.json", error: safeString(e && (e.stack || e.message || e)) });
      dbg(`package.json read failed ${safeString(e && (e.stack || e.message || e))}`);
    }

    // Patch all app_bootstrap scripts.
    const boots = listBootstrapScripts(extractDir);
    dbg(`bootstrap scripts count=${boots.length}`);
    for (const f of boots) {
      patchFileUtf8(f.abs, f.rel, out);
    }

    dbg(`after patch pass anyChanged=${out.anyChanged} patchedCount=${out.patched.length} errorCount=${out.errors.length}`);

    if (!out.anyChanged) {
      out.ok = true;
      out.result = "already-patched-or-no-target";
      dbg(`no changes; already patched or no target`);
      try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
      console.log(JSON.stringify(out, null, 2));
      process.exit(0);
    }

    try {
      await new Promise((resolve, reject) => {
        // IMPORTANT: a pending Promise does not keep Node alive.
        // On some setups, asar.createPackage may not keep the event loop alive either.
        // Keep an interval handle until the callback fires.
        const keepAlive = setInterval(() => {}, 250);
        asar.createPackage(extractDir, outAsar, (err) => {
          try { clearInterval(keepAlive); } catch {}
          if (err) reject(err);
          else resolve();
        });
      });
      dbg(`createPackage ok`);
    }
    catch (err) {
      out.ok = false;
      out.error = "createPackage-failed";
      out.details = safeString(err && (err.stack || err.message || err));
      dbg(`createPackage-failed ${out.details}`);
      try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
      console.log(JSON.stringify(out, null, 2));
      process.exit(1);
    }

    try {
      fs.copyFileSync(outAsar, asarPath);
      dbg(`copy patched asar ok`);
    }
    catch (e) {
      out.ok = false;
      out.error = "write-asar-failed";
      out.details = safeString(e && (e.stack || e.message || e));
      dbg(`write-asar-failed ${out.details}`);
      try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
      console.log(JSON.stringify(out, null, 2));
      process.exit(1);
    }

    out.ok = true;
    out.result = "patched";
    dbg(`patched ok files=${out.patched.length}`);
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  } catch (e) {
    out.ok = false;
    out.error = safeString(e && (e.stack || e.message || e));
    dbg(`top-level exception ${out.error}`);
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }
}

main();
