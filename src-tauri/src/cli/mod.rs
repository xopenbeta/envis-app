use tauri_plugin_cli::CliExt;

mod handlers;

/// 初始化并处理 CLI 参数
pub fn handle_cli(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    match app.cli().matches() {
        Ok(matches) => {
            log::info!("CLI 匹配成功: {:?}", matches);

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
                    "list" => handlers::handle_list(&subcommand.matches),
                    "install" => handlers::handle_install(&subcommand.matches),
                    "start" => handlers::handle_start(&subcommand.matches),
                    "stop" => handlers::handle_stop(&subcommand.matches),
                    "status" => handlers::handle_status(&subcommand.matches),
                    "env" => handlers::handle_env(&subcommand.matches),
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
    use              Activate a service version
    list             List available versions or environments
    install          Download and install a service version
    start            Start a service
    stop             Stop a service
    status           Check service status
    env              Environment management

EXAMPLES:
    # Activate Node.js v20.18.0
    envis use nodejs v20.18.0

    # List all Node.js versions
    envis list versions --service nodejs

    # Install MongoDB 7.0.15
    envis install mongodb 7.0.15

    # Start MySQL service
    envis start mysql --env dev

    # Check all service status
    envis status

For more information on a specific command, run:
    envis <SUBCOMMAND> --help
"#
    );
}
