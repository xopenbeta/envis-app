use anyhow::Result;
use envis_core::manager::env_serv_data_manager::EnvServDataManager;
use envis_core::manager::environment_manager::EnvironmentManager;
use envis_core::manager::export_import;
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
        Ok(result) => {
            // 无论服务是否全部成功，环境本身状态已变更，始终推送事件
            crate::status_events::emit_environment_status(&environment.id);
            Ok(result.into())
        }
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
    let result = {
        let manager = EnvironmentManager::global();
        let manager = manager.lock().unwrap();
        manager.activate_environment_and_services(&mut environment, password)
    };

    match result {
        Ok(result) => {
            // 无论服务是否全部成功，环境本身状态已变更，始终推送事件
            let env_id = environment.id.clone();
            crate::status_events::emit_environment_status(&env_id);
            // 推送每个服务数据的激活状态（服务状态可能部分成功，全量刷新）
            if let Ok(sd_manager) = EnvServDataManager::global().lock() {
                if let Ok(service_datas) =
                    sd_manager.get_environment_all_service_datas(&env_id)
                {
                    for sd in &service_datas {
                        crate::status_events::emit_service_data_status(&env_id, &sd.id);
                    }
                }
            }
            Ok(result.into())
        }
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
        Ok(result) => {
            // 无论服务是否全部成功，环境本身状态已变更，始终推送事件
            crate::status_events::emit_environment_status(&environment.id);
            Ok(result.into())
        }
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
    let result = {
        let manager = EnvironmentManager::global();
        let manager = manager.lock().unwrap();
        manager.deactivate_environment_and_services(&mut environment, password)
    };

    match result {
        Ok(result) => {
            // 无论服务是否全部成功，环境本身状态已变更，始终推送事件
            let env_id = environment.id.clone();
            crate::status_events::emit_environment_status(&env_id);
            // 推送每个服务数据的停用状态（服务状态可能部分成功，全量刷新）
            if let Ok(sd_manager) = EnvServDataManager::global().lock() {
                if let Ok(service_datas) =
                    sd_manager.get_environment_all_service_datas(&env_id)
                {
                    for sd in &service_datas {
                        crate::status_events::emit_service_data_status(&env_id, &sd.id);
                    }
                }
            }
            Ok(result.into())
        }
        Err(e) => Ok(EnvironmentCommandResult {
            success: false,
            message: e.to_string(),
            data: None,
        }),
    }
}

/// 切换到目标环境（可选：同时停用其他活跃环境）
///
/// `deactivate_others` 对应 GUI 设置项"激活环境时禁用其他环境"，
/// CLI 调用时始终传 `true`，GUI 根据用户配置传入。
#[tauri::command]
pub async fn switch_environment_and_services(
    environment_id: String,
    password: Option<String>,
    deactivate_others: bool,
) -> Result<EnvironmentCommandResult, String> {
    let result = {
        let manager = EnvironmentManager::global();
        let manager = manager.lock().unwrap();
        manager.switch_environment_and_services(&environment_id, password, deactivate_others)
    };

    match result {
        Ok(res) => {
            // 推送被停用的其他环境事件
            for deactivated_id in &res.deactivated_environment_ids {
                crate::status_events::emit_environment_status(deactivated_id);
                // 同时推送被停用环境下所有服务数据的状态变化
                if let Ok(sd_manager) = EnvServDataManager::global().lock() {
                    if let Ok(service_datas) =
                        sd_manager.get_environment_all_service_datas(deactivated_id)
                    {
                        for sd in &service_datas {
                            crate::status_events::emit_service_data_status(deactivated_id, &sd.id);
                        }
                    }
                }
            }
            // 推送目标环境激活事件
            crate::status_events::emit_environment_status(&res.activated_environment_id);
            if let Ok(sd_manager) = EnvServDataManager::global().lock() {
                if let Ok(service_datas) = sd_manager
                    .get_environment_all_service_datas(&res.activated_environment_id)
                {
                    for sd in &service_datas {
                        crate::status_events::emit_service_data_status(
                            &res.activated_environment_id,
                            &sd.id,
                        );
                    }
                }
            }

            Ok(EnvironmentCommandResult {
                success: res.success,
                message: res.message,
                data: None,
            })
        }
        Err(e) => Ok(EnvironmentCommandResult {
            success: false,
            message: e.to_string(),
            data: None,
        }),
    }
}

/// 导出环境为 JSON 字符串
/// 仅保留可跨机器迁移的配置（远程仓库地址、镜像源等），排除本地路径和初始化数据。
#[tauri::command]
pub async fn export_environment_data(
    environment_id: String,
) -> Result<EnvironmentCommandResult, String> {
    match export_import::export_environment(&environment_id) {
        Ok(json) => Ok(EnvironmentCommandResult {
            success: true,
            message: "环境导出成功".to_string(),
            data: Some(serde_json::json!({ "json": json })),
        }),
        Err(e) => Ok(EnvironmentCommandResult {
            success: false,
            message: format!("环境导出失败: {}", e),
            data: None,
        }),
    }
}

/// 从 JSON 字符串导入环境（创建新环境和服务数据，不触发下载/初始化）
#[tauri::command]
pub async fn import_environment_data(
    json_content: String,
) -> Result<EnvironmentCommandResult, String> {
    match export_import::import_environment(&json_content) {
        Ok(result) => Ok(EnvironmentCommandResult {
            success: true,
            message: format!("环境 '{}' 导入成功", result.environment_name),
            data: Some(serde_json::json!({
                "environmentId": result.environment_id,
                "environmentName": result.environment_name,
                "services": result.services,
            })),
        }),
        Err(e) => Ok(EnvironmentCommandResult {
            success: false,
            message: format!("环境导入失败: {}", e),
            data: None,
        }),
    }
}
