use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::env_serv_data_manager::ServiceDataResult;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadTask};
use crate::types::{ServiceData, ServiceStatus};
use crate::utils::create_command;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use std::time::Duration;

/// MariaDB 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MariadbVersion {
    pub version: String,
    pub series: String,
    pub release_type: String,
}

/// 全局 MariaDB 服务管理器单例
static GLOBAL_MARIADB_SERVICE: OnceLock<Arc<MariadbService>> = OnceLock::new();

/// MariaDB 服务管理器
pub struct MariadbService {}

impl MariadbService {
    /// 获取全局 MariaDB 服务管理器单例
    pub fn global() -> Arc<MariadbService> {
        GLOBAL_MARIADB_SERVICE
            .get_or_init(|| Arc::new(MariadbService::new()))
            .clone()
    }

    fn new() -> Self {
        Self {}
    }

    /// 获取可用的 MariaDB 版本列表
    pub fn get_available_versions(&self) -> Vec<MariadbVersion> {
        vec![
            MariadbVersion {
                version: "10.6.25".to_string(),
                series: "10.6".to_string(),
                release_type: "Long-Term Support".to_string(),
            },
            MariadbVersion {
                version: "10.11.16".to_string(),
                series: "10.11".to_string(),
                release_type: "Long-Term Support".to_string(),
            },
            MariadbVersion {
                version: "11.4.10".to_string(),
                series: "11.4".to_string(),
                release_type: "Long-Term Support".to_string(),
            },
            MariadbVersion {
                version: "11.8.6".to_string(),
                series: "11.8".to_string(),
                release_type: "Current Stable".to_string(),
            },
            MariadbVersion {
                version: "12.2.2".to_string(),
                series: "12.2".to_string(),
                release_type: "Development".to_string(),
            },
            MariadbVersion {
                version: "12.3.1".to_string(),
                series: "12.3".to_string(),
                release_type: "Development".to_string(),
            },
        ]
    }

