@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    EcoPaste 开发服务停止脚本 (Windows)
echo ========================================
echo.

echo [信息] 正在停止 EcoPaste 开发服务...
echo.
echo [信息] 停止顺序：
echo   1. 停止 Node.js 后端服务器
echo   2. 停止 Tauri 桌面应用
echo   3. 停止 Vite 开发服务器
echo   4. 停止 Cargo 构建进程
echo   5. 清理端口占用进程
echo.

REM 停止 Node.js 进程（后端服务器）
echo [1/3] 停止 Node.js 后端服务器...
taskkill /f /im node.exe >nul 2>&1
if errorlevel 1 (
    echo [信息] 没有找到运行中的 Node.js 进程
) else (
    echo [成功] Node.js 进程已停止
)

REM 停止 Tauri 开发进程和相关进程
echo [2/4] 停止 Tauri 开发进程...
tasklist | findstr /i "EcoPaste" >nul
if errorlevel 1 (
    echo [信息] 没有找到运行中的 EcoPaste 进程
) else (
    taskkill /f /im EcoPaste.exe >nul 2>&1
    echo [成功] EcoPaste 进程已停止
)

REM 停止 Vite 开发服务器
echo [3/4] 停止 Vite 开发服务器...
taskkill /f /fi "WINDOWTITLE eq vite" >nul 2>&1
if errorlevel 1 (
    echo [信息] 没有找到运行中的 Vite 进程
) else (
    echo [成功] Vite 进程已停止
)

REM 停止 Cargo 进程
echo [4/4] 停止 Cargo 构建进程...
taskkill /f /im cargo.exe >nul 2>&1
if errorlevel 1 (
    echo [信息] 没有找到运行中的 Cargo 进程
) else (
    echo [成功] Cargo 进程已停止
)

REM 检查并停止占用端口的进程
echo.
echo [检查] 检查端口占用情况...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001"') do (
    if "%%a" NEQ "" (
        echo [信息] 停止占用端口3001的进程 PID: %%a
        taskkill /f /pid %%a >nul 2>&1
    )
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":1420"') do (
    if "%%a" NEQ "" (
        echo [信息] 停止占用端口1420的进程 PID: %%a
        taskkill /f /pid %%a >nul 2>&1
    )
)

echo.
echo ========================================
echo [完成] 所有 EcoPaste 开发服务已停止
echo ========================================
echo.
echo 按任意键退出...
pause >nul