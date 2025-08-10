use std::collections::HashMap;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce, Key
};
use base64::{Engine as _, engine::general_purpose};
use sha2::{Sha256, Digest};
use serde_json::Value;
use rand::RngCore;

use crate::{
    models::*,
    Result, Error,
};

#[derive(Clone)]
pub struct EncryptionManager {
    master_key: Option<EncryptionKey>,
    device_keys: HashMap<String, EncryptionKey>,
}

impl EncryptionManager {
    pub fn new() -> Self {
        Self {
            master_key: None,
            device_keys: HashMap::new(),
        }
    }

    /// 初始化主密钥
    pub fn initialize_master_key(&mut self, password: &str, salt: &str) -> Result<()> {
        let key = self.derive_key_from_password(password, salt)?;
        self.master_key = Some(EncryptionKey {
            key_id: "master".to_string(),
            key_data: key,
            created_at: chrono::Utc::now().to_rfc3339(),
            algorithm: "AES-256-GCM".to_string(),
        });
        Ok(())
    }

    /// 生成设备密钥
    pub fn generate_device_key(&mut self, device_id: &str) -> Result<EncryptionKey> {
        let mut key_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut key_bytes);
        
        let device_key = EncryptionKey {
            key_id: format!("device_{}", device_id),
            key_data: key_bytes.to_vec(),
            created_at: chrono::Utc::now().to_rfc3339(),
            algorithm: "AES-256-GCM".to_string(),
        };
        
