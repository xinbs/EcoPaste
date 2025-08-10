use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Runtime, Emitter};
use tokio::sync::{RwLock, Mutex};
use tokio::time::interval;
use chrono::Utc;
use uuid::Uuid;
use serde_json::Value;

use crate::{
    models::*,
    storage::LocalStorage,
    websocket::WebSocketClient,
    encryption::EncryptionManager,
    Result, Error,
};

pub struct SyncEngine<R: Runtime> {
    storage: LocalStorage,
    websocket_client: Arc<RwLock<WebSocketClient<R>>>,
    app_handle: AppHandle<R>,
    client: reqwest::Client,
    encryption: EncryptionManager,
    config: Arc<RwLock<SyncConfig>>,
    is_running: Arc<RwLock<bool>>,
    sync_queue: Arc<Mutex<Vec<SyncDataRequest>>>,
    last_sync_time: Arc<RwLock<Option<chrono::DateTime<Utc>>>>,
}

impl<R: Runtime> SyncEngine<R> {
    pub fn new(
        storage: LocalStorage,
        websocket_client: Arc<RwLock<WebSocketClient<R>>>,
        app_handle: AppHandle<R>,
    ) -> Self {
        Self {
            storage,
            websocket_client,
            app_handle,
            client: reqwest::Client::new(),
            encryption: EncryptionManager::new(),
            config: Arc::new(RwLock::new(SyncConfig::default())),
            is_running: Arc::new(RwLock::new(false)),
            sync_queue: Arc::new(Mutex::new(Vec::new())),
            last_sync_time: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn start(&self) -> Result<()> {
        let mut is_running = self.is_running.write().await;
        if *is_running {
            return Ok(());
        }

        *is_running = true;
        drop(is_running);

        // 启动定期同步任务
        self.start_periodic_sync().await;
        
        // 启动队列处理任务
        self.start_queue_processor().await;
        
        // 发送状态更新事件
        self.emit_status_change("running", None).await?;
        
        log::info!("Sync engine started");
        Ok(())
    }

    pub async fn stop(&self) -> Result<()> {
        let mut is_running = self.is_running.write().await;
        if !*is_running {
            return Ok(());
        }

        *is_running = false;
        
        // 发送状态更新事件
        self.emit_status_change("stopped", None).await?;
        
        log::info!("Sync engine stopped");
        Ok(())
    }

    pub async fn sync_data(&self, request: SyncDataRequest) -> Result<SyncDataResponse> {
        let config = self.config.read().await;
        
        // 检查是否启用同步
        if !config.enabled {
            return Ok(SyncDataResponse {
                success: false,
                sync_id: None,
                conflicts: None,
                message: Some("Sync is disabled".to_string()),
            });
        }

        // 检查数据类型是否在同步范围内
        if !config.sync_types.contains(&request.data.r#type) {
            return Ok(SyncDataResponse {
                success: false,
                sync_id: None,
                conflicts: None,
                message: Some(format!("Data type '{}' is not enabled for sync", request.data.r#type)),
            });
        }

        // 如果是自动同步，直接处理；否则加入队列
        if config.auto_sync {
            self.process_sync_request(request).await
        } else {
            // 加入同步队列
            self.sync_queue.lock().await.push(request);
            Ok(SyncDataResponse {
                success: true,
                sync_id: Some(Uuid::new_v4().to_string()),
                conflicts: None,
                message: Some("Added to sync queue".to_string()),
            })
        }
    }

    pub async fn pull_updates(&self, last_sync_time: Option<String>) -> Result<Value> {
        let token = self.storage.load_auth_token().await
            .map_err(|_| Error::AuthenticationFailed("No auth token found".to_string()))?;

        let mut url = "https://api.ecopaste.com/sync/updates".to_string();
        if let Some(timestamp) = last_sync_time {
            url.push_str(&format!("?since={}", timestamp));
        }

        let response = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await?;

        if response.status().is_success() {
            let updates: Value = response.json().await?;
            
            // 处理接收到的更新
            if let Some(items) = updates.get("items").and_then(|v| v.as_array()) {
                for item in items {
                    self.process_remote_update(item).await?;
                }
            }
            
            // 更新最后同步时间
            *self.last_sync_time.write().await = Some(Utc::now());
            
            // 发送同步完成事件
            self.emit_sync_update("pull_complete", &updates).await?;
            
            Ok(serde_json::json!({
                "success": true,
                "data": updates.get("items").unwrap_or(&Value::Null),
                "conflicts": updates.get("conflicts").unwrap_or(&Value::Null)
            }))
        } else {
            let error_msg = response.text().await.unwrap_or_else(|_| "Pull updates failed".to_string());
            Err(Error::NetworkError(error_msg))
        }
    }

    pub async fn force_sync_all(&self) -> Result<Value> {
        self.emit_status_change("syncing", Some("Force syncing all data")).await?;
        
        let start_time = Instant::now();
        let mut total_synced = 0;
        let mut errors = 0;

        // 这里应该从本地数据库获取所有需要同步的数据
        // 为了简化，我们模拟一个强制同步过程
        
        // 1. 推送本地所有数据
        match self.push_all_local_data().await {
            Ok(count) => total_synced += count,
            Err(e) => {
                errors += 1;
                log::error!("Failed to push local data: {}", e);
            }
        }
        
        // 2. 拉取远程所有数据
        match self.pull_updates(None).await {
            Ok(_) => {},
            Err(e) => {
                errors += 1;
                log::error!("Failed to pull remote data: {}", e);
            }
        }
        
        let duration = start_time.elapsed();
        
        // 更新统计信息
        let mut status = self.storage.load_sync_status().await.unwrap_or_default();
        status.total_synced += total_synced;
        status.sync_errors += errors;
        status.last_sync_time = Some(Utc::now().to_rfc3339());
        self.storage.save_sync_status(&status).await?;
        
        self.emit_status_change("idle", None).await?;
        
        Ok(serde_json::json!({
            "success": errors == 0,
            "message": format!("Synced {} items in {:?}", total_synced, duration),
            "total_synced": total_synced,
            "errors": errors,
            "duration_ms": duration.as_millis()
        }))
    }

    pub async fn get_status(&self) -> Result<SyncStatus> {
        let stored_status = self.storage.load_sync_status().await.unwrap_or_default();
        let is_running = *self.is_running.read().await;
        let queue_size = self.sync_queue.lock().await.len() as i32;
        
        Ok(SyncStatus {
            status: if is_running { "running".to_string() } else { "idle".to_string() },
            last_sync_time: stored_status.last_sync_time,
            pending_items: queue_size,
            sync_errors: stored_status.sync_errors,
            total_synced: stored_status.total_synced,
        })
    }

    pub async fn update_config(&self, config: SyncConfig) -> Result<()> {
        *self.config.write().await = config;
        Ok(())
    }

    async fn process_sync_request(&self, request: SyncDataRequest) -> Result<SyncDataResponse> {
        let sync_id = Uuid::new_v4().to_string();
        
        // 加密数据
        let encrypted_data = self.encryption.encrypt_clipboard_data(&request.data).await?;
        
        // 准备上传数据
        let upload_data = serde_json::json!({
            "sync_id": sync_id,
            "device_id": request.device_id,
            "timestamp": request.timestamp,
            "data_type": request.data.r#type,
            "encrypted_data": encrypted_data,
            "metadata": {
                "width": request.data.width,
                "height": request.data.height,
                "subtype": request.data.subtype
            }
        });

        let token = self.storage.load_auth_token().await
            .map_err(|_| Error::AuthenticationFailed("No auth token found".to_string()))?;

        let response = self
            .client
            .post("https://api.ecopaste.com/sync/data")
            .bearer_auth(&token)
            .json(&upload_data)
            .send()
            .await?;

        if response.status().is_success() {
            let sync_response: Value = response.json().await?;
            
            // 检查是否有冲突
            let conflicts = sync_response.get("conflicts")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|item| serde_json::from_value(item.clone()).ok())
                        .collect::<Vec<SyncConflict>>()
                });
            
            // 发送同步完成事件
            self.emit_sync_update("data_synced", &sync_response).await?;
            
            Ok(SyncDataResponse {
                success: true,
                sync_id: Some(sync_id),
                conflicts,
                message: None,
            })
        } else {
            let error_msg = response.text().await.unwrap_or_else(|_| "Sync failed".to_string());
            Err(Error::NetworkError(error_msg))
        }
    }

    async fn process_remote_update(&self, update: &Value) -> Result<()> {
        // 解密远程数据
        if let Some(encrypted_data) = update.get("encrypted_data") {
            let decrypted_data = self.encryption.decrypt_clipboard_data(encrypted_data).await?;
            
            // 发送更新事件到前端
            self.emit_sync_update("remote_update", &serde_json::json!({
                "item_id": update.get("id"),
                "device_id": update.get("device_id"),
                "data": decrypted_data,
                "timestamp": update.get("timestamp")
            })).await?;
        }
        
        Ok(())
    }

    async fn push_all_local_data(&self) -> Result<i32> {
        // 这里应该从本地数据库获取所有需要同步的数据
        // 为了简化，我们返回一个模拟的数量
        Ok(0)
    }

    async fn start_periodic_sync(&self) {
        let storage = self.storage.clone();
        let config = self.config.clone();
        let is_running = self.is_running.clone();
        let sync_engine = self.clone_for_task();
        
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(300)); // 5分钟
            
            loop {
                interval.tick().await;
                
                if !*is_running.read().await {
                    break;
                }
                
                let config = config.read().await;
                if config.enabled && config.auto_sync {
                    if let Err(e) = sync_engine.pull_updates(None).await {
                        log::error!("Periodic sync failed: {}", e);
                    }
                }
            }
        });
    }

    async fn start_queue_processor(&self) {
        let sync_queue = self.sync_queue.clone();
        let is_running = self.is_running.clone();
        let sync_engine = self.clone_for_task();
        
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(10)); // 10秒处理一次队列
            
            loop {
                interval.tick().await;
                
                if !*is_running.read().await {
                    break;
                }
                
                let mut queue = sync_queue.lock().await;
                if !queue.is_empty() {
                    let requests = queue.drain(..).collect::<Vec<_>>();
                    drop(queue);
                    
                    for request in requests {
                        if let Err(e) = sync_engine.process_sync_request(request).await {
                            log::error!("Failed to process sync request: {}", e);
                        }
                    }
                }
            }
        });
    }

    async fn emit_sync_update(&self, event_type: &str, data: &Value) -> Result<()> {
        let event = SyncUpdateEvent {
            r#type: event_type.to_string(),
            data: data.clone(),
            timestamp: Utc::now().timestamp(),
        };
        
        self.app_handle.emit("sync-update", event)
            .map_err(|e| Error::Unknown(format!("Failed to emit sync update: {}", e)))?;
        
        Ok(())
    }

    async fn emit_status_change(&self, status: &str, message: Option<&str>) -> Result<()> {
        let event = serde_json::json!({
            "status": status,
            "message": message,
            "timestamp": Utc::now().timestamp()
        });
        
        self.app_handle.emit("sync-status-change", event)
            .map_err(|e| Error::Unknown(format!("Failed to emit status change: {}", e)))?;
        
        Ok(())
    }

    fn clone_for_task(&self) -> SyncEngineTask<R> {
        SyncEngineTask {
            storage: self.storage.clone(),
            client: self.client.clone(),
            encryption: self.encryption.clone(),
            app_handle: self.app_handle.clone(),
        }
    }
}

// 用于异步任务的简化版本
#[derive(Clone)]
struct SyncEngineTask<R: Runtime> {
    storage: LocalStorage,
    client: reqwest::Client,
    encryption: EncryptionManager,
    app_handle: AppHandle<R>,
}

impl<R: Runtime> SyncEngineTask<R> {
    async fn pull_updates(&self, last_sync_time: Option<String>) -> Result<Value> {
        // 简化的拉取更新实现
        Ok(serde_json::json!({ "items": [] }))
    }
    
    async fn process_sync_request(&self, _request: SyncDataRequest) -> Result<SyncDataResponse> {
        // 简化的同步请求处理
        Ok(SyncDataResponse {
            success: true,
            sync_id: Some(Uuid::new_v4().to_string()),
            conflicts: None,
            message: None,
        })
    }
}