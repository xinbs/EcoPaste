@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    EcoPaste Development Startup Script
echo ========================================
echo.

REM Check if in correct directory
if exist "package.json" goto check_node
echo [Error] Please run this script in the EcoPaste project root directory
echo.
pause
exit /b 1

:check_node
REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 goto no_node
for /f "tokens=*" %%i in ('node --version') do echo [Info] Node.js version: %%i
goto check_pnpm
:no_node
echo [Error] Node.js not found, please install Node.js first
echo Download: https://nodejs.org/
echo.
pause
exit /b 1

:check_pnpm
REM Check if pnpm is installed
echo [Debug] Checking pnpm via WHERE...
where pnpm >nul 2>&1
if errorlevel 1 goto no_pnpm
echo [Debug] Getting pnpm version via cmd /c...
for /f "tokens=*" %%i in ('cmd /c pnpm --version') do echo [Info] pnpm version: %%i
echo [Debug] pnpm check passed, going to check_frontend_deps
goto check_frontend_deps
:no_pnpm
echo [Error] pnpm not found, please install pnpm
echo Install command: npm install -g pnpm
echo.
pause
exit /b 1

:check_frontend_deps
echo.
REM Check and install frontend dependencies
if exist "node_modules" goto check_backend_deps
echo [Dependencies] Installing frontend dependencies...
pnpm install
if errorlevel 1 goto frontend_install_fail
echo [Success] Frontend dependencies installed
echo.
goto check_backend_deps
:frontend_install_fail
echo [Error] Frontend dependencies installation failed
pause
exit /b 1

:check_backend_deps
REM Check and install backend dependencies
if exist "server\node_modules" goto check_ports
echo [Dependencies] Installing backend dependencies...
cd /d server
npm install
if errorlevel 1 goto backend_install_fail
cd ..
echo [Success] Backend dependencies installed
echo.
goto check_ports
:backend_install_fail
echo [Error] Backend dependencies installation failed
cd ..
pause
exit /b 1

:check_ports
REM Check if ports are occupied
netstat -an | find ":3001" | find "LISTENING" >nul
if not errorlevel 1 echo [Warning] Port 3001 is occupied, may affect backend startup
netstat -an | find ":1420" | find "LISTENING" >nul
if not errorlevel 1 echo [Warning] Port 1420 is occupied, may affect frontend startup
echo.

echo [1/2] Starting backend sync server...
start "EcoPaste Backend" cmd /k "cd /d "%~dp0server" && echo [Backend] Starting... && npm start"

echo [2/2] Waiting 3 seconds before starting frontend Tauri app...
timeout /t 3 /nobreak >nul

echo Starting frontend Tauri development server...
start "EcoPaste Frontend" cmd /k "cd /d "%~dp0" && echo [Frontend] Starting... && pnpm tauri dev"

echo.
echo ========================================
echo [Success] All services started!
echo.
echo Backend service: http://localhost:3001
echo Frontend service: http://localhost:1420
echo WebSocket: ws://localhost:3001/ws
echo Health check: http://localhost:3001/health
echo API Documentation: http://localhost:3001
echo.
echo Tip: EcoPaste is a system tray application, check the tray icon
echo Stop services: Run stop-dev.bat or close corresponding windows
echo ========================================
echo.
echo Press any key to exit...
pause >nul