#!/bin/bash
# EcoPaste 开发环境检查脚本 (macOS)

echo "========================================"
echo "    EcoPaste 开发环境检查脚本 (macOS)"
echo "========================================"
echo ""

ERROR_COUNT=0
WARNING_COUNT=0

echo "\033[36m[检查] 正在检查开发环境依赖...\033[0m"
echo ""

# 检查是否在正确的目录
echo "\033[34m[1/8] 检查项目目录...\033[0m"
if [ -f "package.json" ]; then
    echo "\033[32m[✓] 项目根目录正确\033[0m"
else
    echo "\033[31m[✗] 错误: 请在 EcoPaste 项目根目录下运行此脚本\033[0m"
    ((ERROR_COUNT++))
fi

# 检查 Node.js
echo "\033[34m[2/8] 检查 Node.js...\033[0m"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "\033[32m[✓] Node.js 版本: $NODE_VERSION\033[0m"
else
    echo "\033[31m[✗] 未安装 Node.js\033[0m"
    echo "     下载地址: https://nodejs.org/"
    echo "     或使用 Homebrew: brew install node"
    ((ERROR_COUNT++))
fi

# 检查 Rust
echo "\033[34m[3/8] 检查 Rust...\033[0m"
if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version)
    echo "\033[32m[✓] Rust 版本: $RUST_VERSION\033[0m"
else
    echo "\033[31m[✗] 未安装 Rust\033[0m"
    echo "     下载地址: https://rustup.rs/"
    echo "     或使用 Homebrew: brew install rust"
    ((ERROR_COUNT++))
fi

# 检查 Cargo
echo "\033[34m[4/8] 检查 Cargo...\033[0m"
if command -v cargo &> /dev/null; then
    CARGO_VERSION=$(cargo --version)
    echo "\033[32m[✓] Cargo 版本: $CARGO_VERSION\033[0m"
else
    echo "\033[31m[✗] 未安装 Cargo (通常随 Rust 一起安装)\033[0m"
    ((ERROR_COUNT++))
fi

# 检查 pnpm
echo "\033[34m[5/8] 检查 pnpm...\033[0m"
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo "\033[32m[✓] pnpm 版本: $PNPM_VERSION\033[0m"
else
    echo "\033[31m[✗] 未安装 pnpm\033[0m"
    echo "     安装命令: npm install -g pnpm"
    echo "     或使用 Homebrew: brew install pnpm"
    ((ERROR_COUNT++))
fi

# 检查 Tauri CLI
echo "\033[34m[6/8] 检查 Tauri CLI...\033[0m"
if pnpm tauri --version &> /dev/null; then
    TAURI_VERSION=$(pnpm tauri --version 2>/dev/null)
    echo "\033[32m[✓] Tauri CLI 版本: $TAURI_VERSION\033[0m"
else
    echo "\033[33m[⚠] Tauri CLI 未找到，将通过 pnpm 调用\033[0m"
    echo "     可选安装: cargo install tauri-cli"
    ((WARNING_COUNT++))
fi

# 检查前端依赖
echo "\033[34m[7/8] 检查前端依赖...\033[0m"
if [ -d "node_modules" ]; then
    echo "\033[32m[✓] 前端依赖已安装\033[0m"
else
    echo "\033[33m[⚠] 前端依赖未安装\033[0m"
    echo "     运行命令: pnpm install"
    ((WARNING_COUNT++))
fi

# 检查后端依赖
echo "\033[34m[8/8] 检查后端依赖...\033[0m"
if [ -d "server/node_modules" ]; then
    echo "\033[32m[✓] 后端依赖已安装\033[0m"
else
    echo "\033[33m[⚠] 后端依赖未安装\033[0m"
    echo "     运行命令: cd server && npm install"
    ((WARNING_COUNT++))
fi

echo ""
echo "========================================"

# 检查端口占用
echo "\033[34m[额外] 检查端口占用情况...\033[0m"
if lsof -i:3001 &> /dev/null; then
    echo "\033[33m[⚠] 端口 3001 已被占用\033[0m"
    ((WARNING_COUNT++))
else
    echo "\033[32m[✓] 端口 3001 可用\033[0m"
fi

if lsof -i:1420 &> /dev/null; then
    echo "\033[33m[⚠] 端口 1420 已被占用\033[0m"
    ((WARNING_COUNT++))
else
    echo "\033[32m[✓] 端口 1420 可用\033[0m"
fi

# 检查环境变量
echo "\033[34m[额外] 检查环境变量...\033[0m"
if [ ! -z "$TAURI_SIGNING_PRIVATE_KEY" ]; then
    echo "\033[32m[✓] 已设置 TAURI_SIGNING_PRIVATE_KEY\033[0m"
else
    echo "\033[36m[i] 未设置 TAURI_SIGNING_PRIVATE_KEY (开发模式下可选)\033[0m"
fi

# 检查 Xcode 命令行工具 (macOS 特有)
echo "\033[34m[额外] 检查 Xcode 命令行工具...\033[0m"
if xcode-select -p &> /dev/null; then
    XCODE_PATH=$(xcode-select -p)
    echo "\033[32m[✓] Xcode 命令行工具已安装: $XCODE_PATH\033[0m"
else
    echo "\033[31m[✗] Xcode 命令行工具未安装\033[0m"
    echo "     安装命令: xcode-select --install"
    ((ERROR_COUNT++))
fi

echo "========================================"
echo ""

# 总结结果
if [ $ERROR_COUNT -eq 0 ]; then
    if [ $WARNING_COUNT -eq 0 ]; then
        echo "\033[32m[🎉] 环境检查完成！所有依赖都已正确安装\033[0m"
        echo "     可以运行 ./start-dev.sh 启动开发环境"
    else
        echo "\033[33m[⚠] 环境检查完成！发现 $WARNING_COUNT 个警告\033[0m"
        echo "    建议解决警告后再启动开发环境"
    fi
else
    echo "\033[31m[❌] 环境检查失败！发现 $ERROR_COUNT 个错误\033[0m"
    echo "    请先解决错误再启动开发环境"
fi

echo ""