@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    EcoPaste 开发环境检查脚本 (Windows)
echo ========================================
echo.

set ERROR_COUNT=0
set WARNING_COUNT=0

echo [检查] 正在检查开发环境依赖...
echo.

REM 检查是否在正确的目录
echo [1/8] 检查项目目录...
if exist "package.json" (
    echo [✓] 项目根目录正确
) else (
    echo [✗] 错误: 请在 EcoPaste 项目根目录下运行此脚本
    set /a ERROR_COUNT+=1
)

REM 检查 Node.js
echo [2/8] 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [✗] 未安装 Node.js
    echo     下载地址: https://nodejs.org/
    set /a ERROR_COUNT+=1
) else (
    for /f "tokens=*" %%i in ('node --version') do (
        echo [✓] Node.js 版本: %%i
    )
)

REM 检查 Rust
echo [3/8] 检查 Rust...
rustc --version >nul 2>&1
if errorlevel 1 (
    echo [✗] 未安装 Rust
    echo     下载地址: https://rustup.rs/
    echo     安装命令: winget install Rustlang.Rustup
    set /a ERROR_COUNT+=1
) else (
    for /f "tokens=*" %%i in ('rustc --version') do (
        echo [✓] Rust 版本: %%i
    )
)

REM 检查 Cargo
echo [4/8] 检查 Cargo...
cargo --version >nul 2>&1
if errorlevel 1 (
    echo [✗] 未安装 Cargo (通常随 Rust 一起安装)
    set /a ERROR_COUNT+=1
) else (
    for /f "tokens=*" %%i in ('cargo --version') do (
        echo [✓] Cargo 版本: %%i
    )
)

REM 检查 pnpm
echo [5/8] 检查 pnpm...
where pnpm >nul 2>&1
if errorlevel 1 (
    echo [✗] 未安装 pnpm
    echo     安装命令: npm install -g pnpm
    set /a ERROR_COUNT+=1
) else (
    for /f "tokens=*" %%i in ('pnpm --version') do (
        echo [✓] pnpm 版本: %%i
    )
)

REM 检查 Tauri CLI
echo [6/8] 检查 Tauri CLI...
pnpm tauri --version >nul 2>&1
if errorlevel 1 (
    echo [⚠] Tauri CLI 未找到，将通过 pnpm 调用
    echo     可选安装: cargo install tauri-cli
    set /a WARNING_COUNT+=1
) else (
    for /f "tokens=*" %%i in ('pnpm tauri --version 2^>nul') do (
        echo [✓] Tauri CLI 版本: %%i
    )
)

REM 检查前端依赖
echo [7/8] 检查前端依赖...
if exist "node_modules" (
    echo [✓] 前端依赖已安装
) else (
    echo [⚠] 前端依赖未安装
    echo     运行命令: pnpm install
    set /a WARNING_COUNT+=1
)

REM 检查后端依赖
echo [8/8] 检查后端依赖...
if exist "server\node_modules" (
    echo [✓] 后端依赖已安装
) else (
    echo [⚠] 后端依赖未安装
    echo     运行命令: cd server && npm install
    set /a WARNING_COUNT+=1
)

echo.
echo ========================================

REM 检查端口占用
echo [额外] 检查端口占用情况...
netstat -aon | findstr ":3001" >nul
if errorlevel 1 (
    echo [✓] 端口 3001 可用
) else (
    echo [⚠] 端口 3001 已被占用
    set /a WARNING_COUNT+=1
)

netstat -aon | findstr ":1420" >nul
if errorlevel 1 (
    echo [✓] 端口 1420 可用
) else (
    echo [⚠] 端口 1420 已被占用
    set /a WARNING_COUNT+=1
)

REM 检查环境变量
echo [额外] 检查环境变量...
if defined TAURI_SIGNING_PRIVATE_KEY (
    echo [✓] 已设置 TAURI_SIGNING_PRIVATE_KEY
) else (
    echo [i] 未设置 TAURI_SIGNING_PRIVATE_KEY (开发模式下可选)
)

echo ========================================
echo.

REM 总结结果
if !ERROR_COUNT! equ 0 (
    if !WARNING_COUNT! equ 0 (
        echo [🎉] 环境检查完成！所有依赖都已正确安装
        echo     可以运行 start-dev.bat 启动开发环境
    ) else (
        echo [⚠] 环境检查完成！发现 !WARNING_COUNT! 个警告
        echo    建议解决警告后再启动开发环境
    )
) else (
    echo [❌] 环境检查失败！发现 !ERROR_COUNT! 个错误
    echo    请先解决错误再启动开发环境
)

echo.
echo 按任意键退出...
pause >nul