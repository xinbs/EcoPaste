use tauri::{command, AppHandle, Runtime, State};
use crate::{models::*, EcoSync, EcoSyncExt, Result};

// ==================== 用户认证命令 ====================

#[command]
pub async fn login<R: Runtime>(
    app: AppHandle<R>,
    credentials: LoginCredentials,
) -> Result<AuthResponse> {
    app.eco_sync().auth().login(credentials).await
}

#[command]
pub async fn register<R: Runtime>(
    app: AppHandle<R>,
    data: RegisterData,
) -> Result<AuthResponse> {
    app.eco_sync().auth().register(data).await
}

#[command]
pub async fn logout<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
    app.eco_sync().auth().logout().await
}

#[command]
pub async fn check_auth_status<R: Runtime>(
    app: AppHandle<R>,
) -> Result<serde_json::Value> {
    app.eco_sync().auth().check_status().await
}

// ==================== 设备管理命令 ====================

#[command]
pub async fn register_device<R: Runtime>(
    app: AppHandle<R>,
    device_name: String,
) -> Result<serde_json::Value> {
    app.eco_sync().device().register_device(device_name).await
}

#[command]
pub async fn get_devices<R: Runtime>(app: AppHandle<R>) -> Result<Vec<SyncDevice>> {
    app.eco_sync().device().get_devices().await
}

#[command]
pub async fn remove_device<R: Runtime>(
    app: AppHandle<R>,
    device_id: String,
) -> Result<bool> {
    app.eco_sync().device().remove_device(device_id).await
}

#[command]
pub async fn update_device<R: Runtime>(
    app: AppHandle<R>,
    device_id: String,
    name: String,
) -> Result<bool> {
    app.eco_sync().device().update_device(device_id, name).await
}

// ==================== 数据同步命令 ====================

#[command]
pub async fn sync_data<R: Runtime>(
    app: AppHandle<R>,
    request: SyncDataRequest,
) -> Result<SyncDataResponse> {
    app.eco_sync().sync_engine().sync_data(request).await
}

#[command]
pub async fn pull_updates<R: Runtime>(
    app: AppHandle<R>,
    last_sync_time: Option<String>,
) -> Result<serde_json::Value> {
    app.eco_sync().sync_engine().pull_updates(last_sync_time).await
}

#[command]
pub async fn force_sync_all<R: Runtime>(app: AppHandle<R>) -> Result<serde_json::Value> {
    app.eco_sync().sync_engine().force_sync_all().await
}

#[command]
pub async fn get_sync_status<R: Runtime>(app: AppHandle<R>) -> Result<SyncStatus> {
    app.eco_sync().sync_engine().get_status().await
}

// ==================== 冲突解决命令 ====================

#[command]
pub async fn resolve_conflict<R: Runtime>(
    app: AppHandle<R>,
    conflict_id: String,
    resolution: String,
) -> Result<bool> {
    app.eco_sync()
        .conflict_resolver()
        .resolve_conflict(conflict_id, resolution)
        .await
}

#[command]
pub async fn get_pending_conflicts<R: Runtime>(app: AppHandle<R>) -> Result<Vec<SyncConflict>> {
    app.eco_sync().conflict_resolver().get_pending_conflicts().await
}

// ==================== 配置管理命令 ====================

#[command]
pub async fn update_sync_config<R: Runtime>(
    app: AppHandle<R>,
    config: SyncConfig,
) -> Result<bool> {
    app.eco_sync().update_config(config).await
}

#[command]
pub async fn get_sync_config<R: Runtime>(app: AppHandle<R>) -> Result<SyncConfig> {
    app.eco_sync().get_config().await
}

// ==================== 服务管理命令 ====================

#[command]
pub async fn start_sync_service<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
    app.eco_sync().start_service().await
}

#[command]
pub async fn stop_sync_service<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
    app.eco_sync().stop_service().await
}

#[command]
pub async fn test_connection<R: Runtime>(app: AppHandle<R>) -> Result<serde_json::Value> {
    app.eco_sync().test_connection().await
}