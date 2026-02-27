use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::manager::services::python::{PythonService, PythonInstallMode};
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

/// 下载 Python 的 Tauri 命令（支持可选的安装模式参数）
/// mode: "prebuilt"（默认）、"python_build" 或 "local_build"
#[tauri::command]
pub async fn download_python(
    version: String,
    mode: Option<String>,
) -> Result<CommandResponse, String> {
    // 解析安装模式，默认为预编译
    let install_mode = match mode.as_deref() {
        Some("prebuilt") | None => PythonInstallMode::Prebuilt,
        Some("python_build") => PythonInstallMode::PythonBuild,
        Some("local_build") => PythonInstallMode::LocalBuild,
        Some(m) => {
            return Ok(CommandResponse::error(format!(
                "不支持的安装模式: {}，请使用 'prebuilt'、'python_build' 或 'local_build'",
                m
            )))
        }
    };

    log::info!(
        "tauri::command 开始下载 Python {} (模式: {:?})...",
        version,
        install_mode
    );
    
    let python_service = PythonService::global();
    match python_service
        .download_and_install_with_mode(&version, install_mode)
        .await
    {
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

/// 设置 python3 别名为 python
#[tauri::command]
pub async fn set_python3_as_python(
    environment_id: String,
    mut service_data: ServiceData,
    enable: bool,
) -> Result<CommandResponse, String> {
    // 先写入 metadata
    let env_serv_data_manager = EnvServDataManager::global();
    let env_serv_data_manager = env_serv_data_manager.lock().unwrap();
    let _ = env_serv_data_manager.set_metadata(
        &environment_id,
        &mut service_data,
        "PYTHON3_AS_PYTHON",
        serde_json::Value::Bool(enable),
    );

    // 将配置写入终端（设置别名）
    let python_service = PythonService::global();
    match python_service.set_python3_as_python(&mut service_data, enable) {
        Ok(_) => {
            let data = serde_json::json!({
                "enable": enable,
            });
            let message = if enable {
                "已设置 python3 别名为 python"
            } else {
                "已移除 python 别名"
            };
            Ok(CommandResponse::success(
                message.to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "设置 python3 别名失败: {}",
            e
        ))),
    }
}

/// 检查 Python 是否支持 venv
#[tauri::command]
pub async fn check_python_venv_support(version: String) -> Result<CommandResponse, String> {
    let python_service = PythonService::global();
    let supported = python_service.check_venv_support(&version);
    let data = serde_json::json!({
        "supported": supported
    });
    Ok(CommandResponse::success("检查成功".to_string(), Some(data)))
}

/// 检查系统中是否安装 uv
#[tauri::command]
pub async fn check_python_uv_installed() -> Result<CommandResponse, String> {
    let python_service = PythonService::global();
    let installed = python_service.check_uv_installed();
    let data = serde_json::json!({
        "installed": installed
    });
    Ok(CommandResponse::success("检查成功".to_string(), Some(data)))
}

/// 获取 venv 列表
#[tauri::command]
pub async fn get_python_venvs(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let python_service = PythonService::global();
    match python_service.list_venvs(&environment_id, &service_data) {
        Ok(venvs) => {
            let venvs_dir = python_service
                .get_venvs_dir(&environment_id, &service_data)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            let data = serde_json::json!({
                "venvs": venvs,
                "venvsDir": venvs_dir
            });
            Ok(CommandResponse::success(
                "获取 venvs 成功".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!("获取 venvs 失败: {}", e))),
    }
}

/// 创建 venv
#[tauri::command]
pub async fn create_python_venv(
    environment_id: String,
    service_data: ServiceData,
    venv_name: String,
) -> Result<CommandResponse, String> {
    let python_service = PythonService::global();
    match python_service.create_venv(&environment_id, &service_data, &venv_name) {
        Ok(_) => Ok(CommandResponse::success("创建 venv 成功".to_string(), None)),
        Err(e) => Ok(CommandResponse::error(format!("创建 venv 失败: {}", e))),
    }
}

/// 删除 venv
#[tauri::command]
pub async fn remove_python_venv(
    environment_id: String,
    service_data: ServiceData,
    venv_name: String,
) -> Result<CommandResponse, String> {
    let python_service = PythonService::global();
    match python_service.remove_venv(&environment_id, &service_data, &venv_name) {
        Ok(_) => Ok(CommandResponse::success("删除 venv 成功".to_string(), None)),
        Err(e) => Ok(CommandResponse::error(format!("删除 venv 失败: {}", e))),
    }
}
