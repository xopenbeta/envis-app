use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::manager::services::java::JavaService;
use crate::types::{CommandResponse, ServiceData};

/// 检查 Java 是否已安装的 Tauri 命令
#[tauri::command]
pub async fn check_java_installed(version: String) -> Result<CommandResponse, String> {
    let java_service = JavaService::global();
    let is_installed = java_service.is_installed(&version);
    let message = if is_installed {
        "Java 已安装"
    } else {
        "Java 未安装"
    };
    let data = serde_json::json!({
        "installed": is_installed
    });
    Ok(CommandResponse::success(message.to_string(), Some(data)))
}

/// 获取可用的 Java 版本列表的 Tauri 命令
#[tauri::command]
pub async fn get_java_versions() -> Result<CommandResponse, String> {
    let java_service = JavaService::global();
    let versions = java_service.get_available_versions();
    let data = serde_json::json!({
        "versions": versions
    });
    Ok(CommandResponse::success(
        "获取 Java 版本列表成功".to_string(),
        Some(data),
    ))
}

/// 下载 Java 的 Tauri 命令
#[tauri::command]
pub async fn download_java(version: String) -> Result<CommandResponse, String> {
    log::info!("tauri::command 开始下载 Java {}...", version);
    let java_service = JavaService::global();
    match java_service.download_and_install(&version).await {
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
        Err(e) => Ok(CommandResponse::error(format!("下载 Java 失败: {}", e))),
    }
}

/// 取消 Java 下载的 Tauri 命令
#[tauri::command]
pub async fn cancel_download_java(version: String) -> Result<CommandResponse, String> {
    let java_service = JavaService::global();
    match java_service.cancel_download(&version) {
        Ok(_) => {
            let data = serde_json::json!({
                "cancelled": true
            });
            Ok(CommandResponse::success(
                format!("已取消 Java {} 下载", version),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!(
            "取消 Java 下载失败: {}",
            e
        ))),
    }
}

/// 获取 Java 下载进度的 Tauri 命令
#[tauri::command]
pub async fn get_java_download_progress(version: String) -> Result<CommandResponse, String> {
    let java_service = JavaService::global();
    let task = java_service.get_download_progress(&version);
    let data = serde_json::json!({
        "task": task
    });
    Ok(CommandResponse::success(
        "获取 Java 下载进度成功".to_string(),
        Some(data),
    ))
}

/// 获取 Java 版本信息
#[tauri::command]
pub async fn get_java_info(service_data: ServiceData) -> Result<CommandResponse, String> {
    let java_service = JavaService::global();
    match java_service.get_java_info(&service_data) {
        Ok(info) => Ok(CommandResponse::success(
            "获取 Java 信息成功".to_string(),
            Some(info),
        )),
        Err(e) => Ok(CommandResponse::error(format!("获取 Java 信息失败: {}", e))),
    }
}

/// 设置 JAVA_HOME
#[tauri::command]
pub async fn set_java_home(
    environment_id: String,
    mut service_data: ServiceData,
    java_home: String,
) -> Result<CommandResponse, String> {
    // 写入 metadata
    let env_serv_data_manager = EnvServDataManager::global();
    let env_serv_data_manager = env_serv_data_manager.lock().unwrap();
    let _ = env_serv_data_manager.set_metadata(
        &environment_id,
        &mut service_data,
        "JAVA_HOME",
        serde_json::Value::String(java_home.clone()),
    );

    let data = serde_json::json!({
        "javaHome": java_home,
    });
    Ok(CommandResponse::success(
        "JAVA_HOME 设置成功".to_string(),
        Some(data),
    ))
}

/// 设置 JAVA_OPTS
#[tauri::command]
pub async fn set_java_opts(
    environment_id: String,
    mut service_data: ServiceData,
    java_opts: String,
) -> Result<CommandResponse, String> {
    // 写入 metadata
    let env_serv_data_manager = EnvServDataManager::global();
    let env_serv_data_manager = env_serv_data_manager.lock().unwrap();
    let _ = env_serv_data_manager.set_metadata(
        &environment_id,
        &mut service_data,
        "JAVA_OPTS",
        serde_json::Value::String(java_opts.clone()),
    );

    let data = serde_json::json!({
        "javaOpts": java_opts,
    });
    Ok(CommandResponse::success(
        "JAVA_OPTS 设置成功".to_string(),
        Some(data),
    ))
}

/// 设置 MAVEN_HOME
#[tauri::command]
pub async fn set_maven_home(
    environment_id: String,
    mut service_data: ServiceData,
    maven_home: String,
) -> Result<CommandResponse, String> {
    // 写入 metadata
    let env_serv_data_manager = EnvServDataManager::global();
    let env_serv_data_manager = env_serv_data_manager.lock().unwrap();
    let _ = env_serv_data_manager.set_metadata(
        &environment_id,
        &mut service_data,
        "MAVEN_HOME",
        serde_json::Value::String(maven_home.clone()),
    );

    let data = serde_json::json!({
        "mavenHome": maven_home,
    });
    Ok(CommandResponse::success(
        "MAVEN_HOME 设置成功".to_string(),
        Some(data),
    ))
}

/// 设置 GRADLE_HOME
#[tauri::command]
pub async fn set_gradle_home(
    environment_id: String,
    mut service_data: ServiceData,
    gradle_home: String,
) -> Result<CommandResponse, String> {
    // 写入 metadata
    let env_serv_data_manager = EnvServDataManager::global();
    let env_serv_data_manager = env_serv_data_manager.lock().unwrap();
    let _ = env_serv_data_manager.set_metadata(
        &environment_id,
        &mut service_data,
        "GRADLE_HOME",
        serde_json::Value::String(gradle_home.clone()),
    );

    let data = serde_json::json!({
        "gradleHome": gradle_home,
    });
    Ok(CommandResponse::success(
        "GRADLE_HOME 设置成功".to_string(),
        Some(data),
    ))
}
