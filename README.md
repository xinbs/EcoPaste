# XEcoPaste

<div align="center">
  <br/>

  <div>
      简体中文 | <a href="./README.zh-TW.md">繁體中文</a> | <a href="./README.en-US.md">English</a> | <a href="./README.ja-JP.md">日本語</a>
  </div>

  <br/>
    
  <div>
    <a href="https://github.com/xinbs/XEcoPaste/releases">
      <img
        alt="Windows"
        src="https://img.shields.io/badge/-Windows-blue?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB0PSIxNzI2MzA1OTcxMDA2IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjE1NDgiIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48cGF0aCBkPSJNNTI3LjI3NTU1MTYxIDk2Ljk3MTAzMDEzdjM3My45OTIxMDY2N2g0OTQuNTEzNjE5NzVWMTUuMDI2NzU3NTN6TTUyNy4yNzU1NTE2MSA5MjguMzIzNTA4MTVsNDk0LjUxMzYxOTc1IDgwLjUyMDI4MDQ5di00NTUuNjc3NDcxNjFoLTQ5NC41MTM2MTk3NXpNNC42NzA0NTEzNiA0NzAuODMzNjgyOTdINDIyLjY3Njg1OTI1VjExMC41NjM2ODE5N2wtNDE4LjAwNjQwNzg5IDY5LjI1Nzc5NzUzek00LjY3MDQ1MTM2IDg0Ni43Njc1OTcwM0w0MjIuNjc2ODU5MjUgOTE0Ljg2MDMxMDEzVjU1My4xNjYzMTcwM0g0LjY3MDQ1MTM2eiIgcC1pZD0iMTU0OSIgZmlsbD0iI2ZmZmZmZiI+PC9wYXRoPjwvc3ZnPg=="
      />
    </a >
    <a href="https://github.com/xinbs/XEcoPaste/releases">
      <img
        alt="MacOS"
        src="https://img.shields.io/badge/-MacOS-black?style=flat-square&logo=apple&logoColor=white"
      />
    </a >
    <a href="https://github.com/xinbs/XEcoPaste/releases">
      <img 
        alt="Linux"
        src="https://img.shields.io/badge/-Linux-yellow?style=flat-square&logo=linux&logoColor=white" 
      />
    </a>
  </div>

  <div>
    <a href="./LICENSE">
      <img
        src="https://img.shields.io/github/license/xinbs/XEcoPaste?style=flat-square"
      />
    </a >
    <a href="https://github.com/xinbs/XEcoPaste/releases">
      <img
        src="https://img.shields.io/github/package-json/v/xinbs/XEcoPaste?style=flat-square"
      />
    </a >
  </div>

  <br/>

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./static/app-dark.zh-CN.png" />
    <source media="(prefers-color-scheme: light)" srcset="./static/app-light.zh-CN.png" />
    <img src="./static/app-light.zh-CN.png" />
  </picture>
</div>

## 项目说明

**XEcoPaste** 是基于 [EcoPasteHub/EcoPaste](https://github.com/EcoPasteHub/EcoPaste) 的独立 fork 版本，专注于个人定制和功能扩展。

### 🔗 项目来源
- **原项目**: [EcoPasteHub/EcoPaste](https://github.com/EcoPasteHub/EcoPaste)
- **原作者**: ayangweb (ayangweb@foxmail.com)
- **许可协议**: Apache License 2.0
- **Fork 时间**: 2024年
- **当前维护**: 这是一个独立的衍生项目分支

### 🎯 项目定位
XEcoPaste 是一个独立发展的剪贴板管理工具，在原项目基础上进行个性化定制和功能增强。虽然基于 EcoPaste，但将作为独立项目持续发展。

## 功能特性

- 🎉 基于 Tauri v2 开发，轻量高效，跨平台体验
- 💻 支持 Windows、macOS 和 Linux（x11），多设备无缝切换
- ✨ 简洁直观的用户界面，操作简单，零门槛上手
- 📋 支持纯文本、富文本、HTML、图片和文件类型的剪贴板内容
- 🔒 数据本地存储，确保用户隐私安全
- 📝 支持备注功能，轻松分类、管理和检索
- ⚙️ 丰富的个性化设置，满足不同用户需求
- 🔧 持续优化和功能扩展

## 开发环境

### 环境要求
- Node.js 18+
- pnpm
- Rust 1.70+
- Tauri CLI v2

### 快速开始

```bash
# 克隆项目
git clone https://github.com/xinbs/XEcoPaste.git
cd XEcoPaste

# 安装依赖
pnpm install

# 启动开发环境
pnpm tauri dev

# 构建应用
pnpm tauri build
```

## 构建说明

### 前端构建
```bash
pnpm build:vite
```

### 桌面应用构建
```bash
pnpm tauri build
```

## 问题反馈

如果您在使用过程中遇到问题，请：

1. 查看 [Issues](https://github.com/xinbs/XEcoPaste/issues) 中是否已有相关问题
2. 如果没有，请创建新的 Issue 并详细描述问题

## 许可协议

本项目基于 **Apache License 2.0** 开源协议。

### 版权声明
- 原项目版权归 EcoPasteHub/EcoPaste 及其贡献者所有
- 本衍生作品的修改部分遵循相同的 Apache License 2.0 协议
- 详细协议内容请查看 [LICENSE](./LICENSE) 文件

### 致谢
感谢 [EcoPasteHub/EcoPaste](https://github.com/EcoPasteHub/EcoPaste) 项目提供的优秀基础代码。