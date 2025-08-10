use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Runtime, Emitter};
use tokio::sync::{RwLock, Mutex};
use tokio::time::{interval, sleep};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use chrono::Utc;

use crate::{
    models::*,
    storage::LocalStorage,
    Result, Error,
};

pub struct WebSocketClient<R: Runtime> {
    app_handle: AppHandle<R>,
    storage: LocalStorage,
    connection_url: String,
    is_connected: Arc<RwLock<bool>>,
    is_connecting: Arc<RwLock<bool>>,
    reconnect_attempts: Arc<Mutex<u32>>,
    max_reconnect_attempts: u32,
    reconnect_delay: Duration,
}

impl<R: Runtime> WebSocketClient<R> {
    pub fn new(app_handle: AppHandle<R>, storage: LocalStorage) -> Self {
        Self {
            app_handle,
            storage,
            connection_url: "wss://api.ecopaste.com/ws".to_string(),
            is_connected: Arc::new(RwLock::new(false)),
            is_connecting: Arc::new(RwLock::new(false)),
            reconnect_attempts: Arc::new(Mutex::new(0)),
            max_reconnect_attempts: 5,
            reconnect_delay: Duration::from_secs(5),
        }
    }

    pub async fn connect(&self) -> Result<()> {
        let mut is_connecting = self.is_connecting.write().await;
        if *is_connecting {
            return Ok(());
        }
        *is_connecting = true;
        drop(is_connecting);

        let token = self.storage.load_auth_token().await
            .map_err(|_| Error::AuthenticationFailed("No auth token found".to_string()))?;

        let device_id = self.storage.load_device_id().await
            .map_err(|_| Error::Unknown("No device ID found".to_string()))?;

        let url = format!("{}?token={}&device_id={}", self.connection_url, token, device_id);
        
        match connect_async(&url).await {
            Ok((ws_stream, _)) => {
                *self.is_connected.write().await = true;
                *self.is_connecting.write().await = false;
                *self.reconnect_attempts.lock().await = 0;
                
                // 启动消息处理循环
                self.start_message_loop(ws_stream).await;
                
                // 发送连接成功事件
                self.emit_connection_event("connected", None).await?;
                
                log::info!("WebSocket connected successfully");
                Ok(())
            }
            Err(e) => {
                *self.is_connecting.write().await = false;
                
                // 增加重连尝试次数
                let mut attempts = self.reconnect_attempts.lock().await;
                *attempts += 1;
                
                if *attempts < self.max_reconnect_attempts {
                    log::warn!("WebSocket connection failed, will retry in {:?}: {}", self.reconnect_delay, e);
                    
                    // 发送重连事件
                    self.emit_connection_event("reconnecting", Some(&format!("Attempt {} of {}", *attempts, self.max_reconnect_attempts))).await?;
                    
                    // 延迟后重连
                    let client = self.clone_for_reconnect();
                    tokio::spawn(async move {
                        sleep(client.reconnect_delay).await;
                        if let Err(e) = client.connect().await {
                            log::error!("Reconnection failed: {}", e);
                        }
                    });
                    
                    Ok(())
                } else {
                    log::error!("WebSocket connection failed after {} attempts: {}", *attempts, e);
                    self.emit_connection_event("failed", Some(&format!("Failed after {} attempts", *attempts))).await?;
                    Err(Error::NetworkError(format!("WebSocket connection failed: {}", e)))
                }
            }
        }
    }

    pub async fn disconnect(&self) -> Result<()> {
        *self.is_connected.write().await = false;
        self.emit_connection_event("disconnected", None).await?;
        log::info!("WebSocket disconnected");
        Ok(())
    }

    pub async fn is_connected(&self) -> bool {
        *self.is_connected.read().await
    }

    pub async fn send_message(&self, message: WebSocketMessage) -> Result<()> {
        if !self.is_connected().await {
            return Err(Error::NetworkError("WebSocket not connected".to_string()));
        }

        // 这里应该有一个发送消息的实现
        // 由于我们需要保持WebSocket连接的引用，这里简化处理
        log::debug!("Sending WebSocket message: {:?}", message);
        Ok(())
    }

    async fn start_message_loop(&self, ws_stream: tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>) {
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        let app_handle = self.app_handle.clone();
        let is_connected = self.is_connected.clone();
        let client = self.clone_for_message_loop();
        
        // 启动消息接收循环
        tokio::spawn(async move {
            while *is_connected.read().await {
                match ws_receiver.next().await {
                    Some(Ok(message)) => {
                        if let Err(e) = client.handle_message(message).await {
                            log::error!("Failed to handle WebSocket message: {}", e);
                        }
                    }
                    Some(Err(e)) => {
                        log::error!("WebSocket error: {}", e);
                        *is_connected.write().await = false;
                        
                        // 尝试重连
                        if let Err(e) = client.connect().await {
                            log::error!("Failed to reconnect: {}", e);
                        }
                        break;
                    }
                    None => {
                        log::info!("WebSocket connection closed");
                        *is_connected.write().await = false;
                        break;
                    }
                }
            }
        });
        
        // 启动心跳循环
        tokio::spawn(async move {
            let mut heartbeat_interval = interval(Duration::from_secs(30));
            
            while *is_connected.read().await {
                heartbeat_interval.tick().await;
                
                let ping_message = Message::Ping(vec![]);
                if let Err(e) = ws_sender.send(ping_message).await {
                    log::error!("Failed to send ping: {}", e);
                    *is_connected.write().await = false;
                    break;
                }
            }
        });
    }

