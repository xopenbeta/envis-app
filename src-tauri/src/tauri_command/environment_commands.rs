use anyhow::Result;
use envis_core::manager::environment_manager::EnvironmentManager;
use envis_core::types::Environment;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Instant;

#[derive(Debug, Serialize, Deserialize)]
pub struct EnvironmentCommandResult {
    pub success: bool,
    pub message: String,
    pub data: Option<Value>,
}

impl From<envis_core::manager::environment_manager::EnvironmentResult>
    for EnvironmentCommandResult
{
    fn from(result: envis_core::manager::environment_manager::EnvironmentResult) -> Self {
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
    let cmd_start = Instant::now();
    let manager = EnvironmentManager::global();

    let lock_wait_start = Instant::now();
    let manager = manager.lock().unwrap();
    let lock_wait_elapsed = lock_wait_start.elapsed();

    log::debug!(
        "IPC get_all_environments 等待 EnvironmentManager 锁耗时: {:?}",
        lock_wait_elapsed
    );

    match manager.get_all_environments() {
        Ok(environments) => {
            let total_elapsed = cmd_start.elapsed();
            log::debug!(
                "IPC get_all_environments 总耗时(含锁等待): {:?}",
                total_elapsed
            );
            let data = serde_json::json!({ "environments": environments });
            Ok(EnvironmentCommandResult {
                success: true,
                message: "获取环境列表成功".to_string(),
                data: Some(data),
            })
        }
        Err(e) => {
            let total_elapsed = cmd_start.elapsed();
            log::error!(
                "IPC get_all_environments 失败，总耗时(含锁等待): {:?}, 错误: {}",
                total_elapsed,
                e
            );
            Ok(EnvironmentCommandResult {
                success: false,
                message: e.to_string(),
                data: None,
            })
        }
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

/// 获取单个环境
#[tauri::command]
pub async fn get_environment(environment_id: String) -> Result<EnvironmentCommandResult, String> {
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();

    match manager.get_environment(&environment_id) {
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

/// 激活环境和服务
#[tauri::command]
pub async fn activate_environment_and_services(
    mut environment: Environment,
    password: Option<String>,
) -> Result<EnvironmentCommandResult, String> {
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();

    match manager.activate_environment_and_services(&mut environment, password) {
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

/// 停用环境和服务
#[tauri::command]
pub async fn deactivate_environment_and_services(
    mut environment: Environment,
    password: Option<String>,
) -> Result<EnvironmentCommandResult, String> {
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();

    match manager.deactivate_environment_and_services(&mut environment, password) {
        Ok(result) => Ok(result.into()),
        Err(e) => Ok(EnvironmentCommandResult {
            success: false,
            message: e.to_string(),
            data: None,
        }),
    }
}
