@echo off
REM Windows batch wrapper to launch Discord via InAccord launcher
setlocal
set SCRIPT_DIR=%~dp0
set LAUNCHER=%SCRIPT_DIR%scripts\launcher.js
if exist "%LAUNCHER%" (
    node "%LAUNCHER%" %*
) else (
    echo Launcher not found: "%LAUNCHER%"
    pause
)
endlocal
