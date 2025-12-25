use crate::manager::services::nginx::NginxService;
use crate::types::{CommandResponse, ServiceData};
use std::process::Command;

/// 按版本检查 Nginx 是否已安装
#[tauri::command]
pub async fn check_nginx_installed(version: String) -> Result<CommandResponse, String> {
    let nginx_service = NginxService::global();
    let is_installed = nginx_service.is_installed(&version);
    let data = serde_json::json!({"installed": is_installed});
    if is_installed {
        Ok(CommandResponse::success("Nginx 已安装".to_string(), Some(data)))
    } else {
        Ok(CommandResponse::success("Nginx 未安装".to_string(), Some(data)))
    }
}

/// 获取 Nginx 配置
#[tauri::command]
pub async fn get_nginx_config(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    // 从 metadata 中读取配置
    let conf_path = service_data
        .metadata
        .as_ref()
        .and_then(|m| m.get("NGINX_CONF"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    
    // 读取配置文件内容
    if !conf_path.is_empty() {
        match std::fs::read_to_string(conf_path) {
            Ok(content) => {
                let data = serde_json::json!({
                    "content": content
                });
                Ok(CommandResponse::success(
                    "读取配置文件成功".to_string(),
                    Some(data),
                ))
            }
            Err(e) => Ok(CommandResponse::error(format!("读取配置文件失败: {}", e))),
        }
    } else {
        Ok(CommandResponse::error("未配置 Nginx 配置文件路径".to_string()))
    }
}

/// 启动 Nginx 服务
#[tauri::command]
pub async fn start_nginx_service(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let nginx_service = NginxService::global();
    match nginx_service.start_service(&service_data) {
        Ok(_) => Ok(CommandResponse::success(
            "Nginx 服务启动成功".to_string(),
            None,
        )),
        Err(e) => Ok(CommandResponse::error(format!("启动 Nginx 服务失败: {}", e))),
    }
}

/// 停止 Nginx 服务
#[tauri::command]
pub async fn stop_nginx_service(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let nginx_service = NginxService::global();
    match nginx_service.stop_service(&service_data) {
        Ok(_) => Ok(CommandResponse::success(
            "Nginx 服务停止成功".to_string(),
            None,
        )),
        Err(e) => Ok(CommandResponse::error(format!("停止 Nginx 服务失败: {}", e))),
    }
}

/// 重启 Nginx 服务
#[tauri::command]
pub async fn restart_nginx_service(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let nginx_service = NginxService::global();
    match nginx_service.restart_service(&service_data) {
        Ok(_) => Ok(CommandResponse::success(
            "Nginx 服务重启成功".to_string(),
            None,
        )),
        Err(e) => Ok(CommandResponse::error(format!("重启 Nginx 服务失败: {}", e))),
    }
}

/// 获取 Nginx 服务状态
#[tauri::command]
pub async fn get_nginx_service_status(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let nginx_service = NginxService::global();
    match nginx_service.get_service_status(&service_data) {
        Ok(status) => {
            let data = serde_json::json!({
                "status": status
            });
            Ok(CommandResponse::success(
                "获取 Nginx 服务状态成功".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "获取 Nginx 服务状态失败: {}",
            e
        ))),
    }
}

// /// 获取可用的 Nginx 版本列表的 Tauri 命令
#[tauri::command]
pub async fn get_nginx_versions() -> Result<CommandResponse, String> {
    let nginx_service = NginxService::global();
    let versions = nginx_service.get_available_versions();
    let data = serde_json::json!({"versions": versions});
    Ok(CommandResponse::success(
        "获取 Nginx 版本列表成功".to_string(),
        Some(data),
    ))
}

// /// 下载 Nginx 的 Tauri 命令
#[tauri::command]
pub async fn download_nginx(version: String) -> Result<CommandResponse, String> {
    log::info!("tauri::command 开始下载 Nginx {}...", version);
    let nginx_service = NginxService::global();
    match nginx_service.download_and_install(&version).await {
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
        Err(e) => Ok(CommandResponse::error(format!("下载 Nginx 失败: {}", e))),
    }
}

// /// 取消 Nginx 下载的 Tauri 命令
#[tauri::command]
pub async fn cancel_download_nginx(version: String) -> Result<CommandResponse, String> {
    let nginx_service = NginxService::global();
    match nginx_service.cancel_download(&version) {
        Ok(_) => {
            let data = serde_json::json!({"cancelled": true});
            Ok(CommandResponse::success("Nginx 下载已取消".to_string(), Some(data)))
        }
        Err(e) => Ok(CommandResponse::error(format!("取消 Nginx 下载失败: {}", e))),
    }
}

// /// 获取 Nginx 下载进度的 Tauri 命令
#[tauri::command]
pub async fn get_nginx_download_progress(version: String) -> Result<CommandResponse, String> {
    let nginx_service = NginxService::global();
    let task = nginx_service.get_download_progress(&version);
    let data = serde_json::json!({"task": task});
    Ok(CommandResponse::success(
        "获取 Nginx 下载进度成功".to_string(),
        Some(data),
    ))
}
