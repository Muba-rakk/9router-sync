# 9Router-Sync Windows Uninstaller

$ErrorActionPreference = "SilentlyContinue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 9Router-Sync: Windows Uninstaller        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$AppData = if ($env:APPDATA) { $env:APPDATA } else { [System.Environment]::GetFolderPath('ApplicationData') }
$StartupDir = [System.IO.Path]::Combine($AppData, "Microsoft\Windows\Start Menu\Programs\Startup")
$VbsPath = Join-Path $StartupDir "9Router_ModelSync.vbs"
$UserHome = if ($env:USERPROFILE) { $env:USERPROFILE } else { [System.Environment]::GetFolderPath('UserProfile') }
$LockDir = Join-Path $UserHome ".9router-sync"
$LockFile = Join-Path $LockDir "watcher.lock"
$OpenCodePlugin = Join-Path $UserHome ".config\opencode\plugins\9router-sync.js"

# 1. Remove Startup VBS
if (Test-Path $VbsPath) {
    Remove-Item -Path $VbsPath -Force
    Write-Host "[1/3] Removed Windows Startup launcher: $VbsPath" -ForegroundColor Green
} else {
    Write-Host "[1/3] No Startup launcher found." -ForegroundColor Gray
}

# 2. Stop running process
$stoppedAny = $false
if (Test-Path $LockFile) {
    $pidToKill = (Get-Content $LockFile).Trim()
    if ($pidToKill -match '^\d+$') {
        $proc = Get-Process -Id $pidToKill -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            Write-Host "[2/3] Stopped running watcher process (PID $pidToKill)." -ForegroundColor Green
            $stoppedAny = $true
        }
    }
    Remove-Item -Path $LockFile -Force
}

# Sweep any remaining 9router-sync node processes
Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%9router-sync.js%'" -ErrorAction SilentlyContinue | Where-Object { $_.ProcessId -ne $PID } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "      Terminated background watcher (PID $($_.ProcessId))." -ForegroundColor Green
    $stoppedAny = $true
}

if (-not $stoppedAny) {
    Write-Host "[2/3] No active watcher process found." -ForegroundColor Gray
}

if (Test-Path $LockDir) {
    $remainingItems = Get-ChildItem -Path $LockDir -Force -ErrorAction SilentlyContinue
    if (-not $remainingItems) {
        Remove-Item -Path $LockDir -Force -Recurse -ErrorAction SilentlyContinue
    }
}

# 3. Optional: Remove OpenCode Plugin
if (Test-Path $OpenCodePlugin) {
    Remove-Item -Path $OpenCodePlugin -Force
    Write-Host "[3/3] Removed OpenCode plugin: $OpenCodePlugin" -ForegroundColor Green
} else {
    Write-Host "[3/3] OpenCode plugin not found." -ForegroundColor Gray
}

Write-Host "`nUninstallation complete.`n" -ForegroundColor Green
