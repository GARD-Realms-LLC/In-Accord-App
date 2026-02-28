const fs = require('fs');
const path = require('path');

const seqPath = path.join(__dirname, 'build-seq.json');
const pkgPath = path.join(__dirname, 'package.json');

let seq = 48; // default so the first run will be 49 which satisfies > Build 48
try {
  if (fs.existsSync(seqPath)) {
    const data = fs.readFileSync(seqPath, 'utf8');
    const parsed = JSON.parse(data);
    if (typeof parsed.build === 'number') seq = parsed.build;
  }
} catch (e) {
  console.warn('Could not read build-seq.json, starting from 48');
}

seq = Number(seq) + 1;

try {
  fs.writeFileSync(seqPath, JSON.stringify({ build: seq }, null, 2), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = `0.0.${seq}`;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
  console.log(`Prebuild: updated build seq to ${seq} and package.json version to 0.0.${seq}`);
} catch (err) {
  console.error('Prebuild failed:', err);
  process.exit(1);
}
