@echo off
echo ========================================
echo    EcoPaste 开发环境停止脚本
echo ========================================
echo.

echo 正在停止所有EcoPaste相关进程...
echo.

echo [1/4] 停止Tauri开发进程...
taskkill /f /im "eco-paste.exe" 2>nul
taskkill /f /im "cargo.exe" 2>nul

echo [2/4] 停止Node.js进程 (端口3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do (
    taskkill /f /pid %%a 2>nul
)

echo [3/4] 停止Node.js进程 (端口1420)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":1420" ^| find "LISTENING"') do (
    taskkill /f /pid %%a 2>nul
)

echo [4/4] 停止其他相关进程...
taskkill /f /im "node.exe" /fi "WINDOWTITLE eq EcoPaste*" 2>nul
taskkill /f /im "cmd.exe" /fi "WINDOWTITLE eq EcoPaste*" 2>nul

echo.
echo ========================================
echo ✅ 所有EcoPaste开发服务已停止
echo ========================================
echo.
pause