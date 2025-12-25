use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::env_serv_data_manager::ServiceDataResult;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadTask};
use crate::types::ServiceData;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
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
                version: "16.2".to_string(),
                date: "2024-02-08".to_string(),
            },
            PostgresqlVersion {
                version: "15.6".to_string(),
                date: "2024-02-08".to_string(),
            },
            PostgresqlVersion {
                version: "14.11".to_string(),
                date: "2024-02-08".to_string(),
            },
            PostgresqlVersion {
                version: "13.14".to_string(),
                date: "2024-02-08".to_string(),
            },
            PostgresqlVersion {
                version: "12.18".to_string(),
                date: "2024-02-08".to_string(),
            },
        ]
    }

    /// 检查 PostgreSQL 是否已安装（判断 bin/postgres 是否存在）
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        let postgres_binary = if cfg!(target_os = "windows") {
            install_path.join("bin").join("postgres.exe")
        } else {
            install_path.join("bin").join("postgres")
        };
        postgres_binary.exists()
    }

    fn get_install_path(&self, version: &str) -> PathBuf {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        };
        services_folder.join("postgresql").join(version)
    }

    /// 构建下载 URL 和文件名
    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        // PostgreSQL 官方提供二进制包，通常从 https://www.postgresql.org/download/ 或 EDB 获取
        // 这里简化处理，使用常见的命名约定
        let (filename, mut urls) = match platform {
            "macos" => {
                // macOS 通常使用 .dmg 或 .zip，这里假设使用 tar.gz
                let arch_str = if arch == "aarch64" { "arm64" } else { "x86_64" };
                let filename = format!("postgresql-{}-macos-{}.tar.gz", version, arch_str);
                let urls = vec![format!(
                    "https://get.enterprisedb.com/postgresql/postgresql-{}-macos-{}.tar.gz",
                    version, arch_str
                )];
                (filename, urls)
            }
            "linux" => {
                let arch_str = if arch == "aarch64" { "arm64" } else { "x86_64" };
                let filename = format!("postgresql-{}-linux-{}.tar.gz", version, arch_str);
                let urls = vec![format!(
                    "https://get.enterprisedb.com/postgresql/postgresql-{}-linux-{}.tar.gz",
                    version, arch_str
                )];
                (filename, urls)
            }
            "windows" => {
                let arch_str = if arch == "x86_64" { "x64" } else { "x86" };
                let filename = format!("postgresql-{}-windows-{}.zip", version, arch_str);
                let urls = vec![format!(
                    "https://get.enterprisedb.com/postgresql/postgresql-{}-windows-{}.zip",
                    version, arch_str
                )];
                (filename, urls)
            }
            _ => return Err(anyhow!("不支持的操作系统: {}", platform)),
        };

        // 添加镜像源
        urls.push(format!(
            "https://mirrors.tuna.tsinghua.edu.cn/postgresql/binary/v{}/{}",
            version, filename
        ));

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
        let archive_path = &task.target_path;
        let install_dir = self.get_install_path(version);
        std::fs::create_dir_all(&install_dir)?;

        if task.filename.ends_with(".tar.gz") || task.filename.ends_with(".tgz") {
            let output = Command::new("tar")
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
            let output = Command::new("unzip")
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

        // 查找 postgres 可执行文件并确保在 bin 目录
        let mut found_postgres: Option<PathBuf> = None;
        let candidate = install_dir
            .join("bin")
            .join(if cfg!(target_os = "windows") {
                "postgres.exe"
            } else {
                "postgres"
            });
        if candidate.exists() {
            found_postgres = Some(candidate);
        } else {
            for entry in walkdir::WalkDir::new(&install_dir)
                .max_depth(4)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let p = entry.path();
                if p.is_file() {
                    if let Some(name) = p.file_name().and_then(|s| s.to_str()) {
                        if name == "postgres" || name == "postgres.exe" {
                            found_postgres = Some(p.to_path_buf());
                            break;
                        }
                    }
                }
            }
        }

        if let Some(postgres_path) = found_postgres {
            let expected_bin = install_dir.join("bin");
            std::fs::create_dir_all(&expected_bin)?;
            let dest = expected_bin.join(postgres_path.file_name().unwrap());
            if postgres_path != dest {
                std::fs::rename(&postgres_path, &dest)?;
            }
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
        let metadata = service_data.metadata.as_ref();

        let data_path = metadata
            .and_then(|m| m.get("PGDATA"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let port = metadata
            .and_then(|m| m.get("PGPORT"))
            .and_then(|v| v.as_i64())
            .unwrap_or(5432);

        let data = serde_json::json!({
            "dataPath": data_path,
            "port": port,
        });

        Ok(ServiceDataResult {
            success: true,
            message: "获取配置成功".to_string(),
            data: Some(data),
        })
    }

    /// 设置数据目录
    pub fn set_data_path(&self, service_data: &mut ServiceData, data_path: &str) -> Result<()> {
        if service_data.metadata.is_none() {
            service_data.metadata = Some(std::collections::HashMap::new());
        }

        if let Some(metadata) = service_data.metadata.as_mut() {
            metadata.insert(
                "PGDATA".to_string(),
                serde_json::Value::String(data_path.to_string()),
            );
        }

        Ok(())
    }

    /// 设置端口
    pub fn set_port(&self, service_data: &mut ServiceData, port: i64) -> Result<()> {
        if service_data.metadata.is_none() {
            service_data.metadata = Some(std::collections::HashMap::new());
        }

        if let Some(metadata) = service_data.metadata.as_mut() {
            metadata.insert("PGPORT".to_string(), serde_json::Value::Number(port.into()));
        }

        Ok(())
    }

    /// 获取 PostgreSQL 服务运行状态
    pub fn get_service_status(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        let postgres = if cfg!(target_os = "windows") {
            install_path.join("bin").join("postgres.exe")
        } else {
            install_path.join("bin").join("postgres")
        };

        if !postgres.exists() {
            return Ok(ServiceDataResult {
                success: false,
                message: "postgres 可执行文件不存在".to_string(),
                data: None,
            });
        }

        let running = if cfg!(target_os = "windows") {
            let output = Command::new("tasklist")
                .arg("/FI")
                .arg("IMAGENAME eq postgres.exe")
                .output();
            match output {
                Ok(o) => String::from_utf8_lossy(&o.stdout).contains("postgres.exe"),
                Err(_) => false,
            }
        } else {
            let output = Command::new("pgrep").arg("-f").arg("postgres").output();
            match output {
                Ok(o) => o.status.success(),
                Err(_) => false,
            }
        };

        let data = serde_json::json!({ "isRunning": running });
        Ok(ServiceDataResult {
            success: true,
            message: "获取状态成功".to_string(),
            data: Some(data),
        })
    }

    /// 启动 PostgreSQL 服务
    pub fn start_service(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        let postgres = if cfg!(target_os = "windows") {
            install_path.join("bin").join("postgres.exe")
        } else {
            install_path.join("bin").join("postgres")
        };

        if !postgres.exists() {
            return Ok(ServiceDataResult {
                success: false,
                message: "postgres 可执行文件不存在".to_string(),
                data: None,
            });
        }

        // 获取数据目录
        let data_dir = if let Some(metadata) = &service_data.metadata {
            metadata
                .get("PGDATA")
                .and_then(|v| v.as_str())
                .map(|s| PathBuf::from(s))
                .unwrap_or_else(|| install_path.join("data"))
        } else {
            install_path.join("data")
        };

        std::fs::create_dir_all(&data_dir).ok();

        // 初始化数据库（如果尚未初始化）
        let pg_version_file = data_dir.join("PG_VERSION");
        if !pg_version_file.exists() {
            let initdb = if cfg!(target_os = "windows") {
                install_path.join("bin").join("initdb.exe")
            } else {
                install_path.join("bin").join("initdb")
            };

            if initdb.exists() {
                let output = Command::new(&initdb)
                    .args(&["-D", &data_dir.to_string_lossy()])
                    .output()?;

                if !output.status.success() {
                    return Ok(ServiceDataResult {
                        success: false,
                        message: format!(
                            "初始化数据库失败: {}",
                            String::from_utf8_lossy(&output.stderr)
                        ),
                        data: None,
                    });
                }
            }
        }

        // 启动服务
        let mut cmd = Command::new(&postgres);
        cmd.arg("-D").arg(&data_dir);

        if let Some(metadata) = &service_data.metadata {
            if let Some(port) = metadata.get("PGPORT").and_then(|v| v.as_i64()) {
                cmd.arg("-p").arg(port.to_string());
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            cmd.spawn()?;
        }

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW).spawn()?;
        }

        // 等待服务启动
        std::thread::sleep(std::time::Duration::from_secs(2));

        Ok(ServiceDataResult {
            success: true,
            message: "PostgreSQL 服务启动成功".to_string(),
            data: None,
        })
    }

    /// 停止 PostgreSQL 服务
    pub fn stop_service(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);

        #[cfg(target_os = "windows")]
        {
            Command::new("taskkill")
                .args(&["/IM", "postgres.exe", "/F"])
                .output()?;
        }

        #[cfg(not(target_os = "windows"))]
        {
            Command::new("pkill").arg("-f").arg("postgres").output()?;
        }

        std::thread::sleep(std::time::Duration::from_secs(1));

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
        std::thread::sleep(std::time::Duration::from_secs(2));
        self.start_service(environment_id, service_data)
    }
}
