#!/bin/bash
# EcoPaste 开发环境重启脚本 (macOS)

echo "========================================"
echo "    EcoPaste 开发环境重启脚本 (macOS)"
echo "========================================"
echo ""

echo "\033[34m[信息] 正在重启 EcoPaste 开发环境...\033[0m"
echo ""

echo "\033[34m[步骤1/2] 停止现有服务...\033[0m"
echo "----------------------------------------"
if [ -f "./stop-dev.sh" ]; then
    chmod +x ./stop-dev.sh
    ./stop-dev.sh
else
    echo "\033[33m[警告] 未找到 stop-dev.sh，手动停止服务...\033[0m"
    pkill -f "EcoPaste" 2>/dev/null
    pkill -f "node" 2>/dev/null
    pkill -f "cargo" 2>/dev/null
    if lsof -ti:3001 > /dev/null 2>&1; then
        kill $(lsof -ti:3001) 2>/dev/null
    fi
    if lsof -ti:1420 > /dev/null 2>&1; then
        kill $(lsof -ti:1420) 2>/dev/null
    fi
    echo "\033[32m[完成] 服务停止完成\033[0m"
fi

echo ""
echo "\033[34m[步骤2/2] 启动开发服务...\033[0m"
echo "----------------------------------------"
if [ -f "./start-dev.sh" ]; then
    chmod +x ./start-dev.sh
    ./start-dev.sh
else
    echo "\033[31m[错误] 未找到 start-dev.sh 脚本\033[0m"
    echo "请确保在项目根目录下运行此脚本"
    exit 1
fi

echo ""
echo "========================================"
echo "\033[32m[成功] EcoPaste 开发环境重启完成！\033[0m"
echo "========================================"
echo ""