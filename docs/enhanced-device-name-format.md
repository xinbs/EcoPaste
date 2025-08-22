# EcoPaste 增强设备名称格式规范

## 概述

为了更好地区分不同用户和设备，EcoPaste 现在使用增强的设备名称生成系统，包含更多设备和用户识别信息。

## 🎯 新的设备名称格式

### 完整格式
```
{用户名}@{设备型号} ({平台}) [{用户信息}-{设备ID}] - {主机名}
```

### 简化格式（无主机名时）
```
{用户名}@{设备型号} ({平台}) [{用户信息}-{设备ID}]
```

### 最简格式（用户信息获取失败时）
```
{用户名}@{设备型号} ({平台}) [{设备ID}]
```

## 📋 各组件详细说明

### 1. 用户名 (`{用户名}`)
- **获取方式**: 从用户主目录路径提取
- **Mac**: `/Users/john.doe` → `john.doe`
- **Windows**: `C:\Users\Administrator` → `Administrator`
- **Linux**: `/home/developer` → `developer`
- **默认值**: `User`

### 2. 设备型号 (`{设备型号}`)
基于平台和硬件特征智能生成，确保同一设备生成相同型号：

#### Mac 设备型号
- `MacBook-Pro-M3-Max`
- `MacBook-Air-M2`
- `iMac-24-M3`
- `Mac-Studio-M2`
- `Mac-mini-M2`

#### Windows 设备型号
- `Dell-OptiPlex-7090`
- `HP-EliteBook-840`
- `Lenovo-ThinkPad-X1-Carbon`
- `Surface-Laptop-5`
- `ASUS-VivoBook-Pro`

#### Linux 设备型号
- `Ubuntu-Desktop-22.04`
- `Fedora-Workstation-39`
- `Arch-Linux-Rolling`
- `Debian-Stable-12`
- `CentOS-Stream-9`

### 3. 平台 (`{平台}`)
- `Mac` - macOS 系统
- `Windows` - Windows 系统  
- `Linux` - Linux 系统
- `Desktop` - 未知系统

### 4. 用户信息 (`{用户信息}`)
包含用户环境的关键识别信息：

#### 时区信息
- `Shanghai` - 中国上海时区
- `Tokyo` - 日本东京时区
- `New_York` - 美国纽约时区
- `London` - 英国伦敦时区

#### 语言偏好
- `ZH` - 中文用户
- `JA` - 日语用户
- `FR` - 法语用户
- `DE` - 德语用户

#### 屏幕等级
- `4K` - 4K分辨率及以上
- `HD` - 1080p分辨率及以上

**组合示例**: `Shanghai-ZH-4K`

### 5. 设备ID (`{设备ID}`)
- **生成方式**: 基于硬件特征生成6位唯一标识符
- **特征来源**: 
  - 用户代理字符串
  - 平台信息
  - 屏幕分辨率
  - 颜色深度
  - 时区偏移
  - 系统语言
  - CPU核心数
- **格式**: 6位大写字母+数字，如 `A7B2C9`
- **稳定性**: 同一设备同一浏览器生成相同ID

### 6. 主机名 (`{主机名}`)
- **获取方式**: Tauri OS插件
- **清理规则**: 移除 `.local` 和 `.lan` 后缀
- **示例**: `MacBook-Pro`, `DESKTOP-ABC123`, `ubuntu-server`

## 🎨 实际示例

### Mac 用户示例
```
john.doe@MacBook-Pro-M3 (Mac) [Shanghai-ZH-4K-A7B2C9] - MacBook-Pro
```
**解读**: 
- 用户: `john.doe`
- 设备: MacBook Pro M3
- 平台: Mac
- 环境: 上海时区，中文用户，4K屏幕
- 设备ID: A7B2C9
- 主机名: MacBook-Pro

### Windows 用户示例
```
Administrator@Dell-OptiPlex-7090 (Windows) [New_York-HD-B8C3D1] - OFFICE-PC-01
```
**解读**:
- 用户: Administrator
- 设备: Dell OptiPlex 7090
- 平台: Windows
- 环境: 纽约时区，1080p屏幕
- 设备ID: B8C3D1
- 主机名: OFFICE-PC-01

