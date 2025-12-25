use anyhow::Result;
use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::manager::system_info_manager::SystemInfoManager;

/// 获取系统信息
#[tauri::command]
pub async fn get_system_info() -> Result<Value, String> {
    let manager = SystemInfoManager::global();

    match manager.get_system_info() {
        Ok(result) => Ok(serde_json::to_value(result).map_err(|e| e.to_string())?),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}

/// 打开终端
#[tauri::command]
pub async fn open_terminal() -> Result<Value, String> {
    use crate::manager::app_config_manager::AppConfigManager;
    use crate::manager::shell_manamger::ShellManager;

    // 获取配置的终端类型
    let app_config_manager = AppConfigManager::global();
    let terminal_type = app_config_manager
        .lock()
        .map(|manager| manager.get_app_config().terminal_tool)
        .unwrap_or(None);

    // 使用配置的终端类型打开终端
    match ShellManager::open_terminal_with_type(terminal_type) {
        Ok(_) => Ok(serde_json::json!({
            "success": true,
            "message": "终端已打开"
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": format!("打开终端失败: {}", e)
        })),
    }
}

/// 切换开发者工具
#[tauri::command]
pub async fn toggle_dev_tools(app_handle: AppHandle) -> Result<Value, String> {
    match app_handle.get_webview_window("main") {
        Some(window) => {
            #[cfg(debug_assertions)]
            {
                if window.is_devtools_open() {
                    window.close_devtools();
                    Ok(serde_json::json!({
                        "success": true,
                        "message": "开发者工具已关闭"
                    }))
                } else {
                    window.open_devtools();
                    Ok(serde_json::json!({
                        "success": true,
                        "message": "开发者工具已打开"
                    }))
                }
            }

            #[cfg(not(debug_assertions))]
            {
                Ok(serde_json::json!({
                    "success": false,
                    "message": "开发者工具仅在调试模式下可用"
                }))
            }
        }
        None => Ok(serde_json::json!({
            "success": false,
            "message": "未找到主窗口"
        })),
    }
}

/// 退出应用程序
#[tauri::command]
pub async fn quit_app(app_handle: AppHandle) -> Result<Value, String> {
    app_handle.exit(0);
    Ok(serde_json::json!({
        "success": true,
        "message": "应用程序即将退出"
    }))
}

/// 打开系统环境变量设置（仅限 Windows）
#[tauri::command]
pub async fn open_system_env_settings() -> Result<Value, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        match Command::new("SystemPropertiesAdvanced.exe").spawn() {
            Ok(_) => Ok(serde_json::json!({
                "success": true,
                "message": "系统环境变量窗口已打开"
            })),
            Err(e) => Ok(serde_json::json!({
                "success": false,
                "message": format!("打开系统环境变量窗口失败: {}", e)
            })),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(serde_json::json!({
            "success": false,
            "message": "此功能仅在 Windows 上可用"
        }))
    }
}
