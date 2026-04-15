use envis_core::manager::env_serv_data_manager::EnvServDataManager;
use envis_core::manager::services::postgresql::PostgresqlService;
use envis_core::types::{CommandResponse, ServiceData};

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

/// 初始化 PostgreSQL
#[tauri::command]
pub async fn initialize_postgresql(
    environment_id: String,
    mut service_data: ServiceData,
    super_password: String,
    port: Option<String>,
    bind_address: Option<String>,
    reset: Option<bool>,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.initialize_service(
        &environment_id,
        &service_data,
        super_password.clone(),
        port,
        bind_address,
        reset.unwrap_or(false),
    ) {
        Ok(result) => {
            if result.success {
                if let Some(data) = result.data.as_ref() {
                    let env_serv_data_manager = EnvServDataManager::global();
                    let env_serv_data_manager = env_serv_data_manager.lock().unwrap();

                    if let Some(config_path) = data.get("configPath").and_then(|v| v.as_str()) {
                        let _ = env_serv_data_manager.set_metadata(
                            &environment_id,
                            &mut service_data,
                            "POSTGRESQL_CONFIG",
                            serde_json::Value::String(config_path.to_string()),
                        );
                    }
                    if let Some(data_path) = data.get("dataPath").and_then(|v| v.as_str()) {
                        let _ = env_serv_data_manager.set_metadata(
                            &environment_id,
                            &mut service_data,
                            "PGDATA",
                            serde_json::Value::String(data_path.to_string()),
                        );
                    }
                    if let Some(port_value) = data.get("port").and_then(|v| v.as_str()) {
                        let _ = env_serv_data_manager.set_metadata(
                            &environment_id,
                            &mut service_data,
                            "PGPORT",
                            serde_json::Value::String(port_value.to_string()),
                        );
                    }
                    if let Some(bind_address_value) =
                        data.get("bindAddress").and_then(|v| v.as_str())
                    {
                        let _ = env_serv_data_manager.set_metadata(
                            &environment_id,
                            &mut service_data,
                            "PGHOST",
                            serde_json::Value::String(bind_address_value.to_string()),
                        );
                    }
                    if let Some(super_password_value) =
                        data.get("superPassword").and_then(|v| v.as_str())
                    {
                        let _ = env_serv_data_manager.set_metadata(
                            &environment_id,
                            &mut service_data,
                            "POSTGRESQL_SUPER_PASSWORD",
                            serde_json::Value::String(super_password_value.to_string()),
                        );
                    }
                }
                Ok(CommandResponse::success(result.message, result.data))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(e) => Ok(CommandResponse::error(format!("初始化 PostgreSQL 失败: {}", e))),
    }
}

/// 检查 PostgreSQL 是否已初始化
#[tauri::command]
pub async fn check_postgresql_initialized(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.check_initialized(&environment_id, &service_data) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!(
            "检查 PostgreSQL 初始化状态失败: {}",
            e
        ))),
    }
}

/// 列出 PostgreSQL 数据库
#[tauri::command]
pub async fn list_postgresql_databases(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.list_databases(&environment_id, &service_data) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("列出数据库失败: {}", e))),
    }
}

/// 创建 PostgreSQL 数据库
#[tauri::command]
pub async fn create_postgresql_database(
    environment_id: String,
    service_data: ServiceData,
    database_name: String,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.create_database(&environment_id, &service_data, database_name) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("创建数据库失败: {}", e))),
    }
}

/// 列出 PostgreSQL 表
#[tauri::command]
pub async fn list_postgresql_tables(
    environment_id: String,
    service_data: ServiceData,
    database_name: String,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.list_tables(&environment_id, &service_data, database_name) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("列出表失败: {}", e))),
    }
}

/// 打开 PostgreSQL 客户端
#[tauri::command]
pub async fn open_postgresql_client(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.open_client(&environment_id, &service_data) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("打开客户端失败: {}", e))),
    }
}

/// 列出 PostgreSQL 角色
#[tauri::command]
pub async fn list_postgresql_roles(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.list_roles(&environment_id, &service_data) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("列出角色失败: {}", e))),
    }
}

/// 创建 PostgreSQL 角色
#[tauri::command]
pub async fn create_postgresql_role(
    environment_id: String,
    service_data: ServiceData,
    role_name: String,
    password: String,
    grants: Vec<serde_json::Value>,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.create_role(&environment_id, &service_data, role_name, password, grants)
    {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("创建角色失败: {}", e))),
    }
}

/// 删除 PostgreSQL 角色
#[tauri::command]
pub async fn delete_postgresql_role(
    environment_id: String,
    service_data: ServiceData,
    role_name: String,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.delete_role(&environment_id, &service_data, role_name) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("删除角色失败: {}", e))),
    }
}

/// 更新 PostgreSQL 角色权限
#[tauri::command]
pub async fn update_postgresql_role_grants(
    environment_id: String,
    service_data: ServiceData,
    role_name: String,
    grants: Vec<serde_json::Value>,
) -> Result<CommandResponse, String> {
    let postgresql_service = PostgresqlService::global();
    match postgresql_service.update_role_grants(&environment_id, &service_data, role_name, grants) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("更新角色权限失败: {}", e))),
    }
}
