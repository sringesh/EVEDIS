# ==============================================================
# EVEDIS - Windows One-Line Zero-Setup Installer & Launcher
# https://github.com/sringesh/EVEDIS
# ==============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host " ███████╗██╗   ██╗███████╗██████╗ ██╗███████╗" -ForegroundColor Green
Write-Host " ██╔════╝██║   ██║██╔════╝██╔══██╗██║██╔════╝  WIRELESS EXTENDED DISPLAY" -ForegroundColor Green
Write-Host " █████╗  ██║   ██║█████╗  ██║  ██║██║███████╗  Windows Edition" -ForegroundColor Green
Write-Host " ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║  ██║██║╚════██║  Open Source • by Sringesh V." -ForegroundColor Green
Write-Host " ███████╗ ╚████╔╝ ███████╗██████╔╝██║███████║  https://github.com/sringesh/EVEDIS" -ForegroundColor Green
Write-Host " ╚══════╝  ╚═══╝  ╚══════╝╚═════╝ ╚═╝╚══════╝" -ForegroundColor Green
Write-Host ""
Write-Host "[*] Setting up EVEDIS on Windows..." -ForegroundColor Cyan

# 1. Check for Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Node.js is not installed." -ForegroundColor Yellow
    Write-Host "[*] Attempting to install Node.js via winget..." -ForegroundColor Cyan
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } else {
        Write-Host "[X] Please install Node.js (v18+) from https://nodejs.org and rerun this script." -ForegroundColor Red
        Exit 1
    }
}

# 2. Check for Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Git is not installed." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "[*] Installing Git via winget..." -ForegroundColor Cyan
        winget install Git.Git --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } else {
        Write-Host "[X] Please install Git from https://git-scm.com and rerun this script." -ForegroundColor Red
        Exit 1
    }
}

# 3. Clone or update repository into $HOME\evedis
$InstallDir = Join-Path $HOME "evedis"
if (Test-Path (Join-Path $InstallDir ".git")) {
    Write-Host "[*] Updating existing EVEDIS installation in $InstallDir..." -ForegroundColor Cyan
    Set-Location $InstallDir
    git pull --quiet
} else {
    Write-Host "[*] Cloning EVEDIS repository into $InstallDir..." -ForegroundColor Cyan
    git clone --quiet https://github.com/sringesh/EVEDIS.git $InstallDir
    Set-Location $InstallDir
}

# 4. Install dependencies
Write-Host "[*] Installing project dependencies..." -ForegroundColor Cyan
npm install --silent
Set-Location (Join-Path $InstallDir "server")
npm install --silent
Set-Location $InstallDir

# 5. Create Desktop Shortcut for easy 1-click launch
try {
    $WshShell = New-Object -ComObject WScript.Shell
    $DesktopPath = [Environment]::GetFolderPath("Desktop")
    $Shortcut = $WshShell.CreateShortcut((Join-Path $DesktopPath "EVEDIS.lnk"))
    $Shortcut.TargetPath = (Join-Path $InstallDir "start.bat")
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "Launch EVEDIS Wireless Extended Display"
    $Shortcut.Save()
    Write-Host "[+] Created desktop shortcut: EVEDIS" -ForegroundColor Green
} catch {}

Write-Host ""
Write-Host "[+] EVEDIS installed successfully!" -ForegroundColor Green
Write-Host "[*] Starting EVEDIS Host Server..." -ForegroundColor Cyan
Write-Host ""

Start-Process "http://localhost:4040/host"
node server\index.js
