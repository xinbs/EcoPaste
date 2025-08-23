#!/bin/bash
# EcoPaste 开发服务停止脚本 (macOS)

echo "========================================"
echo "    EcoPaste 开发服务停止脚本 (macOS)"
echo "========================================"
echo ""

echo "\033[34m[信息] 正在停止 EcoPaste 开发服务...\033[0m"
echo ""
echo "\033[36m停止顺序：\033[0m"
echo "  1. 停止 Tauri 桌面应用"
echo "  2. 停止 Node.js 后端服务器"
echo "  3. 停止 Cargo 构建进程"
echo "  4. 清理端口占用进程"
echo ""

# 停止 Tauri/EcoPaste 进程
echo "\033[34m[1/4] 停止 Tauri 桌面应用...\033[0m"
if pgrep -f "EcoPaste" > /dev/null; then
    pkill -f "EcoPaste"
    echo "\033[32m[成功] EcoPaste 进程已停止\033[0m"
else
    echo "\033[33m[信息] 没有找到运行中的 EcoPaste 进程\033[0m"
fi

# 停止 Node.js 进程
echo "\033[34m[2/4] 停止 Node.js 后端服务器...\033[0m"
if pgrep -f "node" > /dev/null; then
    pkill -f "node"
    echo "\033[32m[成功] Node.js 进程已停止\033[0m"
else
    echo "\033[33m[信息] 没有找到运行中的 Node.js 进程\033[0m"
fi

# 停止 Cargo 进程
echo "\033[34m[3/4] 停止 Cargo 构建进程...\033[0m"
if pgrep -f "cargo" > /dev/null; then
    pkill -f "cargo"
    echo "\033[32m[成功] Cargo 进程已停止\033[0m"
else
    echo "\033[33m[信息] 没有找到运行中的 Cargo 进程\033[0m"
fi

# 检查并停止占用端口的进程
echo "\033[34m[4/4] 检查端口占用情况...\033[0m"

# 检查端口3001
if lsof -ti:3001 > /dev/null 2>&1; then
    echo "\033[33m[信息] 停止占用端口3001的进程\033[0m"
    kill $(lsof -ti:3001) 2>/dev/null
fi

# 检查端口1420
if lsof -ti:1420 > /dev/null 2>&1; then
    echo "\033[33m[信息] 停止占用端口1420的进程\033[0m"
    kill $(lsof -ti:1420) 2>/dev/null
fi

# 等待进程完全停止
sleep 1

echo ""
echo "========================================"
echo "\033[32m[完成] 所有 EcoPaste 开发服务已停止\033[0m"
echo "========================================"
echo ""