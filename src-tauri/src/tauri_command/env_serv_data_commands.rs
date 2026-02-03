use anyhow::Result;
use serde_json::Value;

use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::types::{
    CreateServiceDataRequest, ServiceData, ServiceDataStatus, UpdateServiceDataRequest,
};

/// 获取指定环境的所有服务数据
#[tauri::command]
pub async fn get_environment_all_service_datas(environment_id: String) -> Result<Value, String> {
    let manager = EnvServDataManager::global();
    let manager = manager.lock().unwrap();
    match manager.get_environment_all_service_datas(&environment_id) {
        Ok(service_datas) => Ok(serde_json::json!({
            "success": true,
            "data": {
                "serviceDatas": service_datas
            }
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}

/// 创建服务数据到环境
#[tauri::command]
pub async fn create_service_data(
    environment_id: String,
    request: CreateServiceDataRequest,
) -> Result<Value, String> {
    let manager = EnvServDataManager::global();
    let manager = manager.lock().unwrap();

    match manager.create_service_data(&environment_id, request.service_type, request.version) {
        Ok(result) => Ok(serde_json::to_value(result).map_err(|e| e.to_string())?),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}

/// 更新服务数据
#[tauri::command]
pub async fn update_service_data(
    environment_id: String,
    request: UpdateServiceDataRequest,
) -> Result<Value, String> {
    let manager = EnvServDataManager::global();
    let manager = manager.lock().unwrap();

    match manager.update_service_data(&environment_id, request) {
        Ok(result) => Ok(serde_json::to_value(result).map_err(|e| e.to_string())?),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}


/// 删除服务数据
#[tauri::command]
pub async fn delete_service_data(
    environment_id: String,
    service_id: String,
) -> Result<Value, String> {
    let manager = EnvServDataManager::global();
    let manager = manager.lock().unwrap();

    match manager.delete_service_data(&environment_id, &service_id) {
        Ok(result) => Ok(serde_json::to_value(result).map_err(|e| e.to_string())?),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}

/// 激活服务数据
#[tauri::command]
pub async fn active_service_data(
    environment_id: String,
    mut service_data: ServiceData,
    password: Option<String>,
) -> Result<Value, String> {
    let manager = EnvServDataManager::global();
    let manager = manager.lock().unwrap();
    match manager.active_service_data(&environment_id, &mut service_data, password) {
        Ok(result) => Ok(serde_json::to_value(result).map_err(|e| e.to_string())?),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}

/// 停用服务数据
#[tauri::command]
pub async fn deactive_service_data(
    environment_id: String,
    mut service_data: ServiceData,
    password: Option<String>,
) -> Result<Value, String> {
    let manager = EnvServDataManager::global();
    let manager = manager.lock().unwrap();
    match manager.deactive_service_data(&environment_id, &mut service_data, password) {
        Ok(result) => Ok(serde_json::to_value(result).map_err(|e| e.to_string())?),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}
