# EcoPaste 开发脚本使用指南

本目录包含了用于快速启动、停止、构建和检查EcoPaste开发环境的脚本文件。

## 🎯 核心启动流程

**EcoPaste 使用统一的启动命令**: `pnpm tauri dev`

这个命令会自动：
1. 启动前端 React 应用 (Vite) - http://localhost:1420/
2. 启动后端同步服务器 - http://localhost:3001/
3. 启动 Tauri 桌面应用 (Rust 后端)

## 📁 脚本文件

### 🚀 启动脚本

#### `start-dev.bat` (Windows批处理)
- **用途**: Windows系统下的一键启动脚本
- **功能**: 执行 `pnpm tauri dev` 启动完整开发环境
- **使用方法**: 双击运行或在命令行中执行 `start-dev.bat`

#### `start-dev.ps1` (PowerShell)
- **用途**: PowerShell版本的启动脚本，提供更好的用户体验
- **功能**: 
  - 全面的环境检查 (Node.js, Rust, pnpm, Tauri)
  - 自动安装缺失的依赖
  - 彩色输出和详细进度信息
  - 执行 `pnpm tauri dev` 启动开发环境
- **使用方法**: 
  ```powershell
  # 在PowerShell中执行
  .\start-dev.ps1
  
  # 或者右键选择"使用PowerShell运行"
  ```

#### `start-dev.sh` (macOS)
- **用途**: macOS系统下的启动脚本
- **功能**: 环境检查 + 依赖安装 + `pnpm tauri dev`
- **使用方法**: `./start-dev.sh`

### ⏹️ 停止脚本

#### `stop-dev.bat` (Windows)
- **用途**: 停止所有EcoPaste开发服务
- **功能**: 
  - 停止 Node.js 进程 (后端服务器)
  - 停止 Tauri 桌面应用
  - 停止 Vite 开发服务器  
  - 停止 Cargo 构建进程
  - 清理端口占用 (3001, 1420)
- **使用方法**: 双击运行或 `stop-dev.bat`

#### `stop-dev.sh` (macOS)
- **用途**: macOS版本的停止脚本
- **功能**: 同Windows版本，使用macOS兼容的进程管理
- **使用方法**: `./stop-dev.sh`

### 🔄 重启脚本

#### `restart-dev.bat` (Windows)
- **用途**: 快速重启开发环境
- **功能**: 调用 `stop-dev.bat` + `start-dev.bat`
- **使用方法**: 双击运行或 `restart-dev.bat`

#### `restart-dev.sh` (macOS)
- **用途**: macOS版本的重启脚本
- **使用方法**: `./restart-dev.sh`

### 🏗️ 构建脚本

#### `build-windows.bat` / `build-windows.ps1`
- **用途**: Windows生产构建
- **功能**: 执行 `pnpm tauri build` 构建生产版本
- **输出**: `target\release\bundle\nsis\*.exe`

#### `build-macos.sh`
- **用途**: macOS生产构建
- **功能**: 执行 `pnpm tauri build` 构建DMG和App包
- **输出**: `target/release/bundle/dmg/*.dmg`

### 🔍 环境检查脚本

#### `check-env.bat` (Windows) / `check-env.sh` (macOS)
- **用途**: 快速诊断开发环境
- **功能**:
  - 检查所有必需工具 (Node.js, Rust, pnpm, Tauri CLI)
  - 验证项目依赖安装状态
  - 检查端口占用情况
  - 生成环境状态报告
- **使用方法**: 双击运行或命令行执行

## 🚀 快速开始

### 方式一: 使用批处理脚本（推荐新手）
1. **环境检查**: 双击 `check-env.bat` 检查开发环境
2. **启动开发**: 双击 `start-dev.bat` 启动完整开发环境
3. **等待加载**: 等待 Tauri 自动启动所有服务
4. **检查系统托盘**: 查看系统托盘中的 EcoPaste 图标
5. **停止服务**: 需要时双击 `stop-dev.bat`

### 方式二: 使用 PowerShell 脚本（推荐开发者）
1. **环境检查**: 右键 `check-env.bat` → "使用PowerShell运行"
2. **启动开发**: 右键 `start-dev.ps1` → "使用PowerShell运行"
3. **自动检查**: 脚本会自动检查环境和依赖
4. **等待启动**: 等待 `pnpm tauri dev` 完成启动
5. **停止服务**: 需要时双击 `stop-dev.bat`

### 方式三: macOS 用户
1. **添加执行权限**: `chmod +x *.sh`
2. **环境检查**: `./check-env.sh`
3. **启动开发**: `./start-dev.sh`
4. **停止服务**: `./stop-dev.sh`

## 📡 服务地址

启动成功后，以下服务将可用：

- **前端开发服务器**: http://localhost:1420/ (自动启动)
- **后端API服务**: http://localhost:3001 (自动启动)
- **WebSocket服务**: ws://localhost:3001/ws
- **健康检查**: http://localhost:3001/health
- **Tauri桌面应用**: 系统托盘中运行

ℹ️ **注意**: 所有服务都由 `pnpm tauri dev` 命令自动管理，无需手动启动单个服务。

## ⚠️ 注意事项

1. **系统托盘应用**: EcoPaste是系统托盘应用，启动后窗口默认隐藏，请检查系统托盘区域的图标

2. **一键启动**: 现在只需要运行 `pnpm tauri dev` 一个命令，就能启动所有服务

3. **端口占用**: 确保端口1420和3001没有被其他应用占用，或使用 `stop-dev` 脚本清理

4. **环境依赖**: 首次运行前请确保已安装：
   - **Node.js** (v18+) - JavaScript 运行环境
   - **pnpm** - 包管理器 (`npm install -g pnpm`)
   - **Rust** - Tauri 后端依赖 (https://rustup.rs/)
   - **Tauri CLI** - 可选，会通过 pnpm 调用

5. **权限问题**: 如果PowerShell脚本无法执行，请以管理员身份运行PowerShell并执行：
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

6. **首次运行**: 首次启动可能需要几分钟来编译 Rust 依赖，请耐心等待

## 🐛 故障排除

### 服务启动失败
- 检查Node.js是否正确安装
- 确认项目依赖已安装 (`pnpm install` 和 `cd server && npm install`)
- 检查端口是否被占用

### 托盘图标不显示
- 确认Tauri应用已成功编译和启动
- 检查系统托盘设置，确保允许显示所有图标

### PowerShell脚本无法执行
- 检查执行策略设置
- 尝试以管理员身份运行

## 📝 开发提示

- 代码修改后会自动重新编译（热重载）
- 后端API修改需要重启后端服务
- Tauri配置修改需要重启整个开发环境
- 使用 `stop-dev.bat` 可以快速停止所有服务