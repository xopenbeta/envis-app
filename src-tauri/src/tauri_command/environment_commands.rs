use crate::manager::environment_manager::EnvironmentManager;
use crate::types::Environment;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct EnvironmentCommandResult {
    pub success: bool,
    pub message: String,
    pub data: Option<Value>,
}

impl From<crate::manager::environment_manager::EnvironmentResult> for EnvironmentCommandResult {
    fn from(result: crate::manager::environment_manager::EnvironmentResult) -> Self {
        Self {
            success: result.success,
            message: result.message,
            data: result.data,
        }
    }
}

/// 获取所有环境
#[tauri::command]
pub async fn get_all_environments() -> Result<EnvironmentCommandResult, String> {
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();

    match manager.get_all_environments() {
        Ok(environments) => {
            let data = serde_json::json!({ "environments": environments });
            Ok(EnvironmentCommandResult {
                success: true,
                message: "获取环境列表成功".to_string(),
                data: Some(data),
            })
        }
        Err(e) => Ok(EnvironmentCommandResult {
            success: false,
            message: e.to_string(),
            data: None,
        }),
    }
}

/// 创建环境
#[tauri::command]
pub async fn create_environment(
    name: String,
    description: Option<String>,
) -> Result<EnvironmentCommandResult, String> {
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();

    match manager.create_environment(name, description) {
        Ok(result) => Ok(result.into()),
        Err(e) => Ok(EnvironmentCommandResult {
            success: false,
            message: e.to_string(),
            data: None,
        }),
    }
}

/// 保存环境
#[tauri::command]
pub async fn save_environment(
    environment: Environment,
) -> Result<EnvironmentCommandResult, String> {
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();

    match manager.save_environment(&environment) {
        Ok(result) => Ok(result.into()),
        Err(e) => Ok(EnvironmentCommandResult {
            success: false,
            message: e.to_string(),
            data: None,
        }),
    }
}

/// 删除环境
#[tauri::command]
pub async fn delete_environment(
    environment: Environment,
) -> Result<EnvironmentCommandResult, String> {
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();

    match manager.delete_environment(&environment) {
        Ok(result) => Ok(result.into()),
        Err(e) => Ok(EnvironmentCommandResult {
            success: false,
            message: e.to_string(),
            data: None,
        }),
    }
}

/// 检查环境是否存在
#[tauri::command]
pub async fn is_environment_exists(
    environment: Environment,
) -> Result<EnvironmentCommandResult, String> {
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();

    match manager.is_environment_exists(&environment) {
        Ok(exists) => {
            let data = serde_json::json!({ "exists": exists });
            Ok(EnvironmentCommandResult {
                success: true,
                message: "检查环境是否存在成功".to_string(),
                data: Some(data),
            })
        }
        Err(e) => Ok(EnvironmentCommandResult {
            success: false,
            message: e.to_string(),
            data: None,
        }),
    }
}

/// 激活环境
#[tauri::command]
pub async fn activate_environment(
    mut environment: Environment,
) -> Result<EnvironmentCommandResult, String> {
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();

    match manager.activate_environment(&mut environment) {
        Ok(result) => Ok(result.into()),
        Err(e) => Ok(EnvironmentCommandResult {
            success: false,
            message: e.to_string(),
            data: None,
        }),
    }
}

/// 停用环境
#[tauri::command]
pub async fn deactivate_environment(
    mut environment: Environment,
) -> Result<EnvironmentCommandResult, String> {
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();

    match manager.deactivate_environment(&mut environment) {
        Ok(result) => Ok(result.into()),
        Err(e) => Ok(EnvironmentCommandResult {
            success: false,
            message: e.to_string(),
            data: None,
        }),
    }
}
