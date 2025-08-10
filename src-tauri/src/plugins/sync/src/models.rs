use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ==================== 用户认证相关 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginCredentials {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterData {
    pub email: String,
    pub password: String,
    pub device_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub user_id: Option<String>,
    pub token: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub created_at: DateTime<Utc>,
}

// ==================== 设备管理相关 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncDevice {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub is_online: bool,
    pub last_active: String,
    pub is_current: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub platform: String,
    pub device_fingerprint: String,
    pub last_active: DateTime<Utc>,
    pub is_online: bool,
    pub created_at: DateTime<Utc>,
}

// ==================== 剪贴板数据相关 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardPayload {
    pub r#type: String,
    pub group: Option<String>,
    pub subtype: Option<String>,
    pub count: i32,
    pub value: String,
    pub search: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItem {
    pub id: Uuid,
    pub user_id: Uuid,
    pub device_id: Uuid,
    pub r#type: String,
    pub content_hash: String,
    pub encrypted_data: Vec<u8>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

// ==================== 同步相关 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncDataRequest {
    pub data: ClipboardPayload,
    pub device_id: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncDataResponse {
    pub success: bool,
    pub sync_id: Option<String>,
    pub conflicts: Option<Vec<SyncConflict>>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConflict {
    pub id: String,
    pub local_item: serde_json::Value,
    pub remote_item: serde_json::Value,
    pub timestamp: String,
    pub resolved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub status: String,
    pub last_sync_time: Option<String>,
    pub pending_items: i32,
    pub sync_errors: i32,
    pub total_synced: i32,
}

// ==================== 配置相关 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub enabled: bool,
    pub auto_sync: bool,
    pub sync_types: Vec<String>,
    pub exclude_devices: Vec<String>,
    pub image_compression: bool,
    pub max_image_size: i32, // MB
    pub sync_on_wifi: bool,
    pub compression_quality: i32, // 0-100
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            auto_sync: true,
            sync_types: vec!["text".to_string(), "image".to_string(), "files".to_string()],
            exclude_devices: vec![],
            image_compression: true,
            max_image_size: 5,
            sync_on_wifi: false,
            compression_quality: 80,
        }
    }
}

// ==================== WebSocket 消息 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketMessage {
    #[serde(rename = "auth")]
    Auth { token: String },
    
    #[serde(rename = "ping")]
    Ping,
    
    #[serde(rename = "pong")]
    Pong,
    
    #[serde(rename = "data_update")]
    DataUpdate {
        item_id: String,
        device_id: String,
        timestamp: i64,
    },
    
    #[serde(rename = "device_status")]
    DeviceStatus {
        device_id: String,
        is_online: bool,
    },
    
    #[serde(rename = "conflict")]
    Conflict {
        conflict_id: String,
        local_item: serde_json::Value,
        remote_item: serde_json::Value,
    },
    
    #[serde(rename = "sync_complete")]
    SyncComplete {
        sync_id: String,
        items_count: i32,
    },
    
    #[serde(rename = "error")]
    Error {
        message: String,
        code: Option<i32>,
    },
}

// ==================== 加密相关 ====================

#[derive(Debug, Clone)]
pub struct EncryptionKey {
    pub key: [u8; 32],
    pub nonce: [u8; 12],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    pub data: Vec<u8>,
    pub nonce: Vec<u8>,
    pub tag: Vec<u8>,
}

// ==================== API 响应 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: Option<String>,
    pub error_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: i32,
    pub page: i32,
    pub per_page: i32,
    pub has_more: bool,
}

// ==================== 事件相关 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncUpdateEvent {
    pub r#type: String, // "data_updated", "device_online", "device_offline", "conflict_detected"
    pub data: serde_json::Value,
    pub timestamp: i64,
}

// ==================== 统计相关 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStats {
    pub total_synced: i32,
    pub last_sync_duration: i32, // milliseconds
    pub sync_errors: i32,
    pub data_usage: i64, // bytes
    pub conflicts_resolved: i32,
}

impl Default for SyncStats {
    fn default() -> Self {
        Self {
            total_synced: 0,
            last_sync_duration: 0,
            sync_errors: 0,
            data_usage: 0,
            conflicts_resolved: 0,
        }
    }
}