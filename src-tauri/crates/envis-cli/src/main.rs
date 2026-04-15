fn main() {
    // 初始化日志（输出到 stderr，不污染 stdout 的命令输出）
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("warn"))
        .target(env_logger::Target::Stderr)
        .init();

    let args: Vec<String> = std::env::args().collect();

    if let Err(e) = envis_core::cli::handle_cli_early(&args) {
        eprintln!("CLI 处理失败: {}", e);
        std::process::exit(1);
    }

    // handle_cli_early 对有效命令会在内部调用 std::process::exit
    // 走到这里说明 args 长度 <= 1（不应该在纯 CLI 模式出现）
    eprintln!("请提供命令，运行 'envis-cli --help' 查看帮助");
    std::process::exit(1);
}
