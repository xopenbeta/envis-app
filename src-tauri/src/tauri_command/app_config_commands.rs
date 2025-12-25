use crate::manager::app_config_manager::{AppConfig, AppConfigManager};
use crate::manager::file_manager::FileManager;
use anyhow::Result;
use serde_json::Value;

#[tauri::command]
pub fn get_app_config() -> Result<Value, String> {
    let app_config_manager = AppConfigManager::global();
    let app_config_manager = app_config_manager.lock().map_err(|e| e.to_string())?;
    let app_config = app_config_manager.get_app_config();

    Ok(serde_json::json!({
        "success": true,
        "msg": "获取应用配置成功",
        "data": {
            "appConfig": app_config
        }
    }))
}

#[tauri::command]
pub fn set_app_config(app_config: AppConfig) -> Result<Value, String> {
    let app_config_manager = AppConfigManager::global();
    let mut app_config_manager = app_config_manager.lock().map_err(|e| e.to_string())?;
    let app_config_clone = app_config.clone();

    match app_config_manager.set_app_config(app_config) {
        Ok(_) => Ok(serde_json::json!({
            "success": true,
            "msg": "设置应用配置成功",
            "data": {
                "appConfig": app_config_clone
            }
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "msg": format!("设置应用配置失败: {}", e),
            "data": {}
        })),
    }
}

#[tauri::command]
pub fn open_app_config_folder() -> Result<Value, String> {
    let app_config_manager = AppConfigManager::global();
    let app_config_manager = app_config_manager.lock().map_err(|e| e.to_string())?;
    
    match app_config_manager.get_app_config_folder_path() {
        Ok(config_folder_path) => {
            match FileManager::open_in_file_manager(&config_folder_path) {
                Ok(_) => Ok(serde_json::json!({
                    "success": true,
                    "msg": "打开配置文件夹成功",
                    "data": {}
                })),
                Err(e) => Ok(serde_json::json!({
                    "success": false,
                    "msg": format!("打开配置文件夹失败: {}", e),
                    "data": {}
                })),
            }
        }
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "msg": format!("获取配置文件夹路径失败: {}", e),
            "data": {}
        })),
    }
}