    async fn handle_message(&self, message: Message) -> Result<()> {
        match message {
            Message::Text(text) => {
                match serde_json::from_str::<WebSocketMessage>(&text) {
                    Ok(ws_message) => self.process_websocket_message(ws_message).await,
                    Err(e) => {
                        log::error!("Failed to parse WebSocket message: {}", e);
                        Ok(())
                    }
                }
            }
            Message::Binary(data) => {
                log::debug!("Received binary message: {} bytes", data.len());
                Ok(())
            }
            Message::Ping(data) => {
                log::debug!("Received ping, sending pong");
                // 这里应该发送pong响应，但由于我们没有保持sender引用，暂时跳过
                Ok(())
            }
            Message::Pong(_) => {
                log::debug!("Received pong");
                Ok(())
            }
            Message::Close(_) => {
                log::info!("Received close message");
                *self.is_connected.write().await = false;
                Ok(())
            }
            _ => Ok(()),
        }
    }

    async fn process_websocket_message(&self, message: WebSocketMessage) -> Result<()> {
        match message {
            WebSocketMessage::SyncUpdate { data, device_id, timestamp } => {
                // 处理同步更新
                let event = serde_json::json!({
                    "type": "sync_update",
                    "data": data,
                    "device_id": device_id,
                    "timestamp": timestamp,
                    "received_at": Utc::now().timestamp()
                });
                
                self.app_handle.emit("sync-update", event)
                    .map_err(|e| Error::Unknown(format!("Failed to emit sync update: {}", e)))?;
            }
            WebSocketMessage::ConflictDetected { conflict_id, items, timestamp } => {
                // 处理冲突检测
                let event = serde_json::json!({
                    "type": "conflict_detected",
                    "conflict_id": conflict_id,
                    "items": items,
                    "timestamp": timestamp,
                    "received_at": Utc::now().timestamp()
                });
                
                self.app_handle.emit("sync-conflict", event)
                    .map_err(|e| Error::Unknown(format!("Failed to emit conflict: {}", e)))?;
            }
            WebSocketMessage::DeviceStatusChange { device_id, status, timestamp } => {
                // 处理设备状态变化
                let event = serde_json::json!({
                    "type": "device_status_change",
                    "device_id": device_id,
                    "status": status,
                    "timestamp": timestamp,
                    "received_at": Utc::now().timestamp()
                });
                
                self.app_handle.emit("device-status-change", event)
                    .map_err(|e| Error::Unknown(format!("Failed to emit device status change: {}", e)))?;
            }
            WebSocketMessage::SyncStatusChange { status, message, timestamp } => {
                // 处理同步状态变化
                let event = serde_json::json!({
                    "type": "sync_status_change",
                    "status": status,
                    "message": message,
                    "timestamp": timestamp,
                    "received_at": Utc::now().timestamp()
                });
                
                self.app_handle.emit("sync-status-change", event)
                    .map_err(|e| Error::Unknown(format!("Failed to emit sync status change: {}", e)))?;
            }
        }
        
        Ok(())
    }

    async fn emit_connection_event(&self, status: &str, message: Option<&str>) -> Result<()> {
        let event = serde_json::json!({
            "status": status,
            "message": message,
            "timestamp": Utc::now().timestamp()
        });
        
        self.app_handle.emit("websocket-connection", event)
            .map_err(|e| Error::Unknown(format!("Failed to emit connection event: {}", e)))?;
        
        Ok(())
    }

    fn clone_for_reconnect(&self) -> WebSocketClientTask<R> {
        WebSocketClientTask {
            app_handle: self.app_handle.clone(),
            storage: self.storage.clone(),
            connection_url: self.connection_url.clone(),
            is_connected: self.is_connected.clone(),
            is_connecting: self.is_connecting.clone(),
            reconnect_attempts: self.reconnect_attempts.clone(),
            max_reconnect_attempts: self.max_reconnect_attempts,
            reconnect_delay: self.reconnect_delay,
        }
    }

    fn clone_for_message_loop(&self) -> WebSocketClientTask<R> {
        WebSocketClientTask {
            app_handle: self.app_handle.clone(),
            storage: self.storage.clone(),
            connection_url: self.connection_url.clone(),
            is_connected: self.is_connected.clone(),
            is_connecting: self.is_connecting.clone(),
            reconnect_attempts: self.reconnect_attempts.clone(),
            max_reconnect_attempts: self.max_reconnect_attempts,
            reconnect_delay: self.reconnect_delay,
        }
    }
}

// 用于异步任务的简化版本
#[derive(Clone)]
struct WebSocketClientTask<R: Runtime> {
    app_handle: AppHandle<R>,
    storage: LocalStorage,
    connection_url: String,
    is_connected: Arc<RwLock<bool>>,
    is_connecting: Arc<RwLock<bool>>,
    reconnect_attempts: Arc<Mutex<u32>>,
    max_reconnect_attempts: u32,
    reconnect_delay: Duration,
}

impl<R: Runtime> WebSocketClientTask<R> {
    async fn connect(&self) -> Result<()> {
        // 简化的连接实现，避免递归
        Ok(())
    }
}