use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

/// 设置系统托盘图标
pub fn setup_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    // 创建托盘菜单
    let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &hide_item, &separator, &quit_item])?;

    // 加载自定义托盘图标
    let icon_bytes = include_bytes!("../icons/envis.png");
    // decode PNG bytes to RGBA using the image crate, then build a tauri::image::Image
    let dyn_img = image::load_from_memory(icon_bytes)?;
    let rgba = dyn_img.to_rgba8();
    let (width, height) = (rgba.width(), rgba.height());
    let icon = Image::new_owned(rgba.into_vec(), width, height);

    // 创建托盘图标
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(true) // 在 macOS 上启用模板模式，自动适应明暗主题
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Envis - 环境和服务管理工具")
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.unminimize();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => {
                log::info!("从托盘菜单退出应用");
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            match event {
                TrayIconEvent::Click {
                    button,
                    button_state,
                    ..
                } => {
                    // 左键单击显示/隐藏窗口
                    if button == MouseButton::Left && button_state == MouseButtonState::Up {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.unminimize();
                            }
                        }
                    }
                }
                TrayIconEvent::DoubleClick { button, .. } => {
                    log::debug!("托盘图标双击: {:?}", button);
                    // 双击显示窗口
                    if button == MouseButton::Left {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    }
                }
                TrayIconEvent::Enter { position, .. } => {
                    log::trace!("鼠标进入托盘图标: {:?}", position);
                }
                TrayIconEvent::Move { position, .. } => {
                    log::trace!("鼠标在托盘图标移动: {:?}", position);
                }
                TrayIconEvent::Leave { position, .. } => {
                    log::trace!("鼠标离开托盘图标: {:?}", position);
                }
                _ => {}
            }
        })
        .build(app)?;

    log::info!("系统托盘图标已创建");
    Ok(())
}

/// 更新托盘图标标题
#[allow(dead_code)]
pub fn update_tray_title<R: Runtime>(
    app: &tauri::AppHandle<R>,
    title: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_tooltip(Some(title))?;
    }
    Ok(())
}

/// 更新托盘菜单
#[allow(dead_code)]
pub fn update_tray_menu<R: Runtime>(
    _app: &tauri::AppHandle<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    // 可以在这里动态更新菜单项
    // 例如：根据服务状态添加不同的菜单项
    log::debug!("更新托盘菜单");
    Ok(())
}
