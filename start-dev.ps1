# EcoPaste 开发环境一键启动脚本 (PowerShell版本)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    EcoPaste 开发环境一键启动脚本" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在正确的目录
if (-not (Test-Path "package.json")) {
    Write-Host "错误: 请在EcoPaste项目根目录下运行此脚本" -ForegroundColor Red
    pause
    exit 1
}

# 检查Node.js是否安装
try {
    $nodeVersion = node --version
    Write-Host "Node.js版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到Node.js，请先安装Node.js" -ForegroundColor Red
    pause
    exit 1
}

# 检查依赖是否安装
if (-not (Test-Path "node_modules")) {
    Write-Host "正在安装前端依赖..." -ForegroundColor Yellow
    pnpm install
}

if (-not (Test-Path "server/node_modules")) {
    Write-Host "正在安装后端依赖..." -ForegroundColor Yellow
    Set-Location server
    npm install
    Set-Location ..
}

Write-Host "[1/2] 启动后端同步服务器..." -ForegroundColor Blue
# 启动后端服务器
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\server'; npm start" -WindowStyle Normal

Write-Host "[2/2] 等待3秒后启动前端Tauri应用..." -ForegroundColor Blue
Start-Sleep -Seconds 3

Write-Host "启动前端Tauri开发服务器..." -ForegroundColor Blue
# 启动前端Tauri开发服务器
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; pnpm tauri dev" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "所有服务启动完成！" -ForegroundColor Green
Write-Host ""
Write-Host "后端服务: http://localhost:3001" -ForegroundColor White
Write-Host "前端服务: http://localhost:1420" -ForegroundColor White
Write-Host "WebSocket: ws://localhost:3001/ws" -ForegroundColor White
Write-Host "健康检查: http://localhost:3001/health" -ForegroundColor White
Write-Host "API文档: http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "提示: EcoPaste是系统托盘应用，请检查托盘图标" -ForegroundColor Yellow
Write-Host "停止服务: 关闭对应的PowerShell窗口" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')