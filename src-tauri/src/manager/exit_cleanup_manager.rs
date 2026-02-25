use anyhow::{anyhow, Context, Result};

use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::environment_manager::EnvironmentManager;
use crate::manager::shell_manamger::ShellManager;
use crate::types::EnvironmentStatus;

pub fn cleanup_on_app_close() -> Result<bool> {
    let app_config = {
        let manager = AppConfigManager::global();
        let manager = manager
            .lock()
            .map_err(|_| anyhow!("AppConfigManager 锁获取失败"))?;
        manager.get_app_config()
    };

    if !app_config.stop_all_services_on_exit {
        return Ok(false);
    }

    let mut environments = {
        let manager = EnvironmentManager::global();
        let manager = manager
            .lock()
            .map_err(|_| anyhow!("EnvironmentManager 锁获取失败"))?;
        manager.get_all_environments().context("读取环境列表失败")?
    };

    let env_manager = EnvironmentManager::global();
    let env_manager = env_manager
        .lock()
        .map_err(|_| anyhow!("EnvironmentManager 锁获取失败"))?;

    for environment in &mut environments {
        if environment.status == EnvironmentStatus::Active {
            if let Err(e) = env_manager.deactivate_environment_and_services(environment, None) {
                log::error!(
                    "退出时停用环境失败: {} ({}), error: {}",
                    environment.name,
                    environment.id,
                    e
                );
            }
        }
    }

    let shell_manager = ShellManager::global();
    let shell_manager = shell_manager
        .lock()
        .map_err(|_| anyhow!("ShellManager 锁获取失败"))?;
    shell_manager
        .clear_shell_environment_block_content()
        .context("清空 Shell 环境块失败")?;

    log::info!("已完成退出清理：环境停用与 Shell 环境块重置");
    Ok(true)
}
