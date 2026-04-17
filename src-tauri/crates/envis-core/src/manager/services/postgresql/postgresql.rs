use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::env_serv_data_manager::ServiceDataResult;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadTask};
use crate::types::ServiceData;
use crate::utils::create_command;
use anyhow::{anyhow, Result};
use serde_json::Value;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::process::Command;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};

/// PostgreSQL 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostgresqlVersion {
    pub version: String,
    pub date: String,
}

/// 全局 PostgreSQL 服务管理器单例
static GLOBAL_POSTGRESQL_SERVICE: OnceLock<Arc<PostgresqlService>> = OnceLock::new();

/// PostgreSQL 服务管理器
pub struct PostgresqlService {}

impl PostgresqlService {
    /// 获取全局 PostgreSQL 服务管理器单例
    pub fn global() -> Arc<PostgresqlService> {
        GLOBAL_POSTGRESQL_SERVICE
            .get_or_init(|| Arc::new(PostgresqlService::new()))
            .clone()
    }

    fn new() -> Self {
        Self {}
    }

    /// 获取可用的 PostgreSQL 版本列表
    pub fn get_available_versions(&self) -> Vec<PostgresqlVersion> {
        vec![
            PostgresqlVersion {
                version: "17.4".to_string(),
                date: "2026-04-17".to_string(),
            },
            PostgresqlVersion {
                version: "16.8".to_string(),
                date: "2026-04-17".to_string(),
            },
            PostgresqlVersion {
                version: "15.12".to_string(),
                date: "2026-04-17".to_string(),
            },
        ]
    }

