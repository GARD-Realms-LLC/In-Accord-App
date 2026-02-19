<#
Create a Startup shortcut so the daemon_local_builder.ps1 runs at user login.
This does not require Task Scheduler or admin rights. It creates a .lnk in the current user's
Startup folder that launches PowerShell with the daemon script hidden.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$DaemonScript = Join-Path $RepoRoot 'daemon_local_builder.ps1'
if (-not (Test-Path $DaemonScript)) {
    Write-Error "Daemon script not found: $DaemonScript"
    exit 1
}

$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = [Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupFolder 'InAccord Local Builder.lnk'

$PowerShellExe = (Get-Command powershell).Source
$Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$DaemonScript`""

Write-Output "Creating startup shortcut: $ShortcutPath"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $PowerShellExe
$Shortcut.Arguments = $Arguments
$Shortcut.WorkingDirectory = $RepoRoot
$Shortcut.WindowStyle = 7 # Minimized
$Shortcut.IconLocation = "$PowerShellExe,0"
$Shortcut.Save()

Write-Output "Startup shortcut created. The daemon will run at next user login."
exit 0
