// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Windows GUI 子系统下，CLI 模式需要重新附加到父进程的控制台，
/// 否则 println!/eprintln! 的输出会被丢弃（因为没有连接到任何控制台）。
#[cfg(target_os = "windows")]
fn reattach_console() {
    extern "system" {
        fn AttachConsole(dwProcessId: u32) -> i32;
    }
    // ATTACH_PARENT_PROCESS = 0xFFFFFFFF，附加到启动本进程的父进程控制台
    unsafe {
        AttachConsole(u32::MAX);
    }
}

fn main() {
    // 提前检查是否是 CLI 模式，避免启动 Tauri 应用
    let args: Vec<String> = std::env::args().collect();

    // 如果有命令行参数，先尝试作为 CLI 命令处理
    if args.len() > 1 {
        // Windows Release 构建使用 GUI 子系统，没有控制台连接；
        // CLI 模式需要先附加到父进程（终端）的控制台，才能正常输出。
        #[cfg(target_os = "windows")]
        reattach_console();

        // 处理 CLI 命令（按需初始化 manager，内部会调用 exit）
        if let Err(e) = envis_lib::handle_cli(&args) {
            eprintln!("CLI 处理失败: {}", e);
            std::process::exit(1);
        }
        // CLI 模式已在 handle_cli 中退出，不会执行到这里
    }

    // GUI 模式：启动 Tauri 应用
    envis_lib::run()
}
