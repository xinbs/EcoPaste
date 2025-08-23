# EcoPaste 生产构建脚本 (PowerShell版本)
# 支持 Windows 平台的完整构建环境检查

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    EcoPaste 生产构建脚本 (Windows)" -ForegroundColor Yellow
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

Write-Host ""

# 检查并安装依赖
if (-not (Test-Path "node_modules")) {
    Write-Host "正在安装前端依赖..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: 依赖安装失败" -ForegroundColor Red
        Read-Host "按回车键退出"
        exit 1
    }
    Write-Host "成功: 前端依赖安装完成" -ForegroundColor Green
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "开始构建 EcoPaste..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 清理之前的构建
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path "target\release") { Remove-Item -Recurse -Force "target\release" }
Write-Host "已清理之前的构建文件" -ForegroundColor Cyan

Write-Host ""
Write-Host "正在构建 Tauri 应用..." -ForegroundColor Yellow
Write-Host "Tauri 将自动执行：" -ForegroundColor Cyan
Write-Host "  1. 构建图标资源 (beforeBuildCommand)" -ForegroundColor White
Write-Host "  2. 构建前端应用 (beforeBuildCommand)" -ForegroundColor White
Write-Host "  3. 编译 Rust 后端和打包" -ForegroundColor White
Write-Host "这可能需要几分钟，请耐心等待..." -ForegroundColor Yellow

# 检查环境变量
if ($env:TAURI_SIGNING_PRIVATE_KEY) {
    Write-Host "使用签名密钥构建" -ForegroundColor Green
} else {
    Write-Host "使用开发模式构建（无签名）" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "正在运行: pnpm tauri build" -ForegroundColor Green

# 直接使用 tauri build，Tauri 会自动执行 beforeBuildCommand
pnpm tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "构建失败" -ForegroundColor Red
    Write-Host "请检查上方的错误信息" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EcoPaste 构建完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 显示构建结果
if (Test-Path "target\release\bundle\nsis\*.exe") {
    Write-Host "构建产物:" -ForegroundColor Yellow
    Get-ChildItem "target\release\bundle\nsis\*.exe" | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
    Write-Host ""
    Write-Host "安装包位置: target\release\bundle\nsis\" -ForegroundColor Cyan
}

if (Test-Path "target\release\EcoPaste.exe") {
    Write-Host "可执行文件: target\release\EcoPaste.exe" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "构建日志: target\release\build.log (如果存在)" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')