use crate::manager::host_manager::{HostEntry, HostManager};
use crate::manager::file_manager::FileManager;
use crate::types::CommandResponse;

/// 获取所有 host 条目
#[tauri::command]
pub async fn get_hosts() -> Result<CommandResponse, String> {
    let host_manager = HostManager::global();
    let manager = host_manager.lock().map_err(|e| e.to_string())?;

    match manager.get_hosts() {
        Ok(entries) => Ok(CommandResponse::success(
            "获取 hosts 成功".to_string(),
            Some(serde_json::json!({ "hosts": entries })),
        )),
        Err(e) => Ok(CommandResponse::error(format!("获取 hosts 失败: {}", e))),
    }
}

/// 添加 host 条目
#[tauri::command]
pub async fn add_host(entry: HostEntry, password: String) -> Result<CommandResponse, String> {
    let host_manager = HostManager::global();
    let manager = host_manager.lock().map_err(|e| e.to_string())?;

    match manager.add_host(entry, &password) {
        Ok(_) => Ok(CommandResponse::success("添加 host 成功".to_string(), None)),
        Err(e) => {
            let error_msg = e.to_string();
            if error_msg.contains("密码错误") {
                Ok(CommandResponse::error("密码错误，请重新输入".to_string()))
            } else {
                Ok(CommandResponse::error(format!(
                    "添加 host 失败: {}",
                    error_msg
                )))
            }
        }
    }
}

/// 更新 host 条目
#[tauri::command]
pub async fn update_host(
    old_entry: HostEntry,
    new_entry: HostEntry,
    password: String,
) -> Result<CommandResponse, String> {
    let host_manager = HostManager::global();
    let manager = host_manager.lock().map_err(|e| e.to_string())?;

    match manager.update_host(old_entry, new_entry, &password) {
        Ok(_) => Ok(CommandResponse::success("更新 host 成功".to_string(), None)),
        Err(e) => {
            let error_msg = e.to_string();
            if error_msg.contains("密码错误") {
                Ok(CommandResponse::error("密码错误，请重新输入".to_string()))
            } else {
                Ok(CommandResponse::error(format!(
                    "更新 host 失败: {}",
                    error_msg
                )))
            }
        }
    }
}

/// 删除 host 条目
#[tauri::command]
pub async fn delete_host(
    ip: String,
    hostname: String,
    password: String,
) -> Result<CommandResponse, String> {
    let host_manager = HostManager::global();
    let manager = host_manager.lock().map_err(|e| e.to_string())?;

    match manager.delete_host(&ip, &hostname, &password) {
        Ok(_) => Ok(CommandResponse::success("删除 host 成功".to_string(), None)),
        Err(e) => {
            let error_msg = e.to_string();
            if error_msg.contains("密码错误") {
                Ok(CommandResponse::error("密码错误，请重新输入".to_string()))
            } else {
                Ok(CommandResponse::error(format!(
                    "删除 host 失败: {}",
                    error_msg
                )))
            }
        }
    }
}

/// 切换 host 条目的启用状态
#[tauri::command]
pub async fn toggle_host(
    ip: String,
    hostname: String,
    password: String,
) -> Result<CommandResponse, String> {
    let host_manager = HostManager::global();
    let manager = host_manager.lock().map_err(|e| e.to_string())?;

    match manager.toggle_host(&ip, &hostname, &password) {
        Ok(_) => Ok(CommandResponse::success(
            "切换 host 状态成功".to_string(),
            None,
        )),
        Err(e) => {
            let error_msg = e.to_string();
            if error_msg.contains("密码错误") {
                Ok(CommandResponse::error("密码错误，请重新输入".to_string()))
            } else {
                Ok(CommandResponse::error(format!(
                    "切换 host 状态失败: {}",
                    error_msg
                )))
            }
        }
    }
}

/// 清空所有 Envis 管理的 host 条目
#[tauri::command]
pub async fn clear_hosts(password: String) -> Result<CommandResponse, String> {
    let host_manager = HostManager::global();
    let manager = host_manager.lock().map_err(|e| e.to_string())?;

    match manager.clear_hosts(&password) {
        Ok(_) => Ok(CommandResponse::success(
            "清空 hosts 成功".to_string(),
            None,
        )),
        Err(e) => {
            let error_msg = e.to_string();
            if error_msg.contains("密码错误") {
                Ok(CommandResponse::error("密码错误，请重新输入".to_string()))
            } else {
                Ok(CommandResponse::error(format!(
                    "清空 hosts 失败: {}",
                    error_msg
                )))
            }
        }
    }
}

/// 打开 hosts 文件所在文件夹
#[tauri::command]
pub async fn open_hosts_file() -> Result<CommandResponse, String> {
    match HostManager::get_hosts_file_path() {
        Ok(path) => {
            match FileManager::open_in_file_manager(&path) {
                Ok(_) => Ok(CommandResponse::success("打开 hosts 文件成功".to_string(), None)),
                Err(e) => Ok(CommandResponse::error(format!("打开 hosts 文件失败: {}", e))),
            }
        }
        Err(e) => Ok(CommandResponse::error(format!("获取 hosts 路径失败: {}", e))),
    }
}
