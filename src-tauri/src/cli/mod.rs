use tauri_plugin_cli::CliExt;

mod handlers;

/// 初始化并处理 CLI 参数
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
