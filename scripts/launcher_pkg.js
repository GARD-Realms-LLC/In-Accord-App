// Small wrapper used for pkg builds. This reads the preload asset at build time
// so pkg will include it in the snapshot, and then sets an env var which
// `launcher.js` will use to extract the preload at runtime.
const fs = require('fs');
const path = require('path');

try {
  const preloadPath = path.join(__dirname, '..', 'dist', 'preload.js');
  const content = fs.readFileSync(preloadPath, 'utf8');
  process.env.INACCORD_EMBEDDED_PRELOAD = content;
} catch (e) {
  // ignore if not found at build time
}

// Now delegate to the main launcher logic
require('./launcher.js');
