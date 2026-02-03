mod cli;
mod manager;
mod tauri_command;
mod tray;
mod types;
mod utils;
mod window;

use manager::app_config_manager::initialize_config_manager;
use manager::env_serv_data_manager::initialize_env_serv_data_manager;
use manager::environment_manager::initialize_environment_manager;
use manager::service_manager::initialize_service_manager;
use manager::shell_manamger::initialize_shell_manager;
use tauri_command::app_config_commands::{get_app_config, set_app_config, open_app_config_folder};
use tauri_command::env_serv_data_commands::*;
use tauri_command::environment_commands::*;
use tauri_command::file_commands::*;
use tauri_command::service_commands::*;
use tauri_command::services::custom_commands::*;
use tauri_command::services::host_commands::*;
use tauri_command::services::mariadb_commands::*;
use tauri_command::services::mongodb_commands::*;
use tauri_command::services::mysql_commands::*;
use tauri_command::services::nginx_commands::*;
use tauri_command::services::nodejs_commands::*;
use tauri_command::services::postgresql_commands::*;
use tauri_command::services::python_commands::*;
use tauri_command::services::ssl_commands::*;
use tauri_command::services::dnsmasq_commands::*;
use tauri_command::system_info_commands::*;
use tauri_plugin_log::{Target, TargetKind};
use tauri::Manager;

