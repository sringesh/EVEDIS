# EVEDIS - Windows PowerShell Quick Installer & Runner
# https://github.com/sringesh/EVEDIS

Write-Host "`n⚡ EVEDIS - Setting up on Windows...`n" -ForegroundColor Green

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Node.js (v18+) is required. Please install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Git is required. Please install from https://git-scm.com" -ForegroundColor Red
    exit 1
}

$InstallDir = "$HOME\evedis"
if (Test-Path "$InstallDir\.git") {
    Write-Host "🔄 Updating existing EVEDIS in $InstallDir..." -ForegroundColor Cyan
    Set-Location $InstallDir
    git pull
} else {
    Write-Host "📥 Cloning EVEDIS into $InstallDir..." -ForegroundColor Cyan
    git clone https://github.com/sringesh/EVEDIS.git $InstallDir
    Set-Location $InstallDir
}

Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
npm install
Set-Location "$InstallDir\server"
npm install
Set-Location $InstallDir

Write-Host "`n✔ EVEDIS is installed and ready!" -ForegroundColor Green
Write-Host "🚀 Launching EVEDIS Host Server...`n" -ForegroundColor Cyan

npm run start:open
