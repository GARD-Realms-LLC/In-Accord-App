@echo off
setlocal
cd /d "%~dp0launcher-ui"
npx electron-builder --win portable
if errorlevel 1 exit /b %errorlevel%
node build-clean.js --skip-build
exit /b %errorlevel%
