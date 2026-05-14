use tauri::{Manager, Runtime};

/// 设置窗口事件处理器
pub fn setup_window_events<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        let app_handle = app.clone();

        // 处理窗口关闭事件
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 阻止窗口关闭，改为隐藏到托盘
                api.prevent_close();

                // 隐藏窗口
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.hide();
                    log::info!("窗口已最小化到系统托盘");
                }
            }
        });

        log::info!("窗口事件处理器已设置");
    }

    Ok(())
}
