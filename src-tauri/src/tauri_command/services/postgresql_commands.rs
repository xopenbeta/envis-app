use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::manager::services::postgresql::PostgresqlService;
use crate::types::{CommandResponse, ServiceData};

/// 检查 PostgreSQL 是否已安装的 Tauri 命令
#[tauri::command]
pub async fn check_postgresql_installed(version: String) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    let is_installed = postgresql_service.is_installed(&version);
    let message = if is_installed {
        "PostgreSQL 已安装"
    } else {
        "PostgreSQL 未安装"
    };
    let data = serde_json::json!({
        "installed": is_installed
    });
    Ok(CommandResponse::success(message.to_string(), Some(data)))
}

/// 获取可用的 PostgreSQL 版本列表的 Tauri 命令
#[tauri::command]
pub async fn get_postgresql_versions() -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    let versions = postgresql_service.get_available_versions();
    let data = serde_json::json!({
        "versions": versions
    });
    Ok(CommandResponse::success(
        "获取 PostgreSQL 版本列表成功".to_string(),
        Some(data),
    ))
}

/// 下载 PostgreSQL 的 Tauri 命令
#[tauri::command]
pub async fn download_postgresql(version: String) -> Result<CommandResponse, String> {
    log::info!("tauri::command 开始下载 PostgreSQL {}...", version);
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.download_and_install(&version).await {
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
        Err(e) => Ok(CommandResponse::error(format!(
            "下载 PostgreSQL 失败: {}",
            e
        ))),
    }
}

/// 取消 PostgreSQL 下载的 Tauri 命令
#[tauri::command]
pub async fn cancel_postgresql_download(version: String) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.cancel_download(&version) {
        Ok(_) => {
            let data = serde_json::json!({
                "cancelled": true
            });
            Ok(CommandResponse::success(
                "PostgreSQL 下载已取消".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "取消 PostgreSQL 下载失败: {}",
            e
        ))),
    }
}

/// 获取 PostgreSQL 下载进度的 Tauri 命令
#[tauri::command]
pub async fn get_postgresql_download_progress(version: String) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    let task = postgresql_service.get_download_progress(&version);
    let data = serde_json::json!({
        "task": task
    });
    Ok(CommandResponse::success(
        "获取 PostgreSQL 下载进度成功".to_string(),
        Some(data),
    ))
}

/// 获取 PostgreSQL 配置的 Tauri 命令
#[tauri::command]
pub async fn get_postgresql_config(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.get_config(&environment_id, &service_data) {
        Ok(result) => {
            if result.success {
                Ok(CommandResponse::success(result.message, result.data))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "获取 PostgreSQL 配置失败: {}",
            e
        ))),
    }
}

/// 设置 PostgreSQL 数据目录的 Tauri 命令
#[tauri::command]
pub async fn set_postgresql_data_path(
    environment_id: String,
    mut service_data: ServiceData,
    data_path: String,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.set_data_path(&mut service_data, &data_path) {
        Ok(_) => {
            // 更新到配置文件
            let env_serv_data_manager = EnvServDataManager::global();
            let env_serv_data_manager = env_serv_data_manager.lock().unwrap();
            let _ = env_serv_data_manager.set_metadata(
                &environment_id,
                &mut service_data,
                "PGDATA",
                serde_json::Value::String(data_path.clone()),
            );

            let data = serde_json::json!({
                "dataPath": data_path,
            });
            Ok(CommandResponse::success(
                "设置 PostgreSQL 数据目录成功".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "设置 PostgreSQL 数据目录失败: {}",
            e
        ))),
    }
}

/// 设置 PostgreSQL 端口的 Tauri 命令
#[tauri::command]
pub async fn set_postgresql_port(
    environment_id: String,
    mut service_data: ServiceData,
    port: i64,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.set_port(&mut service_data, port) {
        Ok(_) => {
            // 更新到配置文件
            let env_serv_data_manager = EnvServDataManager::global();
            let env_serv_data_manager = env_serv_data_manager.lock().unwrap();
            let _ = env_serv_data_manager.set_metadata(
                &environment_id,
                &mut service_data,
                "PGPORT",
                serde_json::Value::Number(port.into()),
            );

            let data = serde_json::json!({
                "port": port,
            });
            Ok(CommandResponse::success(
                "设置 PostgreSQL 端口成功".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "设置 PostgreSQL 端口失败: {}",
            e
        ))),
    }
}

/// 启动 PostgreSQL 服务的 Tauri 命令
#[tauri::command]
pub async fn start_postgresql_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.start_service(&environment_id, &service_data) {
        Ok(result) => {
            if result.success {
                Ok(CommandResponse::success(result.message, result.data))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "启动 PostgreSQL 服务失败: {}",
            e
        ))),
    }
}

/// 停止 PostgreSQL 服务的 Tauri 命令
#[tauri::command]
pub async fn stop_postgresql_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.stop_service(&environment_id, &service_data) {
        Ok(result) => {
            if result.success {
                Ok(CommandResponse::success(result.message, result.data))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "停止 PostgreSQL 服务失败: {}",
            e
        ))),
    }
}

/// 重启 PostgreSQL 服务的 Tauri 命令
#[tauri::command]
pub async fn restart_postgresql_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.restart_service(&environment_id, &service_data) {
        Ok(result) => {
            if result.success {
                Ok(CommandResponse::success(result.message, result.data))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "重启 PostgreSQL 服务失败: {}",
            e
        ))),
    }
}

/// 获取 PostgreSQL 服务状态的 Tauri 命令
#[tauri::command]
pub async fn get_postgresql_service_status(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.get_service_status(&environment_id, &service_data) {
        Ok(result) => {
            if result.success {
                Ok(CommandResponse::success(result.message, result.data))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "获取 PostgreSQL 服务状态失败: {}",
            e
        ))),
    }
}
