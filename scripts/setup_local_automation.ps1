<#
Setup script for local scheduled automation
Creates a Windows Scheduled Task that runs the local build/publish script daily at 02:00.

Run this once interactively to register the scheduled task. It requires that you allow running PowerShell scripts.
If you prefer not to register a scheduled task, you can run `local_build_and_publish.ps1` manually or via another scheduler.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ScriptPath = Join-Path $RepoRoot 'local_build_and_publish.ps1'
if (-not (Test-Path $ScriptPath)) {
    Write-Error "local_build_and_publish.ps1 not found at $ScriptPath"
    exit 1
}

$Action = "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
$TaskName = 'InAccord Local Build'

Write-Output "Registering scheduled task '$TaskName' to run daily at 02:00 under current user"

try {
    # Delete existing task if present
    schtasks.exe /Delete /TN "$TaskName" /F | Out-Null
} catch {}

$createCmd = "schtasks.exe /Create /SC DAILY /TN \"$TaskName\" /TR \"$Action\" /ST 02:00 /F"
Write-Output "Creating task with command: $createCmd"
Invoke-Expression $createCmd

Write-Output "Scheduled task registered. To verify: schtasks /Query /TN \"$TaskName\" /V /FO LIST"

exit 0
