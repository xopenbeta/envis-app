use envis_core::manager::app_config_manager::AppConfigManager;
use envis_core::manager::environment_manager::EnvironmentManager;
use envis_core::types::EnvironmentStatus;

fn persist_last_used_environment_ids(active_environment_ids: Vec<String>) -> Result<(), String> {
    let manager = AppConfigManager::global();
    let mut manager = manager
        .lock()
        .map_err(|_| "无法获取应用配置锁".to_string())?;

    let mut app_config = manager.get_app_config();
    app_config.last_used_environment_ids = active_environment_ids;
    manager
        .set_app_config(app_config)
        .map_err(|e| format!("写入应用配置失败: {}", e))
}

fn collect_active_environment_ids(
    manager: &EnvironmentManager,
    fallback_environment_id: &str,
) -> Vec<String> {
    match manager.get_all_environments() {
        Ok(environments) => {
            let active_environment_ids = environments
                .into_iter()
                .filter(|env| env.status == EnvironmentStatus::Active)
                .map(|env| env.id)
                .collect::<Vec<_>>();

            if active_environment_ids.is_empty() {
                vec![fallback_environment_id.to_string()]
            } else {
                active_environment_ids
            }
        }
        Err(_) => vec![fallback_environment_id.to_string()],
    }
}

/// 提前处理 `use` 命令（不依赖 Tauri 插件）
pub fn handle_use_early(target_str: &str) {
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();

    // 1. 查找目标环境（优先精确匹配 ID，然后精确匹配 Name）
    let target_environment_id = match manager.get_all_environments() {
        Ok(envs) => {
            envs.iter()
                .find(|e| e.id == target_str)
                .or_else(|| envs.iter().find(|e| e.name == target_str))
                .map(|e| e.id.clone())
                .unwrap_or_else(|| {
                    eprintln!("错误: 未找到名称或 ID 为 '{}' 的环境", target_str);
                    std::process::exit(1);
                })
        }
        Err(e) => {
            eprintln!("错误: 无法获取环境列表: {}", e);
            std::process::exit(1);
        }
    };

    // 2. 打印提示
    println!("正在激活环境: {} ...", target_str);

    // 3. 统一调用 core 的切换逻辑（始终停用其他活跃环境）
    match manager.switch_environment_and_services(&target_environment_id, None, true) {
        Ok(res) => {
            let activated = res.success || res.message.contains("环境已激活");
            if activated {
                if !res.success {
                    eprintln!("警告: {}", res.message);
                }
                let active_environment_ids =
                    collect_active_environment_ids(&manager, &target_environment_id);
                if let Err(e) = persist_last_used_environment_ids(active_environment_ids) {
                    eprintln!(
                        "警告: 环境已激活，但更新上次使用环境记录失败，UI 下次启动可能无法正确恢复: {}",
                        e
                    );
                }
                println!("✓ 成功激活环境: {}", target_str);
            } else {
                eprintln!("错误: {}", res.message);
                std::process::exit(1);
            }
        }
        Err(e) => {
            eprintln!("错误: 激活环境失败: {}", e);
            std::process::exit(1);
        }
    }
}

/// 处理 `list` 命令
pub fn handle_list() {
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();
    match manager.get_all_environments() {
        Ok(envs) => {
            if envs.is_empty() {
                println!("(无环境)");
            } else {
                let name_width = envs
                    .iter()
                    .map(|env| env.name.chars().count())
                    .max()
                    .unwrap_or(0);

                for env in envs {
                    let marker = if env.status == EnvironmentStatus::Active {
                        "*"
                    } else {
                        " "
                    };
                    let short_id: String = env.id.chars().take(8).collect();
                    println!("{} {:<width$}\t{}", marker, env.name, short_id, width = name_width);
                }
            }
        }
        Err(e) => {
            eprintln!("错误: 获取环境列表失败: {}", e);
            std::process::exit(1);
        }
    }
}

/// 处理 `refresh` 命令: 不执行任何操作，由 shell wrapper 负责 source 配置文件
pub fn handle_refresh() {
    // 什么都不做，直接成功退出
    // shell wrapper 中检测到 refresh 命令且退出码为 0 时，会自动执行 source
}

/// 处理 `--complete-use` 隐式命令: 输出所有环境名称，每行一个，供 shell 补全使用
pub fn handle_complete_use() {
    let manager = EnvironmentManager::global();
    let manager = match manager.lock() {
        Ok(m) => m,
        Err(_) => return,
    };
    if let Ok(envs) = manager.get_all_environments() {
        for env in envs {
            println!("{}", env.name);
        }
    }
}
