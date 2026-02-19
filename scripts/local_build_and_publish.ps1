<#
Local build and publish script
Performs a repository build and stores artifacts under %USERPROFILE%\InAccord-Builds\<timestamp>
This is intended for fully-local automation when CI/GitHub Actions is not available.
#>
Param(
    [string]$BuildCommand = 'bun run build'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $RepoRoot
try {
    Write-Output "Running build: $BuildCommand"
    iex $BuildCommand
} catch {
    Write-Error "Build failed: $_"
    Pop-Location
    exit 1
}

$DistPath = Join-Path $RepoRoot 'dist'
if (-not (Test-Path $DistPath)) {
    Write-Error "dist folder not found after build: $DistPath"
    Pop-Location
    exit 2
}

$OutputRoot = Join-Path $env:USERPROFILE 'InAccord-Builds'
New-Item -Path $OutputRoot -ItemType Directory -Force | Out-Null

$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$DestFolder = Join-Path $OutputRoot $Timestamp
New-Item -Path $DestFolder -ItemType Directory | Out-Null

# Copy dist contents
Write-Output "Copying dist to $DestFolder"
Copy-Item -Path (Join-Path $DistPath '*') -Destination $DestFolder -Recurse -Force

# Optionally include the launcher scripts and wrappers
if (Test-Path (Join-Path $RepoRoot 'scripts')) {
    Copy-Item -Path (Join-Path $RepoRoot 'scripts') -Destination $DestFolder -Recurse -Force
}
if (Test-Path (Join-Path $RepoRoot 'launch-discord.cmd')) {
    Copy-Item -Path (Join-Path $RepoRoot 'launch-discord.cmd') -Destination $DestFolder -Force
}
if (Test-Path (Join-Path $RepoRoot 'launch-discord.ps1')) {
    Copy-Item -Path (Join-Path $RepoRoot 'launch-discord.ps1') -Destination $DestFolder -Force
}
if (Test-Path (Join-Path $RepoRoot 'launch-discord.sh')) {
    Copy-Item -Path (Join-Path $RepoRoot 'launch-discord.sh') -Destination $DestFolder -Force
}

# Create a ZIP archive for easy distribution
$ZipFile = Join-Path $OutputRoot ("InAccord-dist-$Timestamp.zip")
if (Test-Path $ZipFile) { Remove-Item $ZipFile -Force }
try {
    Compress-Archive -Path (Join-Path $DestFolder '*') -DestinationPath $ZipFile -Force
    Write-Output "Created archive: $ZipFile"
} catch {
    Write-Warning "Compress-Archive failed, leaving uncompressed folder: $_"
}

# Update Latest folder
$LatestFolder = Join-Path $OutputRoot 'latest'
if (Test-Path $LatestFolder) { Remove-Item $LatestFolder -Recurse -Force }
Copy-Item -Path $DestFolder -Destination $LatestFolder -Recurse -Force

Write-Output "Local build and publish complete. Artifacts in: $DestFolder"
Pop-Location
exit 0
