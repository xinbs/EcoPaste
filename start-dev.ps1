# EcoPaste 开发环境一键启动脚本 (PowerShell版本)
# 支持 Windows 平台的完整开发环境检查和启动

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    EcoPaste 开发环境启动脚本 (Windows)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在正确的目录
if (-not (Test-Path "package.json")) {
    Write-Host "错误: 请在EcoPaste项目根目录下运行此脚本" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

# 检查Node.js是否安装
try {
    $nodeVersion = node --version
    Write-Host "Node.js版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到Node.js，请先安装Node.js 18+" -ForegroundColor Red
    Write-Host "下载地址: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

# 检查Rust是否安装
try {
    $rustVersion = rustc --version
    $cargoVersion = cargo --version
    Write-Host "Rust版本: $rustVersion" -ForegroundColor Green
    Write-Host "Cargo版本: $cargoVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到Rust，请先安装Rust工具链" -ForegroundColor Red
    Write-Host "下载地址: https://rustup.rs/" -ForegroundColor Yellow
    Write-Host "安装命令: winget install Rustlang.Rustup" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

# 检查pnpm是否安装
try {
    $pnpmVersion = pnpm --version
    Write-Host "pnpm版本: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到pnpm，请先安装pnpm" -ForegroundColor Red
    Write-Host "安装命令: npm install -g pnpm" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

# 检查Tauri CLI
try {
    $tauriVersion = pnpm tauri --version 2>$null
    if ($tauriVersion) {
        Write-Host "Tauri CLI版本: $tauriVersion" -ForegroundColor Green
    } else {
        Write-Host "警告: Tauri CLI未找到，将通过pnpm调用" -ForegroundColor Yellow
    }
} catch {
    Write-Host "警告: Tauri CLI未找到，将通过pnpm调用" -ForegroundColor Yellow
}

# 检查依赖是否已安装
Write-Host ""
if (-not (Test-Path "node_modules")) {
    Write-Host "正在安装前端依赖..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: 前端依赖安装失败" -ForegroundColor Red
        Read-Host "按回车键退出"
        exit 1
    }
    Write-Host "成功: 前端依赖安装完成" -ForegroundColor Green
}

if (-not (Test-Path "server/node_modules")) {
    Write-Host "正在安装后端依赖..." -ForegroundColor Yellow
    Set-Location server
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: 后端依赖安装失败" -ForegroundColor Red
        Set-Location ..
        Read-Host "按回车键退出"
        exit 1
    }
    Set-Location ..
    Write-Host "成功: 后端依赖安装完成" -ForegroundColor Green
}

# 预编译 Rust 依赖
if (-not (Test-Path "target/debug")) {
    Write-Host "首次运行，预编译 Rust 依赖..." -ForegroundColor Yellow
    Write-Host "这可能需要几分钟，请耐心等待..." -ForegroundColor Cyan
    cargo check --manifest-path=src-tauri/Cargo.toml
    if ($LASTEXITCODE -ne 0) {
        Write-Host "警告: Rust 依赖检查失败，但将继续启动开发服务器" -ForegroundColor Yellow
    } else {
        Write-Host "成功: Rust 依赖检查完成" -ForegroundColor Green
    }
}

# 检查端口占用
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
$port1420 = Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue
if ($port3001) { Write-Host "警告: 端口3001已被占用" -ForegroundColor Yellow }
if ($port1420) { Write-Host "警告: 端口1420已被占用" -ForegroundColor Yellow }

# 检查环境变量
if ($env:TAURI_SIGNING_PRIVATE_KEY) {
    Write-Host "检测到 TAURI_SIGNING_PRIVATE_KEY 环境变量" -ForegroundColor Green
} else {
    Write-Host "未设置 TAURI_SIGNING_PRIVATE_KEY，将使用开发模式" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "正在启动 EcoPaste 开发环境..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tauri 将自动启动以下服务：" -ForegroundColor Cyan
Write-Host "  - 前端 React 应用 (Vite): http://localhost:1420/" -ForegroundColor White
Write-Host "  - 后端同步服务器: http://localhost:3001/" -ForegroundColor White
Write-Host "  - Tauri 桌面应用 (Rust 后端)" -ForegroundColor White
Write-Host ""
Write-Host "正在运行: pnpm tauri dev" -ForegroundColor Green
Write-Host "这可能需要几分钟，请耐心等待..." -ForegroundColor Yellow
Write-Host ""

# 执行 Tauri 开发模式
pnpm tauri dev

Write-Host ""
Write-Host "EcoPaste 开发服务已停止" -ForegroundColor Yellow
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')