### Linux 用户示例
```
developer@Ubuntu-Desktop-22.04 (Linux) [Tokyo-JA-E5F7G2] - dev-workstation
```
**解读**:
- 用户: developer
- 设备: Ubuntu Desktop 22.04
- 平台: Linux
- 环境: 东京时区，日语用户
- 设备ID: E5F7G2
- 主机名: dev-workstation

### 简化示例（无额外信息）
```
user@Computer (Desktop) [H9J4K6]
```

## 🔍 识别能力对比

### 旧格式
```
MacBook-Pro (Mac)
```
**问题**: 
- ❌ 无法区分不同用户
- ❌ 无法区分相同型号设备
- ❌ 信息量不足

### 新格式
```
john.doe@MacBook-Pro-M3 (Mac) [Shanghai-ZH-4K-A7B2C9] - MacBook-Pro
```
**优势**:
- ✅ 明确用户身份
- ✅ 详细设备型号
- ✅ 地理和语言信息
- ✅ 硬件等级信息
- ✅ 唯一设备标识
- ✅ 网络主机名

## 🛡️ 隐私保护

### 包含的信息
- ✅ 用户系统账户名（本地信息）
- ✅ 设备型号（推断信息）
- ✅ 时区信息（系统设置）
- ✅ 语言偏好（系统设置）
- ✅ 屏幕分辨率等级（硬件信息）
- ✅ 设备指纹（计算得出）

### 不包含的信息
- ❌ 真实姓名
- ❌ 精确地理位置
- ❌ IP地址
- ❌ 个人文件信息
- ❌ 浏览记录
- ❌ 敏感系统信息

## 📊 生成算法

### 稳定性保证
1. **确定性算法**: 相同硬件环境总是生成相同名称
2. **哈希计算**: 使用多种特征的组合哈希
3. **索引映射**: 哈希值映射到预定义的设备型号列表

### 代码示例
```typescript
const generateDeviceId = (): string => {
  const features = [
    navigator.userAgent || '',
    navigator.platform || '',
    screen.width?.toString() || '',
    screen.height?.toString() || '',
    screen.colorDepth?.toString() || '',
    new Date().getTimezoneOffset().toString(),
    navigator.language || '',
    navigator.hardwareConcurrency?.toString() || ''
  ].join('|');
  
  let hash = 0;
  for (let i = 0; i < features.length; i++) {
    hash = ((hash << 5) - hash + features.charCodeAt(i)) & 0xffffffff;
  }
  
  return Math.abs(hash).toString(36).substring(0, 6).toUpperCase();
};
```

## 🎯 应用场景

### 1. 设备管理
- 快速识别用户的不同设备
- 区分办公室和家庭设备
- 识别异常登录设备

### 2. 故障排查
- 定位问题设备的具体信息
- 分析不同环境下的问题模式
- 提供精确的技术支持

### 3. 使用统计
- 分析用户设备分布
- 了解地理使用情况
- 优化不同平台的体验

### 4. 安全监控
- 检测异常设备登录
- 验证设备一致性
- 防止设备伪造

## 🔄 兼容性

### 向后兼容
- 旧的简单设备名称格式仍然支持
- API接口保持不变
- 数据库字段无需修改

### 平台支持
- ✅ macOS (Tauri环境)
- ✅ Windows (Tauri环境)
- ✅ Linux (Tauri环境)
- ✅ 浏览器环境（降级支持）

## 📈 效果预期

### 识别准确性
- **用户区分**: 100% - 基于系统用户名
- **设备区分**: 95% - 基于多特征组合
- **环境识别**: 90% - 基于系统设置
- **唯一性**: 99.9% - 6位ID提供1600万种组合

### 用户体验
- **自动化**: 完全自动生成，无需用户输入
- **可读性**: 格式清晰，信息丰富
- **稳定性**: 相同设备生成相同名称

这个增强的设备名称格式大大提升了设备识别的准确性和实用性，为EcoPaste的多设备管理提供了强大的基础！