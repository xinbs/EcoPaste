use std::collections::HashMap;
use chrono::{DateTime, Utc};
use serde_json::Value;
use uuid::Uuid;

use crate::{
    models::*,
    storage::LocalStorage,
    Result, Error,
};

#[derive(Clone)]
pub struct ConflictResolver {
    storage: LocalStorage,
    pending_conflicts: HashMap<String, SyncConflict>,
}

#[derive(Debug, Clone)]
pub enum ConflictResolutionStrategy {
    /// 使用最新的数据
    UseLatest,
    /// 使用本地数据
    UseLocal,
    /// 使用远程数据
    UseRemote,
    /// 合并数据（如果可能）
    Merge,
    /// 手动解决
    Manual,
}

#[derive(Debug, Clone)]
pub struct ConflictResolution {
    pub conflict_id: String,
    pub strategy: ConflictResolutionStrategy,
    pub resolved_data: Option<ClipboardPayload>,
    pub resolved_by: String, // 设备ID或用户ID
    pub resolved_at: DateTime<Utc>,
    pub notes: Option<String>,
}

impl ConflictResolver {
    pub fn new(storage: LocalStorage) -> Self {
        Self {
            storage,
            pending_conflicts: HashMap::new(),
        }
    }

    /// 检测冲突
    pub async fn detect_conflict(
        &mut self,
        local_data: &ClipboardPayload,
        remote_data: &ClipboardPayload,
        device_id: &str,
    ) -> Result<Option<SyncConflict>> {
        // 检查是否存在冲突
        if self.has_conflict(local_data, remote_data) {
            let conflict = SyncConflict {
                conflict_id: Uuid::new_v4().to_string(),
                local_item: local_data.clone(),
                remote_item: remote_data.clone(),
                conflict_type: self.determine_conflict_type(local_data, remote_data),
                detected_at: Utc::now().to_rfc3339(),
                device_id: device_id.to_string(),
                status: "pending".to_string(),
                resolution: None,
            };

            // 保存冲突到本地存储
            self.storage.save_conflict(&conflict).await?;
            
            // 添加到待处理冲突列表
            self.pending_conflicts.insert(conflict.conflict_id.clone(), conflict.clone());
            
            log::info!("Conflict detected: {}", conflict.conflict_id);
            Ok(Some(conflict))
        } else {
            Ok(None)
        }
    }

    /// 自动解决冲突
    pub async fn auto_resolve_conflict(
        &mut self,
        conflict_id: &str,
        strategy: ConflictResolutionStrategy,
        device_id: &str,
    ) -> Result<ConflictResolution> {
        let conflict = self.get_conflict(conflict_id)
            .ok_or_else(|| Error::Unknown(format!("Conflict not found: {}", conflict_id)))?;

        let resolved_data = match strategy {
            ConflictResolutionStrategy::UseLatest => {
                self.resolve_use_latest(&conflict.local_item, &conflict.remote_item)?
            }
            ConflictResolutionStrategy::UseLocal => {
                conflict.local_item.clone()
            }
            ConflictResolutionStrategy::UseRemote => {
                conflict.remote_item.clone()
            }
            ConflictResolutionStrategy::Merge => {
                self.resolve_merge(&conflict.local_item, &conflict.remote_item)?
            }
            ConflictResolutionStrategy::Manual => {
                return Err(Error::Unknown("Manual resolution requires user input".to_string()));
            }
        };

        let resolution = ConflictResolution {
            conflict_id: conflict_id.to_string(),
            strategy,
            resolved_data: Some(resolved_data),
            resolved_by: device_id.to_string(),
            resolved_at: Utc::now(),
            notes: None,
        };

        // 更新冲突状态
        self.mark_conflict_resolved(conflict_id, &resolution).await?;
        
        log::info!("Conflict auto-resolved: {} using {:?}", conflict_id, resolution.strategy);
        Ok(resolution)
    }

