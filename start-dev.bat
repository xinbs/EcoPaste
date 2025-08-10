@echo off
chcp 65001 >nul
echo ========================================
echo    EcoPaste Development Environment Startup
echo ========================================
echo.

echo [1/2] Starting backend sync server...
start "EcoPaste Backend" cmd /k "cd /d server && npm start"

echo [2/2] Waiting 3 seconds before starting frontend Tauri app...
timeout /t 3 /nobreak >nul

echo Starting frontend Tauri development server...
start "EcoPaste Frontend" cmd /k "pnpm tauri dev"

echo.
echo ========================================
echo All services started successfully!
echo.
echo Backend service: http://localhost:3001
echo Frontend service: http://localhost:1420
echo WebSocket: ws://localhost:3001/ws
echo.
echo Note: EcoPaste is a system tray app, check tray icon
echo ========================================
echo.
pause