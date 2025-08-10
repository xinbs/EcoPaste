use std::collections::HashMap;
use chrono::{DateTime, Utc, Duration};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    models::*,
    storage::LocalStorage,
    Result, Error,
};

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String, // user_id
    exp: usize,  // expiration time
    iat: usize,  // issued at
    device_id: String,
}

pub struct AuthManager {
    storage: LocalStorage,
    client: reqwest::Client,
    current_token: Option<String>,
    current_user: Option<User>,
    token_expires_at: Option<DateTime<Utc>>,
}

impl AuthManager {
    pub fn new(storage: LocalStorage) -> Self {
        Self {
            storage,
            client: reqwest::Client::new(),
            current_token: None,
            current_user: None,
            token_expires_at: None,
        }
    }

    pub async fn login(&mut self, credentials: LoginCredentials) -> Result<AuthResponse> {
        let login_data = serde_json::json!({
            "email": credentials.email,
            "password": credentials.password,
            "device_info": self.get_device_info().await?
        });

        let response = self
            .client
            .post("https://api.ecopaste.com/auth/login")
            .json(&login_data)
            .send()
            .await?;

        if response.status().is_success() {
            let auth_response: AuthResponse = response.json().await?;
            
            if auth_response.success {
                if let (Some(token), Some(user_id)) = (&auth_response.token, &auth_response.user_id) {
                    // 验证并解析token
                    self.validate_and_store_token(token.clone()).await?;
                    
                    // 保存认证信息到本地存储
                    self.storage.save_auth_token(token).await?;
                    self.storage.save_user_id(user_id).await?;
                    
                    // 获取用户信息
                    self.fetch_user_info().await?;
                }
            }
            
            Ok(auth_response)
        } else {
            let error_msg = response.text().await.unwrap_or_else(|_| "Login failed".to_string());
            Err(Error::AuthenticationFailed(error_msg))
        }
    }

    pub async fn register(&mut self, data: RegisterData) -> Result<AuthResponse> {
        let register_data = serde_json::json!({
            "email": data.email,
            "password": data.password,
            "device_name": data.device_name,
            "device_info": self.get_device_info().await?
        });

        let response = self
            .client
            .post("https://api.ecopaste.com/auth/register")
            .json(&register_data)
            .send()
            .await?;

        if response.status().is_success() {
            let auth_response: AuthResponse = response.json().await?;
            
            if auth_response.success {
                if let (Some(token), Some(user_id)) = (&auth_response.token, &auth_response.user_id) {
                    // 验证并解析token
                    self.validate_and_store_token(token.clone()).await?;
                    
                    // 保存认证信息到本地存储
                    self.storage.save_auth_token(token).await?;
                    self.storage.save_user_id(user_id).await?;
                    
                    // 获取用户信息
                    self.fetch_user_info().await?;
                }
            }
            
            Ok(auth_response)
        } else {
            let error_msg = response.text().await.unwrap_or_else(|_| "Registration failed".to_string());
            Err(Error::AuthenticationFailed(error_msg))
        }
    }

    pub async fn logout(&mut self) -> Result<bool> {
        // 如果有token，通知服务器登出
        if let Some(token) = &self.current_token {
            let _ = self
                .client
                .post("https://api.ecopaste.com/auth/logout")
                .bearer_auth(token)
                .send()
                .await;
        }

        // 清除本地存储的认证信息
        self.storage.clear_auth_data().await?;
        
        // 清除内存中的认证信息
        self.current_token = None;
        self.current_user = None;
        self.token_expires_at = None;

        Ok(true)
    }

    pub async fn check_status(&self) -> Result<serde_json::Value> {
        // 检查本地存储的token
        if let Ok(token) = self.storage.load_auth_token().await {
            if self.is_token_valid(&token).await? {
                if let Ok(user_id) = self.storage.load_user_id().await {
                    return Ok(serde_json::json!({
                        "isLoggedIn": true,
                        "userId": user_id,
                        "token": token,
                        "email": self.current_user.as_ref().map(|u| &u.email)
                    }));
                }
            }
        }

        Ok(serde_json::json!({
            "isLoggedIn": false
        }))
    }

    pub async fn refresh_token(&mut self) -> Result<String> {
        if let Some(token) = &self.current_token {
            let response = self
                .client
                .post("https://api.ecopaste.com/auth/refresh")
                .bearer_auth(token)
                .send()
                .await?;

            if response.status().is_success() {
                let refresh_response: serde_json::Value = response.json().await?;
                
                if let Some(new_token) = refresh_response.get("token").and_then(|t| t.as_str()) {
                    self.validate_and_store_token(new_token.to_string()).await?;
                    self.storage.save_auth_token(new_token).await?;
                    return Ok(new_token.to_string());
                }
            }
        }

        Err(Error::AuthenticationFailed("Token refresh failed".to_string()))
    }

    pub fn get_current_token(&self) -> Option<&String> {
        self.current_token.as_ref()
    }

    pub fn get_current_user(&self) -> Option<&User> {
        self.current_user.as_ref()
    }

    async fn validate_and_store_token(&mut self, token: String) -> Result<()> {
        // 这里应该验证token的有效性
        // 为了简化，我们假设token是有效的
        self.current_token = Some(token);
        self.token_expires_at = Some(Utc::now() + Duration::hours(24));
        Ok(())
    }

    async fn is_token_valid(&self, token: &str) -> Result<bool> {
        // 检查token是否过期
        if let Some(expires_at) = self.token_expires_at {
            if Utc::now() > expires_at {
                return Ok(false);
            }
        }

        // 可以添加更多的token验证逻辑
        // 比如向服务器验证token的有效性
        
        Ok(!token.is_empty())
    }

    async fn fetch_user_info(&mut self) -> Result<()> {
        if let Some(token) = &self.current_token {
            let response = self
                .client
                .get("https://api.ecopaste.com/user/profile")
                .bearer_auth(token)
                .send()
                .await?;

            if response.status().is_success() {
                let user_data: serde_json::Value = response.json().await?;
                
                if let (Some(id), Some(email)) = (
                    user_data.get("id").and_then(|v| v.as_str()),
                    user_data.get("email").and_then(|v| v.as_str()),
                ) {
                    self.current_user = Some(User {
                        id: Uuid::parse_str(id).map_err(|e| Error::Unknown(e.to_string()))?,
                        email: email.to_string(),
                        created_at: Utc::now(), // 这里应该从API获取真实的创建时间
                    });
                }
            }
        }
        
        Ok(())
    }

    async fn get_device_info(&self) -> Result<serde_json::Value> {
        Ok(serde_json::json!({
            "platform": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
            "hostname": hostname::get().unwrap_or_default().to_string_lossy(),
            "app_version": env!("CARGO_PKG_VERSION")
        }))
    }

    pub async fn initialize_from_storage(&mut self) -> Result<()> {
        // 尝试从本地存储恢复认证状态
        if let Ok(token) = self.storage.load_auth_token().await {
            if self.is_token_valid(&token).await? {
                self.current_token = Some(token);
                self.fetch_user_info().await?;
            }
        }
        
        Ok(())
    }
}