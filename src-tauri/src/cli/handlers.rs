use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::manager::environment_manager::EnvironmentManager;
use crate::manager::services::mongodb::MongodbService;
use crate::manager::services::nodejs::NodejsService;
use crate::types::{ServiceData, ServiceType};

/// 处理 `use` 命令: 激活指定服务版本
pub fn handle_use(matches: &tauri_plugin_cli::Matches) {
    let service = get_string_arg(matches, "service");
    let version = get_string_arg(matches, "version");
    let env_name = get_string_arg(matches, "environment");

    if service.is_none() || version.is_none() {
        eprintln!("错误: 必须指定服务类型和版本");
        eprintln!("用法: envis use <service> <version> [--env <environment>]");
        std::process::exit(1);
    }

    let service = service.unwrap();
    let version = version.unwrap();

    // 获取环境
    let env_id = get_environment_id(env_name.as_deref());

    println!(
        "正在激活 {} 版本 {} (环境: {})...",
        service, version, env_id
    );

    // 根据服务类型执行相应操作
    match service.as_str() {
        "nodejs" => {
            let nodejs_service = NodejsService::global();

            // 检查版本是否已安装
            if !nodejs_service.is_installed(&version) {
                eprintln!("错误: Node.js {} 未安装", version);
                eprintln!("提示: 使用 'envis install nodejs {}' 安装", version);
                std::process::exit(1);
            }

            // 创建或更新服务数据
            let mut service_data = ServiceData {
                id: uuid::Uuid::new_v4().to_string(),
                service_type: ServiceType::Nodejs,
                name: format!("Node.js {}", version),
                version: version.clone(),
                status: crate::types::ServiceDataStatus::Inactive,
                sort: None,
                metadata: None,
                created_at: chrono::Utc::now().to_rfc3339(),
                updated_at: chrono::Utc::now().to_rfc3339(),
            };

            // 激活服务
            match nodejs_service.activate_service(&service_data) {
                Ok(_) => {
                    service_data.status = crate::types::ServiceDataStatus::Active;

                    // 保存服务数据
                    let manager = EnvServDataManager::global();
                    let manager = manager.lock().unwrap();
                    if let Err(e) = manager.save_service_data(&env_id, &service_data) {
                        eprintln!("警告: 保存服务数据失败: {}", e);
                    }

                    println!("✓ 成功激活 {} {}", service, version);
                    println!("请重新打开终端或运行 'source ~/.zshrc' 使更改生效");
                }
                Err(e) => {
                    eprintln!("错误: 激活失败: {}", e);
                    std::process::exit(1);
                }
            }
        }
        "mongodb" | "mysql" | "redis" => {
            eprintln!("提示: {} 服务暂不支持 CLI 激活", service);
            eprintln!("请使用 GUI 界面进行配置");
            std::process::exit(1);
        }
        _ => {
            eprintln!("错误: 不支持的服务类型: {}", service);
            eprintln!("支持的服务: nodejs, mongodb, mysql, redis");
            std::process::exit(1);
        }
    }
}

