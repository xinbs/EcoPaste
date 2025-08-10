use std::collections::HashMap;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use serde_json::Value;

use crate::{
    models::*,
    storage::LocalStorage,
    Result, Error,
};

pub struct DeviceManager {
    storage: LocalStorage,
    client: reqwest::Client,
    current_device_id: Option<String>,
    devices_cache: HashMap<String, SyncDevice>,
}

impl DeviceManager {
    pub fn new(storage: LocalStorage) -> Self {
        Self {
            storage,
            client: reqwest::Client::new(),
            current_device_id: None,
            devices_cache: HashMap::new(),
        }
    }

    pub async fn register_device(&mut self, device_name: String) -> Result<Value> {
        let device_info = self.get_device_info().await?;
        
        let register_data = serde_json::json!({
            "name": device_name,
            "platform": device_info.get("platform"),
            "arch": device_info.get("arch"),
            "hostname": device_info.get("hostname"),
            "app_version": device_info.get("app_version"),
            "device_fingerprint": self.generate_device_fingerprint().await?
        });

        // 获取认证token
        let token = self.storage.load_auth_token().await
            .map_err(|_| Error::AuthenticationFailed("No auth token found".to_string()))?;

        let response = self
            .client
            .post("https://api.ecopaste.com/devices")
            .bearer_auth(&token)
            .json(&register_data)
            .send()
            .await?;

        if response.status().is_success() {
            let device_response: Value = response.json().await?;
            
            if let Some(device_id) = device_response.get("device_id").and_then(|v| v.as_str()) {
                // 保存设备ID到本地存储
                self.storage.save_device_id(device_id).await?;
                self.current_device_id = Some(device_id.to_string());
                
                // 刷新设备列表缓存
                self.refresh_devices_cache().await?;
                
                Ok(serde_json::json!({
                    "success": true,
                    "deviceId": device_id
                }))
            } else {
                Err(Error::Unknown("Invalid response from server".to_string()))
            }
        } else {
            let error_msg = response.text().await.unwrap_or_else(|_| "Device registration failed".to_string());
            Err(Error::NetworkError(error_msg))
        }
    }

    pub async fn get_devices(&mut self) -> Result<Vec<SyncDevice>> {
        // 先尝试从缓存获取
        if !self.devices_cache.is_empty() {
            return Ok(self.devices_cache.values().cloned().collect());
        }

        // 从服务器获取设备列表
        self.refresh_devices_cache().await?;
        Ok(self.devices_cache.values().cloned().collect())
    }

    pub async fn remove_device(&mut self, device_id: String) -> Result<bool> {
        let token = self.storage.load_auth_token().await
            .map_err(|_| Error::AuthenticationFailed("No auth token found".to_string()))?;

        let response = self
            .client
            .delete(&format!("https://api.ecopaste.com/devices/{}", device_id))
            .bearer_auth(&token)
            .send()
            .await?;

        if response.status().is_success() {
            // 从缓存中移除设备
            self.devices_cache.remove(&device_id);
            
            // 如果删除的是当前设备，清除本地设备ID
            if self.current_device_id.as_ref() == Some(&device_id) {
                self.storage.clear_device_id().await?;
                self.current_device_id = None;
            }
            
            Ok(true)
        } else {
            let error_msg = response.text().await.unwrap_or_else(|_| "Device removal failed".to_string());
            Err(Error::NetworkError(error_msg))
        }
    }

    pub async fn update_device(&mut self, device_id: String, name: String) -> Result<bool> {
        let token = self.storage.load_auth_token().await
            .map_err(|_| Error::AuthenticationFailed("No auth token found".to_string()))?;

        let update_data = serde_json::json!({
            "name": name
        });

        let response = self
            .client
            .put(&format!("https://api.ecopaste.com/devices/{}", device_id))
            .bearer_auth(&token)
            .json(&update_data)
            .send()
            .await?;

        if response.status().is_success() {
            // 更新缓存中的设备信息
            if let Some(device) = self.devices_cache.get_mut(&device_id) {
                device.name = name;
            }
            
            Ok(true)
        } else {
            let error_msg = response.text().await.unwrap_or_else(|_| "Device update failed".to_string());
            Err(Error::NetworkError(error_msg))
        }
    }

