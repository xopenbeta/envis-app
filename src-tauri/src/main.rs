// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 提前检查是否是 CLI 模式，避免启动 Tauri 应用
    let args: Vec<String> = std::env::args().collect();
    
    // 如果有命令行参数，先尝试作为 CLI 命令处理
    if args.len() > 1 {
        // 初始化必要的管理器
        let _ = envis_lib::initialize_managers();
        
        // 处理 CLI 命令（这会在处理完后调用 exit）
        if let Err(e) = envis_lib::handle_cli_early() {
            eprintln!("CLI 处理失败: {}", e);
            std::process::exit(1);
        }
        // CLI 模式已在 handle_cli_early 中退出，不会执行到这里
    }
    
    // GUI 模式：启动 Tauri 应用
    envis_lib::run()
}
