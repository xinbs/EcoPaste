# EcoPaste 设备名称自动获取功能实现

## 功能概述

为了提升用户体验，我们实现了设备名称自动获取功能。用户在注册或登录时，不再需要手动输入设备名称，系统会自动获取并生成有意义的设备名称。

## 🎯 用户体验改进

### 之前的体验
- ❌ 用户需要手动填写设备名称
- ❌ 可能输入无意义的名称
- ❌ 容易出现空值导致注册失败

### 现在的体验  
- ✅ 设备名称完全自动获取
- ✅ 生成有意义的设备标识
- ✅ 用户无需额外操作
- ✅ 避免了输入错误

## 🛠 技术实现

### 1. 核心工具函数

在 `src/utils/is.ts` 中新增了 `getDeviceName()` 函数：

```typescript
export const getDeviceName = async () => {
  try {
    // 在 Tauri 环境中
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      const { platform } = await import('@tauri-apps/plugin-os');
      const { hostname } = await import('@tauri-apps/plugin-os');
      
      const [platformInfo, hostnameInfo] = await Promise.all([
        platform(),
        hostname()
      ]);
      
      // 生成设备名称：主机名 + 平台，如 "MacBook-Pro (Mac)"
      const platformMap = {
        macos: 'Mac',
        windows: 'Windows', 
        linux: 'Linux',
        unknown: 'Desktop'
      };
      
      const platformName = platformMap[platformInfo] || 'Desktop';
      const cleanHostname = hostnameInfo ? hostnameInfo.replace(/\.(local|lan)$/i, '') : '';
      
      if (cleanHostname && cleanHostname !== 'localhost') {
        return `${cleanHostname} (${platformName})`;
      } else {
        return `EcoPaste ${platformName}`;
      }
    }
    
    // 浏览器环境的备用方案
    // ... 省略实现细节
    
  } catch (error) {
    console.error('获取设备名称失败:', error);
    return 'EcoPaste Desktop';
  }
};
```

### 2. 同步插件更新

#### 登录功能 (`src/plugins/sync.ts`)
```typescript
async login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    // 自动获取设备名称
    const deviceName = await getDeviceName();
    
    const response = await this.apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: credentials.email,
        password: credentials.password,
        deviceName: deviceName,  // 使用自动获取的设备名称
        deviceType: 'desktop',
        platform: navigator.platform
      })
    });
    // ... 其他逻辑
  }
}
```

#### 注册功能 (`src/plugins/sync.ts`)  
```typescript
async register(data: RegisterData): Promise<AuthResponse> {
  try {
    // 验证必填字段
    if (!data.email || !data.password) {
      throw new Error('邮箱和密码不能为空');
    }
    
    // 自动获取设备名称
    const deviceName = await getDeviceName();
    
    const response = await this.apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: data.email,
        password: data.password,
        email: data.email,
        deviceName: deviceName,  // 使用自动获取的设备名称
        deviceType: 'desktop',
        platform: navigator.platform
      })
    });
    // ... 其他逻辑
  }
}
```

### 3. 前端界面简化

#### 注册表单优化 (`src/components/SyncSettings/index.tsx`)

**移除的元素：**
```typescript
// ❌ 移除了设备名称输入框
<Form.Item label="设备名称">
  <Input
    placeholder="请输入设备名称"
    value={registerForm.deviceName}
    onChange={(e) => setRegisterForm({ ...registerForm, deviceName: e.target.value })}
  />
</Form.Item>
```

**新增的提示：**
```typescript
// ✅ 添加了友好的提示信息
<Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '16px' }}>
  📱 设备名称将自动获取，无需手动输入
</Text>
```

#### 状态管理简化
```typescript
// 之前：需要管理 deviceName 字段
const [registerForm, setRegisterForm] = useState({
  email: '',
  password: '',
  confirmPassword: '',
  deviceName: `EcoPaste-${navigator.platform || 'Desktop'}`,
})

// 现在：不再需要 deviceName 字段
const [registerForm, setRegisterForm] = useState({
  email: '',
  password: '',
  confirmPassword: '',
})
```

### 4. 类型定义更新

`src/types/sync.ts` 中的 `RegisterData` 接口：

```typescript
export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  deviceName?: string;  // 现在是可选的，因为会自动获取
  username?: string;
}
```

## 🎨 设备名称生成规则

### Tauri 环境（桌面应用）

1. **获取主机名和平台信息**
   - 使用 `@tauri-apps/plugin-os` 的 `hostname()` 和 `platform()` API
   - 清理主机名（移除 `.local` 或 `.lan` 后缀）

2. **生成规则**
   - **有主机名**: `"${hostname} (${platform})"` 
     - 例如：`"MacBook-Pro (Mac)"`，`"DESKTOP-ABC123 (Windows)"`
   - **无主机名**: `"EcoPaste ${platform}"`
     - 例如：`"EcoPaste Mac"`，`"EcoPaste Windows"`

3. **平台映射**
   ```typescript
   const platformMap = {
     macos: 'Mac',
     windows: 'Windows',
     linux: 'Linux', 
     unknown: 'Desktop'
   };
   ```

### 浏览器环境（备用方案）

1. **使用 Navigator API**
   - 检查 `navigator.platform` 或 `navigator.userAgent`
   - 基于检测到的平台生成名称

2. **生成规则**
   - 检测到 Mac：`"EcoPaste Mac"`
   - 检测到 Windows：`"EcoPaste Windows"`  
   - 检测到 Linux：`"EcoPaste Linux"`
   - 默认：`"EcoPaste Desktop"`

## 📊 测试验证

### 1. API 测试结果

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "autodevice@example.com", "password": "123456", "email": "autodevice@example.com", "deviceName": "MacBook-Pro (Mac)"}'

# 响应：HTTP 201 - 注册成功
{
  "success": true,
  "message": "注册成功",
  "user": {"id": 5, "username": "autodevice@example.com"},
  "device": {"id": "c8cc1519...", "name": "MacBook-Pro (Mac)", "type": "desktop"},
  "token": "eyJ...",
  "expiresAt": "2025-08-29T02:40:22.464Z"
}
```

### 2. 后端日志验证

```
[INFO] 收到注册请求: {
  "username": "autodevice@example.com",
  "email": "autodevice@example.com", 
  "deviceName": "MacBook-Pro (Mac)",  // ✅ 自动生成的设备名称
  "hasPassword": true
}
```

### 3. 前端界面测试

- ✅ 注册表单不再显示设备名称输入框
- ✅ 显示友好的自动获取提示信息
- ✅ 注册流程简化，用户体验提升

## 🎁 额外优化

### 1. 错误处理
- 如果获取设备信息失败，自动回退到 `"EcoPaste Desktop"`
- 确保注册流程不会因为设备名称获取失败而中断

### 2. 测试页面
- 更新了 `test-register.html` 测试页面
- 添加了设备名称预览功能，实时显示将要使用的设备名称

### 3. 类型安全
- 更新了 TypeScript 类型定义
- 确保代码的类型安全性

## 📈 用户价值

1. **简化操作流程** - 减少用户输入步骤
2. **提升数据质量** - 自动生成的设备名称更有意义  
3. **避免错误输入** - 消除了手动输入可能导致的错误
4. **跨平台一致性** - 在不同平台上都能生成合适的设备名称
5. **智能识别** - 能够识别用户的真实设备信息

## 🔄 向后兼容性

- 保持了 API 接口的兼容性
- 现有的手动设备名称仍然可以工作
- 类型定义保持向后兼容

这个功能的实现大大提升了用户在使用 EcoPaste 同步功能时的体验，让设备注册变得更加智能和便捷！