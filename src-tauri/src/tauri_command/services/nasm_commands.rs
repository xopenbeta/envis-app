use envis_core::manager::services::nasm::NasmService;
use envis_core::types::CommandResponse;

/// 检查 NASM 是否已安装
#[tauri::command]
pub async fn check_nasm_installed(version: String) -> Result<CommandResponse, String> {
    let nasm_service = NasmService::global();
    let is_installed = nasm_service.is_installed(&version);
    let data = serde_json::json!({
        "installed": is_installed,
    });

    let message = if is_installed {
        "NASM 已安装"
    } else {
        "NASM 未安装"
    };

    Ok(CommandResponse::success(message.to_string(), Some(data)))
}

/// 获取可用 NASM 版本列表
#[tauri::command]
pub async fn get_nasm_versions() -> Result<CommandResponse, String> {
    let nasm_service = NasmService::global();
    let versions = nasm_service.get_available_versions();
    let data = serde_json::json!({
        "versions": versions,
    });

    Ok(CommandResponse::success(
        "获取 NASM 版本列表成功".to_string(),
        Some(data),
    ))
}

/// 下载 NASM
#[tauri::command]
pub async fn download_nasm(version: String) -> Result<CommandResponse, String> {
    let nasm_service = NasmService::global();
    match nasm_service.download_and_install(&version).await {
        Ok(result) => {
            let data = serde_json::json!({
                "task": result.task,
            });
            if result.success {
                Ok(CommandResponse::success(result.message, Some(data)))
            } else {
                Ok(CommandResponse::error(result.message))
            }
        }
        Err(e) => Ok(CommandResponse::error(format!("下载 NASM 失败: {}", e))),
    }
}

/// 取消 NASM 下载
#[tauri::command]
pub async fn cancel_download_nasm(version: String) -> Result<CommandResponse, String> {
    let nasm_service = NasmService::global();
    match nasm_service.cancel_download(&version) {
        Ok(_) => {
            let data = serde_json::json!({
                "cancelled": true,
            });
            Ok(CommandResponse::success(
                "NASM 下载已取消".to_string(),
                Some(data),
            ))
        }
        Err(e) => Ok(CommandResponse::error(format!("取消 NASM 下载失败: {}", e))),
    }
}

/// 获取 NASM 下载进度
#[tauri::command]
pub async fn get_nasm_download_progress(version: String) -> Result<CommandResponse, String> {
    let nasm_service = NasmService::global();
    let task = nasm_service.get_download_progress(&version);
    let data = serde_json::json!({
        "task": task,
    });

    Ok(CommandResponse::success(
        "获取 NASM 下载进度成功".to_string(),
        Some(data),
    ))
}
