use crate::manager::services::dnsmasq::DnsmasqService;
use crate::types::{CommandResponse, ServiceData};
use std::process::Command;

/// 按版本检查 Dnsmasq 是否已安装
#[tauri::command]
pub async fn check_dnsmasq_installed(version: String) -> Result<CommandResponse, String> {
    let dnsmasq_service = DnsmasqService::global();
    let is_installed = dnsmasq_service.is_installed(&version);
    let data = serde_json::json!({"installed": is_installed});
    if is_installed {
        Ok(CommandResponse::success("Dnsmasq 已安装".to_string(), Some(data)))
    } else {
        Ok(CommandResponse::success("Dnsmasq 未安装".to_string(), Some(data)))
    }
}

/// 获取 Dnsmasq 配置
#[tauri::command]
pub async fn get_dnsmasq_config(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let dnsmasq_service = DnsmasqService::global();
    let conf_path = dnsmasq_service.get_config_path(&service_data);
    
    if let Some(path) = conf_path {
        match std::fs::read_to_string(&path) {
            Ok(content) => {
                let data = serde_json::json!({
                    "content": content,
                    // 返回实际使用的路径，以便前端可能需要更新 metadata
                    "path": path 
                });
                Ok(CommandResponse::success(
                    "获取 Dnsmasq 配置成功".to_string(),
                    Some(data),
                ))
            }
            Err(e) => Ok(CommandResponse::error(format!("读取配置文件失败: {}", e))),
        }
    } else {
        Ok(CommandResponse::error("未配置 Dnsmasq 配置文件路径，且默认配置文件不存在".to_string()))
    }
}

/// 启动 Dnsmasq 服务
#[tauri::command]
pub async fn start_dnsmasq_service(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let dnsmasq_service = DnsmasqService::global();
    match dnsmasq_service.start_service(&service_data) {
        Ok(_) => Ok(CommandResponse::success(
            "Dnsmasq 服务启动成功".to_string(),
            None,
        )),
        Err(e) => Ok(CommandResponse::error(format!("启动 Dnsmasq 服务失败: {}", e))),
    }
}

/// 停止 Dnsmasq 服务
#[tauri::command]
pub async fn stop_dnsmasq_service(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let dnsmasq_service = DnsmasqService::global();
    match dnsmasq_service.stop_service(&service_data) {
        Ok(_) => Ok(CommandResponse::success(
            "Dnsmasq 服务停止成功".to_string(),
            None,
        )),
        Err(e) => Ok(CommandResponse::error(format!("停止 Dnsmasq 服务失败: {}", e))),
    }
}

/// 重启 Dnsmasq 服务
#[tauri::command]
pub async fn restart_dnsmasq_service(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let dnsmasq_service = DnsmasqService::global();
    match dnsmasq_service.restart_service(&service_data) {
        Ok(_) => Ok(CommandResponse::success(
            "Dnsmasq 服务重启成功".to_string(),
            None,
        )),
        Err(e) => Ok(CommandResponse::error(format!("重启 Dnsmasq 服务失败: {}", e))),
    }
}

/// 获取 Dnsmasq 服务状态
#[tauri::command]
pub async fn get_dnsmasq_service_status(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let dnsmasq_service = DnsmasqService::global();
    match dnsmasq_service.get_service_status(&service_data) {
        Ok(status) => {
            let data = serde_json::json!({
                "status": status
            });
            Ok(CommandResponse::success(
                "获取 Dnsmasq 服务状态成功".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "获取 Dnsmasq 服务状态失败: {}",
            e
        ))),
    }
}

/// 获取可用的 Dnsmasq 版本列表的 Tauri 命令
#[tauri::command]
pub async fn get_dnsmasq_versions() -> Result<CommandResponse, String> {
    let dnsmasq_service = DnsmasqService::global();
    let versions = dnsmasq_service.get_available_versions();
    let data = serde_json::json!({"versions": versions});
    Ok(CommandResponse::success(
        "获取 Dnsmasq 版本列表成功".to_string(),
        Some(data),
    ))
}

/// 下载 Dnsmasq 的 Tauri 命令
#[tauri::command]
pub async fn download_dnsmasq(version: String) -> Result<CommandResponse, String> {
    log::info!("tauri::command 开始下载 Dnsmasq {}...", version);
    let dnsmasq_service = DnsmasqService::global();
    match dnsmasq_service.download_and_install(&version).await {
        Ok(result) => {
            let data = serde_json::json!(result);
            Ok(CommandResponse::success(
                "开始下载 Dnsmasq".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!("下载 Dnsmasq 失败: {}", e))),
    }
}

/// 取消 Dnsmasq 下载的 Tauri 命令
#[tauri::command]
pub async fn cancel_download_dnsmasq(version: String) -> Result<CommandResponse, String> {
    let dnsmasq_service = DnsmasqService::global();
    match dnsmasq_service.cancel_download(&version) {
        Ok(_) => Ok(CommandResponse::success(
            "取消 Dnsmasq 下载成功".to_string(),
            None,
        )),
        Err(e) => Ok(CommandResponse::error(format!("取消 Dnsmasq 下载失败: {}", e))),
    }
}

/// 获取 Dnsmasq 下载进度的 Tauri 命令
#[tauri::command]
pub async fn get_dnsmasq_download_progress(version: String) -> Result<CommandResponse, String> {
    let dnsmasq_service = DnsmasqService::global();
    let task = dnsmasq_service.get_download_progress(&version);
    let data = serde_json::json!({"task": task});
    Ok(CommandResponse::success(
        "获取 Dnsmasq 下载进度成功".to_string(),
        Some(data),
    ))
}
