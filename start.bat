@echo off
title EVEDIS Host Controller
echo ==========================================================
echo       EVEDIS // WIRELESS EXTENDED DISPLAY SYSTEM
echo         Created by Sringesh V. (reachsringesh@gmail.com)
echo ==========================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please download and install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js is detected!

if not exist node_modules (
    echo [INFO] Installing EVEDIS dependencies...
    call npm install
    cd server
    call npm install
    cd ..
)

echo [INFO] Opening EVEDIS Host Controller in your browser...
start "" http://localhost:4040/host

echo [INFO] Starting server on http://localhost:4040...
echo Press Ctrl+C to stop the server at any time.
echo.
node server/index.js
pause
