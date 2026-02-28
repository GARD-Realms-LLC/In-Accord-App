# PowerShell wrapper to launch Discord via the InAccord launcher.
# Usage: Right-click -> Run with PowerShell or run from a PowerShell prompt.

$ScriptDir = Split-Path -Parent $PSCommandPath
$launcher = Join-Path $ScriptDir 'scripts\\launcher.js'

if (Test-Path $launcher) {
    & node $launcher @args
}
else {
    Write-Error "Launcher not found: $launcher"
    exit 1
}