/// 处理 `list` 命令
pub fn handle_list(matches: &tauri_plugin_cli::Matches) {
    let target = get_string_arg(matches, "target");
    let service = get_string_arg(matches, "service");

    match target.as_deref() {
        Some("versions") => {
            let service_name = service.unwrap_or_else(|| {
                eprintln!("错误: 必须指定服务类型");
                eprintln!("用法: envis list versions --service <service>");
                std::process::exit(1);
            });

            println!("可用的 {} 版本:", service_name);
            match service_name.as_str() {
                "nodejs" => {
                    let nodejs_service = NodejsService::global();
                    let versions = nodejs_service.get_available_versions();
                    for v in versions {
                        let installed = if nodejs_service.is_installed(&v.version) {
                            "✓ 已安装"
                        } else {
                            ""
                        };
                        let lts = if v.lts { "[LTS]" } else { "" };
                        println!("  {} {} {} {}", v.version, lts, v.date, installed);
                    }
                }
                "mongodb" => {
                    let mongodb_service = MongodbService::global();
                    let versions = mongodb_service.get_available_versions();
                    for v in versions {
                        let installed = if mongodb_service.is_installed(&v.version) {
                            "✓ 已安装"
                        } else {
                            ""
                        };
                        println!("  {} {} {}", v.version, v.date, installed);
                    }
                }
                _ => {
                    eprintln!("错误: 不支持的服务类型: {}", service_name);
                    std::process::exit(1);
                }
            }
        }
        Some("envs") => {
            println!("环境列表:");
            let manager = EnvironmentManager::global();
            let manager = manager.lock().unwrap();
            match manager.get_all_environments() {
                Ok(envs) => {
                    if envs.is_empty() {
                        println!("  (无环境)");
                    } else {
                        for env in envs {
                            let active = if env.is_default.unwrap_or(false) {
                                "* "
                            } else {
                                "  "
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
        Some("services") => {
            println!("支持的服务类型:");
            println!("  nodejs   - Node.js 运行时");
            println!("  mongodb  - MongoDB 数据库");
            println!("  mysql    - MySQL 数据库");
            println!("  redis    - Redis 缓存");
        }
        _ => {
            eprintln!("错误: 必须指定列表目标");
            eprintln!("用法: envis list <versions|envs|services>");
            std::process::exit(1);
        }
    }
}

/// 处理 `install` 命令
pub fn handle_install(matches: &tauri_plugin_cli::Matches) {
    let service = get_string_arg(matches, "service");
    let version = get_string_arg(matches, "version");

    if service.is_none() || version.is_none() {
        eprintln!("错误: 必须指定服务类型和版本");
        eprintln!("用法: envis install <service> <version>");
        std::process::exit(1);
    }

    let service = service.unwrap();
    let version = version.unwrap();

    println!("正在下载并安装 {} {}...", service, version);
    eprintln!("提示: CLI 安装功能需要异步支持");
    eprintln!("请使用 GUI 界面进行安装，或等待后续版本支持");
    std::process::exit(1);
}

/// 处理 `start` 命令
pub fn handle_start(matches: &tauri_plugin_cli::Matches) {
    let service = get_string_arg(matches, "service");
    let env_name = get_string_arg(matches, "environment");

    if service.is_none() {
        eprintln!("错误: 必须指定服务类型");
        eprintln!("用法: envis start <service> [--env <environment>]");
        std::process::exit(1);
    }

    let service = service.unwrap();
    let env_id = get_environment_id(env_name.as_deref());

    println!("正在启动 {} 服务 (环境: {})...", service, env_id);
    eprintln!("提示: 服务启动功能需要访问管理器状态");
    eprintln!("请使用 GUI 界面进行操作");
    std::process::exit(1);
}

/// 处理 `stop` 命令
pub fn handle_stop(matches: &tauri_plugin_cli::Matches) {
    let service = get_string_arg(matches, "service");
    let env_name = get_string_arg(matches, "environment");

    if service.is_none() {
        eprintln!("错误: 必须指定服务类型");
        eprintln!("用法: envis stop <service> [--env <environment>]");
        std::process::exit(1);
    }

    let service = service.unwrap();
    let env_id = get_environment_id(env_name.as_deref());

    println!("正在停止 {} 服务 (环境: {})...", service, env_id);
    eprintln!("提示: 服务停止功能需要访问管理器状态");
    eprintln!("请使用 GUI 界面进行操作");
    std::process::exit(1);
}

/// 处理 `status` 命令
pub fn handle_status(matches: &tauri_plugin_cli::Matches) {
    let service = get_string_arg(matches, "service");
    let env_name = get_string_arg(matches, "environment");
    let env_id = get_environment_id(env_name.as_deref());

    if let Some(service) = service.as_ref() {
        println!("{} 服务状态 (环境: {}):", service, env_id);
    } else {
        println!("所有服务状态 (环境: {}):", env_id);
    }

    let manager = EnvServDataManager::global();
    let manager = manager.lock().unwrap();

    match manager.get_environment_all_service_datas(&env_id) {
        Ok(services) => {
            if services.is_empty() {
                println!("  (无服务数据)");
            } else {
                for svc in services {
                    let service_name = format!("{:?}", svc.service_type).to_lowercase();
                    if let Some(ref filter) = service {
                        if service_name != filter.to_lowercase() {
                            continue;
                        }
                    }

                    let status = match svc.status {
                        crate::types::ServiceDataStatus::Active => "✓ Active",
                        crate::types::ServiceDataStatus::Inactive => "○ Inactive",
                    };

                    println!(
                        "  {} {:?} - {} ({})",
                        status, svc.service_type, svc.version, svc.name
                    );
                }
            }
        }
        Err(e) => {
            eprintln!("错误: 获取服务数据失败: {}", e);
            std::process::exit(1);
        }
    }
}

/// 处理 `env` 命令
pub fn handle_env(matches: &tauri_plugin_cli::Matches) {
    if let Some(subcommand) = &matches.subcommand {
        match subcommand.name.as_str() {
            "create" => {
                let name = get_string_arg(&subcommand.matches, "name");
                if name.is_none() {
                    eprintln!("错误: 必须指定环境名称");
                    eprintln!("用法: envis env create <name>");
                    std::process::exit(1);
                }

                let name = name.unwrap();
                println!("正在创建环境: {}...", name);

                // 创建 Environment 对象
                let env = crate::types::Environment {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: name.clone(),
                    is_default: Some(false),
                    status: crate::types::EnvironmentStatus::Active,
                    sort: None,
                    metadata: None,
                    created_at: chrono::Utc::now().to_rfc3339(),
                    updated_at: chrono::Utc::now().to_rfc3339(),
                };

                let manager = EnvironmentManager::global();
                let manager = manager.lock().unwrap();
                match manager.create_environment(&env) {
                    Ok(result) => {
                        if result.success {
                            println!("✓ 环境创建成功: {} (ID: {})", name, env.id);
                        } else {
                            eprintln!("错误: {}", result.message);
                            std::process::exit(1);
                        }
                    }
                    Err(e) => {
                        eprintln!("错误: 创建环境失败: {}", e);
                        std::process::exit(1);
                    }
                }
            }
            "list" => {
                println!("环境列表:");
                let manager = EnvironmentManager::global();
                let manager = manager.lock().unwrap();
                match manager.get_all_environments() {
                    Ok(envs) => {
                        if envs.is_empty() {
                            println!("  (无环境)");
                        } else {
                            for env in envs {
                                let active = if env.is_default.unwrap_or(false) {
                                    "* "
                                } else {
                                    "  "
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
            "activate" => {
                let name = get_string_arg(&subcommand.matches, "name");
                if name.is_none() {
                    eprintln!("错误: 必须指定环境名称或 ID");
                    eprintln!("用法: envis env activate <name>");
                    std::process::exit(1);
                }

                let name = name.unwrap();
                println!("正在激活环境: {}...", name);

                let manager = EnvironmentManager::global();
                let manager = manager.lock().unwrap();

                // 查找环境
                match manager.get_all_environments() {
                    Ok(envs) => {
                        let env = envs.iter().find(|e| e.name == name || e.id == name);
                        if let Some(env) = env {
                            // 先将所有环境的 is_default 设置为 false
                            for e in envs.iter() {
                                let mut updated_env = e.clone();
                                updated_env.is_default = Some(false);
                                updated_env.updated_at = chrono::Utc::now().to_rfc3339();
                                let _ = manager.save_environment(&updated_env);
                            }

                            // 激活目标环境
                            let mut activated_env = env.clone();
                            activated_env.is_default = Some(true);
                            activated_env.updated_at = chrono::Utc::now().to_rfc3339();

                            match manager.save_environment(&activated_env) {
                                Ok(_) => {
                                    println!("✓ 环境激活成功: {}", env.name);
                                }
                                Err(e) => {
                                    eprintln!("错误: 激活环境失败: {}", e);
                                    std::process::exit(1);
                                }
                            }
                        } else {
                            eprintln!("错误: 找不到环境: {}", name);
                            std::process::exit(1);
                        }
                    }
                    Err(e) => {
                        eprintln!("错误: 获取环境列表失败: {}", e);
                        std::process::exit(1);
                    }
                }
            }
            "delete" => {
                let name = get_string_arg(&subcommand.matches, "name");
                if name.is_none() {
                    eprintln!("错误: 必须指定环境名称或 ID");
                    eprintln!("用法: envis env delete <name>");
                    std::process::exit(1);
                }

                let name = name.unwrap();
                println!("正在删除环境: {}...", name);

                let manager = EnvironmentManager::global();
                let manager = manager.lock().unwrap();

                // 查找环境
                match manager.get_all_environments() {
                    Ok(envs) => {
                        let env = envs.iter().find(|e| e.name == name || e.id == name);
                        if let Some(env) = env {
                            match manager.delete_environment(&env) {
                                Ok(_) => {
                                    println!("✓ 环境删除成功: {}", env.name);
                                }
                                Err(e) => {
                                    eprintln!("错误: 删除环境失败: {}", e);
                                    std::process::exit(1);
                                }
                            }
                        } else {
                            eprintln!("错误: 找不到环境: {}", name);
                            std::process::exit(1);
                        }
                    }
                    Err(e) => {
                        eprintln!("错误: 获取环境列表失败: {}", e);
                        std::process::exit(1);
                    }
                }
            }
            _ => {
                eprintln!("未知的 env 子命令: {}", subcommand.name);
                std::process::exit(1);
            }
        }
    } else {
        eprintln!("错误: 必须指定 env 子命令");
        eprintln!("用法: envis env <create|list|activate|delete>");
        std::process::exit(1);
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

fn get_environment_id(env_name: Option<&str>) -> String {
    if let Some(name) = env_name {
        // 尝试通过名称查找环境 ID
        let manager = EnvironmentManager::global();
        let manager = manager.lock().unwrap();
        if let Ok(envs) = manager.get_all_environments() {
            if let Some(env) = envs.iter().find(|e| e.name == name || e.id == name) {
                return env.id.clone();
            }
        }
        eprintln!("警告: 找不到环境 '{}', 使用当前激活的环境", name);
    }

    // 获取当前激活的环境（通过 is_default 字段）
    let manager = EnvironmentManager::global();
    let manager = manager.lock().unwrap();
    match manager.get_all_environments() {
        Ok(envs) => {
            if let Some(env) = envs.iter().find(|e| e.is_default.unwrap_or(false)) {
                env.id.clone()
            } else {
                eprintln!("错误: 没有激活的环境");
                eprintln!("请使用 'envis env create <name>' 创建环境");
                eprintln!("或使用 'envis env activate <name>' 激活环境");
                std::process::exit(1);
            }
        }
        Err(e) => {
            eprintln!("错误: 获取环境列表失败: {}", e);
            std::process::exit(1);
        }
    }
}
