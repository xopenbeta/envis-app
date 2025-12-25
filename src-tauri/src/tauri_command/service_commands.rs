use anyhow::Result;
use serde_json::Value;

use crate::manager::service_manager::ServiceManager;
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
