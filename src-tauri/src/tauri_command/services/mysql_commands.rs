use crate::manager::services::mysql::MysqlService;
use crate::types::{CommandResponse, ServiceData};

/// 检查 MySQL 是否已安装的 Tauri 命令
#[tauri::command]
pub async fn check_mysql_installed(version: String) -> Result<CommandResponse, String> {
    let mysql_service = MysqlService::global();
    let is_installed = mysql_service.is_installed(&version);
    let message = if is_installed {
        "MySQL 已安装"
    } else {
        "MySQL 未安装"
    };
    let data = serde_json::json!({
        "installed": is_installed
    });
    Ok(CommandResponse::success(message.to_string(), Some(data)))
}

/// 获取可用的 MySQL 版本列表的 Tauri 命令
#[tauri::command]
pub async fn get_mysql_versions() -> Result<CommandResponse, String> {
    let mysql_service = MysqlService::global();
    let versions = mysql_service.get_available_versions();
    let data = serde_json::json!({
        "versions": versions
    });
    Ok(CommandResponse::success(
        "获取 MySQL 版本列表成功".to_string(),
        Some(data),
    ))
}

/// 下载 MySQL 的 Tauri 命令
#[tauri::command]
pub async fn download_mysql(version: String) -> Result<CommandResponse, String> {
    log::info!("tauri::command 开始下载 MySQL {}...", version);
    let mysql_service = MysqlService::global();
    match mysql_service.download_and_install(&version).await {
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
        Err(e) => Ok(CommandResponse::error(format!("下载 MySQL 失败: {}", e))),
    }
}

/// 取消 MySQL 下载的 Tauri 命令
#[tauri::command]
pub async fn cancel_mysql_download(version: String) -> Result<CommandResponse, String> {
    let mysql_service = MysqlService::global();
    match mysql_service.cancel_download(&version) {
        Ok(_) => {
            let data = serde_json::json!({
                "cancelled": true
            });
            Ok(CommandResponse::success(
                "MySQL 下载已取消".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "取消 MySQL 下载失败: {}",
            e
        ))),
    }
}

/// 获取 MySQL 下载进度的 Tauri 命令
#[tauri::command]
pub async fn get_mysql_download_progress(version: String) -> Result<CommandResponse, String> {
    let mysql_service = MysqlService::global();
    let task = mysql_service.get_download_progress(&version);
    let data = serde_json::json!({
        "task": task
    });
    Ok(CommandResponse::success(
        "获取 MySQL 下载进度成功".to_string(),
        Some(data),
    ))
}

/// 获取 MySQL 配置
#[tauri::command]
pub async fn get_mysql_config(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.get_mysql_config(&environment_id, &service_data) {
        Ok(res) => {
            let data = res.data;
            Ok(CommandResponse::success(res.message, data))
        }
        Err(e) => Ok(CommandResponse::error(format!("获取配置失败: {}", e))),
    }
}

/// 启动 MySQL 服务
#[tauri::command]
pub async fn start_mysql_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.start_service(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("启动失败: {}", e))),
    }
}

/// 停止 MySQL 服务
#[tauri::command]
pub async fn stop_mysql_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.stop_service(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("停止失败: {}", e))),
    }
}

/// 重启 MySQL 服务
#[tauri::command]
pub async fn restart_mysql_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.restart_service(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("重启失败: {}", e))),
    }
}

/// 获取 MySQL 服务状态
#[tauri::command]
pub async fn get_mysql_service_status(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.get_service_status(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("获取状态失败: {}", e))),
    }
}

/// 设置 MySQL 数据目录
#[tauri::command]
pub async fn set_mysql_data_path(
    environment_id: String,
    service_data: ServiceData,
    data_path: String,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.set_mysql_data_path(&environment_id, service_data, data_path) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("设置数据目录失败: {}", e))),
    }
}

/// 设置 MySQL 日志目录
#[tauri::command]
pub async fn set_mysql_log_path(
    environment_id: String,
    service_data: ServiceData,
    log_path: String,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.set_mysql_log_path(&environment_id, service_data, log_path) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("设置日志目录失败: {}", e))),
    }
}

/// 设置 MySQL 端口
#[tauri::command]
pub async fn set_mysql_port(
    environment_id: String,
    service_data: ServiceData,
    port: u16,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.set_mysql_port(&environment_id, service_data, port) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("设置端口失败: {}", e))),
    }
}

/// 初始化 MySQL
#[tauri::command]
pub async fn initialize_mysql(
    environment_id: String,
    service_data: ServiceData,
    root_password: String,
    port: Option<String>,
    bind_address: Option<String>,
    reset: Option<bool>,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.initialize_mysql(
        &environment_id,
        &service_data,
        root_password,
        port,
        bind_address,
        reset.unwrap_or(false),
    ) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("初始化 MySQL 失败: {}", e))),
    }
}

/// 检查 MySQL 是否已初始化
#[tauri::command]
pub async fn check_mysql_initialized(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    let initialized = service.is_initialized(&environment_id, &service_data);
    let data = serde_json::json!({ "initialized": initialized });
    Ok(CommandResponse::success(
        if initialized {
            "MySQL 已初始化"
        } else {
            "MySQL 未初始化"
        }
        .to_string(),
        Some(data),
    ))
}

/// 列出 MySQL 数据库
#[tauri::command]
pub async fn list_mysql_databases(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.list_databases(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("列出数据库失败: {}", e))),
    }
}

/// 创建 MySQL 数据库
#[tauri::command]
pub async fn create_mysql_database(
    environment_id: String,
    service_data: ServiceData,
    database_name: String,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.create_database(&environment_id, &service_data, database_name) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("创建数据库失败: {}", e))),
    }
}

/// 列出 MySQL 表
#[tauri::command]
pub async fn list_mysql_tables(
    environment_id: String,
    service_data: ServiceData,
    database_name: String,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.list_tables(&environment_id, &service_data, database_name) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("列出表失败: {}", e))),
    }
}

/// 打开 MySQL 客户端
#[tauri::command]
pub async fn open_mysql_client(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MysqlService::global();
    match service.open_client(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("打开客户端失败: {}", e))),
    }
}
