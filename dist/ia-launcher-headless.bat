@echo off
REM Headless InAccord launcher for Windows — fully automatic
REM Double-click this file to auto-build assets and launch Discord with InAccord

echo Building InAccord assets...
call bun run build
if %errorlevel% neq 0 (
  echo Build failed. Please run "bun run build" manually to see errors.
  pause
  exit /b %errorlevel%
)

echo Running headless launcher (auto-patch Stable)...
node scripts/launcher.js --patch-stable

echo Launcher finished.
pause
