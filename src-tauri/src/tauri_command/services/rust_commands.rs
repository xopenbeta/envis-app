use envis_core::manager::env_serv_data_manager::EnvServDataManager;
use envis_core::manager::services::rust::RustService;
use envis_core::types::{CommandResponse, ServiceData};

/// 检查 Rust 是否已安装的 Tauri 命令
#[tauri::command]
pub async fn check_rust_installed(version: String) -> Result<CommandResponse, String> {
    let rust_service = RustService::global();
    let is_installed = rust_service.is_installed(&version);
    let message = if is_installed {
        "Rust 已安装"
    } else {
        "Rust 未安装"
    };
    let data = serde_json::json!({
        "installed": is_installed
    });
    Ok(CommandResponse::success(message.to_string(), Some(data)))
}

/// 获取可用的 Rust 版本列表的 Tauri 命令
#[tauri::command]
pub async fn get_rust_versions() -> Result<CommandResponse, String> {
    let rust_service = RustService::global();
    let versions = rust_service.get_available_versions();
    let data = serde_json::json!({
        "versions": versions
    });
    Ok(CommandResponse::success(
        "获取 Rust 版本列表成功".to_string(),
        Some(data),
    ))
}

/// 下载 Rust 的 Tauri 命令
#[tauri::command]
pub async fn download_rust(version: String) -> Result<CommandResponse, String> {
    log::info!("tauri::command 开始下载 Rust {}...", version);
    let rust_service = RustService::global();

    match rust_service.download_and_install(&version).await {
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
        Err(e) => Ok(CommandResponse::error(format!("下载 Rust 失败: {}", e))),
    }
}

/// 取消 Rust 下载的 Tauri 命令
#[tauri::command]
pub async fn cancel_download_rust(version: String) -> Result<CommandResponse, String> {
    let rust_service = RustService::global();
    match rust_service.cancel_download(&version) {
        Ok(_) => {
            crate::status_events::emit_download_status(&format!("rust-{}", version), "cancelled", 0.0);
            let data = serde_json::json!({
                "cancelled": true
            });
            Ok(CommandResponse::success(
                format!("已取消 Rust {} 下载", version),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!("取消 Rust 下载失败: {}", e))),
    }
}

/// 获取 Rust 下载进度的 Tauri 命令
#[tauri::command]
pub async fn get_rust_download_progress(version: String) -> Result<CommandResponse, String> {
    let rust_service = RustService::global();
    let task = rust_service.get_download_progress(&version);
    let data = serde_json::json!({
        "task": task
    });
    Ok(CommandResponse::success(
        "获取 Rust 下载进度成功".to_string(),
        Some(data),
    ))
}

/// 获取 Rust 版本信息
#[tauri::command]
pub async fn get_rust_info(service_data: ServiceData) -> Result<CommandResponse, String> {
    let rust_service = RustService::global();
    match rust_service.get_rust_info(&service_data) {
        Ok(info) => Ok(CommandResponse::success(
            "获取 Rust 信息成功".to_string(),
            Some(info),
        )),
        Err(e) => Ok(CommandResponse::error(format!("获取 Rust 信息失败: {}", e))),
    }
}

/// 设置 CARGO_HOME
#[tauri::command]
pub async fn set_cargo_home(
    environment_id: String,
    mut service_data: ServiceData,
    cargo_home: String,
) -> Result<CommandResponse, String> {
    let env_serv_data_manager = EnvServDataManager::global();
    let env_serv_data_manager = env_serv_data_manager.lock().unwrap();
    let _ = env_serv_data_manager.set_metadata(
        &environment_id,
        &mut service_data,
        "CARGO_HOME",
        serde_json::Value::String(cargo_home.clone()),
    );
    drop(env_serv_data_manager);

    let rust_service = RustService::global();
    match rust_service.set_cargo_home(&mut service_data, &cargo_home) {
        Ok(_) => {
            let data = serde_json::json!({
                "cargoHome": cargo_home,
            });
            Ok(CommandResponse::success(
                "CARGO_HOME 设置成功".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!("设置 CARGO_HOME 失败: {}", e))),
    }
}