    /// 检查 MariaDB 是否已安装
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        let mysqld = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mysqld.exe")
        } else {
            install_path.join("bin").join("mysqld")
        };
        mysqld.exists()
    }

    fn get_install_path(&self, version: &str) -> PathBuf {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        };
        services_folder.join("mariadb").join(version)
    }

    /// 构建下载文件名和 URL 列表
    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;
        let mut urls: Vec<String> = Vec::new();

        match platform {
            // macOS 包从 GitHub Release 下载（文件名格式：mariadb-{version}-macos-{arch}.tar.gz）
            // GitHub Release URL → 302 重定向到签名 CDN 链接（~1小时有效），reqwest 默认自动跟随重定向
            "macos" => {
                let arch_str = if arch == "aarch64" { "arm64" } else { "x86_64" };
                let filename = format!("mariadb-{}-macos-{}.tar.gz", version, arch_str);

                // 主要来源：xopenbeta/mariadb-archive（含各平台 macOS 包）
                urls.push(format!(
                    "https://github.com/xopenbeta/mariadb-archive/releases/latest/download/{}",
                    filename
                ));
                // 备用来源：mariadb-corporation 官方 GitHub Release
                urls.push(format!(
                    "https://github.com/mariadb-corporation/mariadb-community-server-release/releases/download/mariadb-{}/{}",
                    version, filename
                ));
                // 备用来源：MariaDB 官方下载站
                urls.push(format!(
                    "https://downloads.mariadb.org/f/mariadb-{}/bintar-macos-{}/{}",
                    version, arch_str, filename
                ));

                Ok((urls, filename))
            }
            // Linux/Windows 镜像站有完整包，优先走国内镜像
            "linux" => {
                let arch_str = if arch == "aarch64" { "aarch64" } else { "x86_64" };
                let filename =
                    format!("mariadb-{}-linux-systemd-{}.tar.gz", version, arch_str);
                let subdir = format!("bintar-linux-systemd-{}", arch_str);
                urls.push(format!(
                    "https://mirrors.tuna.tsinghua.edu.cn/mariadb/mariadb-{}/{}/{}",
                    version, subdir, filename
                ));
                urls.push(format!(
                    "https://mirrors.aliyun.com/mariadb/mariadb-{}/{}/{}",
                    version, subdir, filename
                ));
                urls.push(format!(
                    "https://downloads.mariadb.org/f/mariadb-{}/{}/{}",
                    version, subdir, filename
                ));
                Ok((urls, filename))
            }
            "windows" => {
                let filename = format!("mariadb-{}-winx64.zip", version);
                let subdir = "winx64-packages";
                urls.push(format!(
                    "https://mirrors.tuna.tsinghua.edu.cn/mariadb/mariadb-{}/{}/{}",
                    version, subdir, filename
                ));
                urls.push(format!(
                    "https://mirrors.aliyun.com/mariadb/mariadb-{}/{}/{}",
                    version, subdir, filename
                ));
                urls.push(format!(
                    "https://downloads.mariadb.org/f/mariadb-{}/{}/{}",
                    version, subdir, filename
                ));
                Ok((urls, filename))
            }
            _ => Err(anyhow!("不支持的操作系统: {}", platform)),
        }
    }

    /// 下载并安装 MariaDB
    pub async fn download_and_install(&self, version: &str) -> Result<DownloadResult> {
        if self.is_installed(version) {
            return Ok(DownloadResult::success(
                format!("MariaDB {} 已经安装", version),
                None,
            ));
        }

        let (urls, filename) = self.build_download_info(version)?;
        let install_path = self.get_install_path(version);
        let task_id = format!("mariadb-{}", version);
        let download_manager = DownloadManager::global();

        let version_for_callback = version.to_string();
        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!(
                "MariaDB {} 下载完成: {} - {}",
                version_for_callback,
                task.id,
                task.filename
            );
            let task_for_spawn = task.clone();
            let version_for_spawn = version_for_callback.clone();
            let service_for_spawn = MariadbService::global();

            tokio::spawn(async move {
                let download_manager = DownloadManager::global();
                if let Err(e) = download_manager.update_task_status(
                    &task_for_spawn.id,
                    crate::manager::services::DownloadStatus::Installing,
                    None,
                ) {
                    log::error!("更新任务状态失败: {}", e);
                } else {
                    log::info!("MariaDB {} 开始安装", version_for_spawn);
                }

                match service_for_spawn
                    .extract_and_install(&task_for_spawn, &version_for_spawn)
                    .await
                {
                    Ok(_) => {
                        if let Err(e) = download_manager.update_task_status(
                            &task_for_spawn.id,
                            crate::manager::services::DownloadStatus::Installed,
                            None,
                        ) {
                            log::error!("更新任务状态失败: {}", e);
                        } else {
                            log::info!("MariaDB {} 安装成功", version_for_spawn);
                        }
                    }
                    Err(e) => {
                        if let Err(update_err) = download_manager.update_task_status(
                            &task_for_spawn.id,
                            crate::manager::services::DownloadStatus::Failed,
                            Some(format!("安装失败: {}", e)),
                        ) {
                            log::error!("更新任务状态失败: {}", update_err);
                        }
                        log::error!("MariaDB {} 安装失败: {}", version_for_spawn, e);
                    }
                }
            });
        });

        match download_manager
            .start_download(
                task_id.clone(),
                urls,
                install_path.clone(),
                filename,
                true,
                Some(success_callback),
            )
            .await
        {
            Ok(_) => {
                if let Some(task) = download_manager.get_task_status(&task_id) {
                    Ok(DownloadResult::success(
                        format!("MariaDB {} 下载完成", version),
                        Some(task),
                    ))
                } else {
                    Ok(DownloadResult::error("无法获取下载任务状态".to_string()))
                }
            }
            Err(e) => Ok(DownloadResult::error(format!("下载失败: {}", e))),
        }
    }

    /// 解压并安装 MariaDB
    pub async fn extract_and_install(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let archive_path = &task.target_path;
        let install_dir = self.get_install_path(version);
        std::fs::create_dir_all(&install_dir)?;

        if task.filename.ends_with(".tar.gz") || task.filename.ends_with(".tgz") {
            let output = create_command("tar")
                .args(&[
                    "-xzf",
                    &archive_path.to_string_lossy(),
                    "-C",
                    &install_dir.to_string_lossy(),
                    "--strip-components=1",
                ])
                .output()?;
            if !output.status.success() {
                return Err(anyhow!(
                    "解压失败: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
        } else if task.filename.ends_with(".zip") {
            let output = create_command("unzip")
                .args(&[
                    "-q",
                    &archive_path.to_string_lossy(),
                    "-d",
                    &install_dir.to_string_lossy(),
                ])
                .output()?;
            if !output.status.success() {
                return Err(anyhow!(
                    "解压失败: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
        }

        // 查找并设置 mysqld 可执行权限
        let mut found_mysqld: Option<PathBuf> = None;
        let candidate = install_dir
            .join("bin")
            .join(if cfg!(target_os = "windows") {
                "mysqld.exe"
            } else {
                "mysqld"
            });
        if candidate.exists() {
            found_mysqld = Some(candidate);
        } else {
            // 深度遍历查找
            for entry in walkdir::WalkDir::new(&install_dir)
                .max_depth(4)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let p = entry.path();
                if p.is_file() {
                    if let Some(name) = p.file_name().and_then(|s| s.to_str()) {
                        if name == "mysqld" || name == "mysqld.exe" {
                            found_mysqld = Some(p.to_path_buf());
                            break;
                        }
                    }
                }
            }
        }

        if let Some(mysqld_path) = found_mysqld {
            let expected_bin = install_dir.join("bin");
            std::fs::create_dir_all(&expected_bin)?;
            let dest = expected_bin.join(mysqld_path.file_name().unwrap());
            if mysqld_path != dest {
                std::fs::rename(&mysqld_path, &dest)?;
            }
            // 设置可执行权限
            #[cfg(not(target_os = "windows"))]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = std::fs::metadata(&dest)?.permissions();
                perms.set_mode(0o755);
                std::fs::set_permissions(&dest, perms)?;
            }
        }

        if archive_path.exists() {
            std::fs::remove_file(archive_path)?;
        }

        Ok(())
    }

    /// 获取 MariaDB 服务运行状态
    pub fn get_service_status(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        let service_data_folder = self.getservice_data_folder(environment_id, version);
        let config_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MARIADB_CONFIG"))
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| service_data_folder.join("my.cnf"));

        // 从配置文件解析端口和绑定地址
        let mut port = "3306".to_string();
        let mut bind_address = "127.0.0.1".to_string();
        if config_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&config_path) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if let Some(val) = trimmed.strip_prefix("port") {
                        let val = val.trim_start_matches(|c: char| c == ' ' || c == '=').trim();
                        if !val.is_empty() {
                            port = val.to_string();
                        }
                    } else if let Some(val) = trimmed.strip_prefix("bind-address") {
                        let val = val.trim_start_matches(|c: char| c == ' ' || c == '=').trim();
                        if !val.is_empty() {
                            bind_address = val.to_string();
                        }
                    }
                }
            }
        }

        let running = if cfg!(target_os = "windows") {
            let output = create_command("tasklist")
                .arg("/FI")
                .arg("IMAGENAME eq mysqld.exe")
                .output();
            match output {
                Ok(o) => String::from_utf8_lossy(&o.stdout).contains("mysqld.exe"),
                Err(_) => false,
            }
        } else {
            // 优先用 lsof 检测端口，与 MongoDB 逻辑保持一致
            let port_arg = format!(":{}", port);
            let output = create_command("lsof")
                .arg("-iTCP")
                .arg(&port_arg)
                .arg("-sTCP:LISTEN")
                .output();
            match output {
                Ok(o) => {
                    let stdout = String::from_utf8_lossy(&o.stdout);
                    if stdout.contains("mysqld") {
                        true
                    } else if !stdout.trim().is_empty() {
                        // 端口被其他进程占用
                        false
                    } else {
                        // lsof 无输出时回退到 pgrep
                        let output = create_command("pgrep").arg("-x").arg("mysqld").output();
                        match output {
                            Ok(o2) => {
                                let stdout2 = String::from_utf8_lossy(&o2.stdout);
                                o2.status.success() && !stdout2.is_empty()
                            }
                            Err(_) => false,
                        }
                    }
                }
                Err(_) => {
                    // lsof 不可用，回退到 pgrep
                    let output = create_command("pgrep").arg("-x").arg("mysqld").output();
                    match output {
                        Ok(o) => {
                            let stdout = String::from_utf8_lossy(&o.stdout);
                            o.status.success() && !stdout.is_empty()
                        }
                        Err(_) => false,
                    }
                }
            }
        };

        let status = if running {
            ServiceStatus::Running
        } else {
            ServiceStatus::Stopped
        };
        let data = serde_json::json!({
            "isRunning": running,
            "status": status,
            "port": port,
            "bindAddress": bind_address,
            "configPath": config_path.to_string_lossy().to_string(),
        });
        Ok(ServiceDataResult {
            success: true,
            message: "获取状态成功".to_string(),
            data: Some(data),
        })
    }

    /// 启动 MariaDB 服务
    pub fn start_service(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        let service_data_folder = self.getservice_data_folder(environment_id, version);
        let mysqld = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mysqld.exe")
        } else {
            install_path.join("bin").join("mysqld")
        };

        if !mysqld.exists() {
            return Ok(ServiceDataResult {
                success: false,
                message: "mysqld 可执行文件不存在".to_string(),
                data: None,
            });
        }

        let config_path = service_data_folder.join("my.cnf");
        if !config_path.exists() {
            return Ok(ServiceDataResult {
                success: false,
                message: "MariaDB 尚未初始化，请先执行初始化操作".to_string(),
                data: None,
            });
        }

        let child_res = if cfg!(target_os = "windows") {
            create_command(&mysqld)
                .arg(format!("--defaults-file={}", config_path.to_string_lossy()))
                .spawn()
        } else if cfg!(target_os = "macos") {
            // macOS: 后台运行，重定向 stdio，防止进程随终端关闭
            create_command(&mysqld)
                .arg(format!("--defaults-file={}", config_path.to_string_lossy()))
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()
        } else {
            // Linux: mysqld 自身支持 daemonize 配置
            create_command(&mysqld)
                .arg(format!("--defaults-file={}", config_path.to_string_lossy()))
                .spawn()
        };

        match child_res {
            Ok(child) => {
                log::info!("MariaDB 进程已启动，PID: {:?}", child.id());
                // 等待服务完成初始化
                std::thread::sleep(Duration::from_millis(500));
                Ok(ServiceDataResult {
                    success: true,
                    message: format!(
                        "MariaDB 启动命令已发送（使用配置文件: {}）",
                        config_path.display()
                    ),
                    data: Some(serde_json::json!({
                        "configPath": config_path.to_string_lossy().to_string(),
                    })),
                })
            }
            Err(e) => Ok(ServiceDataResult {
                success: false,
                message: format!("启动失败: {}", e),
                data: None,
            }),
        }
    }

    pub fn stop_service(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let res = if cfg!(target_os = "windows") {
            create_command("taskkill")
                .args(&["/IM", "mysqld.exe", "/F"])
                .output()
        } else {
            // 使用 -x 精确匹配进程名，避免误杀其他包含 mysqld 的进程
            create_command("pkill").args(&["-x", "mysqld"]).output()
        };

        match res {
            Ok(o) => {
                let exit_code = o.status.code().unwrap_or(-1);
                // exit code 0 = 成功停止，1 = 进程不存在（也算成功）
                if exit_code == 0 || exit_code == 1 {
                    Ok(ServiceDataResult {
                        success: true,
                        message: "停止 MariaDB 成功".to_string(),
                        data: None,
                    })
                } else {
                    Ok(ServiceDataResult {
                        success: false,
                        message: format!("停止失败(exit {}): {}", exit_code, String::from_utf8_lossy(&o.stderr)),
                        data: None,
                    })
                }
            }
            Err(e) => Ok(ServiceDataResult {
                success: false,
                message: format!("停止命令失败: {}", e),
                data: None,
            }),
        }
    }

    pub fn restart_service(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let _ = self.stop_service(environment_id, service_data);
        std::thread::sleep(Duration::from_millis(300));
        self.start_service(environment_id, service_data)
    }

    pub fn get_mariadb_config(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let data = serde_json::to_value(&service_data.metadata).ok();
        Ok(ServiceDataResult {
            success: true,
            message: "获取配置成功".to_string(),
            data,
        })
    }

    pub fn set_mariadb_data_path(
        &self,
        environment_id: &str,
        mut service_data: ServiceData,
        data_path: String,
    ) -> Result<ServiceDataResult> {
        let manager = crate::manager::env_serv_data_manager::EnvServDataManager::global();
        let manager = manager.lock().unwrap();
        match manager.set_metadata(
            environment_id,
            &mut service_data,
            "MARIADB_DATA",
            serde_json::Value::String(data_path.clone()),
        ) {
            Ok(_) => Ok(ServiceDataResult {
                success: true,
                message: "设置数据目录成功".to_string(),
                data: None,
            }),
            Err(e) => Ok(ServiceDataResult {
                success: false,
                message: format!("设置数据目录失败: {}", e),
                data: None,
            }),
        }
    }

    pub fn set_mariadb_log_path(
        &self,
        environment_id: &str,
        mut service_data: ServiceData,
        log_path: String,
    ) -> Result<ServiceDataResult> {
        let manager = crate::manager::env_serv_data_manager::EnvServDataManager::global();
        let manager = manager.lock().unwrap();
        match manager.set_metadata(
            environment_id,
            &mut service_data,
            "MARIADB_LOG",
            serde_json::Value::String(log_path.clone()),
        ) {
            Ok(_) => Ok(ServiceDataResult {
                success: true,
                message: "设置日志目录成功".to_string(),
                data: None,
            }),
            Err(e) => Ok(ServiceDataResult {
                success: false,
                message: format!("设置日志目录失败: {}", e),
                data: None,
            }),
        }
    }

    pub fn set_mariadb_port(
        &self,
        environment_id: &str,
        mut service_data: ServiceData,
        port: u16,
    ) -> Result<ServiceDataResult> {
        let manager = crate::manager::env_serv_data_manager::EnvServDataManager::global();
        let manager = manager.lock().unwrap();
        match manager.set_metadata(
            environment_id,
            &mut service_data,
            "MARIADB_PORT",
            serde_json::Value::Number(serde_json::Number::from(port)),
        ) {
            Ok(_) => Ok(ServiceDataResult {
                success: true,
                message: "设置端口成功".to_string(),
                data: None,
            }),
            Err(e) => Ok(ServiceDataResult {
                success: false,
                message: format!("设置端口失败: {}", e),
                data: None,
            }),
        }
    }

    pub fn cancel_download(&self, version: &str) -> Result<()> {
        let task_id = format!("mariadb-{}", version);
        let download_manager = DownloadManager::global();
        download_manager.cancel_download(&task_id)
    }

    pub fn get_download_progress(&self, version: &str) -> Option<DownloadTask> {
        let task_id = format!("mariadb-{}", version);
        let download_manager = DownloadManager::global();
        download_manager.get_task_status(&task_id)
    }

    /// 获取 MariaDB 服务数据目录
    fn getservice_data_folder(&self, environment_id: &str, version: &str) -> PathBuf {
        let app_config_manager = AppConfigManager::global();
        let app_config_manager = app_config_manager.lock().unwrap();
        let envs_folder = app_config_manager.get_envs_folder();

        PathBuf::from(envs_folder)
            .join(environment_id)
            .join("mariadb")
            .join(version)
    }

    /// 检查 MariaDB 是否已初始化
    pub fn is_initialized(&self, environment_id: &str, service_data: &ServiceData) -> bool {
        let version = &service_data.version;
        let service_data_folder = self.getservice_data_folder(environment_id, version);

        // 检查配置文件和数据目录是否存在
        let config_path = service_data_folder.join("my.cnf");
        let data_dir = service_data_folder.join("data");

        config_path.exists() && data_dir.exists()
    }

    /// 初始化 MariaDB
    pub fn initialize_mariadb(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
        root_password: String,
        port: Option<String>,
        bind_address: Option<String>,
        reset: bool,
    ) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        let service_data_folder = self.getservice_data_folder(environment_id, version);

        // 检查 MariaDB 是否已安装
        let mysql_install_db = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mysql_install_db.exe")
        } else {
            install_path.join("scripts").join("mysql_install_db")
        };

        let mysqld = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mysqld.exe")
        } else {
            install_path.join("bin").join("mysqld")
        };

        if !mysqld.exists() {
            return Ok(ServiceDataResult {
                success: false,
                message: format!("MariaDB {} 未安装，请先下载并安装", version),
                data: None,
            });
        }

        // 如果是重置,先清理现有数据
        if reset && service_data_folder.exists() {
            log::info!("重置模式：清理现有数据...");
            std::fs::read_dir(&service_data_folder)?.for_each(|entry_res| {
                if let Ok(entry) = entry_res {
                    let path = entry.path();
                    // 保留根目录下的 service.json
                    if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
                        if name == "service.json" {
                            return;
                        }
                    }
                    let _ = if path.is_dir() {
                        std::fs::remove_dir_all(&path)
                    } else {
                        std::fs::remove_file(&path)
                    };
                }
            });
        }

        // 检查是否已初始化（非重置模式）
        if !reset && self.is_initialized(environment_id, service_data) {
            return Ok(ServiceDataResult {
                success: false,
                message: "MariaDB 已经初始化，如需重新初始化请使用重置功能".to_string(),
                data: None,
            });
        }

        let port = port.unwrap_or_else(|| "3306".to_string());
        let bind_address = bind_address.unwrap_or_else(|| "127.0.0.1".to_string());

        // 创建目录结构
        log::info!("创建目录结构...");
        std::fs::create_dir_all(&service_data_folder)?;

        let data_dir = service_data_folder.join("data");
        std::fs::create_dir_all(&data_dir)?;

        let log_dir = service_data_folder.join("logs");
        std::fs::create_dir_all(&log_dir)?;

        let tmp_dir = service_data_folder.join("tmp");
        std::fs::create_dir_all(&tmp_dir)?;

        // 创建配置文件
        log::info!("创建配置文件...");
        let config_path = service_data_folder.join("my.cnf");
        self.create_default_config(
            &config_path,
            &data_dir,
            &log_dir,
            &tmp_dir,
            &port,
            &bind_address,
        )?;

        // 初始化数据目录
        log::info!("初始化数据目录...");
        let init_output = if mysql_install_db.exists() {
            // 使用 mysql_install_db（旧版本）
            create_command(&mysql_install_db)
                .arg(format!("--datadir={}", data_dir.display()))
                .arg(format!("--basedir={}", install_path.display()))
                .output()?
        } else {
            // 使用 mysqld --initialize-insecure（新版本）
            create_command(&mysqld)
                .arg("--initialize-insecure")
                .arg(format!("--datadir={}", data_dir.display()))
                .arg(format!("--basedir={}", install_path.display()))
                .output()?
        };

        if !init_output.status.success() {
            let error = String::from_utf8_lossy(&init_output.stderr);
            return Err(anyhow!("初始化数据目录失败: {}", error));
        }

        // 启动临时服务器设置 root 密码
        // 注意：不使用 --skip-grant-tables，因为 MariaDB 10.4+ 该选项会隐式启用
        // --skip-networking，导致 TCP 连接被拒绝；--initialize-insecure 已创建 root@localhost（无密码）
        log::info!("启动临时服务器设置 root 密码...");
        let temp_port = "3307";
        let temp_socket = tmp_dir.join("mysql_init.sock");
        let mut mysqld_process = create_command(&mysqld)
            .arg(format!("--defaults-file={}", config_path.display()))
            .arg(format!("--port={}", temp_port))
            .arg(format!("--socket={}", temp_socket.display()))
            .spawn()?;

        // 等待服务器启动
        std::thread::sleep(Duration::from_secs(3));

        // 设置 root 密码
        let mysql_client = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mysql.exe")
        } else {
            install_path.join("bin").join("mysql")
        };

        // 使用 SET PASSWORD 兼容所有 MariaDB 版本，并切换认证方式为 mysql_native_password
        // 连接时不传密码（--initialize-insecure 后 root 无密码）
        let set_password_cmd = format!(
            "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('{}'); FLUSH PRIVILEGES;",
            root_password
        );

        // Unix 下优先走 socket，Windows 下走 TCP
        let password_output = if cfg!(target_os = "windows") {
            create_command(&mysql_client)
                .arg(format!("--port={}", temp_port))
                .arg("--host=127.0.0.1")
                .arg("-u").arg("root")
                .arg("--password=")
                .arg("-e")
                .arg(&set_password_cmd)
                .output()
        } else {
            create_command(&mysql_client)
                .arg(format!("--socket={}", temp_socket.display()))
                .arg("-u").arg("root")
                .arg("--password=")
                .arg("-e")
                .arg(&set_password_cmd)
                .output()
        };

        // 等待密码设置完成并写入磁盘
        log::info!("等待密码数据写入磁盘 (2秒)...");
        std::thread::sleep(Duration::from_secs(2));

        // 停止临时服务器
        let _ = mysqld_process.kill();
        let _ = mysqld_process.wait();

        // 检查密码设置是否成功
        match password_output {
            Ok(output) if output.status.success() => {
                log::info!("root 密码设置成功");
            }
            Ok(output) => {
                let error = String::from_utf8_lossy(&output.stderr);
                log::warn!("设置 root 密码可能失败: {}", error);
            }
            Err(e) => {
                log::warn!("执行密码设置命令失败: {}", e);
            }
        }

        log::info!("MariaDB 初始化完成！");

        Ok(ServiceDataResult {
            success: true,
            message: "MariaDB 初始化成功".to_string(),
            data: Some(serde_json::json!({
                "configPath": config_path.to_string_lossy().to_string(),
                "dataPath": data_dir.to_string_lossy().to_string(),
                "logPath": log_dir.to_string_lossy().to_string(),
                "rootPassword": root_password,
                "port": port,
                "bindAddress": bind_address,
            })),
        })
    }

    /// 创建默认配置文件
    fn create_default_config(
        &self,
        config_path: &PathBuf,
        data_dir: &PathBuf,
        log_dir: &PathBuf,
        tmp_dir: &PathBuf,
        port: &str,
        bind_address: &str,
    ) -> Result<()> {
        let log_file = log_dir.join("mariadb.log");
        let error_log_file = log_dir.join("error.log");
        let slow_query_log_file = log_dir.join("slow-query.log");
        let socket_file = tmp_dir.join("mysql.sock");
        let pid_file = tmp_dir.join("mysql.pid");

        let config_content = format!(
            r#"[client]
port = {}
socket = {}

[mysqld]
port = {}
bind-address = {}
datadir = {}
socket = {}
pid-file = {}
log-error = {}
general_log_file = {}
slow_query_log_file = {}

# 字符集设置
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# InnoDB 设置
default-storage-engine = InnoDB
innodb_buffer_pool_size = 256M
innodb_log_file_size = 64M
innodb_flush_log_at_trx_commit = 1
innodb_file_per_table = 1

# 连接设置
max_connections = 200
max_connect_errors = 100

# 查询缓存
query_cache_size = 0
query_cache_type = 0

# 日志设置
general_log = 0
slow_query_log = 0
long_query_time = 2

[mysql]
default-character-set = utf8mb4
"#,
            port,
            socket_file.display(),
            port,
            bind_address,
            data_dir.display(),
            socket_file.display(),
            pid_file.display(),
            error_log_file.display(),
            log_file.display(),
            slow_query_log_file.display()
        );

        std::fs::write(config_path, config_content)?;
        Ok(())
    }

    /// 列出所有数据库
    pub fn list_databases(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        // 从 metadata 中获取 root 密码和端口
        let root_password = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MARIADB_ROOT_PASSWORD"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到 root 密码"))?;

        let port = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MARIADB_PORT"))
            .and_then(|v| v.as_str())
            .unwrap_or("3306");

        // 获取 mysql 客户端路径
        let install_path = self.get_install_path(&service_data.version);
        let mysql_client = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mysql.exe")
        } else {
            install_path.join("bin").join("mysql")
        };

        if !mysql_client.exists() {
            return Err(anyhow!("mysql 客户端未安装"));
        }

        // 执行 SQL 查询列出数据库
        let output = create_command(&mysql_client)
            .arg(format!("--port={}", port))
            .arg("--host=127.0.0.1")
            .arg(format!("--password={}", root_password))
            .arg("-e")
            .arg("SHOW DATABASES")
            .arg("--batch")
            .arg("--skip-column-names")
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("列出数据库失败: {}", error));
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        let databases: Vec<String> = output_str
            .lines()
            .filter(|line| !line.is_empty())
            .map(|line| line.to_string())
            .collect();

        Ok(ServiceDataResult {
            success: true,
            message: "获取数据库列表成功".to_string(),
            data: Some(serde_json::json!({ "databases": databases })),
        })
    }

    /// 创建数据库
    pub fn create_database(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        database_name: String,
    ) -> Result<ServiceDataResult> {
        log::info!("创建 MariaDB 数据库: {}", database_name);

        // 验证数据库名称
        if database_name.is_empty() {
            return Err(anyhow!("数据库名称不能为空"));
        }

        // 从 metadata 中获取 root 密码和端口
        let root_password = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MARIADB_ROOT_PASSWORD"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到 root 密码"))?;

        let port = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MARIADB_PORT"))
            .and_then(|v| v.as_str())
            .unwrap_or("3306");

        // 获取 mysql 客户端路径
        let install_path = self.get_install_path(&service_data.version);
        let mysql_client = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mysql.exe")
        } else {
            install_path.join("bin").join("mysql")
        };

        if !mysql_client.exists() {
            return Err(anyhow!("mysql 客户端未安装"));
        }

        // 执行 SQL 创建数据库
        let create_cmd = format!("CREATE DATABASE IF NOT EXISTS `{}`", database_name);

        let output = create_command(&mysql_client)
            .arg(format!("--port={}", port))
            .arg("--host=127.0.0.1")
            .arg(format!("--password={}", root_password))
            .arg("-e")
            .arg(&create_cmd)
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("创建数据库失败: {}", error));
        }

        Ok(ServiceDataResult {
            success: true,
            message: format!("数据库 '{}' 创建成功", database_name),
            data: Some(serde_json::json!({ "database": database_name })),
        })
    }

    /// 列出指定数据库的所有表
    pub fn list_tables(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        database_name: String,
    ) -> Result<ServiceDataResult> {
        log::info!("列出 MariaDB 数据库 '{}' 的表", database_name);

        // 从 metadata 中获取 root 密码和端口
        let root_password = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MARIADB_ROOT_PASSWORD"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到 root 密码"))?;

        let port = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MARIADB_PORT"))
            .and_then(|v| v.as_str())
            .unwrap_or("3306");

        // 获取 mysql 客户端路径
        let install_path = self.get_install_path(&service_data.version);
        let mysql_client = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mysql.exe")
        } else {
            install_path.join("bin").join("mysql")
        };

        if !mysql_client.exists() {
            return Err(anyhow!("mysql 客户端未安装"));
        }

        // 执行 SQL 查询列出表
        let output = create_command(&mysql_client)
            .arg(format!("--port={}", port))
            .arg("--host=127.0.0.1")
            .arg(format!("--password={}", root_password))
            .arg(&database_name)
            .arg("-e")
            .arg("SHOW TABLES")
            .arg("--batch")
            .arg("--skip-column-names")
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("列出表失败: {}", error));
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        let tables: Vec<String> = output_str
            .lines()
            .filter(|line| !line.is_empty())
            .map(|line| line.to_string())
            .collect();

        Ok(ServiceDataResult {
            success: true,
            message: format!("获取数据库 '{}' 的表列表成功", database_name),
            data: Some(serde_json::json!({ "tables": tables })),
        })
    }

    /// 打开 MariaDB 客户端
    pub fn open_client(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        log::info!("打开 MariaDB 客户端");

        // 从 metadata 中获取连接信息
        let root_password = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MARIADB_ROOT_PASSWORD"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let port = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MARIADB_PORT"))
            .and_then(|v| v.as_str())
            .unwrap_or("3306");

        // 构建连接字符串
        let connection_string = if root_password.is_empty() {
            format!("mysql://root@127.0.0.1:{}", port)
        } else {
            format!("mysql://root:{}@127.0.0.1:{}", root_password, port)
        };

        Ok(ServiceDataResult {
            success: true,
            message: "获取连接字符串成功".to_string(),
            data: Some(serde_json::json!({ "connectionString": connection_string })),
        })
    }
}
