use std::path::{Path, PathBuf};
use tokio::fs;
use serde_json::Value;
use sqlx::{SqlitePool, Row};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{
    models::*,
    Result, Error,
};

#[derive(Clone)]
pub struct LocalStorage {
    data_dir: PathBuf,
    db_pool: Option<SqlitePool>,
}

impl LocalStorage {
    pub fn new(data_dir: PathBuf) -> Result<Self> {
        // 确保数据目录存在
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| Error::IoError(format!("Failed to create data directory: {}", e)))?;
        
        Ok(Self {
            data_dir,
            db_pool: None,
        })
    }

    pub async fn initialize_database(&mut self) -> Result<()> {
        let db_path = self.data_dir.join("sync.db");
        let db_url = format!("sqlite:{}", db_path.to_string_lossy());
        
        let pool = SqlitePool::connect(&db_url).await
            .map_err(|e| Error::DatabaseError(format!("Failed to connect to database: {}", e)))?;
        
        // 创建必要的表
        self.create_tables(&pool).await?;
        
        self.db_pool = Some(pool);
        Ok(())
    }

    async fn create_tables(&self, pool: &SqlitePool) -> Result<()> {
        // 创建同步配置表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS sync_config (
                id INTEGER PRIMARY KEY,
                config_data TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#
        )
        .execute(pool)
        .await?;

        // 创建认证信息表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS auth_data (
                id INTEGER PRIMARY KEY,
                token TEXT,
                user_id TEXT,
                device_id TEXT,
                expires_at DATETIME,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#
        )
        .execute(pool)
        .await?;

        // 创建同步状态表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS sync_status (
                id INTEGER PRIMARY KEY,
                last_sync_time DATETIME,
                pending_items INTEGER DEFAULT 0,
                sync_errors INTEGER DEFAULT 0,
                total_synced INTEGER DEFAULT 0,
                data_usage INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#
        )
        .execute(pool)
        .await?;

        // 创建冲突记录表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS sync_conflicts (
                id TEXT PRIMARY KEY,
                local_item TEXT NOT NULL,
                remote_item TEXT NOT NULL,
                conflict_type TEXT NOT NULL,
                resolved BOOLEAN DEFAULT FALSE,
                resolution TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME
            )
            "#
        )
        .execute(pool)
        .await?;

        // 创建本地缓存表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS local_cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    // ==================== 认证相关存储 ====================

    pub async fn save_auth_token(&self, token: &str) -> Result<()> {
        let pool = self.get_pool()?;
        
        sqlx::query(
            "INSERT OR REPLACE INTO auth_data (id, token, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)"
        )
        .bind(token)
        .execute(pool)
        .await?;
        
        Ok(())
    }

    pub async fn load_auth_token(&self) -> Result<String> {
        let pool = self.get_pool()?;
        
        let row = sqlx::query("SELECT token FROM auth_data WHERE id = 1")
            .fetch_optional(pool)
            .await?;
        
        if let Some(row) = row {
            let token: String = row.get("token");
            Ok(token)
        } else {
            Err(Error::DatabaseError("No auth token found".to_string()))
        }
    }

    pub async fn save_user_id(&self, user_id: &str) -> Result<()> {
        let pool = self.get_pool()?;
        
        sqlx::query(
            "INSERT OR REPLACE INTO auth_data (id, user_id, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET user_id = ?, updated_at = CURRENT_TIMESTAMP"
        )
        .bind(user_id)
        .bind(user_id)
        .execute(pool)
        .await?;
        
        Ok(())
    }

    pub async fn load_user_id(&self) -> Result<String> {
        let pool = self.get_pool()?;
        
        let row = sqlx::query("SELECT user_id FROM auth_data WHERE id = 1")
            .fetch_optional(pool)
            .await?;
        
        if let Some(row) = row {
            let user_id: String = row.get("user_id");
            Ok(user_id)
        } else {
            Err(Error::DatabaseError("No user ID found".to_string()))
        }
    }

    pub async fn save_device_id(&self, device_id: &str) -> Result<()> {
        let pool = self.get_pool()?;
        
        sqlx::query(
            "INSERT OR REPLACE INTO auth_data (id, device_id, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET device_id = ?, updated_at = CURRENT_TIMESTAMP"
        )
        .bind(device_id)
        .bind(device_id)
        .execute(pool)
        .await?;
        
        Ok(())
    }

    pub async fn load_device_id(&self) -> Result<String> {
        let pool = self.get_pool()?;
        
        let row = sqlx::query("SELECT device_id FROM auth_data WHERE id = 1")
            .fetch_optional(pool)
            .await?;
        
        if let Some(row) = row {
            let device_id: String = row.get("device_id");
            Ok(device_id)
        } else {
            Err(Error::DatabaseError("No device ID found".to_string()))
        }
    }

    pub async fn clear_auth_data(&self) -> Result<()> {
        let pool = self.get_pool()?;
        
        sqlx::query("DELETE FROM auth_data")
            .execute(pool)
            .await?;
        
        Ok(())
    }

    pub async fn clear_device_id(&self) -> Result<()> {
        let pool = self.get_pool()?;
        
        sqlx::query("UPDATE auth_data SET device_id = NULL WHERE id = 1")
            .execute(pool)
            .await?;
        
        Ok(())
    }

    // ==================== 配置相关存储 ====================

    pub async fn save_sync_config(&self, config: &SyncConfig) -> Result<()> {
        let pool = self.get_pool()?;
        let config_json = serde_json::to_string(config)?;
        
        sqlx::query(
            "INSERT OR REPLACE INTO sync_config (id, config_data, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)"
        )
        .bind(config_json)
        .execute(pool)
        .await?;
        
        Ok(())
    }

    pub async fn load_sync_config(&self) -> Result<SyncConfig> {
        let pool = self.get_pool()?;
        
        let row = sqlx::query("SELECT config_data FROM sync_config WHERE id = 1")
            .fetch_optional(pool)
            .await?;
        
        if let Some(row) = row {
            let config_data: String = row.get("config_data");
            let config: SyncConfig = serde_json::from_str(&config_data)?;
            Ok(config)
        } else {
            Ok(SyncConfig::default())
        }
    }

    // ==================== 同步状态存储 ====================

    pub async fn save_sync_status(&self, status: &SyncStatus) -> Result<()> {
        let pool = self.get_pool()?;
        
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO sync_status 
            (id, last_sync_time, pending_items, sync_errors, total_synced, updated_at) 
            VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            "#
        )
        .bind(&status.last_sync_time)
        .bind(status.pending_items)
        .bind(status.sync_errors)
        .bind(status.total_synced)
        .execute(pool)
        .await?;
        
        Ok(())
    }

    pub async fn load_sync_status(&self) -> Result<SyncStatus> {
        let pool = self.get_pool()?;
        
        let row = sqlx::query(
            "SELECT last_sync_time, pending_items, sync_errors, total_synced FROM sync_status WHERE id = 1"
        )
        .fetch_optional(pool)
        .await?;
        
        if let Some(row) = row {
            Ok(SyncStatus {
                status: "idle".to_string(),
                last_sync_time: row.get("last_sync_time"),
                pending_items: row.get("pending_items"),
                sync_errors: row.get("sync_errors"),
                total_synced: row.get("total_synced"),
            })
        } else {
            Ok(SyncStatus {
                status: "idle".to_string(),
                last_sync_time: None,
                pending_items: 0,
                sync_errors: 0,
                total_synced: 0,
            })
        }
    }

    // ==================== 冲突管理 ====================

    pub async fn save_conflict(&self, conflict: &SyncConflict) -> Result<()> {
        let pool = self.get_pool()?;
        
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO sync_conflicts 
            (id, local_item, remote_item, conflict_type, resolved, created_at) 
            VALUES (?, ?, ?, 'data_conflict', ?, CURRENT_TIMESTAMP)
            "#
        )
        .bind(&conflict.id)
        .bind(serde_json::to_string(&conflict.local_item)?)
        .bind(serde_json::to_string(&conflict.remote_item)?)
        .bind(conflict.resolved)
        .execute(pool)
        .await?;
        
        Ok(())
    }

    pub async fn load_conflicts(&self) -> Result<Vec<SyncConflict>> {
        let pool = self.get_pool()?;
        
        let rows = sqlx::query(
            "SELECT id, local_item, remote_item, resolved, created_at FROM sync_conflicts WHERE resolved = FALSE"
        )
        .fetch_all(pool)
        .await?;
        
        let mut conflicts = Vec::new();
        for row in rows {
            let id: String = row.get("id");
            let local_item_str: String = row.get("local_item");
            let remote_item_str: String = row.get("remote_item");
            let resolved: bool = row.get("resolved");
            let created_at: String = row.get("created_at");
            
            let local_item: Value = serde_json::from_str(&local_item_str)?;
            let remote_item: Value = serde_json::from_str(&remote_item_str)?;
            
            conflicts.push(SyncConflict {
                id,
                local_item,
                remote_item,
                timestamp: created_at,
                resolved,
            });
        }
        
        Ok(conflicts)
    }

    pub async fn resolve_conflict(&self, conflict_id: &str, resolution: &str) -> Result<()> {
        let pool = self.get_pool()?;
        
        sqlx::query(
            "UPDATE sync_conflicts SET resolved = TRUE, resolution = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .bind(resolution)
        .bind(conflict_id)
        .execute(pool)
        .await?;
        
        Ok(())
    }

    // ==================== 缓存管理 ====================

    pub async fn set_cache(&self, key: &str, value: &str, expires_in_seconds: Option<i64>) -> Result<()> {
        let pool = self.get_pool()?;
        
        let expires_at = expires_in_seconds.map(|seconds| {
            (Utc::now() + chrono::Duration::seconds(seconds)).to_rfc3339()
        });
        
        sqlx::query(
            "INSERT OR REPLACE INTO local_cache (key, value, expires_at, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
        )
        .bind(key)
        .bind(value)
        .bind(expires_at)
        .execute(pool)
        .await?;
        
        Ok(())
    }

    pub async fn get_cache(&self, key: &str) -> Result<Option<String>> {
        let pool = self.get_pool()?;
        
        let row = sqlx::query(
            "SELECT value, expires_at FROM local_cache WHERE key = ?"
        )
        .bind(key)
        .fetch_optional(pool)
        .await?;
        
        if let Some(row) = row {
            let expires_at: Option<String> = row.get("expires_at");
            
            // 检查是否过期
            if let Some(expires_str) = expires_at {
                if let Ok(expires_time) = DateTime::parse_from_rfc3339(&expires_str) {
                    if Utc::now() > expires_time {
                        // 已过期，删除缓存
                        self.delete_cache(key).await?;
                        return Ok(None);
                    }
                }
            }
            
            let value: String = row.get("value");
            Ok(Some(value))
        } else {
            Ok(None)
        }
    }

    pub async fn delete_cache(&self, key: &str) -> Result<()> {
        let pool = self.get_pool()?;
        
        sqlx::query("DELETE FROM local_cache WHERE key = ?")
            .bind(key)
            .execute(pool)
            .await?;
        
        Ok(())
    }

    pub async fn clear_expired_cache(&self) -> Result<()> {
        let pool = self.get_pool()?;
        
        sqlx::query("DELETE FROM local_cache WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP")
            .execute(pool)
            .await?;
        
        Ok(())
    }

    // ==================== 工具方法 ====================

    fn get_pool(&self) -> Result<&SqlitePool> {
        self.db_pool.as_ref()
            .ok_or_else(|| Error::DatabaseError("Database not initialized".to_string()))
    }

    pub async fn cleanup(&self) -> Result<()> {
        // 清理过期缓存
        self.clear_expired_cache().await?;
        
        // 可以添加其他清理逻辑
        Ok(())
    }

    pub fn get_data_dir(&self) -> &Path {
        &self.data_dir
    }
}