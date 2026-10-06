# 9Router-Sync Windows Installer
# Sets up silent autostart and OpenCode plugin

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 9Router-Sync: Windows Setup & Autostart " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$RepoDir = Split-Path -Parent $PSScriptRoot
$StartupDir = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$VbsPath = Join-Path $StartupDir "9Router_ModelSync.vbs"
$WatcherScript = Join-Path $RepoDir "bin\9router-sync.js"

# 1. Install npm dependencies
Write-Host "`n[1/4] Checking and installing npm dependencies..." -ForegroundColor Yellow
Push-Location $RepoDir
try {
    npm install --omit=dev
} catch {
    Write-Host "Warning: npm install returned an error. Ensure node/npm is available." -ForegroundColor Red
}
Pop-Location

# 2. Setup OpenCode Plugin if OpenCode is detected
$OpenCodeConfig = Join-Path $env:USERPROFILE ".config\opencode\opencode.json"
$OpenCodePluginsDir = Join-Path $env:USERPROFILE ".config\opencode\plugins"
if (Test-Path $OpenCodeConfig -or (Test-Path (Split-Path $OpenCodeConfig))) {
    Write-Host "[2/4] OpenCode detected. Setting up JIT plugin..." -ForegroundColor Yellow
    if (-not (Test-Path $OpenCodePluginsDir)) {
        New-Item -ItemType Directory -Path $OpenCodePluginsDir -Force | Out-Null
    }
    $PluginSrc = Join-Path $RepoDir "plugins\opencode-plugin.js"
    $PluginDest = Join-Path $OpenCodePluginsDir "9router-sync.js"
    Copy-Item -Path $PluginSrc -Destination $PluginDest -Force
    Write-Host "      Installed plugin to: $PluginDest" -ForegroundColor Green
} else {
    Write-Host "[2/4] OpenCode not detected. Skipping OpenCode plugin setup." -ForegroundColor Gray
}

# 3. Create Silent VBS Autostart Launcher
Write-Host "[3/4] Creating Windows Startup autostart launcher..." -ForegroundColor Yellow
$VbsContent = @"
' 9Router-Sync Silent Autostart Runner
Option Explicit
Dim fso, sh, nodeExe, scriptPath
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

scriptPath = "$WatcherScript"
nodeExe = "node.exe"

If fso.FileExists(scriptPath) Then
    ' Run completely hidden (WindowStyle = 0), non-blocking
    sh.Run "cmd.exe /c " & Chr(34) & nodeExe & " " & Chr(34) & scriptPath & Chr(34) & " --watch" & Chr(34), 0, False
End If
"@

Set-Content -Path $VbsPath -Value $VbsContent -Encoding ASCII
Write-Host "      Created autostart script: $VbsPath" -ForegroundColor Green

# 4. Trigger initial sync and launch watcher
Write-Host "[4/4] Starting 9Router-Sync watcher daemon..." -ForegroundColor Yellow
Start-Process "wscript.exe" -ArgumentList "`"$VbsPath`""

Write-Host "`nSetup complete! 9Router-Sync is now running silently in the background." -ForegroundColor Green
Write-Host "It will automatically launch upon Windows login and sync models whenever 9Router changes.`n" -ForegroundColor Green
