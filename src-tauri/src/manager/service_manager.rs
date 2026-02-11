use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::{Arc, OnceLock};

use crate::manager::app_config_manager::AppConfigManager;
use crate::types::ServiceType;

/// 服务信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    #[serde(rename = "type")]
    pub service_type: ServiceType,
    pub version: String,
    pub size: Option<u64>,
    #[serde(rename = "sizeFormatted")]
    pub size_formatted: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceCheckData {
    pub installed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

/// 服务检查结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceCheckResult {
    pub success: bool,
    pub message: String,
    pub data: ServiceCheckData,
}

/// 服务操作结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceResult {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// 全局服务管理器单例
static SERVICE_MANAGER: OnceLock<Arc<ServiceManager>> = OnceLock::new();

/// 服务管理器
pub struct ServiceManager {}

impl ServiceManager {
    /// 获取全局服务管理器实例
    pub fn global() -> Arc<ServiceManager> {
        SERVICE_MANAGER
            .get_or_init(|| {
                let manager = Self::new();
                Arc::new(manager)
            })
            .clone()
    }

    /// 创建新的服务管理器
    fn new() -> Self {
        Self {}
    }

    /// 获取已安装的所有服务列表
    pub fn get_all_installed_services(&self) -> Result<ServiceResult> {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            app_config_manager.get_services_folder()
        }; // 锁在这里被释放

        let mut services = Vec::new();

        if !Path::new(&services_folder).exists() {
            return Ok(ServiceResult {
                success: false,
                message: "服务文件夹不存在".to_string(),
                data: None,
            });
        }

        // 扫描服务文件夹
        let entries = fs::read_dir(&services_folder).context("读取服务文件夹失败")?;

