#!/bin/bash

echo "========================================"
echo "    EcoPaste Development Startup Script"
echo "========================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "\033[31m[Error] 请在EcoPaste项目根目录下运行此脚本\033[0m"
    exit 1
fi

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "\033[31m[Error] 未找到Node.js，请先安装Node.js\033[0m"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version)
echo "\033[32m[Info] Node.js版本: $NODE_VERSION\033[0m"

# 检查pnpm是否安装
if ! command -v pnpm &> /dev/null; then
    echo "\033[31m[Error] 未找到pnpm，请先安装pnpm\033[0m"
    echo "安装命令: npm install -g pnpm"
    exit 1
fi
PNPM_VERSION=$(pnpm --version)
echo "\033[32m[Info] pnpm版本: $PNPM_VERSION\033[0m"

# 检查并安装前端依赖
if [ ! -d "node_modules" ]; then
    echo "\033[33m[Dependencies] 正在安装前端依赖...\033[0m"
    pnpm install
    if [ $? -ne 0 ]; then
        echo "\033[31m[Error] 前端依赖安装失败\033[0m"
        exit 1
    fi
    echo "\033[32m[Success] 前端依赖安装完成\033[0m"
fi

# 检查并安装后端依赖
if [ ! -d "server/node_modules" ]; then
    echo "\033[33m[Dependencies] 正在安装后端依赖...\033[0m"
    cd server
    npm install
    if [ $? -ne 0 ]; then
        echo "\033[31m[Error] 后端依赖安装失败\033[0m"
        cd ..
        exit 1
    fi
    cd ..
    echo "\033[32m[Success] 后端依赖安装完成\033[0m"
fi

# 检查端口占用情况
if lsof -i:3001 &> /dev/null; then
    echo "\033[33m[Warning] 端口3001已被占用，可能会影响后端启动\033[0m"
fi
if lsof -i:1420 &> /dev/null; then
    echo "\033[33m[Warning] 端口1420已被占用，可能会影响前端启动\033[0m"
fi
echo ""

echo "\033[34m[1/2] 启动后端同步服务器...\033[0m"
# 启动后端服务器（在新的终端窗口中）
osascript -e 'tell application "Terminal" to do script "cd '"$PWD/server"' && npm start"'

echo "\033[34m[2/2] 等待3秒后启动前端Tauri应用...\033[0m"
sleep 3

echo "\033[34m启动前端Tauri开发服务器...\033[0m"
# 启动前端Tauri开发服务器（在新的终端窗口中）
osascript -e 'tell application "Terminal" to do script "cd '"$PWD"' && pnpm tauri dev"'

echo ""
echo "========================================"
echo "\033[32m[Success] 所有服务启动完成！\033[0m"
echo ""
echo "后端服务: http://localhost:3001"
echo "前端服务: http://localhost:1420"
echo "WebSocket: ws://localhost:3001/ws"
echo "健康检查: http://localhost:3001/health"
echo "API文档: http://localhost:3001"
echo ""
echo "\033[33m提示: EcoPaste是系统托盘应用，请检查托盘图标\033[0m"
echo "\033[33m停止服务: 关闭对应的终端窗口\033[0m"
echo "========================================"
echo ""