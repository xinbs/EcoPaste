@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    EcoPaste Development Status Check
echo ========================================
echo.

set "backend_running=0"
set "frontend_running=0"
set "tauri_running=0"

echo Checking service status...
echo.

echo [Backend Service] Port 3001 status:
netstat -an | find ":3001" | find "LISTENING" >nul 2>&1
if errorlevel 1 goto backend_not_running
echo   Backend service is running (http://localhost:3001)
set "backend_running=1"
goto frontend_check
:backend_not_running
echo   Backend service is not running

:frontend_check
echo.
echo [Frontend Service] Port 1420 status:
netstat -an | find ":1420" | find "LISTENING" >nul 2>&1
if errorlevel 1 goto frontend_not_running
echo   Frontend service is running (http://localhost:1420)
set "frontend_running=1"
goto tauri_check
:frontend_not_running
echo   Frontend service is not running

:tauri_check
echo.
echo [Tauri Application] Process status:
tasklist | find /i "eco-paste.exe" >nul 2>&1
if errorlevel 1 goto tauri_not_running
echo   EcoPaste application is running
set "tauri_running=1"
goto cargo_check
:tauri_not_running
echo   EcoPaste application is not running

:cargo_check
tasklist | find /i "cargo.exe" >nul 2>&1
if errorlevel 1 goto no_cargo
echo   Cargo build process is running
goto overview
:no_cargo
echo   No Cargo build process

:overview
echo.
echo ========================================
echo Status Overview:
echo ----------------------------------------
if !backend_running! equ 1 (echo Backend service: Running) else (echo Backend service: Not running)
if !frontend_running! equ 1 (echo Frontend service: Running) else (echo Frontend service: Not running)
if !tauri_running! equ 1 (echo Tauri application: Running) else (echo Tauri application: Not running)
echo ----------------------------------------

set /a "total_services=!backend_running! + !frontend_running! + !tauri_running!"
if !total_services! equ 3 goto all_running
if !total_services! equ 0 goto none_running
echo Some services are not running (!total_services!/3)
echo Tip: Run restart-dev.bat to restart all services
goto links
:all_running
echo All services are running normally!
goto links
:none_running
echo All services are not running
echo Tip: Run start-dev.bat to start the development environment

:links
echo ========================================
echo.
echo Quick Links:
if !backend_running! equ 1 (
    echo   API Documentation: http://localhost:3001
    echo   Health Check: http://localhost:3001/health
    echo   WebSocket: ws://localhost:3001/ws
)
if !frontend_running! equ 1 (
    echo   Frontend Interface: http://localhost:1420
)
echo.
echo Available Scripts:
echo   start-dev.bat   - Start development environment
echo   stop-dev.bat    - Stop development environment
echo   restart-dev.bat - Restart development environment
echo   check-status.bat - Check service status
echo.
echo Press any key to exit...
pause >nul