    /// 检查 PostgreSQL 是否已安装（判断 bin/postgres 是否存在）
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        let bin_dir = install_path.join("bin");
        [
            Self::platform_binary_name("postgres"),
            Self::platform_binary_name("initdb"),
            Self::platform_binary_name("pg_ctl"),
            Self::platform_binary_name("psql"),
        ]
        .iter()
        .all(|name| bin_dir.join(name).exists())
    }

    fn get_install_path(&self, version: &str) -> PathBuf {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        };
        services_folder.join("postgresql").join(version)
    }

    fn major_version(version: &str) -> &str {
        version.split('.').next().unwrap_or(version)
    }

    fn apply_runtime_lib_env(cmd: &mut Command, install_path: &Path) {
        let lib_dir = install_path.join("lib");
        if !lib_dir.exists() {
            return;
        }

        #[cfg(target_os = "macos")]
        {
            let key = "DYLD_LIBRARY_PATH";
            let mut value = lib_dir.to_string_lossy().to_string();
            if let Ok(existing) = std::env::var(key) {
                if !existing.is_empty() {
                    value.push(':');
                    value.push_str(&existing);
                }
            }
            cmd.env(key, value);
        }

        #[cfg(target_os = "linux")]
        {
            let key = "LD_LIBRARY_PATH";
            let mut value = lib_dir.to_string_lossy().to_string();
            if let Ok(existing) = std::env::var(key) {
                if !existing.is_empty() {
                    value.push(':');
                    value.push_str(&existing);
                }
            }
            cmd.env(key, value);
        }
    }

    /// 构建下载 URL 和文件名
    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        let platform_str = match platform {
            "macos" => "macos",
            "linux" => "linux",
            "windows" => "windows",
            _ => return Err(anyhow!("不支持的操作系统: {}", platform)),
        };

        let arch_str = if arch == "aarch64" { "arm64" } else { "x86_64" };
        let ext = if platform == "windows" { "zip" } else { "tar.gz" };
        let filename = format!("postgresql-{}-{}-{}.{}", version, platform_str, arch_str, ext);
        // 该仓库 release tag 可能不是语义版本号（例如时间戳），
        // 优先使用 latest/download，避免因 tag 命名变化导致 404。
        let urls = vec![
            format!(
                "https://github.com/xopenbeta/postgre-archive/releases/latest/download/{}",
                filename
            ),
            format!(
                "https://github.com/xopenbeta/postgre-archive/releases/download/{}/{}",
                version, filename
            ),
            format!(
                "https://github.com/xopenbeta/postgre-archive/releases/download/v{}/{}",
                version, filename
            ),
        ];

        Ok((urls, filename))
    }

    /// 下载并安装 PostgreSQL
    pub async fn download_and_install(&self, version: &str) -> Result<DownloadResult> {
        if self.is_installed(version) {
            return Ok(DownloadResult::success(
                format!("PostgreSQL {} 已经安装", version),
                None,
            ));
        }

        let (urls, filename) = self.build_download_info(version)?;
        let install_path = self.get_install_path(version);
        let task_id = format!("postgresql-{}", version);
        let download_manager = DownloadManager::global();

        let version_for_callback = version.to_string();
        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!(
                "PostgreSQL {} 下载完成: {} - {}",
                version_for_callback,
                task.id,
                task.filename
            );
            let task_for_spawn = task.clone();
            let version_for_spawn = version_for_callback.clone();
            let service_for_spawn = PostgresqlService::global();

            tokio::spawn(async move {
                let download_manager = DownloadManager::global();
                if let Err(e) = download_manager.update_task_status(
                    &task_for_spawn.id,
                    crate::manager::services::DownloadStatus::Installing,
                    None,
                ) {
                    log::error!("更新任务状态失败: {}", e);
                } else {
                    log::info!("PostgreSQL {} 开始安装", version_for_spawn);
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
                            log::info!("PostgreSQL {} 安装成功", version_for_spawn);
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
                        log::error!("PostgreSQL {} 安装失败: {}", version_for_spawn, e);
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
                        format!("PostgreSQL {} 下载完成", version),
                        Some(task),
                    ))
                } else {
                    Ok(DownloadResult::error("无法获取下载任务状态".to_string()))
                }
            }
            Err(e) => Ok(DownloadResult::error(format!("下载失败: {}", e))),
        }
    }

    /// 解压并安装 PostgreSQL
    pub async fn extract_and_install(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let mut archive_path = task.target_path.clone();
        let install_dir = self.get_install_path(version);

        if !archive_path.exists() {
            return Err(anyhow!("安装包不存在: {}", archive_path.to_string_lossy()));
        }

        // 下载文件与安装目录同级时，先转移安装包，避免清理安装目录时误删安装包。
        if archive_path.starts_with(&install_dir) {
            let temp_archive_path = std::env::temp_dir().join(format!(
                "envis-postgresql-{}-{}-{}",
                version,
                std::process::id(),
                task.filename
            ));

            if temp_archive_path.exists() {
                let _ = std::fs::remove_file(&temp_archive_path);
            }

            match std::fs::rename(&archive_path, &temp_archive_path) {
                Ok(_) => {}
                Err(_) => {
                    std::fs::copy(&archive_path, &temp_archive_path)?;
                    std::fs::remove_file(&archive_path)?;
                }
            }

            archive_path = temp_archive_path;
        }

        if install_dir.exists() {
            std::fs::remove_dir_all(&install_dir)?;
        }
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
        } else if task.filename.ends_with(".dmg") {
            #[cfg(target_os = "macos")]
            {
                let mount_dir = std::env::temp_dir().join(format!(
                    "envis-postgresql-{}-mount-{}",
                    version,
                    std::process::id()
                ));
                if mount_dir.exists() {
                    std::fs::remove_dir_all(&mount_dir)?;
                }
                std::fs::create_dir_all(&mount_dir)?;

                let attach_output = create_command("hdiutil")
                    .args(&[
                        "attach",
                        "-nobrowse",
                        "-readonly",
                        "-mountpoint",
                        &mount_dir.to_string_lossy(),
                        &archive_path.to_string_lossy(),
                    ])
                    .output()?;

                if !attach_output.status.success() {
                    let _ = std::fs::remove_dir_all(&mount_dir);
                    return Err(anyhow!(
                        "挂载 dmg 失败: {}",
                        String::from_utf8_lossy(&attach_output.stderr)
                    ));
                }

                let copy_result = (|| -> Result<()> {
                    let app_path = walkdir::WalkDir::new(&mount_dir)
                        .max_depth(2)
                        .into_iter()
                        .filter_map(|entry| entry.ok())
                        .find_map(|entry| {
                            let path = entry.path();
                            (path.is_dir()
                                && path.file_name().and_then(|name| name.to_str()) == Some("Postgres.app"))
                                .then(|| path.to_path_buf())
                        })
                        .ok_or_else(|| anyhow!("dmg 中未找到 Postgres.app"))?;

                    let version_dir = app_path
                        .join("Contents")
                        .join("Versions")
                        .join(Self::major_version(version));

                    if !version_dir.exists() {
                        return Err(anyhow!(
                            "Postgres.app 中未找到 PostgreSQL {} 二进制目录",
                            Self::major_version(version)
                        ));
                    }

                    let copy_output = create_command("ditto")
                        .arg(&version_dir)
                        .arg(&install_dir)
                        .output()?;

                    if !copy_output.status.success() {
                        return Err(anyhow!(
                            "复制 PostgreSQL 文件失败: {}",
                            String::from_utf8_lossy(&copy_output.stderr)
                        ));
                    }

                    Ok(())
                })();

                let detach_output = create_command("hdiutil")
                    .args(&["detach", &mount_dir.to_string_lossy(), "-force"])
                    .output()?;
                if !detach_output.status.success() {
                    log::warn!(
                        "卸载 PostgreSQL dmg 失败: {}",
                        String::from_utf8_lossy(&detach_output.stderr)
                    );
                }
                let _ = std::fs::remove_dir_all(&mount_dir);

                copy_result?;
            }

            #[cfg(not(target_os = "macos"))]
            {
                return Err(anyhow!("当前平台不支持安装 dmg 包"));
            }
        }

        self.normalize_install_layout(&install_dir)?;

        if archive_path.exists() {
            std::fs::remove_file(&archive_path)?;
        }

        Ok(())
    }

    /// 取消 PostgreSQL 下载
    pub fn cancel_download(&self, version: &str) -> Result<()> {
        let task_id = format!("postgresql-{}", version);
        DownloadManager::global().cancel_download(&task_id)
    }

    /// 获取下载进度
    pub fn get_download_progress(&self, version: &str) -> Option<DownloadTask> {
        let task_id = format!("postgresql-{}", version);
        DownloadManager::global().get_task_status(&task_id)
    }

    /// 激活 PostgreSQL 服务环境
    pub fn activate_service(&self, service_data: &ServiceData) -> Result<()> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        let bin_path = install_path.join("bin");

        if !bin_path.exists() {
            return Err(anyhow!("PostgreSQL bin 目录不存在"));
        }

        // 设置 PATH 环境变量
        let shell_manager = crate::manager::shell_manamger::ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();
        shell_manager.add_path(&bin_path.to_string_lossy())?;

        Ok(())
    }

    /// 取消激活 PostgreSQL 服务环境
    pub fn deactivate_service(&self, service_data: &ServiceData) -> Result<()> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        let bin_path = install_path.join("bin");

        let shell_manager = crate::manager::shell_manamger::ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();
        shell_manager.delete_path(&bin_path.to_string_lossy())?;

        Ok(())
    }

    /// 获取 PostgreSQL 配置
    pub fn get_config(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let status_res = self.get_service_status(environment_id, service_data)?;
        let status_data = status_res.data.unwrap_or_else(|| serde_json::json!({}));
        let data_dir = self.get_data_dir(service_data);
        let config_path = self.get_config_path(service_data);
        let log_path = self.get_log_path(service_data);
        let port = self.get_port(service_data);
        let bind_ip = self.get_host(service_data);
        let is_running = status_data
            .get("isRunning")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let data = serde_json::json!({
            "configPath": config_path,
            "dataPath": data_dir,
            "logPath": log_path,
            "bindIp": bind_ip,
            "port": port,
            "isRunning": is_running,
        });

        Ok(ServiceDataResult {
            success: true,
            message: "获取配置成功".to_string(),
            data: Some(data),
        })
    }

    /// 设置数据目录
    pub fn set_data_path(&self, _service_data: &mut ServiceData, data_path: &str) -> Result<()> {
        if data_path.trim().is_empty() {
            return Err(anyhow!("数据目录不能为空"));
        }

        Ok(())
    }

    /// 设置端口
    pub fn set_port(&self, service_data: &mut ServiceData, port: i64) -> Result<()> {
        if !(1..=65535).contains(&port) {
            return Err(anyhow!("端口必须在 1-65535 之间"));
        }

        let config_path = self.get_config_path(service_data);
        let bind_address = self.get_host(service_data);
        let log_path = self.get_log_path(service_data);
        self.update_postgresql_conf(&config_path, port as u16, &bind_address, &log_path)?;

        Ok(())
    }

    /// 设置日志路径
    pub fn set_log_path(&self, service_data: &mut ServiceData, log_path: &str) -> Result<()> {
        if log_path.trim().is_empty() {
            return Err(anyhow!("日志路径不能为空"));
        }

        let config_path = self.get_config_path(service_data);
        let port = self.get_port(service_data) as u16;
        let bind_address = self.get_host(service_data);
        self.update_postgresql_conf(
            &config_path,
            port,
            &bind_address,
            &PathBuf::from(log_path),
        )?;

        Ok(())
    }

    /// 获取 PostgreSQL 服务运行状态
    pub fn get_service_status(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let pg_ctl = self.get_pg_ctl_bin(service_data);
        if !pg_ctl.exists() {
            return Ok(ServiceDataResult {
                success: false,
                message: "pg_ctl 可执行文件不存在".to_string(),
                data: None,
            });
        }

        let data_dir = self.get_data_dir(service_data);
        let mut cmd = create_command(&pg_ctl);
        Self::apply_runtime_lib_env(&mut cmd, &self.get_install_path(&service_data.version));
        let output = cmd.arg("-D").arg(&data_dir).arg("status").output();

        let running = match output {
            Ok(o) => o.status.success(),
            Err(_) => false,
        };

        let data = serde_json::json!({ "isRunning": running });
        Ok(ServiceDataResult {
            success: true,
            message: "获取状态成功".to_string(),
            data: Some(data),
        })
    }

    /// 检查 PostgreSQL 是否已初始化
    pub fn check_initialized(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let initialized = self.is_initialized(service_data);
        Ok(ServiceDataResult {
            success: true,
            message: if initialized {
                "PostgreSQL 已初始化".to_string()
            } else {
                "PostgreSQL 未初始化".to_string()
            },
            data: Some(serde_json::json!({ "initialized": initialized })),
        })
    }

    /// 初始化 PostgreSQL（支持 reset）
    pub fn initialize_service(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        super_password: String,
        port: Option<String>,
        bind_address: Option<String>,
        reset: bool,
    ) -> Result<ServiceDataResult> {
        if super_password.trim().is_empty() {
            return Err(anyhow!("超级用户密码不能为空"));
        }

        let data_dir = self.get_data_dir(service_data);

        if reset {
            let _ = self.stop_service("", service_data);
            if data_dir.exists() {
                fs::remove_dir_all(&data_dir)?;
            }
        }

        fs::create_dir_all(&data_dir)?;

        if !self.is_initialized(service_data) {
            let initdb = self.get_initdb_bin(service_data);
            if !initdb.exists() {
                let bin_entries = self.list_bin_entries(service_data);
                let details = if bin_entries.is_empty() {
                    "(bin 目录为空或不存在)".to_string()
                } else {
                    bin_entries.join(", ")
                };
                return Err(anyhow!(
                    "initdb 可执行文件不存在: {}，当前 bin 内容: {}",
                    initdb.to_string_lossy(),
                    details
                ));
            }

            let pw_file = std::env::temp_dir().join(format!(
                "envis-postgresql-super-password-{}-{}",
                std::process::id(),
                chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
            ));
            fs::write(&pw_file, format!("{}\n", super_password))?;

            let mut cmd = create_command(&initdb);
            Self::apply_runtime_lib_env(&mut cmd, &self.get_install_path(&service_data.version));
            let output = cmd
                .arg("-D")
                .arg(&data_dir)
                .arg("-U")
                .arg("postgres")
                .arg("-A")
                .arg("scram-sha-256")
                .arg("--pwfile")
                .arg(&pw_file)
                .output()?;

            let _ = fs::remove_file(&pw_file);

            if !output.status.success() {
                return Err(anyhow!(
                    "初始化 PostgreSQL 失败: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
        }

        let final_port = port
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or_else(|| self.get_port(service_data) as u16);
        let final_bind = bind_address.unwrap_or_else(|| self.get_host(service_data));

        let config_path = self.get_config_path(service_data);
        let final_log_path = self.get_log_path(service_data);
        if let Some(log_dir) = final_log_path.parent() {
            fs::create_dir_all(log_dir)?;
        }

        self.update_postgresql_conf(&config_path, final_port, &final_bind, &final_log_path)?;

        let start_res = self.start_service("", service_data)?;
        if !start_res.success {
            return Ok(start_res);
        }

        Ok(ServiceDataResult {
            success: true,
            message: if reset {
                "PostgreSQL 重置并初始化成功".to_string()
            } else {
                "PostgreSQL 初始化成功".to_string()
            },
            data: Some(serde_json::json!({
                "configPath": config_path,
                "dataPath": data_dir,
                "logPath": final_log_path,
                "superPassword": super_password,
                "port": final_port.to_string(),
                "bindAddress": final_bind,
            })),
        })
    }

    /// 启动 PostgreSQL 服务
    pub fn start_service(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let pg_ctl = self.get_pg_ctl_bin(service_data);
        if !pg_ctl.exists() {
            return Ok(ServiceDataResult {
                success: false,
                message: "pg_ctl 可执行文件不存在".to_string(),
                data: None,
            });
        }

        let data_dir = self.get_data_dir(service_data);
        if !self.is_initialized(service_data) {
            return Ok(ServiceDataResult {
                success: false,
                message: "PostgreSQL 尚未初始化，请先初始化".to_string(),
                data: None,
            });
        }

        let log_path = self.get_log_path(service_data);
        if let Some(log_dir) = log_path.parent() {
            fs::create_dir_all(log_dir)?;
        }
        let mut cmd = create_command(&pg_ctl);
        Self::apply_runtime_lib_env(&mut cmd, &self.get_install_path(&service_data.version));
        let output = cmd
            .arg("-D")
            .arg(&data_dir)
            .arg("-l")
            .arg(&log_path)
            .arg("start")
            .output()?;

        if !output.status.success() {
            return Ok(ServiceDataResult {
                success: false,
                message: format!(
                    "PostgreSQL 启动失败: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
                data: None,
            });
        }

        Ok(ServiceDataResult {
            success: true,
            message: "PostgreSQL 服务启动成功".to_string(),
            data: None,
        })
    }

    /// 停止 PostgreSQL 服务
    pub fn stop_service(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let pg_ctl = self.get_pg_ctl_bin(service_data);
        let data_dir = self.get_data_dir(service_data);

        if pg_ctl.exists() && data_dir.exists() {
            let mut cmd = create_command(&pg_ctl);
            Self::apply_runtime_lib_env(&mut cmd, &self.get_install_path(&service_data.version));
            let output = cmd
                .arg("-D")
                .arg(&data_dir)
                .arg("stop")
                .arg("-m")
                .arg("fast")
                .output()?;

            if output.status.success() {
                return Ok(ServiceDataResult {
                    success: true,
                    message: "PostgreSQL 服务停止成功".to_string(),
                    data: None,
                });
            }
        }

        #[cfg(target_os = "windows")]
        let output = create_command("taskkill")
            .args(["/IM", "postgres.exe", "/F"])
            .output()?;

        #[cfg(not(target_os = "windows"))]
        let output = create_command("pkill").arg("-f").arg("postgres").output()?;

        if !output.status.success() {
            return Ok(ServiceDataResult {
                success: false,
                message: format!("PostgreSQL 停止失败: {}", String::from_utf8_lossy(&output.stderr)),
                data: None,
            });
        }

        Ok(ServiceDataResult {
            success: true,
            message: "PostgreSQL 服务停止成功".to_string(),
            data: None,
        })
    }

    /// 重启 PostgreSQL 服务
    pub fn restart_service(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        self.stop_service(environment_id, service_data)?;
        self.start_service(environment_id, service_data)
    }

    /// 列出数据库
    pub fn list_databases(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let sql = "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname";
        let output = self.execute_psql(service_data, Some("postgres"), sql)?;
        let databases: Vec<String> = output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .map(ToString::to_string)
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
        let db_name = database_name.trim();
        if db_name.is_empty() {
            return Err(anyhow!("数据库名称不能为空"));
        }

        self.ensure_valid_identifier(db_name)?;
        let sql = format!("CREATE DATABASE {}", Self::quote_ident(db_name));
        self.execute_psql(service_data, Some("postgres"), &sql)?;

        Ok(ServiceDataResult {
            success: true,
            message: format!("数据库 '{}' 创建成功", db_name),
            data: Some(serde_json::json!({ "database": db_name })),
        })
    }

    /// 列出数据库表
    pub fn list_tables(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        database_name: String,
    ) -> Result<ServiceDataResult> {
        let db_name = database_name.trim();
        if db_name.is_empty() {
            return Err(anyhow!("数据库名称不能为空"));
        }

        self.ensure_valid_identifier(db_name)?;
        let sql = "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name";
        let output = self.execute_psql(service_data, Some(db_name), sql)?;
        let tables: Vec<String> = output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .map(ToString::to_string)
            .collect();

        Ok(ServiceDataResult {
            success: true,
            message: format!("获取数据库 '{}' 的表列表成功", db_name),
            data: Some(serde_json::json!({ "tables": tables })),
        })
    }

    /// 打开 psql 客户端
    pub fn open_client(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let psql_bin = self.get_psql_bin(service_data);
        let cli_cmd = if psql_bin.exists() {
            psql_bin.to_string_lossy().to_string()
        } else if cfg!(target_os = "windows") {
            "psql.exe".to_string()
        } else {
            "psql".to_string()
        };

        let host = self.get_host(service_data);
        let port = self.get_port(service_data).to_string();
        let super_password = self.get_super_password(service_data);

        let mut args = vec![
            "-h".to_string(),
            host.clone(),
            "-p".to_string(),
            port.clone(),
            "-U".to_string(),
            "postgres".to_string(),
            "postgres".to_string(),
        ];

        let result = if cfg!(target_os = "macos") {
            let shell_cmd = if super_password.is_empty() {
                Self::build_terminal_command(&cli_cmd, &args)
            } else {
                format!(
                    "PGPASSWORD={} {}",
                    Self::shell_quote(&super_password),
                    Self::build_terminal_command(&cli_cmd, &args)
                )
            };
            create_command("osascript")
                .arg("-e")
                .arg(format!(
                    "tell application \"Terminal\" to do script \"{}\"",
                    Self::escape_applescript_string(&shell_cmd)
                ))
                .arg("-e")
                .arg("tell application \"Terminal\" to activate")
                .spawn()
        } else if cfg!(target_os = "windows") {
            let mut cmd_args = vec![
                "/C".to_string(),
                "start".to_string(),
                "cmd".to_string(),
                "/K".to_string(),
            ];
            if !super_password.is_empty() {
                cmd_args.push(format!("set PGPASSWORD={}&&", super_password));
            }
            cmd_args.push(cli_cmd);
            cmd_args.append(&mut args);
            create_command("cmd").args(&cmd_args).spawn()
        } else {
            let shell_cmd = if super_password.is_empty() {
                Self::build_terminal_command(&cli_cmd, &args)
            } else {
                format!(
                    "PGPASSWORD={} {}",
                    Self::shell_quote(&super_password),
                    Self::build_terminal_command(&cli_cmd, &args)
                )
            };
            create_command("gnome-terminal")
                .arg("--")
                .arg("bash")
                .arg("-lc")
                .arg(&shell_cmd)
                .spawn()
                .or_else(|_| {
                    create_command("xterm")
                        .arg("-e")
                        .arg(&shell_cmd)
                        .spawn()
                })
        };

        match result {
            Ok(_) => Ok(ServiceDataResult {
                success: true,
                message: "PostgreSQL 客户端已打开".to_string(),
                data: Some(serde_json::json!({ "port": port })),
            }),
            Err(e) => Ok(ServiceDataResult {
                success: false,
                message: format!("无法打开 PostgreSQL 客户端: {}", e),
                data: None,
            }),
        }
    }

    /// 列出角色（不含 postgres）
    pub fn list_roles(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let sql = r#"
SELECT r.rolname,
       d.datname,
       CASE
           WHEN has_database_privilege(r.rolname, d.datname, 'CREATE') OR has_database_privilege(r.rolname, d.datname, 'TEMPORARY') THEN 'ALL PRIVILEGES'
           WHEN has_database_privilege(r.rolname, d.datname, 'CONNECT') THEN 'SELECT'
           ELSE ''
       END AS privilege
FROM pg_roles r
CROSS JOIN pg_database d
WHERE r.rolcanlogin = true
  AND r.rolname <> 'postgres'
  AND d.datistemplate = false
  AND has_database_privilege(r.rolname, d.datname, 'CONNECT')
ORDER BY r.rolname, d.datname
"#;

        let output = self.execute_psql(service_data, Some("postgres"), sql)?;
        let mut role_map: HashMap<String, Vec<Value>> = HashMap::new();
        for line in output.lines().map(str::trim).filter(|line| !line.is_empty()) {
            let parts: Vec<&str> = line.splitn(3, '|').collect();
            if parts.len() != 3 {
                continue;
            }

            let role_name = parts[0].trim();
            let db_name = parts[1].trim();
            let privilege = parts[2].trim();

            role_map.entry(role_name.to_string()).or_default().push(serde_json::json!({
                "database": db_name,
                "privilege": if privilege == "ALL PRIVILEGES" { "ALL PRIVILEGES" } else { "SELECT" },
            }));
        }

        let roles: Vec<Value> = role_map
            .into_iter()
            .map(|(role_name, grants)| {
                serde_json::json!({
                    "roleName": role_name,
                    "grants": grants,
                })
            })
            .collect();

        Ok(ServiceDataResult {
            success: true,
            message: "获取角色列表成功".to_string(),
            data: Some(serde_json::json!({ "roles": roles })),
        })
    }

    /// 创建角色
    pub fn create_role(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        role_name: String,
        password: String,
        grants: Vec<Value>,
    ) -> Result<ServiceDataResult> {
        let role_name = role_name.trim();
        if role_name.is_empty() {
            return Err(anyhow!("角色名称不能为空"));
        }
        if role_name.eq_ignore_ascii_case("postgres") {
            return Err(anyhow!("不能创建 postgres 角色"));
        }
        if password.trim().is_empty() {
            return Err(anyhow!("密码不能为空"));
        }

        self.ensure_valid_identifier(role_name)?;
        let mut sql_parts = vec![format!(
            "CREATE ROLE {} WITH LOGIN PASSWORD {}",
            Self::quote_ident(role_name),
            Self::quote_literal(&password)
        )];

        for grant in grants {
            let database = grant.get("database").and_then(|v| v.as_str()).unwrap_or("");
            let privilege = grant.get("privilege").and_then(|v| v.as_str()).unwrap_or("SELECT");
            if database.trim().is_empty() {
                continue;
            }
            self.ensure_valid_identifier(database)?;
            if privilege == "ALL PRIVILEGES" {
                sql_parts.push(format!(
                    "GRANT ALL PRIVILEGES ON DATABASE {} TO {}",
                    Self::quote_ident(database),
                    Self::quote_ident(role_name)
                ));
            } else {
                sql_parts.push(format!(
                    "GRANT CONNECT ON DATABASE {} TO {}",
                    Self::quote_ident(database),
                    Self::quote_ident(role_name)
                ));
            }
        }

        self.execute_psql(service_data, Some("postgres"), &sql_parts.join("; "))?;
        Ok(ServiceDataResult {
            success: true,
            message: format!("角色 '{}' 创建成功", role_name),
            data: Some(serde_json::json!({ "roleName": role_name })),
        })
    }

    /// 删除角色
    pub fn delete_role(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        role_name: String,
    ) -> Result<ServiceDataResult> {
        let role_name = role_name.trim();
        if role_name.eq_ignore_ascii_case("postgres") {
            return Ok(ServiceDataResult {
                success: false,
                message: "不能删除 postgres 角色".to_string(),
                data: None,
            });
        }

        self.ensure_valid_identifier(role_name)?;
        let sql = format!("DROP ROLE IF EXISTS {}", Self::quote_ident(role_name));
        self.execute_psql(service_data, Some("postgres"), &sql)?;

        Ok(ServiceDataResult {
            success: true,
            message: format!("角色 '{}' 删除成功", role_name),
            data: Some(serde_json::json!({ "roleName": role_name })),
        })
    }

    /// 更新角色权限（全量替换）
    pub fn update_role_grants(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        role_name: String,
        grants: Vec<Value>,
    ) -> Result<ServiceDataResult> {
        let role_name = role_name.trim();
        if role_name.eq_ignore_ascii_case("postgres") {
            return Ok(ServiceDataResult {
                success: false,
                message: "不能修改 postgres 角色权限".to_string(),
                data: None,
            });
        }

        self.ensure_valid_identifier(role_name)?;
        let mut sql_parts = vec![];

        // 先撤销数据库级权限
        let db_output = self.execute_psql(
            service_data,
            Some("postgres"),
            "SELECT datname FROM pg_database WHERE datistemplate = false",
        )?;
        for db in db_output.lines().map(str::trim).filter(|db| !db.is_empty()) {
            self.ensure_valid_identifier(db)?;
            sql_parts.push(format!(
                "REVOKE ALL PRIVILEGES ON DATABASE {} FROM {}",
                Self::quote_ident(db),
                Self::quote_ident(role_name)
            ));
            sql_parts.push(format!(
                "REVOKE CONNECT ON DATABASE {} FROM {}",
                Self::quote_ident(db),
                Self::quote_ident(role_name)
            ));
        }

        // 再按新授权写回
        for grant in grants {
            let database = grant.get("database").and_then(|v| v.as_str()).unwrap_or("");
            let privilege = grant.get("privilege").and_then(|v| v.as_str()).unwrap_or("SELECT");
            if database.trim().is_empty() {
                continue;
            }
            self.ensure_valid_identifier(database)?;
            if privilege == "ALL PRIVILEGES" {
                sql_parts.push(format!(
                    "GRANT ALL PRIVILEGES ON DATABASE {} TO {}",
                    Self::quote_ident(database),
                    Self::quote_ident(role_name)
                ));
            } else {
                sql_parts.push(format!(
                    "GRANT CONNECT ON DATABASE {} TO {}",
                    Self::quote_ident(database),
                    Self::quote_ident(role_name)
                ));
            }
        }

        self.execute_psql(service_data, Some("postgres"), &sql_parts.join("; "))?;
        Ok(ServiceDataResult {
            success: true,
            message: format!("角色 '{}' 权限更新成功", role_name),
            data: Some(serde_json::json!({ "roleName": role_name })),
        })
    }

    fn is_initialized(&self, service_data: &ServiceData) -> bool {
        self.get_data_dir(service_data).join("PG_VERSION").exists()
    }

    fn get_default_data_dir(&self, service_data: &ServiceData) -> PathBuf {
        self.get_install_path(&service_data.version).join("data")
    }

    fn get_config_path(&self, service_data: &ServiceData) -> PathBuf {
        service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("POSTGRESQL_CONFIG"))
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| self.get_default_data_dir(service_data).join("postgresql.conf"))
    }

    fn read_config_content(&self, service_data: &ServiceData) -> Option<String> {
        fs::read_to_string(self.get_config_path(service_data)).ok()
    }

    fn parse_config_value(content: &str, key: &str) -> Option<String> {
        let mut result = None;

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            let candidate = trimmed.split('#').next().unwrap_or(trimmed).trim();
            if let Some((lhs, rhs)) = candidate.split_once('=') {
                if lhs.trim() != key {
                    continue;
                }

                let value = rhs.trim().trim_matches('"').trim_matches('\'').trim();
                if !value.is_empty() {
                    result = Some(value.to_string());
                }
            }
        }

        result
    }

    fn get_data_dir(&self, service_data: &ServiceData) -> PathBuf {
        let config_path = self.get_config_path(service_data);
        if let Some(parent) = config_path.parent() {
            return parent.to_path_buf();
        }

        self.get_default_data_dir(service_data)
    }

    fn get_port(&self, service_data: &ServiceData) -> i64 {
        self.read_config_content(service_data)
            .as_deref()
            .and_then(|content| Self::parse_config_value(content, "port"))
            .and_then(|value| value.parse::<i64>().ok())
            .unwrap_or(5432)
    }

    fn get_host(&self, service_data: &ServiceData) -> String {
        self.read_config_content(service_data)
            .as_deref()
            .and_then(|content| Self::parse_config_value(content, "listen_addresses"))
            .unwrap_or_else(|| "127.0.0.1".to_string())
    }

    fn get_log_path(&self, service_data: &ServiceData) -> PathBuf {
        let data_dir = self.get_data_dir(service_data);
        if let Some(content) = self.read_config_content(service_data) {
            let log_directory = Self::parse_config_value(&content, "log_directory");
            let log_filename = Self::parse_config_value(&content, "log_filename")
                .unwrap_or_else(|| "postgresql.log".to_string());

            if let Some(directory) = log_directory {
                let directory_path = PathBuf::from(&directory);
                let resolved_dir = if directory_path.is_absolute() {
                    directory_path
                } else {
                    data_dir.join(directory)
                };
                return resolved_dir.join(log_filename);
            }

            let log_filename_path = PathBuf::from(&log_filename);
            if log_filename_path.is_absolute() {
                return log_filename_path;
            }

            return data_dir.join(log_filename);
        }

        data_dir.join("postgresql.log")
    }

    fn get_super_password(&self, service_data: &ServiceData) -> String {
        service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("POSTGRESQL_SUPER_PASSWORD"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    }

    fn platform_binary_name(base_name: &str) -> String {
        if cfg!(target_os = "windows") {
            format!("{}.exe", base_name)
        } else {
            base_name.to_string()
        }
    }

    fn discover_bin_dir(install_dir: &Path) -> Option<PathBuf> {
        let postgres_name = Self::platform_binary_name("postgres");
        walkdir::WalkDir::new(install_dir)
            .max_depth(6)
            .into_iter()
            .filter_map(|e| e.ok())
            .find_map(|entry| {
                let path = entry.path();
                if !path.is_file() {
                    return None;
                }

                let file_name = path.file_name().and_then(|v| v.to_str())?;
                if file_name != postgres_name {
                    return None;
                }

                path.parent().map(Path::to_path_buf)
            })
    }

    fn copy_dir_recursive(from: &Path, to: &Path) -> Result<()> {
        fs::create_dir_all(to)?;

        for entry in walkdir::WalkDir::new(from)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let src_path = entry.path();
            let rel = src_path
                .strip_prefix(from)
                .map_err(|e| anyhow!("计算目录相对路径失败: {}", e))?;
            let target = to.join(rel);

            if src_path.is_dir() {
                fs::create_dir_all(&target)?;
                continue;
            }

            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(src_path, &target)?;
        }

        Ok(())
    }

    fn ensure_bin_permissions(bin_dir: &Path) -> Result<()> {
        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;

            for base in ["postgres", "initdb", "pg_ctl", "psql"] {
                let file_path = bin_dir.join(base);
                if !file_path.exists() {
                    continue;
                }

                let mut perms = fs::metadata(&file_path)?.permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&file_path, perms)?;
            }
        }

        Ok(())
    }

    fn normalize_install_layout(&self, install_dir: &Path) -> Result<()> {
        let expected_bin = install_dir.join("bin");
        if !expected_bin.exists() {
            if let Some(found_bin) = Self::discover_bin_dir(install_dir) {
                if found_bin != expected_bin {
                    match fs::rename(&found_bin, &expected_bin) {
                        Ok(_) => {}
                        Err(_) => {
                            Self::copy_dir_recursive(&found_bin, &expected_bin)?;
                            fs::remove_dir_all(&found_bin)?;
                        }
                    }
                }
            }
        }

        fs::create_dir_all(&expected_bin)?;
        Self::ensure_bin_permissions(&expected_bin)?;

        let missing: Vec<String> = ["postgres", "initdb", "pg_ctl", "psql"]
            .iter()
            .map(|base| Self::platform_binary_name(base))
            .filter(|name| !expected_bin.join(name).exists())
            .collect();

        if !missing.is_empty() {
            return Err(anyhow!(
                "PostgreSQL 安装不完整，缺少关键文件: {}",
                missing.join(", ")
            ));
        }

        Ok(())
    }

    fn list_bin_entries(&self, service_data: &ServiceData) -> Vec<String> {
        let bin_dir = self.get_install_path(&service_data.version).join("bin");
        let mut entries: Vec<String> = fs::read_dir(bin_dir)
            .ok()
            .into_iter()
            .flatten()
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| entry.file_name().to_str().map(|v| v.to_string()))
            .collect();
        entries.sort();
        entries
    }

    fn get_initdb_bin(&self, service_data: &ServiceData) -> PathBuf {
        let install_path = self.get_install_path(&service_data.version);
        if cfg!(target_os = "windows") {
            install_path.join("bin").join("initdb.exe")
        } else {
            install_path.join("bin").join("initdb")
        }
    }

    fn get_pg_ctl_bin(&self, service_data: &ServiceData) -> PathBuf {
        let install_path = self.get_install_path(&service_data.version);
        if cfg!(target_os = "windows") {
            install_path.join("bin").join("pg_ctl.exe")
        } else {
            install_path.join("bin").join("pg_ctl")
        }
    }

    fn get_psql_bin(&self, service_data: &ServiceData) -> PathBuf {
        let install_path = self.get_install_path(&service_data.version);
        if cfg!(target_os = "windows") {
            install_path.join("bin").join("psql.exe")
        } else {
            install_path.join("bin").join("psql")
        }
    }

    fn update_postgresql_conf(
        &self,
        config_path: &PathBuf,
        port: u16,
        bind_address: &str,
        log_path: &PathBuf,
    ) -> Result<()> {
        let default_dir = config_path
            .parent()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));
        let conf_path = config_path.clone();
        let log_dir = log_path
            .parent()
            .unwrap_or(&default_dir)
            .to_string_lossy()
            .replace('\'', "");
        let conf_patch = format!(
            "\n# Envis managed settings\nlisten_addresses = '{}'\nport = {}\nlog_destination = 'stderr'\nlogging_collector = on\nlog_directory = '{}'\nlog_filename = '{}'\n",
            bind_address.replace('\'', ""),
            port,
            log_dir,
            log_path
                .file_name()
                .and_then(|v| v.to_str())
                .unwrap_or("postgresql.log")
        );

        if let Some(parent) = conf_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(conf_path)?;
        file.write_all(conf_patch.as_bytes())?;
        Ok(())
    }

    fn execute_psql(
        &self,
        service_data: &ServiceData,
        database: Option<&str>,
        sql: &str,
    ) -> Result<String> {
        let psql = self.get_psql_bin(service_data);
        if !psql.exists() {
            return Err(anyhow!("psql 可执行文件不存在"));
        }

        let host = self.get_host(service_data);
        let port = self.get_port(service_data).to_string();
        let super_password = self.get_super_password(service_data);

        let mut cmd = create_command(&psql);
        Self::apply_runtime_lib_env(&mut cmd, &self.get_install_path(&service_data.version));
        cmd.arg("-h")
            .arg(&host)
            .arg("-p")
            .arg(&port)
            .arg("-U")
            .arg("postgres")
            .arg("-At")
            .arg("-F")
            .arg("|")
            .arg("-c")
            .arg(sql);

        if let Some(db) = database {
            cmd.arg("-d").arg(db);
        }

        if !super_password.is_empty() {
            cmd.env("PGPASSWORD", &super_password);
        }

        let output = cmd.output()?;
        if !output.status.success() {
            return Err(anyhow!(
                "执行 SQL 失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    fn ensure_valid_identifier(&self, value: &str) -> Result<()> {
        if value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_')
        {
            return Ok(());
        }
        Err(anyhow!("名称仅支持字母、数字和下划线"))
    }

    fn quote_ident(value: &str) -> String {
        format!("\"{}\"", value.replace('"', "\"\""))
    }

    fn quote_literal(value: &str) -> String {
        format!("'{}'", value.replace('\'', "''"))
    }

    fn shell_quote(value: &str) -> String {
        format!("'{}'", value.replace('\'', "'\\''"))
    }

    fn build_terminal_command(command: &str, args: &[String]) -> String {
        let mut parts = vec![Self::shell_quote(command)];
        parts.extend(args.iter().map(|arg| Self::shell_quote(arg)));
        parts.push("; exec $SHELL".to_string());
        parts.join(" ")
    }

    fn escape_applescript_string(value: &str) -> String {
        value.replace('\\', "\\\\").replace('"', "\\\"")
    }
}
