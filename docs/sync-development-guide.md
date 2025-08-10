# EcoPaste 同步功能开发指导

## 概述

EcoPaste 同步功能是一个完整的跨设备剪贴板同步解决方案，支持实时同步、冲突解决、端到端加密等功能。

## 架构设计

### 后端架构 (Rust)

#### 核心模块

1. **插件入口** (`src/plugins/sync/src/lib.rs`)
   - 定义插件模块结构
   - 注册 Tauri 命令
   - 初始化桌面和移动端实现

2. **数据模型** (`src/plugins/sync/src/models.rs`)
   - 用户认证模型：`LoginCredentials`, `RegisterData`, `AuthResponse`, `User`
   - 设备管理模型：`SyncDevice`, `Device`
   - 剪贴板数据模型：`ClipboardPayload`, `ClipboardItem`
   - 同步模型：`SyncDataRequest`, `SyncDataResponse`, `SyncConflict`, `SyncStatus`
   - 配置模型：`SyncConfig`
   - WebSocket 消息模型：`WebSocketMessage`
   - 加密模型：`EncryptionKey`, `EncryptedData`
   - API 响应模型：`ApiResponse`, `PaginatedResponse`

3. **错误处理** (`src/plugins/sync/src/error.rs`)
   - 统一错误类型定义
   - 错误转换实现
   - Tauri 命令错误序列化

4. **命令处理** (`src/plugins/sync/src/commands.rs`)
   - 用户认证命令：登录、注册、登出、状态检查
   - 设备管理命令：注册、获取、移除、更新设备
   - 数据同步命令：同步数据、拉取更新、强制同步
   - 冲突解决命令：解决冲突、获取冲突列表
   - 配置管理命令：更新、获取配置
   - 服务管理命令：启动/停止服务、测试连接

#### 功能模块

1. **用户认证** (`src/plugins/sync/src/auth.rs`)
   - JWT token 管理
   - 用户登录/注册
   - 认证状态维护
   - 本地存储集成

2. **设备管理** (`src/plugins/sync/src/device.rs`)
   - 设备注册和识别
   - 设备信息管理
   - 设备指纹生成
   - 云端设备同步

3. **同步引擎** (`src/plugins/sync/src/sync_engine.rs`)
   - 核心同步逻辑
   - 周期性同步任务
   - 同步队列管理
   - 状态跟踪

4. **WebSocket 客户端** (`src/plugins/sync/src/websocket.rs`)
   - 实时连接管理
   - 自动重连机制
   - 消息处理和分发
   - 事件通知

5. **加密管理** (`src/plugins/sync/src/encryption.rs`)
   - AES-256-GCM 加密
   - 密钥管理和轮换
   - 数据完整性验证
   - 端到端加密

6. **冲突解决** (`src/plugins/sync/src/conflict_resolver.rs`)
   - 冲突检测算法
   - 自动解决策略
   - 手动解决支持
   - 冲突历史记录

7. **本地存储** (`src/plugins/sync/src/storage.rs`)
   - SQLite 数据库管理
   - 配置持久化
   - 缓存管理
   - 数据迁移

### 前端架构 (React + TypeScript)

#### 核心组件

1. **同步设置界面** (`src/components/SyncSettings/index.tsx`)
   - 用户账户管理
   - 同步配置选项
   - 设备管理界面
   - 冲突解决设置

2. **同步状态指示器** (`src/components/SyncStatus/index.tsx`)
   - 实时状态显示
   - 同步进度展示
   - 错误状态提示
   - 手动操作按钮

#### 状态管理

1. **同步状态存储** (`src/stores/sync.ts`)
   - 用户认证状态
   - 同步配置
   - 设备列表
   - 冲突列表
   - 同步状态

2. **插件接口** (`src/plugins/sync.ts`)
   - Tauri 命令封装
   - 事件监听
   - 错误处理
   - 类型安全

## 技术特性

### 安全性

1. **端到端加密**
   - AES-256-GCM 算法
   - 客户端密钥生成
   - 密钥轮换机制

2. **身份认证**
   - JWT token 认证
   - 设备指纹验证
   - 多设备管理

3. **数据完整性**
   - SHA-256 哈希验证
   - 数据签名校验
   - 传输加密

### 可靠性

1. **冲突解决**
   - 自动冲突检测
   - 多种解决策略
   - 手动解决支持

2. **错误恢复**
   - 自动重试机制
   - 网络断线重连
   - 数据一致性保证

3. **本地缓存**
   - 离线数据访问
   - 增量同步
   - 数据备份

### 性能优化

1. **增量同步**
   - 只同步变更数据
   - 压缩传输
   - 批量操作

2. **实时通信**
   - WebSocket 连接
   - 事件驱动更新
   - 低延迟同步

3. **资源管理**
   - 连接池管理
   - 内存优化
   - 异步处理

## API 设计

### 后端 API 端点

```
POST /auth/login          # 用户登录
POST /auth/register       # 用户注册
POST /auth/logout         # 用户登出
GET  /auth/me             # 获取用户信息

POST /devices             # 注册设备
GET  /devices             # 获取设备列表
DELETE /devices/:id       # 删除设备
PUT  /devices/:id         # 更新设备

POST /sync/data           # 同步数据
GET  /sync/updates        # 获取更新
POST /sync/resolve        # 解决冲突
GET  /sync/status         # 获取状态

WebSocket /ws             # 实时通信
```

