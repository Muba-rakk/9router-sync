# 9Router-Sync Windows Uninstaller

$ErrorActionPreference = "SilentlyContinue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 9Router-Sync: Windows Uninstaller        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$StartupDir = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$VbsPath = Join-Path $StartupDir "9Router_ModelSync.vbs"
$LockFile = Join-Path $env:USERPROFILE ".9router-sync\watcher.lock"
$OpenCodePlugin = Join-Path $env:USERPROFILE ".config\opencode\plugins\9router-sync.js"

# 1. Remove Startup VBS
if (Test-Path $VbsPath) {
    Remove-Item -Path $VbsPath -Force
    Write-Host "[1/3] Removed Windows Startup launcher: $VbsPath" -ForegroundColor Green
} else {
    Write-Host "[1/3] No Startup launcher found." -ForegroundColor Gray
}

# 2. Stop running process
if (Test-Path $LockFile) {
    $pidToKill = (Get-Content $LockFile).Trim()
    if ($pidToKill) {
        Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
        Write-Host "[2/3] Stopped running watcher process (PID $pidToKill)." -ForegroundColor Green
    }
    Remove-Item -Path $LockFile -Force
} else {
    Write-Host "[2/3] No active watcher lockfile found." -ForegroundColor Gray
}

# 3. Optional: Remove OpenCode Plugin
if (Test-Path $OpenCodePlugin) {
    Remove-Item -Path $OpenCodePlugin -Force
    Write-Host "[3/3] Removed OpenCode plugin: $OpenCodePlugin" -ForegroundColor Green
} else {
    Write-Host "[3/3] OpenCode plugin not found." -ForegroundColor Gray
}

Write-Host "`nUninstallation complete.`n" -ForegroundColor Green
