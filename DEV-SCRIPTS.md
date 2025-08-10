# EcoPaste 开发脚本使用指南

本目录包含了用于快速启动和停止EcoPaste开发环境的脚本文件。

## 📁 脚本文件

### 启动脚本

#### `start-dev.bat` (Windows批处理)
- **用途**: Windows系统下的一键启动脚本
- **功能**: 同时启动后端同步服务器和前端Tauri开发服务器
- **使用方法**: 双击运行或在命令行中执行 `start-dev.bat`

#### `start-dev.ps1` (PowerShell)
- **用途**: PowerShell版本的启动脚本，功能更丰富
- **功能**: 
  - 检查Node.js环境
  - 自动安装依赖（如果缺失）
  - 启动后端和前端服务
  - 提供详细的状态信息
- **使用方法**: 
  ```powershell
  # 在PowerShell中执行
  .\start-dev.ps1
  
  # 或者右键选择"使用PowerShell运行"
  ```

### 停止脚本

#### `stop-dev.bat`
- **用途**: 停止所有EcoPaste开发服务
- **功能**: 
  - 停止Tauri应用进程
  - 停止占用端口3001和1420的进程
  - 清理相关的Node.js和Cargo进程
- **使用方法**: 双击运行或在命令行中执行 `stop-dev.bat`

## 🚀 快速开始

### 方式一: 使用批处理脚本（推荐新手）
1. 双击 `start-dev.bat` 启动所有服务
2. 等待服务启动完成
3. 检查系统托盘中的EcoPaste图标
4. 需要停止时，双击 `stop-dev.bat`

### 方式二: 使用PowerShell脚本（推荐开发者）
1. 右键 `start-dev.ps1` → "使用PowerShell运行"
2. 脚本会自动检查环境和依赖
3. 等待服务启动完成
4. 需要停止时，双击 `stop-dev.bat`

## 📡 服务地址

启动成功后，以下服务将可用：

- **前端开发服务器**: http://localhost:1420/
- **后端API服务**: http://localhost:3001
- **WebSocket服务**: ws://localhost:3001/ws
- **健康检查**: http://localhost:3001/health
- **API文档**: http://localhost:3001

## ⚠️ 注意事项

1. **系统托盘应用**: EcoPaste是系统托盘应用，启动后窗口默认隐藏，请检查系统托盘区域的图标

2. **端口占用**: 确保端口1420和3001没有被其他应用占用

3. **依赖安装**: 首次运行前请确保已安装：
   - Node.js (推荐v18+)
   - pnpm (前端包管理器)
   - Rust (Tauri依赖)

4. **权限问题**: 如果PowerShell脚本无法执行，请以管理员身份运行PowerShell并执行：
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

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