### 前端 Tauri 命令

```typescript
// 认证相关
login(credentials: LoginCredentials): Promise<AuthResponse>
register(data: RegisterData): Promise<AuthResponse>
logout(): Promise<void>
checkAuthStatus(): Promise<boolean>

// 设备管理
registerDevice(device: SyncDevice): Promise<Device>
getDevices(): Promise<Device[]>
removeDevice(deviceId: string): Promise<void>
updateDevice(deviceId: string, updates: Partial<Device>): Promise<Device>

// 数据同步
syncData(request: SyncDataRequest): Promise<SyncDataResponse>
pullUpdates(): Promise<ClipboardItem[]>
forceSyncAll(): Promise<void>
getSyncStatus(): Promise<SyncStatus>

// 冲突解决
resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void>
getPendingConflicts(): Promise<SyncConflict[]>

// 配置管理
updateConfig(config: Partial<SyncConfig>): Promise<void>
getConfig(): Promise<SyncConfig>

// 服务管理
startSyncService(): Promise<void>
stopSyncService(): Promise<void>
testConnection(): Promise<boolean>
```

## 开发流程

### 1. 环境准备

```bash
# 安装 Rust 依赖
cd src-tauri/src/plugins/sync
cargo build

# 安装前端依赖
npm install
```

### 2. 开发步骤

1. **后端开发**
   - 实现核心模块
   - 编写单元测试
   - 集成测试

2. **前端开发**
   - 创建 UI 组件
   - 实现状态管理
   - 集成后端 API

3. **集成测试**
   - 端到端测试
   - 性能测试
   - 安全测试

### 3. 部署配置

1. **服务器配置**
   - API 服务器部署
   - WebSocket 服务配置
   - 数据库设置

2. **客户端配置**
   - 服务器地址配置
   - 加密密钥管理
   - 本地存储设置

## 测试策略

### 单元测试

- 每个模块独立测试
- 模拟外部依赖
- 覆盖率要求 > 80%

### 集成测试

- 模块间交互测试
- API 接口测试
- 数据库操作测试

### 端到端测试

- 完整同步流程测试
- 多设备同步测试
- 冲突解决测试

### 性能测试

- 大数据量同步测试
- 并发用户测试
- 网络延迟测试

## 部署指南

### 开发环境

1. 启动本地 API 服务器
2. 配置开发数据库
3. 启动前端开发服务器

### 生产环境

1. 部署 API 服务器到云平台
2. 配置生产数据库
3. 设置 CDN 和负载均衡
4. 配置监控和日志

## 维护指南

### 监控指标

- 同步成功率
- 响应时间
- 错误率
- 用户活跃度

### 故障排查

- 日志分析
- 性能分析
- 错误追踪
- 用户反馈

### 版本升级

- 数据库迁移
- API 版本兼容
- 客户端更新
- 回滚策略

## 安全考虑

### 数据保护

- 端到端加密
- 传输层安全
- 访问控制
- 数据脱敏

### 隐私保护

- 最小化数据收集
- 用户同意机制
- 数据删除权
- 透明度报告

### 合规要求

- GDPR 合规
- 数据本地化
- 审计日志
- 安全认证

## 扩展计划

### 功能扩展

- 文件同步支持
- 团队协作功能
- 高级搜索
- 数据分析

### 平台扩展

- Web 版本
- 浏览器插件
- 移动应用
- API 开放平台

### 性能优化

- 分布式架构
- 缓存优化
- 数据库分片
- CDN 加速

## 今日修复记录（2025-08-10）

- 修复：登录后界面不跳转
  - 在登录成功回调中直接更新登录态与账户信息，移除 setTimeout 延迟，避免渲染时序问题
  - 位置：src/components/SyncSettings/index.tsx

- 修复：未登录时请求受保护接口导致 401
  - 在同步状态初始化逻辑中增加本地 token/登录态校验，未登录时不调用受保护接口，避免触发 401 并清空 token 的连锁影响
  - 位置：src/components/SyncStatus/index.tsx

- 修复：/api/sync/status 接口 SQLITE_ERROR
  - 对齐 devices 表字段名：last_active → last_seen；is_online → is_active
  - 移除对不存在的 sync_conflicts 表的统计，临时返回 0（后续若启用冲突功能再补表与接口）
  - 位置：server/src/routes/sync.js；数据库结构参考：server/src/database/init.js

- 开发环境处理
  - 使用 stop-dev.bat 释放 3001（后端）/1420（前端）端口
  - 重启命令：后端 npm --prefix server run dev；前端 pnpm dev:vite

- 已知注意事项
  - 纯浏览器环境访问前端时，Tauri API（如 getCurrentWindow、listen、invoke）相关 TypeError 属预期现象，不影响本次后端修复验证；如需浏览器开发体验，可在相关 hooks/工具函数添加环境守卫或提供 Mock

- 后续计划
  - 若需要启用冲突功能：
    - 在 SQLite 初始化中新增 sync_conflicts 表定义（含 resolved、resolution、created_at/resolved_at 等字段）
    - 在 /api/sync/status 恢复冲突统计，并补充冲突查询/解决路由；前端同步完善冲突列表与解决交互