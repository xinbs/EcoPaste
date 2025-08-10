# EcoPaste 项目技术架构分析与AI开发指导

## 项目概述
EcoPaste 是一款开源的跨平台剪贴板管理工具，采用现代化的技术栈构建，具有优秀的架构设计和用户体验。

## 核心技术架构

### 前端技术栈
- **框架**: React 18 + TypeScript
- **构建工具**: Vite (开发服务器端口: 1420)
- **UI组件库**: Ant Design 5.24.7 + Happy Work Theme
- **CSS框架**: UnoCSS (原子化CSS)
- **状态管理**: Valtio (轻量级状态管理)
- **路由**: React Router DOM (Hash路由)
- **国际化**: i18next + react-i18next
- **工具库**: 
  - ahooks (React Hooks工具库)
  - lodash-es (工具函数)
  - dayjs (日期处理)
  - clsx (类名处理)

### 后端技术栈
- **框架**: Tauri 2.0 (Rust + Web技术)
- **语言**: Rust (Edition 2021)
- **数据库**: SQLite (通过tauri-plugin-sql)
- **系统集成**: 多个Tauri插件提供系统级功能

### 开发工具链
- **包管理**: pnpm
- **代码规范**: Biome (代替ESLint + Prettier)
- **Git Hooks**: simple-git-hooks
- **发布工具**: release-it
- **自动导入**: unplugin-auto-import

## 架构设计特点

### 1. 双窗口架构
- **主窗口** (main): 360x600，剪贴板管理界面
- **设置窗口** (preference): 700x480，应用配置界面
- 两个窗口独立运行，通过事件通信

### 2. 插件化架构
项目采用高度模块化的插件系统：
- **tauri-plugin-eco-window**: 窗口管理
- **tauri-plugin-eco-clipboard**: 剪贴板监听
- **tauri-plugin-eco-ocr**: OCR文字识别
- **tauri-plugin-eco-paste**: 粘贴功能
- **tauri-plugin-eco-autostart**: 自启动管理

### 3. 状态管理架构
- **globalStore**: 全局应用设置（主题、语言、快捷键等）
- **clipboardStore**: 剪贴板相关配置
- 使用Valtio实现响应式状态管理
- 状态持久化到本地存储

### 4. 数据库设计
- 使用SQLite存储剪贴板历史
- 主要表结构：history表存储剪贴板条目
- 支持文本、图片等多种类型数据
- 包含收藏、搜索、分组等功能

## 项目结构详解

### 前端目录结构
```
src/
├── App.tsx                 # 应用入口组件
├── main.tsx                # React应用挂载点
├── components/             # 可复用组件
│   ├── AdaptiveSelect/     # 自适应选择器
│   ├── Audio/              # 音频组件
│   ├── ProList/            # 专业列表组件
│   ├── ProListItem/        # 列表项组件
│   ├── ProSelect/          # 专业选择器
│   ├── ProShortcut/        # 快捷键组件
│   ├── ProSwitch/          # 专业开关
│   ├── Scrollbar/          # 滚动条组件
│   ├── UnoIcon/            # 图标组件
│   └── UpdateApp/          # 应用更新组件
├── pages/                  # 页面组件
│   ├── Main/               # 主界面
│   └── Preference/         # 设置界面
├── stores/                 # 状态管理
│   ├── clipboard.ts        # 剪贴板状态
│   └── global.ts           # 全局状态
├── database/               # 数据库操作
├── hooks/                  # 自定义Hooks
├── plugins/                # Tauri插件封装
├── utils/                  # 工具函数
├── types/                  # TypeScript类型定义
└── locales/                # 国际化文件
```

### 后端目录结构
```
src-tauri/
├── src/
│   ├── main.rs             # Rust应用入口
│   ├── lib.rs              # 库文件
│   ├── core/               # 核心功能
│   └── plugins/            # 自定义插件
│       ├── autostart/      # 自启动插件
│       ├── clipboard/      # 剪贴板插件
│       ├── ocr/            # OCR插件
│       ├── paste/          # 粘贴插件
│       └── window/         # 窗口管理插件
├── Cargo.toml              # Rust项目配置
├── tauri.conf.json         # Tauri配置文件
└── capabilities/           # 权限配置
```

## AI开发指导

### 开发环境搭建

#### 前置要求
- Node.js 18+
- Rust 1.70+
- pnpm 8+

