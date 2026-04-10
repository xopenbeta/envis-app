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
use std::path::PathBuf;
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
        _environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let data_dir = self.get_data_dir(service_data);
        let config_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("POSTGRESQL_CONFIG"))
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| data_dir.join("postgresql.conf"));
        let log_path = data_dir.join("postgresql.log");
        let port = self.get_port(service_data);
        let bind_ip = self.get_host(service_data);
        let data = serde_json::json!({
            "configPath": config_path,
            "dataPath": data_dir,
            "logPath": log_path,
            "bindIp": bind_ip,
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
        if data_path.trim().is_empty() {
            return Err(anyhow!("数据目录不能为空"));
        }

        if service_data.metadata.is_none() {
            service_data.metadata = Some(HashMap::new());
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
        if !(1..=65535).contains(&port) {
            return Err(anyhow!("端口必须在 1-65535 之间"));
        }

        if service_data.metadata.is_none() {
            service_data.metadata = Some(HashMap::new());
        }

        if let Some(metadata) = service_data.metadata.as_mut() {
            metadata.insert("PGPORT".to_string(), serde_json::Value::Number(port.into()));
        }

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
        let output = create_command(&pg_ctl)
            .arg("-D")
            .arg(&data_dir)
            .arg("status")
            .output();

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
                return Err(anyhow!("initdb 可执行文件不存在"));
            }

            let pw_file = data_dir.join(".postgresql_super_password");
            fs::write(&pw_file, format!("{}\n", super_password))?;

            let output = create_command(&initdb)
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

        self.update_postgresql_conf(&data_dir, final_port, &final_bind)?;

        let start_res = self.start_service("", service_data)?;
        if !start_res.success {
            return Ok(start_res);
        }

        let config_path = data_dir.join("postgresql.conf");
        let log_path = data_dir.join("postgresql.log");
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
                "logPath": log_path,
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

        let log_path = data_dir.join("postgresql.log");
        let output = create_command(&pg_ctl)
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
            let output = create_command(&pg_ctl)
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

    fn get_data_dir(&self, service_data: &ServiceData) -> PathBuf {
        if let Some(path) = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("PGDATA"))
            .and_then(|v| v.as_str())
        {
            return PathBuf::from(path);
        }

        self.get_install_path(&service_data.version).join("data")
    }

    fn get_port(&self, service_data: &ServiceData) -> i64 {
        service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("PGPORT"))
            .and_then(|v| {
                v.as_i64().or_else(|| {
                    v.as_str()
                        .and_then(|s| s.parse::<i64>().ok())
                })
            })
            .unwrap_or(5432)
    }

    fn get_host(&self, service_data: &ServiceData) -> String {
        service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("PGHOST"))
            .and_then(|v| v.as_str())
            .unwrap_or("127.0.0.1")
            .to_string()
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

    fn update_postgresql_conf(&self, data_dir: &PathBuf, port: u16, bind_address: &str) -> Result<()> {
        let conf_path = data_dir.join("postgresql.conf");
        let log_path = data_dir.join("postgresql.log");
        let conf_patch = format!(
            "\n# Envis managed settings\nlisten_addresses = '{}'\nport = {}\nlog_destination = 'stderr'\nlogging_collector = on\nlog_filename = '{}'\n",
            bind_address.replace('\'', ""),
            port,
            log_path
                .file_name()
                .and_then(|v| v.to_str())
                .unwrap_or("postgresql.log")
        );

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
