use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::env_serv_data_manager::{EnvServDataManager, ServiceDataResult};
use crate::manager::services::{DownloadManager, DownloadResult, DownloadTask};
use crate::types::{ServiceData, ServiceStatus};
use crate::utils::create_command;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisVersion {
    pub version: String,
    pub date: String,
}

static GLOBAL_REDIS_SERVICE: OnceLock<Arc<RedisService>> = OnceLock::new();

pub struct RedisService {}

impl RedisService {
    pub fn global() -> Arc<RedisService> {
        GLOBAL_REDIS_SERVICE
            .get_or_init(|| Arc::new(RedisService::new()))
            .clone()
    }

    fn new() -> Self {
        Self {}
    }

    pub fn get_available_versions(&self) -> Vec<RedisVersion> {
        vec![
            RedisVersion {
                version: "8.6.2".to_string(),
                date: "2026-03-01".to_string(),
            },
            RedisVersion {
                version: "7.4.8".to_string(),
                date: "2026-02-12".to_string(),
            },
            RedisVersion {
                version: "6.2.20".to_string(),
                date: "2025-12-20".to_string(),
            },
        ]
    }

    pub fn is_installed(&self, version: &str) -> bool {
        let bin = self.get_server_bin_path(version);
        bin.exists()
    }

    fn get_install_path(&self, version: &str) -> PathBuf {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        };
        services_folder.join("redis").join(version)
    }

    fn get_service_data_folder(&self, environment_id: &str, version: &str) -> PathBuf {
        let app_config_manager = AppConfigManager::global();
        let app_config_manager = app_config_manager.lock().unwrap();
        let envs_folder = app_config_manager.get_envs_folder();

        PathBuf::from(envs_folder)
            .join(environment_id)
            .join("redis")
            .join(version)
    }

    fn get_server_bin_path(&self, version: &str) -> PathBuf {
        let install_path = self.get_install_path(version);
        if cfg!(target_os = "windows") {
            install_path.join("bin").join("redis-server.exe")
        } else {
            install_path.join("bin").join("redis-server")
        }
    }

    fn get_cli_bin_path(&self, version: &str) -> PathBuf {
        let install_path = self.get_install_path(version);
        if cfg!(target_os = "windows") {
            install_path.join("bin").join("redis-cli.exe")
        } else {
            install_path.join("bin").join("redis-cli")
        }
    }

    fn map_platform_arch(&self) -> Result<(&'static str, &'static str, &'static str)> {
        let os = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        match os {
            "macos" => {
                let arch_str = if arch == "aarch64" { "arm64" } else { "x86_64" };
                Ok(("macos", arch_str, "tar.gz"))
            }
            "linux" => {
                let arch_str = if arch == "aarch64" { "arm64" } else { "x86_64" };
                Ok(("linux", arch_str, "tar.gz"))
            }
            "windows" => Ok(("windows", "x86_64", "zip")),
            _ => Err(anyhow!("不支持的操作系统: {}", os)),
        }
    }

    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        let (os, arch, ext) = self.map_platform_arch()?;
        let filename = format!("redis-{}-{}-{}.{}", version, os, arch, ext);
        let url = format!(
            "https://github.com/xopenbeta/redis-archive/releases/latest/download/{}",
            filename
        );

        Ok((vec![url], filename))
    }

    pub async fn download_and_install(&self, version: &str) -> Result<DownloadResult> {
        if self.is_installed(version) {
            return Ok(DownloadResult::success(
                format!("Redis {} 已经安装", version),
                None,
            ));
        }

        let (urls, filename) = self.build_download_info(version)?;
        let install_path = self.get_install_path(version);
        let task_id = format!("redis-{}", version);
        let download_manager = DownloadManager::global();

        let version_for_callback = version.to_string();
        let success_callback = Arc::new(move |task: &DownloadTask| {
            let task_for_spawn = task.clone();
            let version_for_spawn = version_for_callback.clone();
            let service_for_spawn = RedisService::global();

            tokio::spawn(async move {
                let download_manager = DownloadManager::global();
                if let Err(e) = download_manager.update_task_status(
                    &task_for_spawn.id,
                    crate::manager::services::DownloadStatus::Installing,
                    None,
                ) {
                    log::error!("更新任务状态失败: {}", e);
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
                    }
                }
            });
        });

        match download_manager
            .start_download(
                task_id.clone(),
                urls,
                install_path,
                filename,
                true,
                Some(success_callback),
            )
            .await
        {
            Ok(_) => {
                if let Some(task) = download_manager.get_task_status(&task_id) {
                    Ok(DownloadResult::success(
                        format!("Redis {} 下载完成", version),
                        Some(task),
                    ))
                } else {
                    Ok(DownloadResult::error("无法获取下载任务状态".to_string()))
                }
            }
            Err(e) => Ok(DownloadResult::error(format!("下载失败: {}", e))),
        }
    }

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
        } else {
            return Err(anyhow!("不支持的压缩格式: {}", task.filename));
        }

        self.normalize_binary_layout(&install_dir)?;

        if archive_path.exists() {
            std::fs::remove_file(archive_path)?;
        }

        Ok(())
    }

    fn normalize_binary_layout(&self, install_dir: &Path) -> Result<()> {
        let bin_dir = install_dir.join("bin");
        std::fs::create_dir_all(&bin_dir)?;

        let server_name = if cfg!(target_os = "windows") {
            "redis-server.exe"
        } else {
            "redis-server"
        };
        let cli_name = if cfg!(target_os = "windows") {
            "redis-cli.exe"
        } else {
            "redis-cli"
        };

        self.move_binary_if_found(install_dir, &bin_dir, server_name)?;
        self.move_binary_if_found(install_dir, &bin_dir, cli_name)?;

        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;

            let server = bin_dir.join(server_name);
            if server.exists() {
                let mut perms = std::fs::metadata(&server)?.permissions();
                perms.set_mode(0o755);
                std::fs::set_permissions(&server, perms)?;
            }

            let cli = bin_dir.join(cli_name);
            if cli.exists() {
                let mut perms = std::fs::metadata(&cli)?.permissions();
                perms.set_mode(0o755);
                std::fs::set_permissions(&cli, perms)?;
            }
        }

        let server_path = bin_dir.join(server_name);
        if !server_path.exists() {
            return Err(anyhow!("未找到 redis-server 可执行文件"));
        }

        Ok(())
    }

    fn move_binary_if_found(&self, search_root: &Path, bin_dir: &Path, name: &str) -> Result<()> {
        let direct = bin_dir.join(name);
        if direct.exists() {
            return Ok(());
        }

        for entry in walkdir::WalkDir::new(search_root)
            .max_depth(5)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_file()
                && path
                    .file_name()
                    .and_then(|v| v.to_str())
                    .map(|n| n == name)
                    .unwrap_or(false)
            {
                if path == direct {
                    return Ok(());
                }
                std::fs::copy(path, &direct)?;
                return Ok(());
            }
        }

        Ok(())
    }

    pub fn cancel_download(&self, version: &str) -> Result<()> {
        let task_id = format!("redis-{}", version);
        DownloadManager::global().cancel_download(&task_id)
    }

    pub fn get_download_progress(&self, version: &str) -> Option<DownloadTask> {
        let task_id = format!("redis-{}", version);
        DownloadManager::global().get_task_status(&task_id)
    }

    pub fn get_service_status(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let config = self.get_runtime_config(environment_id, service_data)?;
        let running = self.is_running_on_port(config.port);

        Ok(ServiceDataResult {
            success: true,
            message: "获取 Redis 状态成功".to_string(),
            data: Some(serde_json::json!({
                "isRunning": running,
                "status": if running { ServiceStatus::Running } else { ServiceStatus::Stopped },
                "port": config.port,
                "bindIp": config.bind_ip,
                "configPath": config.config_path,
                "dataPath": config.data_path,
                "logPath": config.log_path,
            })),
        })
    }

    pub fn start_service(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        let server_bin = self.get_server_bin_path(version);

        if !server_bin.exists() {
            return Ok(ServiceDataResult {
                success: false,
                message: "redis-server 可执行文件不存在".to_string(),
                data: None,
            });
        }

        let config = self.get_runtime_config(environment_id, service_data)?;
        if !Path::new(&config.config_path).exists() {
            return Ok(ServiceDataResult {
                success: false,
                message: "Redis 尚未初始化，请先执行初始化操作".to_string(),
                data: None,
            });
        }

        if self.is_running_on_port(config.port) {
            return Ok(ServiceDataResult {
                success: true,
                message: "Redis 已在运行".to_string(),
                data: Some(serde_json::json!({
                    "port": config.port,
                    "alreadyRunning": true
                })),
            });
        }

        let child_res = create_command(&server_bin)
            .arg(&config.config_path)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();

        match child_res {
            Ok(child) => {
                log::info!("Redis 进程已启动，PID: {:?}", child.id());
                std::thread::sleep(Duration::from_millis(500));
                Ok(ServiceDataResult {
                    success: true,
                    message: "Redis 启动成功".to_string(),
                    data: Some(serde_json::json!({
                        "port": config.port,
                        "configPath": config.config_path,
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
        let version = &service_data.version;
        let cli_bin = self.get_cli_bin_path(version);
        let config = self.get_runtime_config(environment_id, service_data)?;

        if cli_bin.exists() {
            let mut shutdown_cmd = create_command(&cli_bin);
            shutdown_cmd.arg("-p").arg(config.port.to_string());
            if !config.password.is_empty() {
                shutdown_cmd.arg("-a").arg(config.password.clone());
            }
            shutdown_cmd.arg("shutdown").arg("nosave");

            if let Ok(output) = shutdown_cmd.output() {
                if output.status.success() {
                    return Ok(ServiceDataResult {
                        success: true,
                        message: "Redis 已停止".to_string(),
                        data: None,
                    });
                }
            }
        }

        let kill_res = if cfg!(target_os = "windows") {
            create_command("taskkill")
                .args(["/IM", "redis-server.exe", "/F"])
                .output()
        } else {
            create_command("pkill").args(["-x", "redis-server"]).output()
        };

        match kill_res {
            Ok(o) => {
                let exit_code = o.status.code().unwrap_or(-1);
                if exit_code == 0 || exit_code == 1 {
                    Ok(ServiceDataResult {
                        success: true,
                        message: "Redis 已停止".to_string(),
                        data: None,
                    })
                } else {
                    Ok(ServiceDataResult {
                        success: false,
                        message: format!(
                            "停止失败(exit {}): {}",
                            exit_code,
                            String::from_utf8_lossy(&o.stderr)
                        ),
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

    pub fn get_redis_config(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let config = self.get_runtime_config(environment_id, service_data)?;
        let content = std::fs::read_to_string(&config.config_path).unwrap_or_default();

        Ok(ServiceDataResult {
            success: true,
            message: "获取 Redis 配置成功".to_string(),
            data: Some(serde_json::json!({
                "configPath": config.config_path,
                "dataPath": config.data_path,
                "logPath": config.log_path,
                "port": config.port,
                "bindIp": config.bind_ip,
                "password": config.password,
                "content": content,
                "isRunning": self.is_running_on_port(config.port),
            })),
        })
    }

    pub fn is_initialized(&self, environment_id: &str, service_data: &ServiceData) -> bool {
        let version = &service_data.version;
        let service_data_folder = self.get_service_data_folder(environment_id, version);
        service_data_folder.join("redis.conf").exists() && service_data_folder.join("data").exists()
    }

    pub fn initialize_redis(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
        password: Option<String>,
        port: Option<String>,
        bind_ip: Option<String>,
        reset: bool,
    ) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        let server_bin = self.get_server_bin_path(version);

        if !install_path.exists() || !server_bin.exists() {
            return Ok(ServiceDataResult {
                success: false,
                message: format!("Redis {} 未安装，请先下载安装", version),
                data: None,
            });
        }

        let service_data_folder = self.get_service_data_folder(environment_id, version);

        if reset && service_data_folder.exists() {
            std::fs::read_dir(&service_data_folder)?.for_each(|entry_res| {
                if let Ok(entry) = entry_res {
                    let path = entry.path();
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

        if !reset && self.is_initialized(environment_id, service_data) {
            return Ok(ServiceDataResult {
                success: false,
                message: "Redis 已初始化，如需重新初始化请使用重置功能".to_string(),
                data: None,
            });
        }

        let port = port
            .unwrap_or_else(|| "6379".to_string())
            .parse::<u16>()
            .map_err(|_| anyhow!("端口格式错误"))?;
        let bind_ip = bind_ip.unwrap_or_else(|| "127.0.0.1".to_string());
        let password = password.unwrap_or_default();

        std::fs::create_dir_all(&service_data_folder)?;
        let data_dir = service_data_folder.join("data");
        let log_dir = service_data_folder.join("logs");
        std::fs::create_dir_all(&data_dir)?;
        std::fs::create_dir_all(&log_dir)?;

        let config_path = service_data_folder.join("redis.conf");
        let log_path = log_dir.join("redis.log");

        self.create_default_config(&config_path, &data_dir, &log_path, port, &bind_ip, &password)?;

        let manager = EnvServDataManager::global();
        let manager = manager.lock().unwrap();
        let mut service_data_copy = service_data.clone();

        let _ = manager.set_metadata(
            environment_id,
            &mut service_data_copy,
            "REDIS_CONFIG",
            serde_json::Value::String(config_path.to_string_lossy().to_string()),
        );
        let _ = manager.set_metadata(
            environment_id,
            &mut service_data_copy,
            "REDIS_DATA",
            serde_json::Value::String(data_dir.to_string_lossy().to_string()),
        );
        let _ = manager.set_metadata(
            environment_id,
            &mut service_data_copy,
            "REDIS_LOG",
            serde_json::Value::String(log_path.to_string_lossy().to_string()),
        );
        let _ = manager.set_metadata(
            environment_id,
            &mut service_data_copy,
            "REDIS_PORT",
            serde_json::Value::Number(serde_json::Number::from(port)),
        );
        let _ = manager.set_metadata(
            environment_id,
            &mut service_data_copy,
            "REDIS_BIND_IP",
            serde_json::Value::String(bind_ip.clone()),
        );
        let _ = manager.set_metadata(
            environment_id,
            &mut service_data_copy,
            "REDIS_PASSWORD",
            serde_json::Value::String(password.clone()),
        );

        Ok(ServiceDataResult {
            success: true,
            message: if reset {
                "Redis 重置并初始化成功".to_string()
            } else {
                "Redis 初始化成功".to_string()
            },
            data: Some(serde_json::json!({
                "configPath": config_path.to_string_lossy().to_string(),
                "dataPath": data_dir.to_string_lossy().to_string(),
                "logPath": log_path.to_string_lossy().to_string(),
                "port": port.to_string(),
                "bindIp": bind_ip,
                "password": password,
            })),
        })
    }

    fn create_default_config(
        &self,
        config_path: &Path,
        data_dir: &Path,
        log_path: &Path,
        port: u16,
        bind_ip: &str,
        password: &str,
    ) -> Result<()> {
        let mut lines = vec![
            "protected-mode yes".to_string(),
            format!("bind {}", bind_ip),
            format!("port {}", port),
            format!("dir {}", data_dir.to_string_lossy()),
            format!("logfile {}", log_path.to_string_lossy()),
            "appendonly yes".to_string(),
            "save 900 1".to_string(),
            "save 300 10".to_string(),
            "save 60 10000".to_string(),
        ];

        if !password.is_empty() {
            lines.push(format!("requirepass {}", password));
        }

        std::fs::write(config_path, lines.join("\n") + "\n")?;
        Ok(())
    }

    fn is_running_on_port(&self, port: u16) -> bool {
        if cfg!(target_os = "windows") {
            let output = create_command("tasklist")
                .arg("/FI")
                .arg("IMAGENAME eq redis-server.exe")
                .output();
            return output
                .map(|o| String::from_utf8_lossy(&o.stdout).contains("redis-server.exe"))
                .unwrap_or(false);
        }

        let port_arg = format!(":{}", port);
        let output = create_command("lsof")
            .arg("-iTCP")
            .arg(&port_arg)
            .arg("-sTCP:LISTEN")
            .output();

        match output {
            Ok(o) => {
                let stdout = String::from_utf8_lossy(&o.stdout);
                if stdout.contains("redis-server") {
                    true
                } else if !stdout.trim().is_empty() {
                    false
                } else {
                    create_command("pgrep")
                        .arg("-x")
                        .arg("redis-server")
                        .output()
                        .map(|po| po.status.success() && !po.stdout.is_empty())
                        .unwrap_or(false)
                }
            }
            Err(_) => create_command("pgrep")
                .arg("-x")
                .arg("redis-server")
                .output()
                .map(|po| po.status.success() && !po.stdout.is_empty())
                .unwrap_or(false),
        }
    }

    fn get_runtime_config(&self, environment_id: &str, service_data: &ServiceData) -> Result<RedisRuntimeConfig> {
        let version = &service_data.version;
        let service_data_folder = self.get_service_data_folder(environment_id, version);
        let metadata = service_data.metadata.as_ref();

        let config_path = metadata
            .and_then(|m| m.get("REDIS_CONFIG"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| service_data_folder.join("redis.conf").to_string_lossy().to_string());

        let data_path = metadata
            .and_then(|m| m.get("REDIS_DATA"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| service_data_folder.join("data").to_string_lossy().to_string());

        let log_path = metadata
            .and_then(|m| m.get("REDIS_LOG"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                service_data_folder
                    .join("logs")
                    .join("redis.log")
                    .to_string_lossy()
                    .to_string()
            });

        let port = metadata
            .and_then(|m| m.get("REDIS_PORT"))
            .and_then(|v| {
                if let Some(s) = v.as_str() {
                    s.parse::<u16>().ok()
                } else {
                    v.as_u64().and_then(|n| u16::try_from(n).ok())
                }
            })
            .unwrap_or_else(|| self.read_port_from_config(Path::new(&config_path)).unwrap_or(6379));

        let bind_ip = metadata
            .and_then(|m| m.get("REDIS_BIND_IP"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| self.read_bind_from_config(Path::new(&config_path)).unwrap_or_else(|| "127.0.0.1".to_string()));

        let password = metadata
            .and_then(|m| m.get("REDIS_PASSWORD"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| self.read_password_from_config(Path::new(&config_path)).unwrap_or_default());

        Ok(RedisRuntimeConfig {
            config_path,
            data_path,
            log_path,
            port,
            bind_ip,
            password,
        })
    }

    fn read_port_from_config(&self, path: &Path) -> Option<u16> {
        let content = std::fs::read_to_string(path).ok()?;
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("port ") {
                let v = trimmed.trim_start_matches("port ").trim();
                if let Ok(port) = v.parse::<u16>() {
                    return Some(port);
                }
            }
        }
        None
    }

    fn read_bind_from_config(&self, path: &Path) -> Option<String> {
        let content = std::fs::read_to_string(path).ok()?;
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("bind ") {
                let v = trimmed.trim_start_matches("bind ").trim();
                if !v.is_empty() {
                    return Some(v.to_string());
                }
            }
        }
        None
    }

    fn read_password_from_config(&self, path: &Path) -> Option<String> {
        let content = std::fs::read_to_string(path).ok()?;
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("requirepass ") {
                let v = trimmed.trim_start_matches("requirepass ").trim();
                return Some(v.to_string());
            }
        }
        None
    }
}

struct RedisRuntimeConfig {
    config_path: String,
    data_path: String,
    log_path: String,
    port: u16,
    bind_ip: String,
    password: String,
}
