<#
Background daemon that runs local_build_and_publish.ps1 daily at 02:00.
This script is intended to be launched at user login (Startup folder). It will run once immediately
and then sleep until the next 02:00 each day. To stop the daemon, create a file at
%USERPROFILE%\InAccord-Builds\daemon.stop and the script will exit cleanly on next check.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BuildScript = Join-Path $RepoRoot 'local_build_and_publish.ps1'
if (-not (Test-Path $BuildScript)) {
    Write-Error "Build script not found: $BuildScript"
    exit 2
}

function Run-Build {
    try {
        Write-Output "[Daemon] Running local build: $BuildScript"
        & powershell -NoProfile -ExecutionPolicy Bypass -File `"$BuildScript`"
    } catch {
        Write-Warning "[Daemon] Build failed: $_"
    }
}

function Get-Seconds-Until-Next-Run {
    param([int]$Hour = 2, [int]$Minute = 0)
    $now = Get-Date
    $target = Get-Date -Hour $Hour -Minute $Minute -Second 0
    if ($target -le $now) { $target = $target.AddDays(1) }
    return ([int]($target - $now).TotalSeconds)
}

$StopFile = Join-Path $env:USERPROFILE 'InAccord-Builds\daemon.stop'

# Initial run
Run-Build

while ($true) {
    if (Test-Path $StopFile) {
        Write-Output "[Daemon] Stop file found; exiting daemon."
        exit 0
    }

    $secs = Get-Seconds-Until-Next-Run -Hour 2 -Minute 0
    Write-Output "[Daemon] Sleeping for $secs seconds until next run (02:00)."
    Start-Sleep -Seconds $secs

    if (Test-Path $StopFile) {
        Write-Output "[Daemon] Stop file found before run; exiting daemon."
        exit 0
    }

    Run-Build
}
