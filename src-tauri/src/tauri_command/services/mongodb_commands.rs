use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::manager::services::mongodb::MongodbService;
use crate::types::{CommandResponse, ServiceData};
use tauri::AppHandle;

#[tauri::command]
pub async fn get_mongodb_versions() -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    let versions = service.get_available_versions();
    let data = serde_json::json!({ "versions": versions });
    Ok(CommandResponse::success(
        "获取 MongoDB 版本列表成功".to_string(),
        Some(data),
    ))
}

#[tauri::command]
pub async fn download_mongodb(version: String) -> Result<CommandResponse, String> {
    log::info!("tauri::command 开始下载 MongoDB {}...", version);
    let service = MongodbService::global();
    match service.download_and_install(&version).await {
        Ok(result) => {
            if result.success {
                let data = serde_json::json!({ "task": result.task });
                Ok(CommandResponse::success(result.message, Some(data)))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(e) => Ok(CommandResponse::error(format!("下载 MongoDB 失败: {}", e))),
    }
}

#[tauri::command]
pub async fn cancel_mongodb_download(version: String) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.cancel_download(&version) {
        Ok(_) => Ok(CommandResponse::success(
            "MongoDB 下载已取消".to_string(),
            Some(serde_json::json!({ "cancelled": true })),
        )),
        Err(e) => Ok(CommandResponse::error(format!(
            "取消 MongoDB 下载失败: {}",
            e
        ))),
    }
}

#[tauri::command]
pub async fn check_mongodb_installed(version: String) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    let installed = service.is_installed(&version);
    let data = serde_json::json!({ "installed": installed });
    Ok(CommandResponse::success(
        "检查 MongoDB 安装状态成功".to_string(),
        Some(data),
    ))
}

#[tauri::command]
pub async fn get_mongodb_download_progress(version: String) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    let task = service.get_download_progress(&version);
    let data = serde_json::json!({ "task": task });
    Ok(CommandResponse::success(
        "获取 MongoDB 下载进度成功".to_string(),
        Some(data),
    ))
}

// 服务控制与配置命令

#[tauri::command]
pub async fn get_mongodb_config(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.get_mongodb_config(&environment_id, &service_data) {
        Ok(res) => {
            let data = res.data;
            Ok(CommandResponse::success(res.message, data))
        }
        Err(e) => Ok(CommandResponse::error(format!("获取配置失败: {}", e))),
    }
}

#[tauri::command]
pub async fn start_mongodb_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.start_service(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("启动失败: {}", e))),
    }
}

#[tauri::command]
pub async fn stop_mongodb_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.stop_service(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("停止失败: {}", e))),
    }
}

#[tauri::command]
pub async fn restart_mongodb_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.restart_service(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("重启失败: {}", e))),
    }
}

#[tauri::command]
pub async fn get_mongodb_service_status(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.get_service_status(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("获取状态失败: {}", e))),
    }
}

#[tauri::command]
pub async fn open_mongodb_compass(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.open_compass(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!(
            "打开 MongoDB Compass 失败: {}",
            e
        ))),
    }
}

#[tauri::command]
pub async fn open_mongodb_shell(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.open_shell(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!(
            "打开 Mongo Shell 失败: {}",
            e
        ))),
    }
}

#[tauri::command]
pub async fn initialize_mongodb(
    app_handle: AppHandle,
    environment_id: String,
    service_data: ServiceData,
    admin_username: String,
    admin_password: String,
    port: Option<String>,
    bind_ip: Option<String>,
    enable_replica_set: Option<bool>,
    reset: Option<bool>,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    let reset = reset.unwrap_or(false);
    let enable_replica_set = enable_replica_set.unwrap_or(false);
    match service.initialize_mongodb(
        &app_handle,
        &environment_id,
        &service_data,
        admin_username,
        admin_password,
        port,
        bind_ip,
        enable_replica_set,
        reset,
    ) {
        Ok(res) => {
            if res.success {
                Ok(CommandResponse::success(res.message, res.data))
            } else {
                Ok(CommandResponse::error(res.message))
            }
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "初始化 MongoDB 失败: {}",
            e
        ))),
    }
}

#[tauri::command]
pub async fn check_mongodb_initialized(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    let initialized = service.is_initialized(&environment_id, &service_data);
    let data = serde_json::json!({ "initialized": initialized });
    Ok(CommandResponse::success(
        "检查初始化状态成功".to_string(),
        Some(data),
    ))
}

#[tauri::command]
pub async fn list_mongodb_databases(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.list_databases(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("获取数据库列表失败: {}", e))),
    }
}

#[tauri::command]
pub async fn list_mongodb_collections(
    environment_id: String,
    service_data: ServiceData,
    database_name: String,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.list_collections(&environment_id, &service_data, database_name) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("获取集合列表失败: {}", e))),
    }
}

#[tauri::command]
pub async fn create_mongodb_database(
    environment_id: String,
    service_data: ServiceData,
    database_name: String,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.create_database(&environment_id, &service_data, database_name) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("创建数据库失败: {}", e))),
    }
}

#[tauri::command]
pub async fn create_mongodb_user(
    environment_id: String,
    service_data: ServiceData,
    username: String,
    password: String,
    databases: Vec<String>,
    roles: Vec<String>,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.create_user(
        &environment_id,
        &service_data,
        username,
        password,
        databases,
        roles,
    ) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("创建用户失败: {}", e))),
    }
}

#[tauri::command]
pub async fn list_mongodb_users(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.list_users(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("获取用户列表失败: {}", e))),
    }
}

#[tauri::command]
pub async fn update_mongodb_user_roles(
    environment_id: String,
    service_data: ServiceData,
    username: String,
    databases: Vec<String>,
    roles: Vec<String>,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.update_user_roles(&environment_id, &service_data, username, databases, roles) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("更新用户权限失败: {}", e))),
    }
}

#[tauri::command]
pub async fn delete_mongodb_user(
    environment_id: String,
    service_data: ServiceData,
    username: String,
) -> Result<CommandResponse, String> {
    let service = MongodbService::global();
    match service.delete_user(&environment_id, &service_data, username) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("删除用户失败: {}", e))),
    }
}
