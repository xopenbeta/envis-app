use anyhow::{anyhow, Context, Result};

use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::environment_manager::EnvironmentManager;
use crate::manager::shell_manamger::ShellManager;
use crate::types::EnvironmentStatus;

fn persist_active_environment_ids(active_environment_ids: Vec<String>) -> Result<()> {
    let manager = AppConfigManager::global();
    let mut manager = manager
        .lock()
        .map_err(|_| anyhow!("AppConfigManager 锁获取失败"))?;

    let mut app_config = manager.get_app_config();
    app_config.last_used_environment_ids = active_environment_ids;
    manager.set_app_config(app_config)?;

    Ok(())
}

pub fn cleanup_on_app_close() -> Result<bool> {
    log::info!("cleanup_on_app_close 开始执行");

    let app_config = {
        let manager = AppConfigManager::global();
        let manager = manager
            .lock()
            .map_err(|_| anyhow!("AppConfigManager 锁获取失败"))?;
        manager.get_app_config()
    };

    log::info!(
        "cleanup_on_app_close 配置: stop_all_services_on_exit={}, auto_activate_last_used_environment_on_app_start={}",
        app_config.stop_all_services_on_exit,
        app_config.auto_activate_last_used_environment_on_app_start
    );

    let mut environments = {
        let manager = EnvironmentManager::global();
        let manager = manager
            .lock()
            .map_err(|_| anyhow!("EnvironmentManager 锁获取失败"))?;
        manager.get_all_environments().context("读取环境列表失败")?
    };

    let active_environment_ids = environments
        .iter()
        .filter(|env| env.status == EnvironmentStatus::Active)
        .map(|env| env.id.clone())
        .collect::<Vec<_>>();
    if let Err(e) = persist_active_environment_ids(active_environment_ids.clone()) {
        log::error!("记录退出前活跃环境失败: {}", e);
    } else {
        log::info!(
            "已记录退出前活跃环境IDs(供下次启动恢复): {:?}",
            active_environment_ids
        );
    }

    if !app_config.stop_all_services_on_exit {
        log::info!("cleanup_on_app_close 跳过：stop_all_services_on_exit=false");
        return Ok(false);
    }

    let env_manager = EnvironmentManager::global();
    let env_manager = env_manager
        .lock()
        .map_err(|_| anyhow!("EnvironmentManager 锁获取失败"))?;

    let active_count = environments
        .iter()
        .filter(|env| env.status == EnvironmentStatus::Active)
        .count();
    log::info!("cleanup_on_app_close 检测到活跃环境数量: {}", active_count);

    for environment in &mut environments {
        if environment.status == EnvironmentStatus::Active {
            log::info!("cleanup_on_app_close 停用环境: {} ({})", environment.name, environment.id);
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