#### 安装步骤
```bash
# 克隆项目
git clone <repository-url>
cd EcoPaste

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建应用
pnpm build

# 代码检查
pnpm lint
```

### 核心开发原则

1. **类型安全**: 项目使用严格的TypeScript配置，确保类型安全
2. **组件化**: UI组件高度模块化，遵循单一职责原则
3. **国际化**: 支持中文、英文、日文、繁体中文四种语言
4. **响应式设计**: 使用UnoCSS实现现代化UI
5. **性能优化**: 使用虚拟滚动、懒加载等技术
6. **安全性**: 遵循Tauri安全最佳实践

### 关键文件说明

#### 配置文件
- `package.json`: 前端依赖和脚本配置
- `Cargo.toml`: Rust依赖配置
- `vite.config.ts`: Vite构建配置
- `tauri.conf.json`: Tauri应用配置
- `uno.config.ts`: UnoCSS配置
- `tsconfig.json`: TypeScript配置
- `biome.json`: 代码规范配置

#### 核心源码
- `src/App.tsx`: 应用入口，配置主题和路由
- `src/main.tsx`: React应用挂载点
- `src-tauri/src/lib.rs`: Rust后端入口
- `src-tauri/src/main.rs`: Rust应用主函数

### 功能模块开发指南

#### 1. 新增UI组件
```typescript
// 在 src/components/ 目录下创建新组件
// 例如：src/components/MyComponent/index.tsx

import { FC } from 'react';
import { Button } from 'antd';

interface MyComponentProps {
  title: string;
  onClick?: () => void;
}

const MyComponent: FC<MyComponentProps> = ({ title, onClick }) => {
  return (
    <Button onClick={onClick}>
      {title}
    </Button>
  );
};

export default MyComponent;
```

#### 2. 状态管理
```typescript
// 在 src/stores/ 中定义新的store
import { proxy } from 'valtio';

export const myStore = proxy({
  count: 0,
  increment: () => {
    myStore.count++;
  },
});
```

#### 3. 数据库操作
```typescript
// 使用 src/database/index.tsx 中的API
import { insertSQL, selectSQL } from '@/database';

// 插入数据
await insertSQL('history', {
  id: nanoid(),
  type: 'text',
  value: 'Hello World',
  createTime: new Date().toISOString(),
});

// 查询数据
const results = await selectSQL('history', { type: 'text' });
```

#### 4. 系统集成
```typescript
// 在 src/plugins/ 中封装Tauri插件调用
import { invoke } from '@tauri-apps/api/core';

export const mySystemFunction = async (params: any) => {
  return await invoke('my_system_function', { params });
};
```

#### 5. 国际化
```json
// 在 src/locales/ 中添加翻译文件
// zh-CN.json
{
  "myFeature": {
    "title": "我的功能",
    "description": "这是一个新功能"
  }
}

// en-US.json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This is a new feature"
  }
}
```

### 自定义Tauri插件开发

#### 创建新插件
```bash
# 在 src-tauri/src/plugins/ 目录下创建新插件
mkdir src-tauri/src/plugins/my-plugin
cd src-tauri/src/plugins/my-plugin
```

#### 插件结构
```
my-plugin/
├── Cargo.toml              # 插件依赖配置
├── build.rs                # 构建脚本
├── permissions/            # 权限配置
│   └── default.toml
└── src/
    ├── lib.rs              # 插件入口
    ├── commands.rs         # 命令定义
    └── error.rs            # 错误处理
```

### 构建和发布

#### 本地构建
```bash
# 开发构建
pnpm tauri dev

# 生产构建
pnpm tauri build
```

#### 多平台支持
项目支持以下平台构建：
- **Windows**: .exe安装包
- **macOS**: .dmg安装包  
- **Linux**: AppImage、deb包

#### CI/CD流程
项目使用GitHub Actions实现自动化构建和发布：
- `beta_build.yml`: Beta版本构建
- `release.yml`: 正式版本发布
- `pull_request.yml`: PR检查
- `aur-publish-*.yaml`: AUR包发布

### 性能优化建议

1. **虚拟滚动**: 使用`@tanstack/react-virtual`处理大量数据
2. **懒加载**: 组件和路由按需加载
3. **状态优化**: 合理使用Valtio的响应式特性
4. **内存管理**: 及时清理事件监听器和定时器
5. **打包优化**: 利用Vite的代码分割功能

