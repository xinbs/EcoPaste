@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    EcoPaste 开发环境重启脚本 (Windows)
echo ========================================
echo.

echo [信息] 正在重启 EcoPaste 开发环境...
echo.

echo [步骤1/2] 停止现有服务...
echo ----------------------------------------
if exist "%~dp0stop-dev.bat" (
    call "%~dp0stop-dev.bat"
) else (
    echo [警告] 未找到 stop-dev.bat，手动停止服务...
    taskkill /f /im node.exe >nul 2>&1
    taskkill /f /im EcoPaste.exe >nul 2>&1
    taskkill /f /im cargo.exe >nul 2>&1
    echo [完成] 服务停止完成
)

echo.
echo [步骤2/2] 启动开发服务...
echo ----------------------------------------
if exist "%~dp0start-dev.bat" (
    call "%~dp0start-dev.bat"
) else (
    echo [错误] 未找到 start-dev.bat 脚本
    echo 请确保在项目根目录下运行此脚本
    pause
    exit /b 1
)

echo.
echo ========================================
echo [成功] EcoPaste 开发环境重启完成！
echo ========================================
echo.
echo 按任意键退出...
pause >nul