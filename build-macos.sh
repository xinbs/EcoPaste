#!/bin/bash
# EcoPaste 生产构建脚本 (macOS 版本)

echo "========================================"
echo "    EcoPaste 生产构建脚本 (macOS)"
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

echo ""

# 检查并安装依赖
if [ ! -d "node_modules" ]; then
    echo "\033[33m[依赖] 正在安装前端依赖...\033[0m"
    pnpm install
    if [ $? -ne 0 ]; then
        echo "\033[31m[错误] 依赖安装失败\033[0m"
        exit 1
    fi
    echo "\033[32m[成功] 前端依赖安装完成\033[0m"
    echo ""
fi

echo "========================================"
echo "\033[34m[构建] 开始构建 EcoPaste...\033[0m"
echo "========================================"
echo ""

# 清理之前的构建
if [ -d "dist" ]; then
    rm -rf dist
fi
if [ -d "target/release" ]; then
    rm -rf target/release
fi
echo "\033[36m[清理] 已清理之前的构建文件\033[0m"

echo ""
echo "\033[34m[构建] 正在构建 Tauri 应用...\033[0m"
echo "\033[36mTauri 将自动执行：\033[0m"
echo "  1. 构建图标资源 (beforeBuildCommand)"
echo "  2. 构建前端应用 (beforeBuildCommand)"
echo "  3. 编译 Rust 后端和打包"
echo "\033[36m这可能需要几分钟，请耐心等待...\033[0m"

# 检查环境变量
if [ ! -z "$TAURI_SIGNING_PRIVATE_KEY" ]; then
    echo "\033[32m[信息] 使用签名密钥构建\033[0m"
else
    echo "\033[36m[信息] 使用开发模式构建（无签名）\033[0m"
fi

# 直接使用 tauri build，Tauri 会自动执行 beforeBuildCommand
pnpm tauri build

if [ $? -ne 0 ]; then
    echo "\033[31m[错误] Tauri 构建失败\033[0m"
    exit 1
fi

echo ""
echo "========================================"
echo "\033[32m[成功] EcoPaste 构建完成！\033[0m"
echo "========================================"
echo ""

# 显示构建结果
if [ -f "target/release/bundle/dmg/"*.dmg ]; then
    echo "构建产物:"
    ls -la target/release/bundle/dmg/*.dmg
    echo ""
    echo "DMG 安装包位置: target/release/bundle/dmg/"
fi

if [ -f "target/release/bundle/macos/"*.app ]; then
    echo "应用程序包:"
    ls -la target/release/bundle/macos/*.app
    echo ""
    echo "App 包位置: target/release/bundle/macos/"
fi

if [ -f "target/release/EcoPaste" ]; then
    echo "可执行文件: target/release/EcoPaste"
fi

echo ""
echo "构建日志: target/release/build.log (如果存在)"
echo "========================================"
echo ""