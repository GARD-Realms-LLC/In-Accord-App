@echo off
setlocal

REM Starts the InAccord Launcher with safe Chromium flags to avoid immediate sandbox crashes.
REM (These flags must be present at process start; setting them inside app code is too late.)

set "NODE_OPTIONS="
set "ELECTRON_RUN_AS_NODE="

set "LAUNCHER_DIR=%~dp0launcher-build-win32\win-unpacked"
if not exist "%LAUNCHER_DIR%\InAccord Launcher.exe" (
  echo ERROR: Launcher EXE not found:
  echo   %LAUNCHER_DIR%\InAccord Launcher.exe
  exit /b 1
)

pushd "%LAUNCHER_DIR%" >nul
start "InAccord Launcher" "InAccord Launcher.exe" --no-sandbox --disable-gpu --disable-software-rasterizer
popd >nul

endlocal
