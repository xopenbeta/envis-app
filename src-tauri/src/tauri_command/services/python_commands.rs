use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::manager::services::python::PythonService;
use crate::types::{CommandResponse, ServiceData};

/// 检查 Python 是否已安装的 Tauri 命令
#[tauri::command]
pub async fn check_python_installed(version: String) -> Result<CommandResponse, String> {
    let python_service = PythonService::global();
    let is_installed = python_service.is_installed(&version);
    let message = if is_installed {
        "Python 已安装"
    } else {
        "Python 未安装"
    };
    let data = serde_json::json!({
        "installed": is_installed
    });
    Ok(CommandResponse::success(message.to_string(), Some(data)))
}

/// 获取可用的 Python 版本列表的 Tauri 命令
#[tauri::command]
pub async fn get_python_versions() -> Result<CommandResponse, String> {
    let python_service = PythonService::global();
    let versions = python_service.get_available_versions();
    let data = serde_json::json!({
        "versions": versions
    });
    Ok(CommandResponse::success(
        "获取 Python 版本列表成功".to_string(),
        Some(data),
    ))
}

/// 下载 Python 的 Tauri 命令
#[tauri::command]
pub async fn download_python(version: String) -> Result<CommandResponse, String> {
    log::info!("tauri::command 开始下载 Python {}...", version);
    let python_service = PythonService::global();
    match python_service.download_and_install(&version).await {
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
        Err(e) => Ok(CommandResponse::error(format!("下载 Python 失败: {}", e))),
    }
}

/// 取消 Python 下载的 Tauri 命令
#[tauri::command]
pub async fn cancel_download_python(version: String) -> Result<CommandResponse, String> {
    let python_service = PythonService::global();
    match python_service.cancel_download(&version) {
        Ok(_) => {
            let data = serde_json::json!({
                "cancelled": true
            });
            Ok(CommandResponse::success(
                "Python 下载已取消".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "取消 Python 下载失败: {}",
            e
        ))),
    }
}

/// 获取 Python 下载进度的 Tauri 命令
#[tauri::command]
pub async fn get_python_download_progress(version: String) -> Result<CommandResponse, String> {
    let python_service = PythonService::global();
    let task = python_service.get_download_progress(&version);
    let data = serde_json::json!({
        "task": task
    });
    Ok(CommandResponse::success(
        "获取 Python 下载进度成功".to_string(),
        Some(data),
    ))
}

/// 设置 pip 镜像源
#[tauri::command]
pub async fn set_pip_index_url(
    environment_id: String,
    mut service_data: ServiceData,
    index_url: String,
) -> Result<CommandResponse, String> {
    // 先写入 metadata
    let env_serv_data_manager = EnvServDataManager::global();
    let env_serv_data_manager = env_serv_data_manager.lock().unwrap();
    let _ = env_serv_data_manager.set_metadata(
        &environment_id,
        &mut service_data,
        "PIP_INDEX_URL",
        serde_json::Value::String(index_url.clone()),
    );

    // 将配置写入终端（导出环境变量）
    let python_service = PythonService::global();
    match python_service.set_pip_index_url(&mut service_data, &index_url) {
        Ok(_) => {
            let data = serde_json::json!({
                "indexUrl": index_url,
            });
            Ok(CommandResponse::success(
                "设置 pip 镜像源成功".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "设置 pip 镜像源失败: {}",
            e
        ))),
    }
}

/// 设置 pip 信任主机
#[tauri::command]
pub async fn set_pip_trusted_host(
    environment_id: String,
    mut service_data: ServiceData,
    trusted_host: String,
) -> Result<CommandResponse, String> {
    // 先写入 metadata
    let env_serv_data_manager = EnvServDataManager::global();
    let env_serv_data_manager = env_serv_data_manager.lock().unwrap();
    let _ = env_serv_data_manager.set_metadata(
        &environment_id,
        &mut service_data,
        "PIP_TRUSTED_HOST",
        serde_json::Value::String(trusted_host.clone()),
    );

    // 将配置写入终端（导出环境变量）
    let python_service = PythonService::global();
    match python_service.set_pip_trusted_host(&mut service_data, &trusted_host) {
        Ok(_) => {
            let data = serde_json::json!({
                "trustedHost": trusted_host,
            });
            Ok(CommandResponse::success(
                "设置 pip 信任主机成功".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "设置 pip 信任主机失败: {}",
            e
        ))),
    }
}
