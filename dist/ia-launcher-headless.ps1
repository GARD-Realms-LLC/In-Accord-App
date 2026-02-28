Write-Host "Building InAccord assets..."
$build = Start-Process -FilePath bun -ArgumentList 'run','build' -NoNewWindow -Wait -PassThru
if ($build.ExitCode -ne 0) {
  Write-Host "Build failed (exit code $($build.ExitCode)). Run 'bun run build' manually to inspect." -ForegroundColor Red
  Exit $build.ExitCode
}

Write-Host "Running headless launcher (auto-patch Stable)..."
node scripts/launcher.js --patch-stable

Write-Host "Launcher finished."
Pause