        self.device_keys.insert(device_id.to_string(), device_key.clone());
        Ok(device_key)
    }

    /// 从密码派生密钥
    pub fn derive_key_from_password(&self, password: &str, salt: &str) -> Result<Vec<u8>> {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        hasher.update(salt.as_bytes());
        
        // 简单的密钥派生，实际应用中应该使用PBKDF2或Argon2
        let mut result = hasher.finalize().to_vec();
        
        // 多轮哈希增强安全性
        for _ in 0..10000 {
            let mut hasher = Sha256::new();
            hasher.update(&result);
            hasher.update(password.as_bytes());
            result = hasher.finalize().to_vec();
        }
        
        Ok(result)
    }

    /// 加密剪贴板数据
    pub async fn encrypt_clipboard_data(&self, data: &ClipboardPayload) -> Result<EncryptedData> {
        let key = self.get_encryption_key()?;
        
        // 序列化数据
        let plaintext = serde_json::to_vec(data)
            .map_err(|e| Error::EncryptionFailed(format!("Failed to serialize data: {}", e)))?;
        
        // 生成随机nonce
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // 创建加密器
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key.key_data));
        
        // 加密数据
        let ciphertext = cipher.encrypt(nonce, plaintext.as_ref())
            .map_err(|e| Error::EncryptionFailed(format!("Encryption failed: {}", e)))?;
        
        Ok(EncryptedData {
            data: general_purpose::STANDARD.encode(&ciphertext),
            nonce: general_purpose::STANDARD.encode(&nonce_bytes),
            key_id: key.key_id.clone(),
            algorithm: key.algorithm.clone(),
        })
    }

    /// 解密剪贴板数据
    pub async fn decrypt_clipboard_data(&self, encrypted_data: &Value) -> Result<ClipboardPayload> {
        let encrypted: EncryptedData = serde_json::from_value(encrypted_data.clone())
            .map_err(|e| Error::DecryptionFailed(format!("Failed to parse encrypted data: {}", e)))?;
        
        let key = self.get_key_by_id(&encrypted.key_id)
            .ok_or_else(|| Error::DecryptionFailed(format!("Key not found: {}", encrypted.key_id)))?;
        
        // 解码数据
        let ciphertext = general_purpose::STANDARD.decode(&encrypted.data)
            .map_err(|e| Error::DecryptionFailed(format!("Failed to decode ciphertext: {}", e)))?;
        
        let nonce_bytes = general_purpose::STANDARD.decode(&encrypted.nonce)
            .map_err(|e| Error::DecryptionFailed(format!("Failed to decode nonce: {}", e)))?;
        
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // 创建解密器
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key.key_data));
        
        // 解密数据
        let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| Error::DecryptionFailed(format!("Decryption failed: {}", e)))?;
        
        // 反序列化数据
        let data: ClipboardPayload = serde_json::from_slice(&plaintext)
            .map_err(|e| Error::DecryptionFailed(format!("Failed to deserialize data: {}", e)))?;
        
        Ok(data)
    }

    /// 加密配置数据
    pub async fn encrypt_config(&self, config: &SyncConfig) -> Result<EncryptedData> {
        let key = self.get_encryption_key()?;
        
        // 序列化配置
        let plaintext = serde_json::to_vec(config)
            .map_err(|e| Error::EncryptionFailed(format!("Failed to serialize config: {}", e)))?;
        
        // 生成随机nonce
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // 创建加密器
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key.key_data));
        
        // 加密数据
        let ciphertext = cipher.encrypt(nonce, plaintext.as_ref())
            .map_err(|e| Error::EncryptionFailed(format!("Config encryption failed: {}", e)))?;
        
        Ok(EncryptedData {
            data: general_purpose::STANDARD.encode(&ciphertext),
            nonce: general_purpose::STANDARD.encode(&nonce_bytes),
            key_id: key.key_id.clone(),
            algorithm: key.algorithm.clone(),
        })
    }

    /// 解密配置数据
    pub async fn decrypt_config(&self, encrypted_data: &EncryptedData) -> Result<SyncConfig> {
        let key = self.get_key_by_id(&encrypted_data.key_id)
            .ok_or_else(|| Error::DecryptionFailed(format!("Key not found: {}", encrypted_data.key_id)))?;
        
        // 解码数据
        let ciphertext = general_purpose::STANDARD.decode(&encrypted_data.data)
            .map_err(|e| Error::DecryptionFailed(format!("Failed to decode config ciphertext: {}", e)))?;
        
        let nonce_bytes = general_purpose::STANDARD.decode(&encrypted_data.nonce)
            .map_err(|e| Error::DecryptionFailed(format!("Failed to decode config nonce: {}", e)))?;
        
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // 创建解密器
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key.key_data));
        
        // 解密数据
        let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| Error::DecryptionFailed(format!("Config decryption failed: {}", e)))?;
        
        // 反序列化配置
        let config: SyncConfig = serde_json::from_slice(&plaintext)
            .map_err(|e| Error::DecryptionFailed(format!("Failed to deserialize config: {}", e)))?;
        
        Ok(config)
    }

    /// 生成数据哈希
    pub fn generate_hash(&self, data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = hasher.finalize();
        general_purpose::STANDARD.encode(&result)
    }

    /// 验证数据完整性
    pub fn verify_integrity(&self, data: &[u8], expected_hash: &str) -> bool {
        let actual_hash = self.generate_hash(data);
        actual_hash == expected_hash
    }

    /// 加密敏感字符串
    pub async fn encrypt_string(&self, plaintext: &str) -> Result<String> {
        let key = self.get_encryption_key()?;
        
        // 生成随机nonce
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // 创建加密器
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key.key_data));
        
        // 加密数据
        let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| Error::EncryptionFailed(format!("String encryption failed: {}", e)))?;
        
        // 组合nonce和密文
        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&ciphertext);
        
        Ok(general_purpose::STANDARD.encode(&result))
    }

    /// 解密敏感字符串
    pub async fn decrypt_string(&self, encrypted: &str) -> Result<String> {
        let key = self.get_encryption_key()?;
        
        // 解码数据
        let data = general_purpose::STANDARD.decode(encrypted)
            .map_err(|e| Error::DecryptionFailed(format!("Failed to decode encrypted string: {}", e)))?;
        
        if data.len() < 12 {
            return Err(Error::DecryptionFailed("Invalid encrypted data length".to_string()));
        }
        
        // 分离nonce和密文
        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        
        // 创建解密器
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key.key_data));
        
        // 解密数据
        let plaintext = cipher.decrypt(nonce, ciphertext)
            .map_err(|e| Error::DecryptionFailed(format!("String decryption failed: {}", e)))?;
        
        String::from_utf8(plaintext)
            .map_err(|e| Error::DecryptionFailed(format!("Invalid UTF-8 in decrypted string: {}", e)))
    }

    /// 导出加密密钥（用于备份）
    pub fn export_key(&self, key_id: &str) -> Result<String> {
        let key = self.get_key_by_id(key_id)
            .ok_or_else(|| Error::Unknown(format!("Key not found: {}", key_id)))?;
        
        let exported = serde_json::to_string(key)
            .map_err(|e| Error::Unknown(format!("Failed to export key: {}", e)))?;
        
        Ok(general_purpose::STANDARD.encode(exported.as_bytes()))
    }

    /// 导入加密密钥（用于恢复）
    pub fn import_key(&mut self, exported_key: &str) -> Result<()> {
        let decoded = general_purpose::STANDARD.decode(exported_key)
            .map_err(|e| Error::Unknown(format!("Failed to decode exported key: {}", e)))?;
        
        let key_json = String::from_utf8(decoded)
            .map_err(|e| Error::Unknown(format!("Invalid UTF-8 in exported key: {}", e)))?;
        
        let key: EncryptionKey = serde_json::from_str(&key_json)
            .map_err(|e| Error::Unknown(format!("Failed to parse exported key: {}", e)))?;
        
        if key.key_id == "master" {
            self.master_key = Some(key);
        } else if key.key_id.starts_with("device_") {
            let device_id = key.key_id.strip_prefix("device_").unwrap().to_string();
            self.device_keys.insert(device_id, key);
        }
        
        Ok(())
    }

    /// 轮换密钥
    pub fn rotate_device_key(&mut self, device_id: &str) -> Result<EncryptionKey> {
        self.generate_device_key(device_id)
    }

    /// 清除所有密钥
    pub fn clear_keys(&mut self) {
        self.master_key = None;
        self.device_keys.clear();
    }

    /// 获取当前加密密钥
    fn get_encryption_key(&self) -> Result<&EncryptionKey> {
        self.master_key.as_ref()
            .ok_or_else(|| Error::EncryptionFailed("No encryption key available".to_string()))
    }

    /// 根据ID获取密钥
    fn get_key_by_id(&self, key_id: &str) -> Option<&EncryptionKey> {
        if key_id == "master" {
            self.master_key.as_ref()
        } else if key_id.starts_with("device_") {
            let device_id = key_id.strip_prefix("device_")?;
            self.device_keys.get(device_id)
        } else {
            None
        }
    }
}

impl Default for EncryptionManager {
    fn default() -> Self {
        Self::new()
    }
}