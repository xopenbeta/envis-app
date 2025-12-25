use anyhow::Result;
use serde_json::Value;

use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::types::{CreateServiceDataRequest, ServiceData, ServiceDataStatus};

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

    // 使用前端传递的 id 和 name
    let service_id = request.id;
    let service_name = request.name;

    // 设置时间戳
    let now = chrono::Utc::now().to_rfc3339();

    // 获取当前环境的所有服务数据，计算最大 sort 值
    let existing_service_datas = match manager.get_environment_all_service_datas(&environment_id) {
        Ok(datas) => datas,
        Err(_) => Vec::new(),
    };
    let max_sort = existing_service_datas
        .iter()
        .filter_map(|sd| sd.sort)
        .max()
        .unwrap_or(0);

    // 构建完整的 ServiceData
    let mut service_data = ServiceData {
        id: service_id,
        name: service_name,
        service_type: request.service_type,
        version: request.version,
        status: ServiceDataStatus::Inactive, // 默认为 Inactive，后续可以根据安装状态调整
        sort: Some(max_sort + 1),            // 设置为最大 sort 值 + 1，确保排在最后
        metadata: None,                      // 稍后由 build_default_metadata 填充
        created_at: now.clone(),
        updated_at: now,
    };

    // 根据服务类型构建一份默认的 metadata
    match manager.build_default_metadata(&environment_id, &service_data) {
        Ok(default_md) => {
            service_data.metadata = Some(default_md);
        }
        Err(e) => {
            return Ok(serde_json::json!({
                "success": false,
                "message": format!("构建默认 metadata 失败: {}", e)
            }));
        }
    }

    match manager.save_service_data(&environment_id, &service_data) {
        Ok(_) => Ok(serde_json::json!({
            "success": true,
            "message": "服务创建成功",
            "data": {
                "serviceData": service_data
            }
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}

/// 保存服务数据到环境
#[tauri::command]
pub async fn save_service_data(
    environment_id: String,
    service_data: ServiceData,
) -> Result<Value, String> {
    let manager = EnvServDataManager::global();
    let manager = manager.lock().unwrap();

    match manager.save_service_data(&environment_id, &service_data) {
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
    service_data: ServiceData,
) -> Result<Value, String> {
    let manager = EnvServDataManager::global();
    let manager = manager.lock().unwrap();

    match manager.delete_service_data(&environment_id, &service_data) {
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
