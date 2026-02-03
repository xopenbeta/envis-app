use crate::manager::environment_manager::EnvironmentManager;
use crate::types::EnvironmentStatus;

/// 处理 `use` 命令: 激活指定环境
pub fn handle_use(matches: &tauri_plugin_cli::Matches) {
    let name_or_id = get_string_arg(matches, "name");

    if name_or_id.is_none() {
        eprintln!("错误: 必须指定环境名称或 ID");
        eprintln!("用法: envis use <name_or_id>");
        std::process::exit(1);
    }

    let target_str = name_or_id.unwrap();
    
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();

    // 1. 获取所有环境
    let mut environments = match manager.get_all_environments() {
        Ok(envs) => envs,
        Err(e) => {
            eprintln!("错误: 无法获取环境列表: {}", e);
            std::process::exit(1);
        }
    };

    // 2. 查找目标环境
    // 优先精确匹配 ID，然后精确匹配 Name
    let target_idx = environments.iter().position(|e| e.id == target_str)
        .or_else(|| environments.iter().position(|e| e.name == target_str));

    if let Some(idx) = target_idx {
        let mut target_env = environments[idx].clone();
        
        println!("正在激活环境: {} ({}) ...", target_env.name, target_env.id);

        // 3. 停用其他活跃环境 (更新状态文件，避免下次 list 显示多个 Active)
        for (i, env) in environments.iter_mut().enumerate() {
            if i != idx && env.status == EnvironmentStatus::Active {
                env.status = EnvironmentStatus::Inactive;
                if let Err(e) = manager.save_environment(env) {
                    eprintln!("警告: 无法更新原环境 {} 的状态 (非致命错误): {}", env.name, e);
                }
            }
        }

        // 4. 激活目标环境
        match manager.activate_environment_and_services(&mut target_env, None) {
            Ok(res) => {
                if res.success {
                    println!("✓ 成功激活环境: {}", target_env.name);
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

    } else {
        eprintln!("错误: 未找到名称或 ID 为 '{}' 的环境", target_str);
        std::process::exit(1);
    }
}

/// 处理 `list` 命令
pub fn handle_list() {
    println!("环境列表:");
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();
    match manager.get_all_environments() {
        Ok(envs) => {
            if envs.is_empty() {
                println!("  (无环境)");
            } else {
                for env in envs {
                    let active = if env.status == EnvironmentStatus::Active {
                        "[Active] "
                    } else {
                        "         "
                    };
                    println!("{}{} ({})", active, env.name, env.id);
                }
            }
        }
        Err(e) => {
            eprintln!("错误: 获取环境列表失败: {}", e);
            std::process::exit(1);
        }
    }
}

// 辅助函数
fn get_string_arg(matches: &tauri_plugin_cli::Matches, name: &str) -> Option<String> {
    matches.args.get(name).and_then(|arg| match &arg.value {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Array(arr) if !arr.is_empty() => arr[0].as_str().map(|s| s.to_string()),
        _ => None,
    })
}