        for entry in entries {
            let entry = entry.context("读取目录项失败")?;
            let service_type_path = entry.path();

            if service_type_path.is_dir() {
                let service_type_name = service_type_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");

                // 容错，跳过空名称或无效的服务类型
                if service_type_name.is_empty() {
                    continue;
                }

                // 尝试将字符串转换为 ServiceType
                if let Some(service_type) = self.string_to_service_type(service_type_name) {
                    // 遍历服务版本文件夹
                    if let Ok(version_entries) = fs::read_dir(&service_type_path) {
                        for version_entry in version_entries {
                            if let Ok(version_entry) = version_entry {
                                let version_path = version_entry.path();

                                if version_path.is_dir() {
                                    let version = version_path
                                        .file_name()
                                        .and_then(|n| n.to_str())
                                        .unwrap_or("")
                                        .to_string();

                                    if !version.is_empty() {
                                        services.push(Service {
                                            service_type: service_type.clone(),
                                            version,
                                            size: None, // 稍后异步获取
                                            size_formatted: "计算中...".to_string(),
                                            path: Some(version_path.to_string_lossy().to_string()),
                                            installed: Some(true),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(ServiceResult {
            success: true,
            message: "获取服务列表成功".to_string(),
            data: Some(serde_json::json!({ "services": services })),
        })
    }

    /// 获取单个服务的文件夹大小
    pub fn get_service_size(
        &self,
        service_type: &ServiceType,
        version: &str,
    ) -> Result<ServiceResult> {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            app_config_manager.get_services_folder()
        }; // 锁在这里被释放

        let service_type_str = self.service_type_to_string(service_type);
        let service_path = Path::new(&services_folder)
            .join(&service_type_str)
            .join(version);

        if !service_path.exists() {
            return Ok(ServiceResult {
                success: false,
                message: "服务不存在".to_string(),
                data: Some(serde_json::json!({
                    "size": 0,
                    "sizeFormatted": "未知"
                })),
            });
        }

        let size = self.get_folder_size(&service_path)?;
        let size_formatted = self.format_file_size(size);

        Ok(ServiceResult {
            success: true,
            message: "获取服务大小成功".to_string(),
            data: Some(serde_json::json!({
                "size": size,
                "sizeFormatted": size_formatted
            })),
        })
    }

    /// 删除已安装的服务
    pub fn delete_service(
        &self,
        service_type: &ServiceType,
        version: &str,
    ) -> Result<ServiceResult> {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            app_config_manager.get_services_folder()
        }; // 锁在这里被释放

        let service_type_str = self.service_type_to_string(service_type);
        let service_path = Path::new(&services_folder)
            .join(&service_type_str)
            .join(version);

        if !service_path.exists() {
            return Ok(ServiceResult {
                success: false,
                message: "服务不存在".to_string(),
                data: None,
            });
        }

        // 删除服务文件夹
        fs::remove_dir_all(&service_path).context("删除服务文件夹失败")?;

        // 检查父文件夹是否为空，如果为空则删除
        let parent_path = Path::new(&services_folder).join(&service_type_str);
        if let Ok(entries) = fs::read_dir(&parent_path) {
            if entries.count() == 0 {
                let _ = fs::remove_dir(&parent_path); // 忽略删除父文件夹的错误
            }
        }

        log::info!("服务已删除: {} {}", service_type_str, version);

        Ok(ServiceResult {
            success: true,
            message: format!("{} {} 删除成功", service_type_str, version),
            data: None,
        })
    }

    /// 将服务类型枚举转换为字符串
    fn service_type_to_string(&self, service_type: &ServiceType) -> String {
        match service_type {
            ServiceType::Mongodb => "mongodb".to_string(),
            ServiceType::Mariadb => "mariadb".to_string(),
            ServiceType::Mysql => "mysql".to_string(),
            ServiceType::Postgresql => "postgresql".to_string(),
            ServiceType::Nginx => "nginx".to_string(),
            ServiceType::Nodejs => "nodejs".to_string(),
            ServiceType::Python => "python".to_string(),
            ServiceType::Java => "java".to_string(),
            ServiceType::Custom => "custom".to_string(),
            ServiceType::Host => "host".to_string(),
            ServiceType::SSL => "ssl".to_string(),
            ServiceType::Dnsmasq => "dnsmasq".to_string(),
        }
    }

    /// 将字符串转换为服务类型枚举
    fn string_to_service_type(&self, service_type_str: &str) -> Option<ServiceType> {
        match service_type_str {
            "mongodb" => Some(ServiceType::Mongodb),
            "mariadb" => Some(ServiceType::Mariadb),
            "mysql" => Some(ServiceType::Mysql),
            "postgresql" => Some(ServiceType::Postgresql),
            "nginx" => Some(ServiceType::Nginx),
            "nodejs" => Some(ServiceType::Nodejs),
            "python" => Some(ServiceType::Python),
            "custom" => Some(ServiceType::Custom),
            "host" => Some(ServiceType::Host),
            "ssl" => Some(ServiceType::SSL),
            "dnsmasq" => Some(ServiceType::Dnsmasq),
            _ => None,
        }
    }

    /// 递归计算文件夹大小
    fn get_folder_size(&self, path: &Path) -> Result<u64> {
        let mut size = 0;

        if path.is_file() {
            return Ok(path.metadata().context("获取文件元数据失败")?.len());
        }

        if path.is_dir() {
            let entries = fs::read_dir(path).context("读取目录失败")?;

            for entry in entries {
                let entry = entry.context("读取目录项失败")?;
                let entry_path = entry.path();

                size += self.get_folder_size(&entry_path)?;
            }
        }

        Ok(size)
    }

    /// 格式化文件大小
    fn format_file_size(&self, size: u64) -> String {
        const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
        let mut size = size as f64;
        let mut unit_index = 0;

        while size >= 1024.0 && unit_index < UNITS.len() - 1 {
            size /= 1024.0;
            unit_index += 1;
        }

        if unit_index == 0 {
            format!("{} {}", size as u64, UNITS[unit_index])
        } else {
            format!("{:.2} {}", size, UNITS[unit_index])
        }
    }
}

/// 初始化服务管理器
pub fn initialize_service_manager() -> Result<()> {
    match std::panic::catch_unwind(|| ServiceManager::global()) {
        Ok(_) => {
            log::info!("服务管理器初始化成功");
            Ok(())
        }
        Err(_) => {
            log::error!("服务管理器初始化失败: ServiceManager::global() 发生 panic");
            Err(anyhow::anyhow!("服务管理器初始化失败"))
        }
    }
}