    pub async fn update_device_status(&mut self, is_online: bool) -> Result<()> {
        if let Some(device_id) = &self.current_device_id {
            let token = self.storage.load_auth_token().await
                .map_err(|_| Error::AuthenticationFailed("No auth token found".to_string()))?;

            let status_data = serde_json::json!({
                "is_online": is_online,
                "last_active": Utc::now().to_rfc3339()
            });

            let response = self
                .client
                .patch(&format!("https://api.ecopaste.com/devices/{}/status", device_id))
                .bearer_auth(&token)
                .json(&status_data)
                .send()
                .await?;

            if !response.status().is_success() {
                log::warn!("Failed to update device status: {}", response.status());
            }
        }
        
        Ok(())
    }

    pub fn get_current_device_id(&self) -> Option<&String> {
        self.current_device_id.as_ref()
    }

    pub async fn initialize_from_storage(&mut self) -> Result<()> {
        // 尝试从本地存储恢复设备ID
        if let Ok(device_id) = self.storage.load_device_id().await {
            self.current_device_id = Some(device_id);
            
            // 更新设备在线状态
            self.update_device_status(true).await?;
        }
        
        Ok(())
    }

    async fn refresh_devices_cache(&mut self) -> Result<()> {
        let token = self.storage.load_auth_token().await
            .map_err(|_| Error::AuthenticationFailed("No auth token found".to_string()))?;

        let response = self
            .client
            .get("https://api.ecopaste.com/devices")
            .bearer_auth(&token)
            .send()
            .await?;

        if response.status().is_success() {
            let devices_response: Value = response.json().await?;
            
            if let Some(devices_array) = devices_response.get("devices").and_then(|v| v.as_array()) {
                self.devices_cache.clear();
                
                for device_value in devices_array {
                    if let Ok(device) = self.parse_device_from_api(device_value) {
                        self.devices_cache.insert(device.id.clone(), device);
                    }
                }
            }
        } else {
            log::warn!("Failed to refresh devices cache: {}", response.status());
        }
        
        Ok(())
    }

    fn parse_device_from_api(&self, device_value: &Value) -> Result<SyncDevice> {
        let id = device_value.get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| Error::Unknown("Missing device id".to_string()))?;
        
        let name = device_value.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown Device")
            .to_string();
        
        let platform = device_value.get("platform")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        
        let is_online = device_value.get("is_online")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        
        let last_active = device_value.get("last_active")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        
        let is_current = self.current_device_id.as_ref() == Some(&id.to_string());
        
        Ok(SyncDevice {
            id: id.to_string(),
            name,
            platform,
            is_online,
            last_active,
            is_current,
        })
    }

    async fn get_device_info(&self) -> Result<Value> {
        Ok(serde_json::json!({
            "platform": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
            "hostname": hostname::get().unwrap_or_default().to_string_lossy(),
            "app_version": env!("CARGO_PKG_VERSION")
        }))
    }

    async fn generate_device_fingerprint(&self) -> Result<String> {
        use sha2::{Sha256, Digest};
        
        let device_info = self.get_device_info().await?;
        let fingerprint_data = format!(
            "{}-{}-{}-{}",
            device_info.get("platform").and_then(|v| v.as_str()).unwrap_or(""),
            device_info.get("arch").and_then(|v| v.as_str()).unwrap_or(""),
            device_info.get("hostname").and_then(|v| v.as_str()).unwrap_or(""),
            std::env::var("COMPUTERNAME").or_else(|_| std::env::var("HOSTNAME")).unwrap_or_default()
        );
        
        let mut hasher = Sha256::new();
        hasher.update(fingerprint_data.as_bytes());
        let result = hasher.finalize();
        
        Ok(format!("{:x}", result))
    }

    pub async fn cleanup(&mut self) -> Result<()> {
        // 设置设备为离线状态
        self.update_device_status(false).await?;
        Ok(())
    }
}