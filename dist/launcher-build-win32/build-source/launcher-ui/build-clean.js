const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const pkgPath = path.resolve(__dirname, 'package.json');
const sourceRoot = path.join(root, 'build-source');

const keepRoot = new Set([
  'build-source',
  'win-unpacked',
  'In-Accord Launcher.exe',
  'In-Accord.Launcher.build-seq.txt',
  'In-Accord.Launcher.build.json',
  'In-Accord.Launcher.files.json',
  'In-Accord.Launcher.restorepoints.ndjson',
  'In-Accord.Launcher.version.txt'
]);

function runBuild() {
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npmBin, ['run', 'build'], {
    cwd: __dirname,
    stdio: 'inherit'
  });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
}

function rmForce(p) {
  try {
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
    else fs.unlinkSync(p);
  } catch {}
}

function cleanRoot() {
  if (!fs.existsSync(root)) return;
  for (const name of fs.readdirSync(root)) {
    if (!keepRoot.has(name)) rmForce(path.join(root, name));
  }
}

// Remove any duplicated image/assets folders inside the launcher-ui tree so we keep a
// single canonical Images folder at build-source/Images. This avoids accidental
// duplication between launcher-ui/Images and build-source/Images.
function removeLauncherUiDuplicates() {
  const dupImages = path.join(sourceRoot, 'launcher-ui', 'Images');
  const dupAssets = path.join(sourceRoot, 'launcher-ui', 'assets');
  rmForce(dupImages);
  rmForce(dupAssets);
}

function isUnderSourceRoot(absPath) {
  try {
    const rel = path.relative(sourceRoot, absPath);
    return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch {
    return false;
  }
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

function readSeq() {
  const seqPath = path.join(root, 'In-Accord.Launcher.build-seq.txt');
  try {
    if (!fs.existsSync(seqPath)) return 47;
    const n = parseInt(fs.readFileSync(seqPath, 'utf8').trim(), 10);
    return Number.isFinite(n) ? n : 47;
  } catch {
    return 47;
  }
}

function writeManifest() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = String(pkg.version || '0.0.50');
  const seq = readSeq();

  const generatedAt = new Date().toISOString();

  const buildJsonPath = path.join(root, 'In-Accord.Launcher.build.json');
  const versionPath = path.join(root, 'In-Accord.Launcher.version.txt');

  fs.writeFileSync(versionPath, `${version}\n`, 'utf8');
  fs.writeFileSync(buildJsonPath, `${JSON.stringify({ seq, version, generatedAt }, null, 2)}\n`, 'utf8');

  const files = walk(root)
    .filter((p) => !isUnderSourceRoot(p))
    .filter((p) => path.relative(root, p).replace(/\\/g, '/') !== 'In-Accord.Launcher.files.json')
    .map((p) => {
      const st = fs.statSync(p);
      return {
        path: path.relative(root, p).replace(/\\/g, '/'),
        size: st.size,
        mtimeIso: new Date(st.mtimeMs).toISOString(),
        sha256: sha256(p)
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const manifest = {
    generatedAt,
    seq,
    version,
    root,
    fileCount: files.length,
    files
  };

  fs.writeFileSync(path.join(root, 'In-Accord.Launcher.files.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

if (!process.argv.includes('--skip-build')) runBuild();
cleanRoot();
removeLauncherUiDuplicates();
writeManifest();

console.log('Launcher build folder cleaned and manifest regenerated.');
