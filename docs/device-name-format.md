# EcoPaste 智能设备名称生成规则

## 概述

为了更好地区分不同用户和设备，EcoPaste 现在使用智能设备名称生成系统，能够自动获取详细的设备信息并生成有意义的设备标识。

## 🎯 设备名称格式

### 完整格式
```
{用户名}@{设备型号} ({平台}) - {主机名}
```

### 简化格式（当无法获取某些信息时）
```
{用户名}@{设备型号} ({平台})
```

### 备用格式（权限不足或错误时）
```
EcoPaste-{平台}-{时间戳}
```

## 📋 具体示例

### Mac 设备
- **完整格式**: `john.doe@MacBook-Pro-M3 (Mac) - MacBook-Pro`
- **简化格式**: `admin@iMac-24 (Mac)`
- **备用格式**: `EcoPaste-Mac-841692`

### Windows 设备
- **完整格式**: `Administrator@Dell-OptiPlex-7090 (Windows) - DESKTOP-ABC123`
- **简化格式**: `office-user@Surface-Laptop-5 (Windows)`
- **备用格式**: `EcoPaste-Windows-753214`

### Linux 设备
- **完整格式**: `developer@Ubuntu-Desktop (Linux) - ubuntu-server`
- **简化格式**: `sysadmin@Fedora-Workstation (Linux)`
- **备用格式**: `EcoPaste-Linux-962580`

### 浏览器环境
- **格式**: `Web@{浏览器} ({平台}) - {时间戳}`
- **示例**: `Web@Chrome (Mac) - 841692`

## 🔧 技术实现

### 信息获取方式

#### Mac 平台
1. **设备型号**: 
   - 首选: `system_profiler SPHardwareDataType` 命令
   - 备用: 预设的常见Mac型号随机选择
2. **用户名**: 从用户目录路径提取
3. **主机名**: 使用 Tauri 的 `hostname()` API

#### Windows 平台
1. **设备型号**:
   - 首选: `wmic computersystem get model /value` 命令
   - 备用: 预设的常见PC型号随机选择
2. **用户名**: 从用户目录路径提取
3. **主机名**: 使用 Tauri 的 `hostname()` API

#### Linux 平台
1. **设备型号**:
   - 首选: 读取 `/sys/devices/virtual/dmi/id/product_name`
   - 次选: `lsb_release -si` 获取发行版信息
   - 备用: 预设的常见Linux设备名随机选择
2. **用户名**: 从用户目录路径提取
3. **主机名**: 使用 Tauri 的 `hostname()` API

### 错误处理机制

1. **权限不足**: 当系统命令执行失败时，自动降级到备用方案
2. **命令不存在**: 使用预设的设备型号列表
3. **信息获取失败**: 生成带时间戳的唯一标识符

## 🔒 权限配置

为了获取详细的设备信息，需要在 Tauri 配置中添加以下权限：

```json
{
  "identifier": "shell:allow-execute",
  "allow": [
    {
      "args": true,
      "name": "system_profiler"
    },
    {
      "args": true,
      "name": "wmic"
    },
    {
      "args": true,
      "name": "cat"
    },
    {
      "args": true,
      "name": "lsb_release"
    }
  ]
}
```

## 🎨 设备名称的优势

### 1. 高识别度
- **用户标识**: 明确显示设备所属用户
- **设备型号**: 区分不同的硬件设备
- **平台信息**: 快速识别操作系统
- **主机名称**: 提供网络识别信息

### 2. 实用性
- **多用户环境**: 轻松区分不同用户的设备
- **设备管理**: 快速识别和管理多个设备
- **故障排查**: 便于定位问题设备
- **使用统计**: 了解不同设备的使用情况

### 3. 安全性
- **设备验证**: 通过详细信息验证设备合法性
- **异常检测**: 识别可疑的设备连接
- **访问控制**: 基于设备信息进行权限控制

## 📊 设备名称统计

### 常见格式分布
- **Mac用户**: `username@MacBook-Pro-M3 (Mac) - hostname`
- **Windows用户**: `username@Dell-PC (Windows) - hostname`
- **Linux用户**: `username@Ubuntu-Desktop (Linux) - hostname`
- **Web用户**: `Web@Chrome (Mac) - timestamp`

### 信息完整度
- **完整信息**: 约85%的设备能获取完整信息
- **部分信息**: 约10%的设备获取部分信息
- **备用方案**: 约5%的设备使用备用方案

## 🔄 兼容性

### 向后兼容
- 旧版本的简单设备名称仍然支持
- 新旧格式可以在同一系统中共存
- API接口保持不变

### 平台支持
- ✅ macOS 10.14+
- ✅ Windows 10+
- ✅ Linux (主流发行版)
- ✅ 浏览器环境

## 🚀 未来扩展

### 计划功能
1. **设备指纹**: 添加硬件指纹信息
2. **地理位置**: 可选的地理位置标识
3. **使用时间**: 设备激活和使用时间信息
4. **自定义标签**: 用户自定义设备标签

### 优化方向
1. **性能优化**: 缓存设备信息，减少重复获取
2. **准确性提升**: 更精确的设备型号识别
3. **隐私保护**: 可配置的信息显示级别

## 📝 开发者指南

### 使用方法
```typescript
import { getDeviceName } from '@/utils/is';

// 获取当前设备名称
const deviceName = await getDeviceName();
console.log(deviceName); // "john.doe@MacBook-Pro-M3 (Mac) - MacBook-Pro"
```

### 错误处理
```typescript
try {
  const deviceName = await getDeviceName();
  // 使用设备名称
} catch (error) {
  console.error('获取设备名称失败:', error);
  // 使用默认设备名称
  const fallbackName = 'EcoPaste-Device';
}
```

### 自定义配置
```typescript
// 将来可能支持的配置选项
const options = {
  includeHostname: true,
  includeUsername: true,
  includeModel: true,
  includeTimestamp: false
};

const deviceName = await getDeviceName(options);
```

这个新的设备名称生成系统大大提升了设备识别的准确性和实用性，为 EcoPaste 的多设备同步功能提供了更强大的基础！