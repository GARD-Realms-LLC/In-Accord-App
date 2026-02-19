const fs = require('fs');
const p = 'e:/InAccord-Apps/dist/launcher-build/win-unpacked/resources/app.asar';
if (!fs.existsSync(p)) { console.error('missing app.asar'); process.exit(2); }
const b = fs.readFileSync(p);
const find = (x) => { const i = b.indexOf(Buffer.from(x)); console.log(x + ' -> ' + i); };
find('launcher.js');
find('launcher-ui/launcher.js');
find('scripts/launcher.js');
