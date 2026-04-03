use crate::manager::services::redis::RedisService;
use crate::types::{CommandResponse, ServiceData};

#[tauri::command]
pub async fn get_redis_versions() -> Result<CommandResponse, String> {
    let service = RedisService::global();
    let versions = service.get_available_versions();
    let data = serde_json::json!({ "versions": versions });
    Ok(CommandResponse::success(
        "获取 Redis 版本列表成功".to_string(),
        Some(data),
    ))
}

#[tauri::command]
pub async fn download_redis(version: String) -> Result<CommandResponse, String> {
    let service = RedisService::global();
    match service.download_and_install(&version).await {
        Ok(result) => {
            let data = serde_json::json!({ "task": result.task });
            if result.success {
                Ok(CommandResponse::success(result.message, Some(data)))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(e) => Ok(CommandResponse::error(format!("下载 Redis 失败: {}", e))),
    }
}

#[tauri::command]
pub async fn cancel_download_redis(version: String) -> Result<CommandResponse, String> {
    let service = RedisService::global();
    match service.cancel_download(&version) {
        Ok(_) => Ok(CommandResponse::success(
            "Redis 下载已取消".to_string(),
            Some(serde_json::json!({ "cancelled": true })),
        )),
        Err(e) => Ok(CommandResponse::error(format!("取消 Redis 下载失败: {}", e))),
    }
}

#[tauri::command]
pub async fn check_redis_installed(version: String) -> Result<CommandResponse, String> {
    let service = RedisService::global();
    let installed = service.is_installed(&version);
    Ok(CommandResponse::success(
        "检查 Redis 安装状态成功".to_string(),
        Some(serde_json::json!({ "installed": installed })),
    ))
}

#[tauri::command]
pub async fn get_redis_download_progress(version: String) -> Result<CommandResponse, String> {
    let service = RedisService::global();
    let task = service.get_download_progress(&version);
    Ok(CommandResponse::success(
        "获取 Redis 下载进度成功".to_string(),
        Some(serde_json::json!({ "task": task })),
    ))
}

#[tauri::command]
pub async fn get_redis_config(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = RedisService::global();
    match service.get_redis_config(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("获取 Redis 配置失败: {}", e))),
    }
}

#[tauri::command]
pub async fn start_redis_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = RedisService::global();
    match service.start_service(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("启动 Redis 失败: {}", e))),
    }
}

#[tauri::command]
pub async fn stop_redis_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = RedisService::global();
    match service.stop_service(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("停止 Redis 失败: {}", e))),
    }
}

#[tauri::command]
pub async fn restart_redis_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = RedisService::global();
    match service.restart_service(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("重启 Redis 失败: {}", e))),
    }
}

#[tauri::command]
pub async fn get_redis_service_status(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = RedisService::global();
    match service.get_service_status(&environment_id, &service_data) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("获取 Redis 状态失败: {}", e))),
    }
}

#[tauri::command]
pub async fn initialize_redis(
    environment_id: String,
    service_data: ServiceData,
    password: Option<String>,
    port: Option<String>,
    bind_ip: Option<String>,
    reset: Option<bool>,
) -> Result<CommandResponse, String> {
    let service = RedisService::global();
    match service.initialize_redis(
        &environment_id,
        &service_data,
        password,
        port,
        bind_ip,
        reset.unwrap_or(false),
    ) {
        Ok(res) => Ok(CommandResponse::success(res.message, res.data)),
        Err(e) => Ok(CommandResponse::error(format!("初始化 Redis 失败: {}", e))),
    }
}

#[tauri::command]
pub async fn check_redis_initialized(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let service = RedisService::global();
    let initialized = service.is_initialized(&environment_id, &service_data);
    Ok(CommandResponse::success(
        if initialized {
            "Redis 已初始化"
        } else {
            "Redis 未初始化"
        }
        .to_string(),
        Some(serde_json::json!({ "initialized": initialized })),
    ))
}
