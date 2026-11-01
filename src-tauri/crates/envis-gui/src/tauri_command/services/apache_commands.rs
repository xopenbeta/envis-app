use envis_core::manager::services::apache::ApacheService;
use envis_core::types::{CommandResponse, ServiceData};

/// 按版本检查 Apache 是否已安装
#[tauri::command]
pub async fn check_apache_installed(version: String) -> Result<CommandResponse, String> {
    let apache_service = ApacheService::global();
    let is_installed = apache_service.is_installed(&version);
    let data = serde_json::json!({ "installed": is_installed });
    Ok(CommandResponse::success(
        if is_installed {
            "Apache 已安装".to_string()
        } else {
            "Apache 未安装".to_string()
        },
        Some(data),
    ))
}

/// 获取 Apache 版本列表
#[tauri::command]
pub async fn get_apache_versions() -> Result<CommandResponse, String> {
    let apache_service = ApacheService::global();
    let versions = apache_service.get_available_versions();
    let data = serde_json::json!({ "versions": versions });
    Ok(CommandResponse::success(
        "获取 Apache 版本列表成功".to_string(),
        Some(data),
    ))
}

/// 下载 Apache
#[tauri::command]
pub async fn download_apache(version: String) -> Result<CommandResponse, String> {
    log::info!("tauri::command 开始下载 Apache {}...", version);
    let apache_service = ApacheService::global();
    match apache_service.download_and_install(&version).await {
        Ok(result) => {
            let data = serde_json::json!({ "task": result.task });
            if result.success {
                Ok(CommandResponse::success(result.message, Some(data)))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(error) => Ok(CommandResponse::error(format!("下载 Apache 失败: {}", error))),
    }
}

/// 取消 Apache 下载
#[tauri::command]
pub async fn cancel_download_apache(version: String) -> Result<CommandResponse, String> {
    let apache_service = ApacheService::global();
    match apache_service.cancel_download(&version) {
        Ok(_) => {
            crate::status_events::emit_download_status(
                &format!("apache-{}", version),
                "cancelled",
                0.0,
            );
            let data = serde_json::json!({ "cancelled": true });
            Ok(CommandResponse::success(
                "Apache 下载已取消".to_string(),
                Some(data),
            ))
        }
        Err(error) => Ok(CommandResponse::error(format!(
            "取消 Apache 下载失败: {}",
            error
        ))),
    }
}

/// 获取 Apache 下载进度
#[tauri::command]
pub async fn get_apache_download_progress(version: String) -> Result<CommandResponse, String> {
    let apache_service = ApacheService::global();
    let task = apache_service.get_download_progress(&version);
    let data = serde_json::json!({ "task": task });
    Ok(CommandResponse::success(
        "获取 Apache 下载进度成功".to_string(),
        Some(data),
    ))
}

/// 获取 Apache 配置内容
#[tauri::command]
pub async fn get_apache_config(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let apache_service = ApacheService::global();

    // 首次打开面板时按发行包模板生成环境级 httpd.conf
    let (_, conf_path) = match apache_service.ensure_service_conf(&service_data) {
        Ok(paths) => paths,
        Err(error) => {
            return Ok(CommandResponse::error(format!(
                "准备 Apache 配置文件失败: {}",
                error
            )))
        }
    };

    match std::fs::read_to_string(&conf_path) {
        Ok(content) => {
            let data = serde_json::json!({
                "content": content,
                "path": conf_path.to_string_lossy().to_string(),
            });
            Ok(CommandResponse::success(
                "读取配置文件成功".to_string(),
                Some(data),
            ))
        }
        Err(error) => Ok(CommandResponse::error(format!(
            "读取配置文件失败: {}",
            error
        ))),
    }
}

/// 校验 Apache 配置（httpd -t）
#[tauri::command]
pub async fn validate_apache_config(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let apache_service = ApacheService::global();
    match apache_service.validate_config(&service_data) {
        Ok((valid, stdout, stderr)) => {
            let data = serde_json::json!({
                "valid": valid,
                "stdout": stdout,
                "stderr": stderr,
            });
            if valid {
                Ok(CommandResponse::success(
                    "Apache 配置校验通过".to_string(),
                    Some(data),
                ))
            } else {
                Ok(CommandResponse {
                    success: false,
                    message: format!("Apache 配置校验失败: {}", stderr.trim()),
                    data: Some(data),
                })
            }
        }
        Err(error) => Ok(CommandResponse::error(format!(
            "执行 Apache 配置校验失败: {}",
            error
        ))),
    }
}

/// 启动 Apache 服务
#[tauri::command]
pub async fn start_apache_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let apache_service = ApacheService::global();
    match apache_service.start_service(&service_data) {
        Ok(result) => {
            if result.success {
                crate::status_events::emit_service_status(
                    &environment_id,
                    &service_data.id,
                    "running",
                );
                Ok(CommandResponse::success(result.message, result.data))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(error) => Ok(CommandResponse::error(format!(
            "启动 Apache 服务失败: {}",
            error
        ))),
    }
}

/// 停止 Apache 服务
#[tauri::command]
pub async fn stop_apache_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let apache_service = ApacheService::global();
    match apache_service.stop_service(&service_data) {
        Ok(_) => {
            crate::status_events::emit_service_status(
                &environment_id,
                &service_data.id,
                "stopped",
            );
            Ok(CommandResponse::success(
                "Apache 服务停止成功".to_string(),
                None,
            ))
        }
        Err(error) => Ok(CommandResponse::error(format!(
            "停止 Apache 服务失败: {}",
            error
        ))),
    }
}

/// 重启 Apache 服务
#[tauri::command]
pub async fn restart_apache_service(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let apache_service = ApacheService::global();
    match apache_service.restart_service(&service_data) {
        Ok(_) => {
            crate::status_events::emit_service_status(
                &environment_id,
                &service_data.id,
                "running",
            );
            Ok(CommandResponse::success(
                "Apache 服务重启成功".to_string(),
                None,
            ))
        }
        Err(error) => Ok(CommandResponse::error(format!(
            "重启 Apache 服务失败: {}",
            error
        ))),
    }
}

/// 获取 Apache 服务状态
#[tauri::command]
pub async fn get_apache_service_status(
    _environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let apache_service = ApacheService::global();
    match apache_service.get_service_status(&service_data) {
        Ok(status) => {
            let data = serde_json::json!({ "status": status });
            Ok(CommandResponse::success(
                "获取 Apache 服务状态成功".to_string(),
                Some(data),
            ))
        }
        Err(error) => Ok(CommandResponse::error(format!(
            "获取 Apache 服务状态失败: {}",
            error
        ))),
    }
}
