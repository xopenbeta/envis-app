use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::manager::services::nodejs::NodejsService;
use crate::types::{CommandResponse, ServiceData};

/// 检查 Node.js 是否已安装的 Tauri 命令
#[tauri::command]
pub async fn check_nodejs_installed(version: String) -> Result<CommandResponse, String> {
    let nodejs_service = NodejsService::global();
    let is_installed = nodejs_service.is_installed(&version);
    let message = if is_installed {
        "Node.js 已安装"
    } else {
        "Node.js 未安装"
    };
    let data = serde_json::json!({
        "installed": is_installed
    });
    Ok(CommandResponse::success(message.to_string(), Some(data)))
}

/// 获取可用的 Node.js 版本列表的 Tauri 命令
#[tauri::command]
pub async fn get_nodejs_versions() -> Result<CommandResponse, String> {
    let nodejs_service = NodejsService::global();
    let versions = nodejs_service.get_available_versions();
    let data = serde_json::json!({
        "versions": versions
    });
    Ok(CommandResponse::success(
        "获取 Node.js 版本列表成功".to_string(),
        Some(data),
    ))
}

/// 下载 Node.js 的 Tauri 命令
#[tauri::command]
pub async fn download_nodejs(version: String) -> Result<CommandResponse, String> {
    // 打印日志
    log::info!("tauri::command 开始下载 Node.js {}...", version);
    let nodejs_service = NodejsService::global();
    match nodejs_service.download_and_install(&version).await {
        Ok(result) => {
            let data = serde_json::json!({
                "task": result.task
            });
            if result.success {
                Ok(CommandResponse::success(result.message, Some(data)))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(e) => Ok(CommandResponse::error(format!("下载 Node.js 失败: {}", e))),
    }
}

/// 取消 Node.js 下载的 Tauri 命令
#[tauri::command]
pub async fn cancel_download_nodejs(version: String) -> Result<CommandResponse, String> {
    let nodejs_service = NodejsService::global();
    match nodejs_service.cancel_download(&version) {
        Ok(_) => {
            let data = serde_json::json!({
                "cancelled": true
            });
            Ok(CommandResponse::success(
                "Node.js 下载已取消".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "取消 Node.js 下载失败: {}",
            e
        ))),
    }
}

/// 获取 Node.js 下载进度的 Tauri 命令
#[tauri::command]
pub async fn get_nodejs_download_progress(version: String) -> Result<CommandResponse, String> {
    let nodejs_service = NodejsService::global();
    let task = nodejs_service.get_download_progress(&version);
    let data = serde_json::json!({
        "task": task
    });
    Ok(CommandResponse::success(
        "获取 Node.js 下载进度成功".to_string(),
        Some(data),
    ))
}

#[tauri::command]
pub async fn set_npm_registry(
    environment_id: String,
    mut service_data: ServiceData,
    registry: String,
) -> Result<CommandResponse, String> {
    // 先写入 metadata
    let env_serv_data_manager = EnvServDataManager::global();
    let env_serv_data_manager = env_serv_data_manager.lock().unwrap();
    let _ = env_serv_data_manager.set_metadata(
        &environment_id,
        &mut service_data,
        "NPM_CONFIG_REGISTRY",
        serde_json::Value::String(registry.clone()),
    );

    // 将配置写入终端（导出环境变量）
    let nodejs_service = NodejsService::global();
    match nodejs_service.set_npm_registry(&mut service_data, &registry) {
        Ok(_) => {
            let data = serde_json::json!({
                "registry": registry,
            });
            Ok(CommandResponse::success(
                "设置 Node.js 源成功".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "设置 Node.js 源失败: {}",
            e
        ))),
    }
}

/// 设置包管理器配置前缀的通用 Tauri 命令
#[tauri::command]
pub async fn set_npm_config_prefix(
    environment_id: String,
    mut service_data: ServiceData,
    config_prefix: String,
) -> Result<CommandResponse, String> {
    // 先写入 metadata
    let env_serv_data_manager = EnvServDataManager::global();
    let env_serv_data_manager = env_serv_data_manager.lock().unwrap();
    let _ = env_serv_data_manager.set_metadata(
        &environment_id,
        &mut service_data,
        "NPM_CONFIG_PREFIX",
        serde_json::Value::String(config_prefix.clone()),
    );

    // 将配置写入终端（导出环境变量）
    let nodejs_service = NodejsService::global();
    match nodejs_service.set_npm_config_prefix(&mut service_data, &config_prefix) {
        Ok(_) => {
            let data = serde_json::json!({
                "configPrefix": config_prefix,
            });
            Ok(CommandResponse::success(
                "设置 Node.js 配置前缀成功".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "设置 Node.js 配置前缀失败: {}",
            e
        ))),
    }
}
