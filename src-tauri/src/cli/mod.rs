use tauri_plugin_cli::CliExt;

mod handlers;

/// 提前处理 CLI 参数（不依赖 Tauri 应用）
pub fn handle_cli_early() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    
    // 没有参数，返回
    if args.len() <= 1 {
        return Ok(());
    }

    // 处理帮助信息
    if args.len() == 2 && (args[1] == "--help" || args[1] == "-h") {
        print_help();
        std::process::exit(0);
    }

    // 处理版本信息
    if args.len() == 2 && (args[1] == "--version" || args[1] == "-v") {
        println!("Envis version {}", env!("CARGO_PKG_VERSION"));
        std::process::exit(0);
    }

    // 处理子命令
    if args.len() >= 2 {
        match args[1].as_str() {
            "list" | "ls" => {
                handlers::handle_list();
                std::process::exit(0);
            }
            "use" => {
                if args.len() < 3 {
                    eprintln!("错误: 必须指定环境名称或 ID");
                    eprintln!("用法: envis use <name_or_id>");
                    std::process::exit(1);
                }
                handlers::handle_use_early(&args[2]);
                std::process::exit(0);
            }
            "refresh" => {
                handlers::handle_refresh();
                std::process::exit(0);
            }
            _ => {
                eprintln!("未知命令: {}", args[1]);
                eprintln!("运行 'envis --help' 查看可用命令");
                std::process::exit(1);
            }
        }
    }

    Ok(())
}

/// 初始化并处理 CLI 参数（保留以兼容旧代码）
pub fn handle_cli(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    match app.cli().matches() {
        Ok(matches) => {
            // 处理顶层参数
            if matches.args.get("version").is_some() {
                println!("Envis version {}", app.package_info().version);
                std::process::exit(0);
            }

            if matches.args.get("help").is_some() {
                print_help();
                std::process::exit(0);
            }

            // 处理子命令
            if let Some(subcommand) = &matches.subcommand {
                match subcommand.name.as_str() {
                    "use" => handlers::handle_use(&subcommand.matches),
                    "list" => handlers::handle_list(),
                    "ls" => handlers::handle_list(),
                    "refresh" => handlers::handle_refresh(),
                    _ => {
                        eprintln!("未知命令: {}", subcommand.name);
                        std::process::exit(1);
                    }
                }

                // CLI 模式下处理完命令后退出
                std::process::exit(0);
            }

            Ok(())
        }
        Err(e) => {
            log::error!("CLI 解析错误: {}", e);
            Err(Box::new(e))
        }
    }
}

fn print_help() {
    println!(
        r#"
Envis - Environment and Service Management Tool

USAGE:
    envis [OPTIONS] [SUBCOMMAND]

OPTIONS:
    -h, --help       Show help information
    -v, --version    Show version information

SUBCOMMANDS:
    list             List all environments
    ls               List all environments
    use              Activate an environment
    refresh          Reload shell configuration (source ~/.zshrc or ~/.bash_profile)

EXAMPLES:
    # List all environments
    envis list

    # Activate an environment by name
    envis use my-env

    # Activate an environment by ID
    envis use 0389cccc-1ed7-4d59-8be0-0c1baec26e5eenv

For more information on a specific command, run:
    envis <SUBCOMMAND> --help
"#
    );
}
