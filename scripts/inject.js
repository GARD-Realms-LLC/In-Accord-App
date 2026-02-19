#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function usage() {
  console.log('Usage: node scripts/inject.js --apply|--restore --app <appDir>');
  process.exit(1);
}

const args = process.argv.slice(2);
let mode = null;
let appDir = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--apply') mode = 'apply';
  else if (a === '--restore') mode = 'restore';
  else if ((a === '--app' || a === '-a') && args[i+1]) appDir = args[++i];
}
if (!mode || !appDir) usage();

const coreDir = path.join(appDir, 'resources', 'discord_desktop_core');
const indexPath = path.join(coreDir, 'index.js');
const backupPath = path.join(coreDir, 'index.js.ia.bak');

if (!fs.existsSync(coreDir)) { console.error('discord_desktop_core not found at', coreDir); process.exit(1); }

if (mode === 'apply') {
  if (!fs.existsSync(indexPath)) { console.error('index.js not found:', indexPath); process.exit(1); }
  if (fs.existsSync(backupPath)) { console.error('Backup already exists at', backupPath, '\nAborting to avoid overwriting backup.'); process.exit(1); }
  const original = fs.readFileSync(indexPath, 'utf8');
  const distPath = path.resolve(__dirname, '..', 'dist', 'InAccord.js');
  const injectCode = `try{ require(${JSON.stringify(distPath)}); }catch(e){ console.error('InAccord inject failed', e); }\n`;
  fs.copyFileSync(indexPath, backupPath);
  fs.writeFileSync(indexPath, injectCode + original, 'utf8');
  console.log('Injected InAccord into', indexPath, '\nBackup saved to', backupPath);
  process.exit(0);
}

if (mode === 'restore') {
  if (!fs.existsSync(backupPath)) { console.error('Backup not found at', backupPath); process.exit(1); }
  fs.copyFileSync(backupPath, indexPath);
  fs.unlinkSync(backupPath);
  console.log('Restored original index.js from backup and removed backup.');
  process.exit(0);
}