    /// 手动解决冲突
    pub async fn manual_resolve_conflict(
        &mut self,
        conflict_id: &str,
        resolved_data: ClipboardPayload,
        device_id: &str,
        notes: Option<String>,
    ) -> Result<ConflictResolution> {
        let _conflict = self.get_conflict(conflict_id)
            .ok_or_else(|| Error::Unknown(format!("Conflict not found: {}", conflict_id)))?;

        let resolution = ConflictResolution {
            conflict_id: conflict_id.to_string(),
            strategy: ConflictResolutionStrategy::Manual,
            resolved_data: Some(resolved_data),
            resolved_by: device_id.to_string(),
            resolved_at: Utc::now(),
            notes,
        };

        // 更新冲突状态
        self.mark_conflict_resolved(conflict_id, &resolution).await?;
        
        log::info!("Conflict manually resolved: {}", conflict_id);
        Ok(resolution)
    }

    /// 获取待解决的冲突
    pub async fn get_pending_conflicts(&self) -> Result<Vec<SyncConflict>> {
        let conflicts = self.storage.load_conflicts().await?;
        Ok(conflicts.into_iter()
            .filter(|c| c.status == "pending")
            .collect())
    }

    /// 获取已解决的冲突
    pub async fn get_resolved_conflicts(&self) -> Result<Vec<SyncConflict>> {
        let conflicts = self.storage.load_conflicts().await?;
        Ok(conflicts.into_iter()
            .filter(|c| c.status == "resolved")
            .collect())
    }

    /// 清理已解决的冲突
    pub async fn cleanup_resolved_conflicts(&self, older_than_days: i64) -> Result<i32> {
        let cutoff_date = Utc::now() - chrono::Duration::days(older_than_days);
        let conflicts = self.storage.load_conflicts().await?;
        
        let mut cleaned_count = 0;
        for conflict in conflicts {
            if conflict.status == "resolved" {
                if let Ok(detected_at) = DateTime::parse_from_rfc3339(&conflict.detected_at) {
                    if detected_at.with_timezone(&Utc) < cutoff_date {
                        self.storage.delete_conflict(&conflict.conflict_id).await?;
                        cleaned_count += 1;
                    }
                }
            }
        }
        
        log::info!("Cleaned up {} resolved conflicts", cleaned_count);
        Ok(cleaned_count)
    }

    /// 获取冲突统计
    pub async fn get_conflict_stats(&self) -> Result<Value> {
        let conflicts = self.storage.load_conflicts().await?;
        
        let total = conflicts.len();
        let pending = conflicts.iter().filter(|c| c.status == "pending").count();
        let resolved = conflicts.iter().filter(|c| c.status == "resolved").count();
        
        let mut type_counts = HashMap::new();
        for conflict in &conflicts {
            *type_counts.entry(conflict.conflict_type.clone()).or_insert(0) += 1;
        }
        
        Ok(serde_json::json!({
            "total": total,
            "pending": pending,
            "resolved": resolved,
            "by_type": type_counts
        }))
    }

    /// 检查是否存在冲突
    fn has_conflict(&self, local_data: &ClipboardPayload, remote_data: &ClipboardPayload) -> bool {
        // 检查时间戳冲突
        if let (Ok(local_time), Ok(remote_time)) = (
            DateTime::parse_from_rfc3339(&local_data.timestamp),
            DateTime::parse_from_rfc3339(&remote_data.timestamp)
        ) {
            let time_diff = (local_time.timestamp() - remote_time.timestamp()).abs();
            
            // 如果时间差小于5秒，认为是同时修改，可能存在冲突
            if time_diff < 5 {
                return self.has_content_conflict(local_data, remote_data);
            }
        }
        
        // 检查内容冲突
        self.has_content_conflict(local_data, remote_data)
    }

    /// 检查内容冲突
    fn has_content_conflict(&self, local_data: &ClipboardPayload, remote_data: &ClipboardPayload) -> bool {
        // 如果类型不同，认为有冲突
        if local_data.r#type != remote_data.r#type {
            return true;
        }
        
