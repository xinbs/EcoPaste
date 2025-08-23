@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    EcoPaste 生产构建脚本 (Windows)
echo ========================================
echo.

REM 检查是否在正确的目录
if exist "package.json" goto check_node
echo [错误] 请在 EcoPaste 项目根目录下运行此脚本
echo.
pause
exit /b 1

:check_node
REM 检查 Node.js 是否安装
node --version >nul 2>&1
if errorlevel 1 goto no_node
for /f "tokens=*" %%i in ('node --version') do echo [信息] Node.js 版本: %%i
goto check_rust
:no_node
echo [错误] 未找到 Node.js，请先安装 Node.js 18+
echo 下载地址: https://nodejs.org/
echo.
pause
exit /b 1

:check_rust
REM 检查 Rust 是否安装
rustc --version >nul 2>&1
if errorlevel 1 goto no_rust
for /f "tokens=*" %%i in ('rustc --version') do echo [信息] Rust 版本: %%i
for /f "tokens=*" %%i in ('cargo --version') do echo [信息] Cargo 版本: %%i
goto check_pnpm
:no_rust
echo [错误] 未找到 Rust，请先安装 Rust 工具链
echo 下载地址: https://rustup.rs/
echo 安装命令: winget install Rustlang.Rustup
echo.
pause
exit /b 1

:check_pnpm
REM 检查 pnpm 是否安装
where pnpm >nul 2>&1
if errorlevel 1 goto no_pnpm
for /f "tokens=*" %%i in ('pnpm --version') do echo [信息] pnpm 版本: %%i
goto check_deps
:no_pnpm
echo [错误] 未找到 pnpm，请先安装 pnpm
echo 安装命令: npm install -g pnpm
echo.
pause
exit /b 1

:check_deps
echo.
REM 检查并安装依赖
if exist "node_modules" goto build_process
echo [依赖] 正在安装前端依赖...
pnpm install
if errorlevel 1 goto install_fail
echo [成功] 前端依赖安装完成
echo.
goto build_process
:install_fail
echo [错误] 依赖安装失败
pause
exit /b 1

:build_process
echo ========================================
echo [构建] 开始构建 EcoPaste...
echo ========================================
echo.

REM 清理之前的构建
if exist "dist" rmdir /s /q "dist"
if exist "target\release" rmdir /s /q "target\release"
echo [清理] 已清理之前的构建文件

echo.
echo [构建] 正在构建 Tauri 应用...
echo [信息] Tauri 将自动执行：
echo   1. 构建图标资源 (beforeBuildCommand)
echo   2. 构建前端应用 (beforeBuildCommand) 
echo   3. 编译 Rust 后端和打包
echo [信息] 这可能需要几分钟，请耐心等待...

REM 检查环境变量
if defined TAURI_SIGNING_PRIVATE_KEY (
    echo [信息] 使用签名密钥构建
) else (
    echo [信息] 使用开发模式构建（无签名）
)

REM 直接使用 tauri build，Tauri 会自动执行 beforeBuildCommand
pnpm tauri build

if errorlevel 1 goto build_fail

echo.
echo ========================================
echo [成功] EcoPaste 构建完成！
echo ========================================
echo.

REM 显示构建结果
if exist "target\release\bundle\nsis\*.exe" (
    echo 构建产物:
    for %%f in ("target\release\bundle\nsis\*.exe") do echo   - %%f
    echo.
    echo 安装包位置: target\release\bundle\nsis\
)

if exist "target\release\EcoPaste.exe" (
    echo 可执行文件: target\release\EcoPaste.exe
)

echo.
echo 构建日志: target\release\build.log (如果存在)
echo ========================================
echo.
echo 按任意键退出...
pause >nul
exit /b 0

:build_fail
echo.
echo [错误] 构建失败
echo 请检查上方的错误信息
echo.
pause
exit /b 1