// 在移动端构建时：相当于给 run 函数加上 #[tauri::mobile_entry_point]，让它成为移动端入口。
// 在桌面端构建时：不会添加这个属性，run 只是普通函数，你通常会在 main() 里调用它。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 检查是否是 CLI 模式（有命令行参数）
    let is_cli_mode = std::env::args().len() > 1;
    
    let mut builder = tauri::Builder::default();
    
    // 只在非 CLI 模式下启用单实例插件
    if !is_cli_mode {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            log::debug!("检测到尝试启动新实例");
            log::debug!("启动参数: {:?}", args);
            log::debug!("工作目录: {}", cwd);
            
            // 获取主窗口并聚焦
            if let Some(window) = app.get_webview_window("main") {
                // 显示窗口（如果被最小化）
                if let Err(e) = window.show() {
                    log::error!("显示窗口失败: {}", e);
                }
                
                // 取消最小化
                if let Err(e) = window.unminimize() {
                    log::error!("取消最小化失败: {}", e);
                }
                
                // 聚焦窗口
                if let Err(e) = window.set_focus() {
                    log::error!("聚焦窗口失败: {}", e);
                } else {
                    log::info!("成功聚焦现有实例的主窗口");
                }
            } else {
                log::warn!("未找到主窗口");
            }
        }));
    }

    builder
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets(if is_cli_mode {
                    // CLI 模式下不输出日志到 stdout，避免干扰命令输出
                    vec![Target::new(TargetKind::Webview)]
                } else {
                    // GUI 模式下同时输出到 stdout 和 webview
                    vec![
                        Target::new(TargetKind::Stdout),
                        Target::new(TargetKind::Webview),
                    ]
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_cli::init())
        .setup(move |app| {
            // 初始化各个管理器（需在日志插件初始化后执行，以便记录初始化日志）
            let _ = initialize_config_manager(); // 初始化配置管理器
            let _ = initialize_shell_manager(); // 初始化 Shell 管理器
            let _ = initialize_environment_manager(); // 初始化环境管理器
            let _ = initialize_env_serv_data_manager(); // 初始化环境服务数据管理器
            let _ = initialize_service_manager(); // 初始化服务管理器
            // Host 管理器延迟初始化，在第一次调用时自动创建
            // let _ = initialize_host_manager();

            if !is_cli_mode {
                log::info!("GUI 模式启动成功");
            }

            // 处理 CLI 参数
            if let Err(e) = cli::handle_cli(app) {
                log::error!("CLI 处理失败: {}", e);
            }

            // 设置系统托盘
            if let Err(e) = tray::setup_tray(app.handle()) {
                log::error!("设置系统托盘失败: {}", e);
            }

            // 设置窗口事件处理器
            if let Err(e) = window::setup_window_events(app.handle()) {
                log::error!("设置窗口事件失败: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 应用配置相关命令
            get_app_config,
            set_app_config,
            open_app_config_folder,
            // 文件相关命令
            open_file_dialog,
            open_files_dialog,
            open_folder_dialog,
            open_in_file_manager,
            // 环境相关命令
            get_all_environments,
            create_environment,
            save_environment,
            delete_environment,
            is_environment_exists,
            activate_environment,
            activate_environment_and_services,
            deactivate_environment,
            deactivate_environment_and_services,
            // 环境服务数据相关命令
            get_environment_all_service_datas,
            create_service_data,
            update_service_data,
            delete_service_data,
            active_service_data,
            deactive_service_data,
            // 服务相关命令
            get_all_installed_services,
            get_service_size,
            delete_service,
            // 系统信息相关命令
            get_system_info,
            open_terminal,
            toggle_dev_tools,
            quit_app,
            open_system_env_settings,
            // Node.js 服务命令
            download_nodejs,
            get_nodejs_versions,
            check_nodejs_installed,
            cancel_download_nodejs,
            get_nodejs_download_progress,
            // npm 配置命令
            set_npm_registry,
            set_npm_config_prefix,
            get_global_npm_packages,
            install_global_npm_package,
            // Nginx 服务命令
            check_nginx_installed,
            get_nginx_versions,
            download_nginx,
            cancel_download_nginx,
            get_nginx_download_progress,
            // Nginx 配置命令
            get_nginx_config,
            // Nginx 控制命令
            start_nginx_service,
            stop_nginx_service,
            restart_nginx_service,
            get_nginx_service_status,
            // 自定义服务命令
            update_custom_service_paths,
            update_custom_service_env_vars,
            update_custom_service_aliases,
            execute_custom_service_alias,
            // Host 服务命令
            get_hosts,
            add_host,
            update_host,
            delete_host,
            toggle_host,
            clear_hosts,
            open_hosts_file,
            // MongoDB 服务命令
            download_mongodb,
            get_mongodb_versions,
            check_mongodb_installed,
            cancel_mongodb_download,
            get_mongodb_download_progress,
            // MongoDB 控制与配置
            get_mongodb_config,
            start_mongodb_service,
            stop_mongodb_service,
            restart_mongodb_service,
            get_mongodb_service_status,
            open_mongodb_compass,
            open_mongodb_shell,
            initialize_mongodb,
            check_mongodb_initialized,
            list_mongodb_databases,
            list_mongodb_collections,
            create_mongodb_database,
            create_mongodb_user,
            list_mongodb_users,
            update_mongodb_user_roles,
            delete_mongodb_user,
            // MariaDB 服务命令
            download_mariadb,
            get_mariadb_versions,
            check_mariadb_installed,
            cancel_mariadb_download,
            get_mariadb_download_progress,
            // MariaDB 控制与配置
            get_mariadb_config,
            start_mariadb_service,
            stop_mariadb_service,
            restart_mariadb_service,
            get_mariadb_service_status,
            set_mariadb_data_path,
            set_mariadb_log_path,
            set_mariadb_port,
            initialize_mariadb,
            check_mariadb_initialized,
            list_mariadb_databases,
            create_mariadb_database,
            list_mariadb_tables,
            open_mariadb_client,
            // MySQL 服务命令
            download_mysql,
            get_mysql_versions,
            check_mysql_installed,
            cancel_mysql_download,
            get_mysql_download_progress,
            // MySQL 控制与配置
            get_mysql_config,
            start_mysql_service,
            stop_mysql_service,
            restart_mysql_service,
            get_mysql_service_status,
            set_mysql_data_path,
            set_mysql_log_path,
            set_mysql_port,
            initialize_mysql,
            check_mysql_initialized,
            list_mysql_databases,
            create_mysql_database,
            list_mysql_tables,
            open_mysql_client,
            // PostgreSQL 服务命令
            download_postgresql,
            get_postgresql_versions,
            check_postgresql_installed,
            cancel_postgresql_download,
            get_postgresql_download_progress,
            // PostgreSQL 控制与配置
            get_postgresql_config,
            start_postgresql_service,
            stop_postgresql_service,
            restart_postgresql_service,
            get_postgresql_service_status,
            set_postgresql_data_path,
            set_postgresql_port,
            // Python 服务命令
            download_python,
            get_python_versions,
            check_python_installed,
            cancel_download_python,
            get_python_download_progress,
            // pip 配置命令
            set_pip_index_url,
            set_pip_trusted_host,
            set_python3_as_python,
            // SSL 证书服务命令
            check_ca_initialized,
            initialize_ca,
            get_ca_info,
            issue_certificate,
            list_certificates,
            delete_certificate,
            export_ca_certificate,
            check_ca_installed,
            // Dnsmasq 服务命令
            check_dnsmasq_installed,
            get_dnsmasq_versions,
            download_dnsmasq,
            cancel_download_dnsmasq,
            get_dnsmasq_download_progress,
            // Dnsmasq 配置命令
            get_dnsmasq_config,
            // Dnsmasq 控制命令
            start_dnsmasq_service,
            stop_dnsmasq_service,
            restart_dnsmasq_service,
            get_dnsmasq_service_status,
        ])
        .on_window_event(|_window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { .. } => {
                    // // 在窗口关闭时清理 Shell 管理器
                    // let _ = cleanup_shell_manager();
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
