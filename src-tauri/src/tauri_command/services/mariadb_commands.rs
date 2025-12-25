use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::manager::services::mariadb::MariadbService;
use crate::types::{CommandResponse, ServiceData};

#[tauri::command]
pub async fn get_mariadb_versions() -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    let versions = service.get_available_versions();
    let data = serde_json::json!({ "versions": versions });
    Ok(CommandResponse::success(
        "获取 MariaDB 版本列表成功".to_string(),
        Some(data),
    ))
}

#[tauri::command]
pub async fn check_mariadb_installed(version: String) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    let is_installed = service.is_installed(&version);
    let message = if is_installed {
        "MariaDB 已安装"
    } else {
        "MariaDB 未安装"
    };
    let data = serde_json::json!({
        "installed": is_installed
    });
    Ok(CommandResponse::success(message.to_string(), Some(data)))
}

#[tauri::command]
pub async fn download_mariadb(version: String) -> Result<CommandResponse, String> {
    log::info!("tauri::command 开始下载 MariaDB {}...", version);
    let service = MariadbService::global();
    match service.download_and_install(&version).await {
        Ok(result) => {
            if result.success {
                let data = serde_json::json!({ "task": result.task });
                Ok(CommandResponse::success(result.message, Some(data)))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(e) => Ok(CommandResponse::error(format!("下载 MariaDB 失败: {}", e))),
    }
}

#[tauri::command]
pub async fn cancel_mariadb_download(version: String) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.cancel_download(&version) {
        Ok(_) => Ok(CommandResponse::success(
            "MariaDB 下载已取消".to_string(),
            Some(serde_json::json!({ "cancelled": true })),
        )),
        Err(e) => Ok(CommandResponse::error(format!(
            "取消 MariaDB 下载失败: {}",
            e
        ))),
    }
}

#[tauri::command]
pub async fn get_mariadb_download_progress(version: String) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    let task = service.get_download_progress(&version);
    let data = serde_json::json!({ "task": task });
    Ok(CommandResponse::success(
        "获取 MariaDB 下载进度成功".to_string(),
        Some(data),
    ))
}

// 服务控制与配置命令

#[tauri::command]
pub async fn get_mariadb_config(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.get_mariadb_config(&environment_id, &service_data) {
        Ok(res) => {
            let data = res.data;
            Ok(CommandResponse::success(res.message, data))
        }
        Err(e) => Ok(CommandResponse::error(format!("获取配置失败: {}", e))),
    }
}

#[tauri::command]
pub async fn start_mariadb_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.start_service(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("启动失败: {}", e))),
    }
}

#[tauri::command]
pub async fn stop_mariadb_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.stop_service(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("停止失败: {}", e))),
    }
}

#[tauri::command]
pub async fn restart_mariadb_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.restart_service(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("重启失败: {}", e))),
    }
}

#[tauri::command]
pub async fn get_mariadb_service_status(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.get_service_status(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("获取状态失败: {}", e))),
    }
}

#[tauri::command]
pub async fn set_mariadb_data_path(
    environment_id: String,
    service_data: ServiceData,
    data_path: String,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.set_mariadb_data_path(&environment_id, service_data, data_path) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("设置数据目录失败: {}", e))),
    }
}

#[tauri::command]
pub async fn set_mariadb_log_path(
    environment_id: String,
    service_data: ServiceData,
    log_path: String,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.set_mariadb_log_path(&environment_id, service_data, log_path) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("设置日志目录失败: {}", e))),
    }
}

#[tauri::command]
pub async fn set_mariadb_port(
    environment_id: String,
    service_data: ServiceData,
    port: u16,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.set_mariadb_port(&environment_id, service_data, port) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("设置端口失败: {}", e))),
    }
}

#[tauri::command]
pub async fn initialize_mariadb(
    environment_id: String,
    service_data: ServiceData,
    root_password: String,
    port: Option<String>,
    bind_address: Option<String>,
    reset: Option<bool>,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.initialize_mariadb(
        &environment_id,
        &service_data,
        root_password,
        port,
        bind_address,
        reset.unwrap_or(false),
    ) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!(
            "初始化 MariaDB 失败: {}",
            e
        ))),
    }
}

#[tauri::command]
pub async fn check_mariadb_initialized(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    let initialized = service.is_initialized(&environment_id, &service_data);
    let data = serde_json::json!({ "initialized": initialized });
    Ok(CommandResponse::success(
        if initialized {
            "MariaDB 已初始化"
        } else {
            "MariaDB 未初始化"
        }
        .to_string(),
        Some(data),
    ))
}

#[tauri::command]
pub async fn list_mariadb_databases(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.list_databases(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("列出数据库失败: {}", e))),
    }
}

#[tauri::command]
pub async fn create_mariadb_database(
    environment_id: String,
    service_data: ServiceData,
    database_name: String,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.create_database(&environment_id, &service_data, database_name) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("创建数据库失败: {}", e))),
    }
}

#[tauri::command]
pub async fn list_mariadb_tables(
    environment_id: String,
    service_data: ServiceData,
    database_name: String,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.list_tables(&environment_id, &service_data, database_name) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("列出表失败: {}", e))),
    }
}

#[tauri::command]
pub async fn open_mariadb_client(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MariadbService::global();
    match service.open_client(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("打开客户端失败: {}", e))),
    }
}
