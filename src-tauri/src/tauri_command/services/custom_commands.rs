use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::manager::shell_manamger::ShellManager;
use crate::types::{CommandResponse, ServiceData, ServiceDataStatus};

/// 更新自定义服务的路径配置
#[tauri::command]
pub async fn update_custom_service_paths(
    environment_id: String,
    service_data: ServiceData,
    old_paths: Vec<String>,
    paths: Vec<String>,
) -> Result<CommandResponse, String> {
    if let Ok(shell_manager_lock) = ShellManager::global().lock() {
        // 先删除旧路径（无论是否在新列表中）
        for p in old_paths.iter() {
            let _ = shell_manager_lock.delete_path(p);
            log::debug!("已从 PATH 移除（更新 - 先删除旧）: {}", p);
        }

        // 再添加新的路径（无论路径是否存在都添加）
        for p in paths.iter() {
            let _ = shell_manager_lock.add_path(p);
            log::debug!("已添加自定义路径到 PATH（更新 - 添加新）: {}", p);
        }
    } else {
        log::error!("获取 Shell 管理器锁失败，无法同步路径到终端配置");
    }

    Ok(CommandResponse::success(
        "自定义服务路径配置更新成功".to_string(),
        None,
    ))
}

/// 更新自定义服务的环境变量配置
#[tauri::command]
pub async fn update_custom_service_env_vars(
    environment_id: String,
    service_data: ServiceData,
    old_env_vars: std::collections::HashMap<String, String>,
    env_vars: std::collections::HashMap<String, String>,
) -> Result<CommandResponse, String> {
    if let Ok(shell_manager_lock) = ShellManager::global().lock() {
        // 先删除旧的环境变量
        for (k, _) in old_env_vars.iter() {
            let _ = shell_manager_lock.delete_export(k);
            log::debug!("已移除自定义环境变量（更新 - 先删除旧）: {}", k);
        }

        // 添加或更新新的环境变量
        for (k, v) in env_vars.iter() {
            let _ = shell_manager_lock.add_export(k, v);
            log::debug!("已设置自定义环境变量（更新 - 添加新）: {}={}", k, v);
        }
    } else {
        log::error!("获取 Shell 管理器锁失败，无法同步环境变量到终端配置");
    }

    Ok(CommandResponse::success(
        "自定义服务环境变量配置更新成功".to_string(),
        None,
    ))
}

/// 更新自定义服务的 Alias 配置
#[tauri::command]
pub async fn update_custom_service_aliases(
    environment_id: String,
    service_data: ServiceData,
    old_aliases: std::collections::HashMap<String, String>,
    aliases: std::collections::HashMap<String, String>,
) -> Result<CommandResponse, String> {
    if let Ok(shell_manager_lock) = ShellManager::global().lock() {
        // 先删除旧的 Alias
        for (k, _) in old_aliases.iter() {
            let _ = shell_manager_lock.delete_alias(k);
            log::debug!("已移除自定义 Alias（更新 - 先删除旧）: {}", k);
        }

        // 添加或更新新的 Alias
        for (k, v) in aliases.iter() {
            let _ = shell_manager_lock.add_alias(k, v);
            log::debug!("已设置自定义 Alias（更新 - 添加新）: {}={}", k, v);
        }
    } else {
        log::error!("获取 Shell 管理器锁失败，无法同步 Alias 到终端配置");
    }

    Ok(CommandResponse::success(
        "自定义服务 Alias 配置更新成功".to_string(),
        None,
    ))
}
