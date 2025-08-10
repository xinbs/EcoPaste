// 用户认证相关类型
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  deviceName: string;
  username?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  createdAt: Date;
  lastLoginAt?: Date;
  isVerified: boolean;
}

// 设备管理相关类型
export interface SyncDevice {
  name: string;
  platform: string;
  deviceType: string;
  appVersion: string;
}

export interface Device {
  id: string;
  name: string;
  platform: string;
  deviceType: string;
  appVersion: string;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
  isCurrent: boolean;
}

// 剪贴板数据相关类型
export interface ClipboardPayload {
  items: ClipboardItem[];
  deviceId: string;
  timestamp: Date;
}

export interface ClipboardItem {
  id: string;
  type: 'text' | 'image' | 'file';
  content: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  deviceId: string;
  hash: string;
}

// 同步相关类型
export interface SyncDataRequest {
  items: ClipboardItem[];
  lastSyncTime?: Date;
  deviceId: string;
}

export interface SyncDataResponse {
  success: boolean;
  items: ClipboardItem[];
  conflicts: SyncConflict[];
  lastSyncTime: Date;
  message?: string;
}

export interface SyncConflict {
  id: string;
  localItem: ClipboardItem;
  remoteItem: ClipboardItem;
  type: 'content' | 'timestamp' | 'device';
  createdAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: ConflictResolution;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync: Date | null;
  nextSync: Date | null;
  itemsToSync: number;
  syncProgress: number;
  error: string | null;
}

// 配置相关类型
export interface SyncConfig {
  enabled: boolean;
  autoSync: boolean;
  syncInterval: number; // seconds
  conflictResolution: ConflictResolutionStrategy;
  encryptionEnabled: boolean;
  syncTypes: {
    text: boolean;
    image: boolean;
    file: boolean;
  };
  maxItems: number;
  retentionDays: number;
}

// WebSocket 消息类型
export type WebSocketMessage = 
  | { type: 'sync_update'; data: ClipboardItem[] }
  | { type: 'conflict_detected'; data: SyncConflict }
  | { type: 'device_status_changed'; data: { deviceId: string; isOnline: boolean } }
  | { type: 'sync_status_changed'; data: SyncStatus }
  | { type: 'error'; data: { message: string; code?: string } };

// 加密相关类型
export interface EncryptionKey {
  id: string;
  key: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface EncryptedData {
  data: string;
  nonce: string;
  keyId: string;
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// 事件类型
export interface SyncUpdateEvent {
  type: 'items_added' | 'items_updated' | 'items_deleted' | 'conflict_detected';
  items: ClipboardItem[];
  conflicts?: SyncConflict[];
}

// 统计类型
export interface SyncStats {
  totalSynced: number;
  syncedToday: number;
  conflictsResolved: number;
  lastSyncDuration: number; // milliseconds
}

// 冲突解决相关类型
export type ConflictResolutionStrategy = 'manual' | 'latest' | 'local' | 'remote' | 'merge';

export interface ConflictResolution {
  strategy: ConflictResolutionStrategy;
  selectedItem?: ClipboardItem;
  mergedContent?: string;
  note?: string;
}

// 连接状态类型
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

// 同步模式类型
export type SyncMode = 'manual' | 'auto' | 'realtime';

// 数据类型过滤
export interface DataTypeFilter {
  text: boolean;
  image: boolean;
  file: boolean;
  url: boolean;
  code: boolean;
}

// 设备过滤
export interface DeviceFilter {
  includeDevices: string[];
  excludeDevices: string[];
}

// 时间范围过滤
export interface TimeRangeFilter {
  startTime?: Date;
  endTime?: Date;
  lastNDays?: number;
}

// 同步选项
export interface SyncOptions {
  force?: boolean;
  dataTypes?: DataTypeFilter;
  devices?: DeviceFilter;
  timeRange?: TimeRangeFilter;
  batchSize?: number;
}

// 错误类型
export interface SyncError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
}

// 网络状态
export interface NetworkStatus {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  bandwidth?: number; // Mbps
  latency?: number; // ms
}

// 备份相关类型
export interface BackupInfo {
  id: string;
  createdAt: Date;
  size: number; // bytes
  itemCount: number;
  deviceId: string;
  encrypted: boolean;
}

export interface RestoreOptions {
  backupId: string;
  overwriteExisting: boolean;
  selectiveRestore?: {
    dataTypes: DataTypeFilter;
    timeRange: TimeRangeFilter;
  };
}

// 权限相关类型
export interface SyncPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canManageDevices: boolean;
  canResolveConflicts: boolean;
}

// 配额相关类型
export interface SyncQuota {
  maxItems: number;
  maxStorage: number; // bytes
  maxDevices: number;
  usedItems: number;
  usedStorage: number;
  usedDevices: number;
}

// 审计日志类型
export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  deviceId: string;
  timestamp: Date;
  details: Record<string, any>;
  ipAddress?: string;
}