        // 如果内容不同，认为有冲突
        match local_data.r#type.as_str() {
            "text" => {
                local_data.value != remote_data.value
            }
            "image" => {
                // 对于图片，比较哈希或大小
                local_data.value != remote_data.value ||
                local_data.width != remote_data.width ||
                local_data.height != remote_data.height
            }
            "file" => {
                // 对于文件，比较路径和大小
                local_data.value != remote_data.value
            }
            _ => {
                // 其他类型直接比较值
                local_data.value != remote_data.value
            }
        }
    }

    /// 确定冲突类型
    fn determine_conflict_type(&self, local_data: &ClipboardPayload, remote_data: &ClipboardPayload) -> String {
        if local_data.r#type != remote_data.r#type {
            "type_mismatch".to_string()
        } else if local_data.value != remote_data.value {
            "content_mismatch".to_string()
        } else {
            "metadata_mismatch".to_string()
        }
    }

    /// 使用最新数据解决冲突
    fn resolve_use_latest(&self, local_data: &ClipboardPayload, remote_data: &ClipboardPayload) -> Result<ClipboardPayload> {
        let local_time = DateTime::parse_from_rfc3339(&local_data.timestamp)
            .map_err(|e| Error::Unknown(format!("Invalid local timestamp: {}", e)))?;
        let remote_time = DateTime::parse_from_rfc3339(&remote_data.timestamp)
            .map_err(|e| Error::Unknown(format!("Invalid remote timestamp: {}", e)))?;
        
        if local_time > remote_time {
            Ok(local_data.clone())
        } else {
            Ok(remote_data.clone())
        }
    }

    /// 合并数据解决冲突
    fn resolve_merge(&self, local_data: &ClipboardPayload, remote_data: &ClipboardPayload) -> Result<ClipboardPayload> {
        // 简单的合并策略：对于文本类型，尝试合并内容
        if local_data.r#type == "text" && remote_data.r#type == "text" {
            let merged_value = format!("{} | {}", local_data.value, remote_data.value);
            
            let mut merged_data = local_data.clone();
            merged_data.value = merged_value;
            merged_data.timestamp = Utc::now().to_rfc3339();
            
            Ok(merged_data)
        } else {
            // 对于其他类型，使用最新的数据
            self.resolve_use_latest(local_data, remote_data)
        }
    }

    /// 标记冲突为已解决
    async fn mark_conflict_resolved(&mut self, conflict_id: &str, resolution: &ConflictResolution) -> Result<()> {
        if let Some(mut conflict) = self.pending_conflicts.remove(conflict_id) {
            conflict.status = "resolved".to_string();
            conflict.resolution = Some(serde_json::to_value(resolution)
                .map_err(|e| Error::Unknown(format!("Failed to serialize resolution: {}", e)))?);
            
            self.storage.save_conflict(&conflict).await?;
        }
        
        Ok(())
    }

    /// 获取冲突
    fn get_conflict(&self, conflict_id: &str) -> Option<&SyncConflict> {
        self.pending_conflicts.get(conflict_id)
    }

    /// 加载待处理冲突
    pub async fn load_pending_conflicts(&mut self) -> Result<()> {
        let conflicts = self.get_pending_conflicts().await?;
        
        self.pending_conflicts.clear();
        for conflict in conflicts {
            self.pending_conflicts.insert(conflict.conflict_id.clone(), conflict);
        }
        
        log::info!("Loaded {} pending conflicts", self.pending_conflicts.len());
        Ok(())
    }

    /// 批量解决冲突
    pub async fn batch_resolve_conflicts(
        &mut self,
        strategy: ConflictResolutionStrategy,
        device_id: &str,
    ) -> Result<Vec<ConflictResolution>> {
        let conflict_ids: Vec<String> = self.pending_conflicts.keys().cloned().collect();
        let mut resolutions = Vec::new();
        
        for conflict_id in conflict_ids {
            match self.auto_resolve_conflict(&conflict_id, strategy.clone(), device_id).await {
                Ok(resolution) => resolutions.push(resolution),
                Err(e) => log::error!("Failed to resolve conflict {}: {}", conflict_id, e),
            }
        }
        
        log::info!("Batch resolved {} conflicts", resolutions.len());
        Ok(resolutions)
    }
}