### 调试和测试

#### 开发调试
```bash
# 启用详细日志
RUST_LOG=debug pnpm tauri dev

# 前端调试
pnpm dev:vite
```

#### 日志系统
项目集成了完整的日志系统：
- 前端：使用Tauri日志插件
- 后端：使用Rust log crate
- 输出：控制台、文件、WebView

### 安全考虑

1. **权限控制**: 严格控制Tauri插件权限
2. **数据验证**: 前后端数据验证
3. **安全更新**: 使用Tauri更新插件
4. **敏感信息**: 避免在日志中输出敏感数据

### 最佳实践建议

1. **代码风格**: 使用Biome进行代码格式化和检查
2. **类型安全**: 充分利用TypeScript的类型系统
3. **错误处理**: 实现完善的错误处理机制
4. **文档维护**: 及时更新代码注释和文档
5. **版本管理**: 遵循语义化版本规范
6. **测试覆盖**: 编写单元测试和集成测试

### 常见问题解决

#### 构建问题
- 确保Rust和Node.js版本符合要求
- 清理缓存：`pnpm clean && cargo clean`
- 重新安装依赖：`pnpm install`

#### 开发问题
- 热重载失效：检查Vite配置
- 类型错误：更新类型定义文件
- 插件调用失败：检查权限配置

## 云端多终端同步功能设计

### 功能概述

EcoPaste云同步功能旨在实现跨设备的剪贴板数据同步，让用户在多个设备间无缝共享剪贴板内容。

### 核心功能设计

#### 1. 数据同步功能
- **全类型支持**: 文本、图片、文件、富文本等所有剪贴板数据类型
- **实时同步**: WebSocket实时推送，实现秒级数据同步
- **离线支持**: 本地缓存机制，网络恢复后自动同步
- **增量同步**: 基于版本控制的增量数据传输
- **冲突解决**: 智能冲突检测和解决策略

#### 2. 设备管理
- **多设备注册**: 支持用户注册多个设备
- **设备状态监控**: 实时显示设备在线状态
- **选择性同步**: 用户可选择同步的设备和数据类型
- **设备标识**: 每个数据项显示来源设备信息

#### 3. 用户体验功能
- **同步状态指示**: 实时显示同步进度和状态
- **隐私模式**: 敏感数据可选择不参与同步
- **带宽控制**: 图片压缩、流量控制等优化
- **同步历史**: 查看同步记录和操作历史

### 技术架构设计

#### 前端架构扩展

##### 新增状态管理
```typescript
// src/stores/sync.ts
export const syncStore = proxy<SyncStore>({
  account: {
    isLoggedIn: false,
    userId: '',
    email: '',
    devices: [],
  },
  sync: {
    enabled: true,
    autoSync: true,
    syncTypes: ['text', 'image', 'files'],
    excludeDevices: [],
    lastSyncTime: null,
    status: 'idle', // idle, syncing, error
  },
  conflicts: [],
  bandwidth: {
    imageCompression: true,
    maxImageSize: 5, // MB
    syncOnWifi: false,
  }
});
```

##### 同步插件接口
```typescript
// src/plugins/sync.ts
export const syncPlugin = {
  // 用户认证
  login: (email: string, password: string) => invoke('plugin:eco-sync|login'),
  logout: () => invoke('plugin:eco-sync|logout'),
  
  // 设备管理
  registerDevice: (deviceName: string) => invoke('plugin:eco-sync|register_device'),
  getDevices: () => invoke('plugin:eco-sync|get_devices'),
  
  // 数据同步
  syncData: (data: ClipboardPayload) => invoke('plugin:eco-sync|sync_data'),
  pullUpdates: () => invoke('plugin:eco-sync|pull_updates'),
  
  // 实时监听
  onSyncUpdate: (callback) => listen('sync-update', callback),
  onConflict: (callback) => listen('sync-conflict', callback),
};
```

#### 后端Rust插件设计

##### 插件目录结构
```
src-tauri/src/plugins/sync/
├── Cargo.toml
├── src/
│   ├── lib.rs              # 插件入口
│   ├── auth.rs             # 用户认证
│   ├── device.rs           # 设备管理
│   ├── sync_engine.rs      # 同步引擎
│   ├── conflict_resolver.rs # 冲突解决
│   ├── websocket.rs        # WebSocket客户端
│   ├── encryption.rs       # 数据加密
│   └── storage.rs          # 本地缓存
```

