use tauri::{plugin::PluginApi, AppHandle, Runtime};
use std::sync::Arc;
use parking_lot::RwLock;

use crate::{
    auth::AuthManager,
    device::DeviceManager,
    sync_engine::SyncEngine,
    conflict_resolver::ConflictResolver,
    websocket::WebSocketClient,
    storage::LocalStorage,
    models::*,
    Result,
};

pub fn init<R: Runtime>(
    app: &AppHandle<R>,
    _api: PluginApi<R, ()>,
) -> crate::Result<EcoSync<R>> {
    let app_handle = app.clone();
    
    // 初始化本地存储
    let storage = LocalStorage::new(app.path().app_data_dir().unwrap())?;
    
    // 初始化各个管理器
    let auth_manager = AuthManager::new(storage.clone());
    let device_manager = DeviceManager::new(storage.clone());
    let conflict_resolver = ConflictResolver::new(storage.clone());
    
    // 初始化WebSocket客户端
    let websocket_client = WebSocketClient::new(app_handle.clone());
    
    // 初始化同步引擎
    let sync_engine = SyncEngine::new(
        storage.clone(),
        websocket_client.clone(),
        app_handle.clone(),
    );
    
    Ok(EcoSync {
        auth_manager: Arc::new(RwLock::new(auth_manager)),
        device_manager: Arc::new(RwLock::new(device_manager)),
        sync_engine: Arc::new(RwLock::new(sync_engine)),
        conflict_resolver: Arc::new(RwLock::new(conflict_resolver)),
        websocket_client: Arc::new(RwLock::new(websocket_client)),
        storage: Arc::new(storage),
        config: Arc::new(RwLock::new(SyncConfig::default())),
        is_running: Arc::new(RwLock::new(false)),
    })
}

pub struct EcoSync<R: Runtime> {
    pub auth_manager: Arc<RwLock<AuthManager>>,
    pub device_manager: Arc<RwLock<DeviceManager>>,
    pub sync_engine: Arc<RwLock<SyncEngine<R>>>,
    pub conflict_resolver: Arc<RwLock<ConflictResolver>>,
    pub websocket_client: Arc<RwLock<WebSocketClient<R>>>,
    pub storage: Arc<LocalStorage>,
    pub config: Arc<RwLock<SyncConfig>>,
    pub is_running: Arc<RwLock<bool>>,
}

impl<R: Runtime> EcoSync<R> {
    pub fn auth(&self) -> &Arc<RwLock<AuthManager>> {
        &self.auth_manager
    }
    
    pub fn device(&self) -> &Arc<RwLock<DeviceManager>> {
        &self.device_manager
    }
    
    pub fn sync_engine(&self) -> &Arc<RwLock<SyncEngine<R>>> {
        &self.sync_engine
    }
    
    pub fn conflict_resolver(&self) -> &Arc<RwLock<ConflictResolver>> {
        &self.conflict_resolver
    }
    
    pub fn websocket_client(&self) -> &Arc<RwLock<WebSocketClient<R>>> {
        &self.websocket_client
    }
    
    pub async fn start_service(&self) -> Result<bool> {
        let mut is_running = self.is_running.write();
        if *is_running {
            return Ok(true);
        }
        
        // 启动WebSocket连接
        if let Ok(auth_status) = self.auth_manager.read().check_status().await {
            if let Some(token) = auth_status.get("token").and_then(|t| t.as_str()) {
                self.websocket_client.write().connect(token.to_string()).await?;
            }
        }
        
        // 启动同步引擎
        self.sync_engine.write().start().await?;
        
        *is_running = true;
        Ok(true)
    }
    
    pub async fn stop_service(&self) -> Result<bool> {
        let mut is_running = self.is_running.write();
        if !*is_running {
            return Ok(true);
        }
        
        // 停止同步引擎
        self.sync_engine.write().stop().await?;
        
        // 断开WebSocket连接
        self.websocket_client.write().disconnect().await?;
        
        *is_running = false;
        Ok(true)
    }
    
    pub async fn update_config(&self, config: SyncConfig) -> Result<bool> {
        // 保存配置到本地存储
        self.storage.save_sync_config(&config).await?;
        
        // 更新内存中的配置
        *self.config.write() = config.clone();
        
        // 如果同步引擎正在运行，更新其配置
        if *self.is_running.read() {
            self.sync_engine.write().update_config(config).await?;
        }
        
        Ok(true)
    }
    
    pub async fn get_config(&self) -> Result<SyncConfig> {
        // 尝试从本地存储加载配置
        match self.storage.load_sync_config().await {
            Ok(config) => {
                *self.config.write() = config.clone();
                Ok(config)
            }
            Err(_) => {
                // 如果加载失败，返回默认配置
                let default_config = SyncConfig::default();
                *self.config.write() = default_config.clone();
                Ok(default_config)
            }
        }
    }
    
    pub async fn test_connection(&self) -> Result<serde_json::Value> {
        let start_time = std::time::Instant::now();
        
        // 测试本地HTTP连接
        let client = reqwest::Client::new();
        let response = client
            .get("http://localhost:3001/health")
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await?;
        
        let latency = start_time.elapsed().as_millis() as u64;
        let status = response.status().as_u16();
        
        Ok(serde_json::json!({
            "success": status == 200,
            "latency": latency,
            "status_code": status,
            "timestamp": chrono::Utc::now().timestamp()
        }))
    }
}