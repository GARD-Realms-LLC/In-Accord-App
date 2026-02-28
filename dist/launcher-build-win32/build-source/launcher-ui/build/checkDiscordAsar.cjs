/*
  Check whether a Discord app.asar has the InAccord marker.

  Usage:
    node checkDiscordAsar.cjs "C:\\...\\resources\\app.asar"
*/

const fs = require("fs");
const path = require("path");

let asar;
try {
  asar = require("asar");
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: "asar-module-missing", details: String(e) }));
  process.exit(2);
}

const asarPath = process.argv[2] || "";
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

function readFileText(rel) {
  try {
    const buf = asar.extractFile(asarPath, rel);
    if (Buffer.isBuffer(buf)) return buf.toString("utf8");
    return safeString(buf);
  } catch {
    return "";
  }
}

function main() {
  const out = {
    ok: false,
    asarPath,
    marker,
    packageMain: null,
    mainHasMarker: false,
    foundIn: []
  };

  if (!asarPath || !fs.existsSync(asarPath)) {
    out.ok = false;
    out.error = "asar-not-found";
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  let pkg = null;
  try {
    const txt = readFileText("package.json");
    pkg = txt ? JSON.parse(txt) : null;
  } catch {
    pkg = null;
  }

  const mainRel = normalizeRel(pkg && pkg.main);
  out.packageMain = mainRel || null;

  if (mainRel) {
    const t = readFileText(mainRel);
    out.mainHasMarker = t.indexOf(marker) >= 0;
    if (out.mainHasMarker) out.foundIn.push(mainRel);
  }

  // Known bootstrap candidates.
  const candidates = [
    "app_bootstrap/index.js",
    "app_bootstrap/bootstrap.js",
    "app_bootstrap/app.js",
    "app_bootstrap/main.js",
    "app_bootstrap/launcher.js",
    "app_bootstrap/index.cjs",
    "app_bootstrap/bootstrap.cjs",
    "app_bootstrap/app.cjs",
    "app_bootstrap/main.cjs",
    "app_bootstrap/launcher.cjs",
    "app_bootstrap/index.mjs",
    "app_bootstrap/bootstrap.mjs",
    "app_bootstrap/app.mjs",
    "app_bootstrap/main.mjs",
    "app_bootstrap/launcher.mjs"
  ];

  for (const rel of candidates) {
    const t = readFileText(rel);
    if (t && t.indexOf(marker) >= 0) out.foundIn.push(rel);
  }

  out.ok = true;
  out.patched = out.foundIn.length > 0;
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

main();
