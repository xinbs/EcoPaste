#!/bin/bash
# EcoPaste 开发环境启动脚本 (macOS 版本)
# 支持 macOS 平台的完整开发环境检查和启动

echo "========================================"
echo "    EcoPaste 开发环境启动脚本 (macOS)"
echo "========================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "\033[31m[错误] 请在 EcoPaste 项目根目录下运行此脚本\033[0m"
    exit 1
fi

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "\033[31m[错误] 未找到 Node.js，请先安装 Node.js 18+\033[0m"
    echo "下载地址: https://nodejs.org/"
    echo "或使用 Homebrew: brew install node"
    exit 1
fi
NODE_VERSION=$(node --version)
echo "\033[32m[信息] Node.js 版本: $NODE_VERSION\033[0m"

# 检查 Rust 是否安装
if ! command -v rustc &> /dev/null; then
    echo "\033[31m[错误] 未找到 Rust，请先安装 Rust 工具链\033[0m"
    echo "下载地址: https://rustup.rs/"
    echo "或使用 Homebrew: brew install rust"
    exit 1
fi
RUST_VERSION=$(rustc --version)
CARGO_VERSION=$(cargo --version)
echo "\033[32m[信息] Rust 版本: $RUST_VERSION\033[0m"
echo "\033[32m[信息] Cargo 版本: $CARGO_VERSION\033[0m"

# 检查 pnpm 是否安装
if ! command -v pnpm &> /dev/null; then
    echo "\033[31m[错误] 未找到 pnpm，请先安装 pnpm\033[0m"
    echo "安装命令: npm install -g pnpm"
    echo "或使用 Homebrew: brew install pnpm"
    exit 1
fi
PNPM_VERSION=$(pnpm --version)
echo "\033[32m[信息] pnpm 版本: $PNPM_VERSION\033[0m"

# 检查 Tauri CLI
if pnpm tauri --version &> /dev/null; then
    TAURI_VERSION=$(pnpm tauri --version 2>/dev/null)
    echo "\033[32m[信息] Tauri CLI 版本: $TAURI_VERSION\033[0m"
else
    echo "\033[33m[警告] Tauri CLI 未找到，将通过 pnpm 调用\033[0m"
fi

echo ""

# 检查并安装前端依赖
if [ ! -d "node_modules" ]; then
    echo "\033[33m[依赖] 正在安装前端依赖...\033[0m"
    pnpm install
    if [ $? -ne 0 ]; then
        echo "\033[31m[错误] 前端依赖安装失败\033[0m"
        exit 1
    fi
    echo "\033[32m[成功] 前端依赖安装完成\033[0m"
fi

# 检查并安装后端依赖
if [ ! -d "server/node_modules" ]; then
    echo "\033[33m[依赖] 正在安装后端依赖...\033[0m"
    cd server
    npm install
    if [ $? -ne 0 ]; then
        echo "\033[31m[错误] 后端依赖安装失败\033[0m"
        cd ..
        exit 1
    fi
    cd ..
    echo "\033[32m[成功] 后端依赖安装完成\033[0m"
fi

# 预编译 Rust 依赖（首次运行或 Cargo.lock 更新时）
if [ ! -d "target/debug" ]; then
    echo "\033[33m[编译] 首次运行，预编译 Rust 依赖...\033[0m"
    echo "\033[36m[信息] 这可能需要几分钟，请耐心等待...\033[0m"
    cargo check --manifest-path=src-tauri/Cargo.toml
    if [ $? -ne 0 ]; then
        echo "\033[33m[警告] Rust 依赖检查失败，但将继续启动开发服务器\033[0m"
    else
        echo "\033[32m[成功] Rust 依赖检查完成\033[0m"
    fi
fi

# 检查端口占用情况
if lsof -i:3001 &> /dev/null; then
    echo "\033[33m[警告] 端口3001已被占用，可能会影响后端启动\033[0m"
fi
if lsof -i:1420 &> /dev/null; then
    echo "\033[33m[警告] 端口1420已被占用，可能会影响前端启动\033[0m"
fi

# 检查环境变量（用于 macOS 编译问题）
if [ ! -z "$TAURI_SIGNING_PRIVATE_KEY" ]; then
    echo "\033[32m[信息] 检测到 TAURI_SIGNING_PRIVATE_KEY 环境变量\033[0m"
else
    echo "\033[36m[信息] 未设置 TAURI_SIGNING_PRIVATE_KEY，将使用开发模式\033[0m"
fi

echo ""
echo "========================================"
echo "\033[34m[启动] 正在启动 EcoPaste 开发环境...\033[0m"
echo "========================================"
echo ""
echo "\033[36mTauri 将自动启动以下服务：\033[0m"
echo "  - 前端 React 应用 (Vite): http://localhost:1420/"
echo "  - 后端同步服务器: http://localhost:3001/"
echo "  - Tauri 桌面应用 (Rust 后端)"
echo ""
echo "\033[32m正在运行: pnpm tauri dev\033[0m"
echo "\033[33m这可能需要几分钟，请耐心等待...\033[0m"
echo ""

# 执行 Tauri 开发模式
pnpm tauri dev

echo ""
echo "\033[33mEcoPaste 开发服务已停止\033[0m"
echo ""