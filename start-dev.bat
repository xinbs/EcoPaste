@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    EcoPaste 开发环境启动脚本 (Windows)
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
goto check_tauri_cli
:no_pnpm
echo [错误] 未找到 pnpm，请先安装 pnpm
echo 安装命令: npm install -g pnpm
echo.
pause
exit /b 1

:check_tauri_cli
REM 检查 Tauri CLI 是否安装
pnpm tauri --version >nul 2>&1
if errorlevel 1 (
    echo [警告] Tauri CLI 未找到，将通过 pnpm 调用
) else (
    for /f "tokens=*" %%i in ('pnpm tauri --version 2^>nul') do echo [信息] Tauri CLI 版本: %%i
)

:check_frontend_deps
echo.
REM 检查并安装前端依赖
if exist "node_modules" goto check_backend_deps
echo [依赖] 正在安装前端依赖...
pnpm install
if errorlevel 1 goto frontend_install_fail
echo [成功] 前端依赖安装完成
echo.
goto check_backend_deps
:frontend_install_fail
echo [错误] 前端依赖安装失败
pause
exit /b 1

:check_backend_deps
REM 检查并安装后端依赖
if exist "server\node_modules" goto start_dev
echo [依赖] 正在安装后端依赖...
cd /d server
npm install
if errorlevel 1 goto backend_install_fail
cd ..
echo [成功] 后端依赖安装完成
echo.
goto start_dev
:backend_install_fail
echo [错误] 后端依赖安装失败
cd ..
pause
exit /b 1

:start_dev

:check_frontend_deps
echo.
REM 检查并安装前端依赖
if exist "node_modules" goto check_backend_deps
echo [依赖] 正在安装前端依赖...
pnpm install
if errorlevel 1 goto frontend_install_fail
echo [成功] 前端依赖安装完成
echo.
goto check_backend_deps
:frontend_install_fail
echo [错误] 前端依赖安装失败
pause
exit /b 1

:check_backend_deps
REM 检查并安装后端依赖
if exist "server\node_modules" goto build_rust_deps
echo [依赖] 正在安装后端依赖...
cd /d server
npm install
if errorlevel 1 goto backend_install_fail
cd ..
echo [成功] 后端依赖安装完成
echo.
goto build_rust_deps
:backend_install_fail
echo [错误] 后端依赖安装失败
cd ..
pause
exit /b 1

:build_rust_deps
REM 预编译 Rust 依赖（首次运行或 Cargo.lock 更新时）
if exist "target\debug" goto check_ports
echo [编译] 首次运行，预编译 Rust 依赖...
echo [信息] 这可能需要几分钟，请耐心等待...
cargo check --manifest-path=src-tauri/Cargo.toml
if errorlevel 1 (
    echo [警告] Rust 依赖检查失败，但将继续启动开发服务器
) else (
    echo [成功] Rust 依赖检查完成
)
echo.
goto check_ports

:check_ports
REM 检查端口占用情况
netstat -an | find ":3001" | find "LISTENING" >nul
if not errorlevel 1 echo [警告] 端口3001已被占用，可能会影响后端启动
netstat -an | find ":1420" | find "LISTENING" >nul
if not errorlevel 1 echo [警告] 端口1420已被占用，可能会影响前端启动
echo.

REM 检查环境变量（用于 Windows 编译问题）
if defined TAURI_SIGNING_PRIVATE_KEY (
    echo [信息] 检测到 TAURI_SIGNING_PRIVATE_KEY 环境变量
) else (
    echo [信息] 未设置 TAURI_SIGNING_PRIVATE_KEY，将使用开发模式
)
echo.

echo ========================================
echo [启动] 正在启动 EcoPaste 开发环境...
echo ========================================
echo.
echo [信息] Tauri 将自动启动以下服务：
echo   - 前端 React 应用 (Vite): http://localhost:1420/
echo   - 后端同步服务器: http://localhost:3001/
echo   - Tauri 桌面应用 (Rust 后端)
echo.
echo [启动] 正在运行: pnpm tauri dev
echo [信息] 这可能需要几分钟，请耐心等待...
echo.

REM 执行 Tauri 开发模式
pnpm tauri dev

echo.
echo [信息] EcoPaste 开发服务已停止
echo 按任意键退出...
pause >nul