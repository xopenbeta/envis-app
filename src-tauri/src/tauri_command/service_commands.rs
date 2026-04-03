use anyhow::Result;
use serde_json::Value;

use crate::manager::service_manager::ServiceManager;
use crate::manager::system_info_manager::SystemInfoManager;
use crate::types::ServiceType;

/// 获取已安装的所有服务列表
#[tauri::command]
pub async fn get_all_installed_services() -> Result<Value, String> {
    let manager = ServiceManager::global();

    match manager.get_all_installed_services() {
        Ok(result) => Ok(serde_json::to_value(result).map_err(|e| e.to_string())?),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}

/// 获取单个服务的文件夹大小
#[tauri::command]
pub async fn get_service_size(service_type: ServiceType, version: String) -> Result<Value, String> {
    let manager = ServiceManager::global();

    match manager.get_service_size(&service_type, &version) {
        Ok(result) => Ok(serde_json::to_value(result).map_err(|e| e.to_string())?),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}

/// 删除已安装的服务
#[tauri::command]
pub async fn delete_service(service_type: ServiceType, version: String) -> Result<Value, String> {
    let manager = ServiceManager::global();

    match manager.delete_service(&service_type, &version) {
        Ok(result) => Ok(serde_json::to_value(result).map_err(|e| e.to_string())?),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}

/// 按服务类型列表查询进程资源统计（CPU + 内存）
#[tauri::command]
pub async fn get_services_process_stats(
    service_types: Vec<ServiceType>,
) -> Result<Value, String> {
    fn service_type_to_process_names(service_type: &ServiceType) -> &'static [&'static str] {
        match service_type {
            ServiceType::Nginx => &["nginx"],
            ServiceType::Mongodb => &["mongod"],
            ServiceType::Redis => &["redis-server"],
            ServiceType::Mariadb => &["mariadbd", "mysqld_safe"],
            ServiceType::Mysql => &["mysqld"],
            ServiceType::Postgresql => &["postgres"],
            ServiceType::Dnsmasq => &["dnsmasq"],
            _ => &[],
        }
    }

    // 收集所有需要查询的进程名（去重）
    let mut seen = std::collections::HashSet::new();
    let unique_names: Vec<&'static str> = service_types
        .iter()
        .flat_map(|t| service_type_to_process_names(t).iter().copied())
        .filter(|&n| seen.insert(n))
        .collect();

    let manager = SystemInfoManager::global();
    match manager.get_process_stats_by_names(&unique_names) {
        Ok(stats) => Ok(serde_json::json!({
            "success": true,
            "data": stats
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}