##### 核心同步引擎
```rust
// sync_engine.rs
pub struct SyncEngine {
    client: HttpClient,
    websocket: Option<WebSocketClient>,
    encryption: EncryptionManager,
    local_storage: LocalStorage,
}

impl SyncEngine {
    pub async fn sync_clipboard_item(&self, item: ClipboardItem) -> Result<()> {
        // 1. 数据加密
        let encrypted_item = self.encryption.encrypt(&item)?;
        
        // 2. 上传到云端
        let response = self.client.post("/api/clipboard", encrypted_item).await?;
        
        // 3. 更新本地同步状态
        self.local_storage.update_sync_status(&item.id, SyncStatus::Synced)?;
        
        // 4. 通知前端
        self.emit_sync_event(SyncEvent::ItemSynced { item_id: item.id })?;
        
        Ok(())
    }
}
```

#### 云端服务架构

##### 技术栈
- **后端框架**: Node.js + Express / Rust + Axum
- **数据库**: PostgreSQL (主数据) + Redis (缓存)
- **文件存储**: AWS S3 / 阿里云OSS
- **实时通信**: WebSocket
- **消息队列**: Redis Pub/Sub

##### API设计
```typescript
// RESTful API
POST   /api/auth/login          # 用户登录
POST   /api/auth/register       # 用户注册
POST   /api/devices             # 注册设备
GET    /api/devices             # 获取设备列表
POST   /api/clipboard           # 上传剪贴板数据
GET    /api/clipboard           # 获取剪贴板数据
PUT    /api/clipboard/:id       # 更新剪贴板数据
DELETE /api/clipboard/:id       # 删除剪贴板数据
GET    /api/sync/status         # 获取同步状态
POST   /api/sync/resolve        # 解决冲突
```

##### 数据库设计
```sql
-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 设备表
CREATE TABLE devices (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    platform VARCHAR(50),
    last_active TIMESTAMP,
    is_online BOOLEAN DEFAULT false
);

-- 剪贴板数据表
CREATE TABLE clipboard_items (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    device_id UUID REFERENCES devices(id),
    type VARCHAR(20) NOT NULL,
    content_hash VARCHAR(64),
    encrypted_data BYTEA,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
```

### 数据同步策略

#### 同步时机
- **实时同步**: 剪贴板数据变化时立即同步
- **定时同步**: 每5分钟检查远程更新
- **启动同步**: 应用启动时拉取最新数据
- **网络恢复同步**: 连接恢复后自动同步

#### 冲突解决
```typescript
interface ConflictResolution {
  strategy: 'timestamp' | 'user_choice' | 'merge';
  rules: {
    timestamp: 'latest_wins' | 'first_wins';
    user_choice: boolean;
    merge: boolean;
  };
}
```

#### 安全设计
- **端到端加密**: AES-256-GCM加密
- **JWT认证**: 无状态身份验证
- **设备指纹**: 防止设备伪造
- **隐私保护**: 敏感数据过滤

### 实施计划

#### Phase 1: 基础架构 (4周)
1. 云端服务搭建
2. 用户认证系统
3. 基础API开发
4. 数据库设计实现

#### Phase 2: 核心同步 (6周)
1. Rust同步插件开发
2. 前端同步界面
3. 基础数据同步
4. 冲突解决机制

#### Phase 3: 高级功能 (4周)
1. 实时推送
2. 离线支持
3. 数据加密
4. 性能优化

#### Phase 4: 测试优化 (2周)
1. 功能测试
2. 性能测试
3. 安全测试
4. 用户体验优化

## 总结

EcoPaste项目展现了现代桌面应用开发的最佳实践，结合了Web技术的灵活性和原生应用的性能优势。通过Tauri框架，实现了跨平台的高性能桌面应用，同时保持了良好的开发体验和代码可维护性。

云端多终端同步功能的加入将进一步提升EcoPaste的实用性，为用户提供跨设备的无缝剪贴板体验。该功能采用现代化的技术架构，注重安全性和用户体验，将成为EcoPaste的重要特色功能。

对于AI开发者来说，这个项目提供了一个优秀的学习和参考案例，涵盖了现代前端技术栈、Rust系统编程、跨平台开发、云服务集成等多个技术领域。通过深入理解其架构设计和实现细节，可以为类似项目的开发提供有价值的指导。