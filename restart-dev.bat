@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    EcoPaste Development Restart Script
echo ========================================
echo.

echo [Info] Restarting EcoPaste development environment...
echo.

echo [Step 1/2] Stopping existing services...
echo ----------------------------------------
call "%~dp0stop-dev.bat"

echo.
echo [Step 2/2] Starting development services...
echo ----------------------------------------
call "%~dp0start-dev.bat"

echo.
echo ========================================
echo [Success] EcoPaste development environment restarted!
echo ========================================
echo.
echo Press any key to exit...
pause >nul