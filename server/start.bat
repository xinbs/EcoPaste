@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    EcoPaste 同步服务器启动脚本
echo ========================================
echo.

:: 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [信息] Node.js 版本: 
node --version
echo.

:: 检查是否存在 package.json
if not exist "package.json" (
    echo [错误] 未找到 package.json 文件
    echo 请确保在正确的目录下运行此脚本
    pause
    exit /b 1
)

:: 检查依赖是否已安装
if not exist "node_modules" (
    echo [信息] 首次运行，正在安装依赖...
    npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo [成功] 依赖安装完成
    echo.
)

:: 检查环境配置文件
if not exist ".env" (
    if exist ".env.example" (
        echo [信息] 创建环境配置文件...
        copy ".env.example" ".env" >nul
        echo [警告] 请编辑 .env 文件配置您的服务器设置
        echo [警告] 特别是 JWT_SECRET 和 ALLOWED_ORIGINS
        echo.
    ) else (
        echo [错误] 未找到 .env.example 文件
        pause
        exit /b 1
    )
)

:: 创建必要目录
if not exist "data" mkdir data
if not exist "logs" mkdir logs

:: 检查端口占用
set PORT=3001
for /f "tokens=*" %%i in ('findstr "^PORT=" .env 2^>nul') do (
    for /f "tokens=2 delims==" %%j in ("%%i") do set PORT=%%j
)

netstat -an | findstr ":!PORT! " >nul 2>&1
if not errorlevel 1 (
    echo [警告] 端口 !PORT! 已被占用
    set /p continue="是否继续启动？(y/N): "
    if /i not "!continue!"=="y" (
        echo 已取消启动
        pause
        exit /b 0
    )
)

echo [信息] 正在启动 EcoPaste 同步服务器...
echo [信息] 服务地址: http://localhost:!PORT!
echo [信息] 健康检查: http://localhost:!PORT!/health
echo [信息] 按 Ctrl+C 停止服务
echo.
echo ========================================
echo.

:: 启动服务器
node src/index.js

echo.
echo [信息] 服务器已停止
pause