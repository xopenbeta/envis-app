
mod handlers;

use crate::manager::app_config_manager::initialize_config_manager;
use crate::manager::environment_manager::initialize_environment_manager;
use crate::manager::shell_manamger::initialize_shell_manager;

/// 提前处理 CLI 参数（不依赖 Tauri 应用）
/// args: 来自 std::env::args().collect()，由 main.rs 传入，避免重复收集
pub fn handle_cli_early(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    // 没有参数，直接返回 Ok(())，让程序继续启动 GUI
    if args.len() <= 1 {
        return Ok(());
    }

    // ── 无需任何初始化的命令 ────────────────────────────────────────
    match args[1].as_str() {
        "--help" | "-h" => {
            print_help();
            std::process::exit(0);
        }
        "--version" | "-v" => {
            println!("Envis version {}", env!("CARGO_PKG_VERSION"));
            std::process::exit(0);
        }
        // refresh 是 no-op，由 shell wrapper 负责 source
        "refresh" => {
            handlers::handle_refresh();
            std::process::exit(0);
        }
        _ => {}
    }

    // ── list / ls：只需 AppConfigManager + EnvironmentManager ───────
    if args[1] == "list" || args[1] == "ls" {
        initialize_config_manager()?;
        initialize_environment_manager()?;
        handlers::handle_list();
        std::process::exit(0);
    }

    // ── use：需要完整初始化（含 ShellManager，因为要写 shell 配置）─
    if args[1] == "use" {
        if args.len() < 3 {
            eprintln!("错误: 必须指定环境名称或 ID");
            eprintln!("用法: envis use <name_or_id>");
            std::process::exit(1);
        }
        initialize_config_manager()?;
        initialize_shell_manager()?;
        initialize_environment_manager()?;
        handlers::handle_use_early(&args[2]);
        std::process::exit(0);
    }

    eprintln!("未知命令: {}", args[1]);
    eprintln!("运行 'envis --help' 查看可用命令");
    std::process::exit(1);
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
