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

if not exist node_modules (
    echo [INFO] Installing EVEDIS dependencies...
    call npm install
    cd server
    call npm install
    cd ..
)

echo [INFO] Starting EVEDIS with Terminal LCD Dashboard...
node server\index.js %*
pause
