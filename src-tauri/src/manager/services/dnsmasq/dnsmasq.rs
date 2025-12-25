use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::env_serv_data_manager::ServiceDataResult;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadStatus, DownloadTask};
use crate::types::{ServiceData, ServiceStatus};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, OnceLock};

/// Dnsmasq 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsmasqVersion {
    pub version: String,
    pub stable: bool,
    pub date: String,
}

/// 全局 Dnsmasq 服务管理器单例
static GLOBAL_DNSMASQ_SERVICE: OnceLock<Arc<DnsmasqService>> = OnceLock::new();

/// Dnsmasq 服务管理器
pub struct DnsmasqService {}

impl DnsmasqService {
    /// 获取全局 Dnsmasq 服务管理器单例
    pub fn global() -> Arc<DnsmasqService> {
        GLOBAL_DNSMASQ_SERVICE
            .get_or_init(|| Arc::new(DnsmasqService::new()))
            .clone()
    }

    /// 创建新的 Dnsmasq 服务管理器（内部使用）
    fn new() -> Self {
        Self {}
    }

    /// 获取可用的 Dnsmasq 版本列表（静态列表示例）
    pub fn get_available_versions(&self) -> Vec<DnsmasqVersion> {
        vec![
            DnsmasqVersion {
                version: "2.90".to_string(),
                stable: true,
                date: "2024-02-13".to_string(),
            },
        ]
    }

    /// 检查 Dnsmasq 是否已安装（判断 sbin/dnsmasq 是否存在）
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        let dnsmasq_bin = if cfg!(target_os = "windows") {
            install_path.join("dnsmasq.exe")
        } else {
            install_path.join("sbin").join("dnsmasq")
        };
        let installed = dnsmasq_bin.exists();
        installed
    }

    /// 获取 Dnsmasq 安装路径
    fn get_install_path(&self, version: &str) -> PathBuf {
        let app_config_manager = AppConfigManager::global();
        let app_config_manager = app_config_manager.lock().unwrap();
        let services_folder = PathBuf::from(app_config_manager.get_services_folder());
        services_folder.join("dnsmasq").join(version)
    }

    /// 构建下载 URL 和文件名
    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        // Dnsmasq 官方提供的是源码包，下载后需要编译
        let filename = format!("dnsmasq-{}.tar.gz", version);
        let urls = vec![
            format!("https://thekelleys.org.uk/dnsmasq/{}", filename)
        ];
        Ok((urls, filename))
    }

    /// 下载并安装 Dnsmasq
    pub async fn download_and_install(&self, version: &str) -> Result<DownloadResult> {
        if self.is_installed(version) {
            return Ok(DownloadResult {
                success: true,
                message: "Dnsmasq 已安装".to_string(),
                task: None,
            });
        }

        let (urls, filename) = self.build_download_info(version)?;
        let install_path = self.get_install_path(version);
        // 使用临时目录下载，避免安装时清理目录导致文件丢失
        let download_path = install_path.parent().ok_or_else(|| anyhow!("无法获取父目录"))?.join("temp");

        let task_id = format!("dnsmasq-{}", version);
        let download_manager = DownloadManager::global();

        let version_for_callback = version.to_string();
        let success_callback = Arc::new(move |task: &DownloadTask| {
            let dnsmasq_service = DnsmasqService::global();
            // 在异步上下文中执行解压
            let task_clone = task.clone();
            let version_clone = version_for_callback.clone();
            let task_id = task.id.clone();
            
            tauri::async_runtime::spawn(async move {
                let download_manager = DownloadManager::global();
                // 更新状态为 Installing
                let _ = download_manager.update_task_status(&task_id, DownloadStatus::Installing, None);

                match dnsmasq_service.extract_and_install(&task_clone, &version_clone).await {
                    Ok(_) => {
                        // 更新状态为 Installed
                        let _ = download_manager.update_task_status(&task_id, DownloadStatus::Installed, None);
                    }
                    Err(e) => {
                        log::error!("安装 Dnsmasq 失败: {}", e);
                        // 更新状态为 Failed
                        let _ = download_manager.update_task_status(&task_id, DownloadStatus::Failed, Some(e.to_string()));
                    }
                }
            });
        });

        match download_manager
            .start_download(
                task_id.clone(),
                urls,
                download_path,
                filename,
                true,
                Some(success_callback),
            )
            .await
        {
            Ok(_) => Ok(DownloadResult {
                success: true,
                message: "开始下载 Dnsmasq".to_string(),
                task: None,
            }),
            Err(e) => Err(anyhow!("下载请求失败: {}", e)),
        }
    }

    /// 解压和安装 Dnsmasq
    pub async fn extract_and_install(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let archive_path = &task.target_path;
        let install_path = self.get_install_path(version);
        
        // 清理旧目录并创建新目录
        if install_path.exists() {
            std::fs::remove_dir_all(&install_path)?;
        }
        std::fs::create_dir_all(&install_path)?;

        // 解压源码
        self.extract_tar_to(archive_path, &install_path).await?;

        // 编译和安装 (仅限非 Windows)
        #[cfg(not(target_os = "windows"))]
        {
            // 1. make
            // 检查 make 是否存在
            if Command::new("make").arg("--version").output().is_err() {
                return Err(anyhow!("未找到 make 命令，请先安装构建工具 (如 xcode-select --install)"));
            }

            let make_output = Command::new("make")
                .current_dir(&install_path)
                .output()?;
            
            if !make_output.status.success() {
                let stderr = String::from_utf8_lossy(&make_output.stderr);
                return Err(anyhow!("Dnsmasq 编译失败: {}", stderr));
            }

            // 2. make install PREFIX=...
            // 这会将二进制文件安装到 install_path/sbin/dnsmasq
            let install_output = Command::new("make")
                .arg("install")
                .arg(format!("PREFIX={}", install_path.display()))
                .current_dir(&install_path)
                .output()?;

            if !install_output.status.success() {
                let stderr = String::from_utf8_lossy(&install_output.stderr);
                return Err(anyhow!("Dnsmasq 安装失败: {}", stderr));
            }

            // 3. Copy example config
            let example_conf = install_path.join("dnsmasq.conf.example");
            let target_conf = install_path.join("dnsmasq.conf");
            if example_conf.exists() && !target_conf.exists() {
                std::fs::copy(example_conf, target_conf)?;
            }
        }

        #[cfg(target_os = "windows")]
        {
             return Err(anyhow!("Windows 暂不支持自动编译安装 Dnsmasq，请手动下载二进制文件放置于: {}", install_path.display()));
        }
        
        // 设置权限（Unix）并删除压缩包
        #[cfg(not(target_os = "windows"))]
        self.set_executable_permissions(&install_path)?;
        
        if archive_path.exists() { 
            let _ = std::fs::remove_file(archive_path);
            // 尝试删除下载目录（如果为空）
            if let Some(parent) = archive_path.parent() {
                let _ = std::fs::remove_dir(parent);
            }
        }
        Ok(())
    }

    /// 解压 tar.gz 到目标目录
    async fn extract_tar_to(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        std::fs::create_dir_all(target_dir)?;
        let output = Command::new("tar")
            .arg("-xzf")
            .arg(archive_path)
            .arg("-C")
            .arg(target_dir)
            .arg("--strip-components=1") // 假设有一层目录
            .output()?;
            
        if !output.status.success() {
            return Err(anyhow!("解压失败: {:?}", String::from_utf8_lossy(&output.stderr)));
        }
        Ok(())
    }

    /// 设置可执行权限 (Unix 系统)
    #[cfg(not(target_os = "windows"))]
    fn set_executable_permissions(&self, install_dir: &PathBuf) -> Result<()> {
        let bin_path = install_dir.join("sbin").join("dnsmasq");
        if bin_path.exists() {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&bin_path)?.permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&bin_path, perms)?;
        }
        Ok(())
    }

    /// 取消 Dnsmasq 下载
    pub fn cancel_download(&self, version: &str) -> Result<()> {
        let task_id = format!("dnsmasq-{}", version);
        DownloadManager::global().cancel_download(&task_id);
        Ok(())
    }

    /// 获取下载进度
    pub fn get_download_progress(&self, version: &str) -> Option<DownloadTask> {
        let task_id = format!("dnsmasq-{}", version);
        DownloadManager::global().get_task_status(&task_id)
    }

    /// 获取配置文件路径
    pub fn get_config_path(&self, service_data: &ServiceData) -> Option<PathBuf> {
        if let Some(path) = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("DNSMASQ_CONF"))
            .and_then(|v| v.as_str())
        {
            return Some(PathBuf::from(path));
        }

        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        let default_conf = install_path.join("dnsmasq.conf");
        if default_conf.exists() {
            Some(default_conf)
        } else {
            None
        }
    }

    /// 启动 Dnsmasq 服务
    pub fn start_service(&self, service_data: &ServiceData) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        if !self.is_installed(version) {
            return Err(anyhow!("Dnsmasq {} 未安装", version));
        }

        let install_path = self.get_install_path(version);
        let dnsmasq_bin = if cfg!(target_os = "windows") {
            install_path.join("dnsmasq.exe")
        } else {
            install_path.join("sbin").join("dnsmasq")
        };

        // 获取配置文件路径
        let conf_path = self
            .get_config_path(service_data)
            .ok_or_else(|| anyhow!("未找到配置文件路径"))?;

        // PID 文件路径
        let pid_file = install_path.join("dnsmasq.pid");

        // 构建命令
        let mut cmd = Command::new(&dnsmasq_bin);
        cmd.arg("-C").arg(conf_path);
        cmd.arg("--pid-file").arg(&pid_file);
        // 不使用 -k，让它后台运行（daemonize），这样它会自己 fork 并写入 pid 文件
        
        let output = cmd.output().map_err(|e| anyhow!("启动 Dnsmasq 失败: {}", e))?;
        
        if !output.status.success() {
             let stderr = String::from_utf8_lossy(&output.stderr);
             return Err(anyhow!("启动 Dnsmasq 失败: {}", stderr));
        }

        Ok(ServiceDataResult {
            success: true,
            message: "Dnsmasq 启动成功".to_string(),
            data: None,
        })
    }

    /// 停止 Dnsmasq 服务
    pub fn stop_service(&self, service_data: &ServiceData) -> Result<()> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        let pid_file = install_path.join("dnsmasq.pid");

        if !pid_file.exists() {
            return Err(anyhow!("未找到 PID 文件，服务可能未运行"));
        }

        let pid_str = std::fs::read_to_string(&pid_file)?;
        let pid = pid_str.trim().parse::<i32>()?;

        #[cfg(not(target_os = "windows"))]
        {
            // 发送 SIGTERM
            let output = Command::new("kill")
                .arg(pid.to_string())
                .output()?;
            
            if !output.status.success() {
                 return Err(anyhow!("停止服务失败: {}", String::from_utf8_lossy(&output.stderr)));
            }
        }

        #[cfg(target_os = "windows")]
        {
            let output = Command::new("taskkill")
                .arg("/PID")
                .arg(pid.to_string())
                .arg("/F")
                .output()?;
             if !output.status.success() {
                 return Err(anyhow!("停止服务失败: {}", String::from_utf8_lossy(&output.stderr)));
            }
        }
        
        // 删除 PID 文件
        let _ = std::fs::remove_file(pid_file);

        Ok(())
    }

    /// 重启 Dnsmasq 服务
    pub fn restart_service(&self, service_data: &ServiceData) -> Result<()> {
        self.stop_service(service_data)?;
        // 等待一小段时间确保进程完全退出
        std::thread::sleep(std::time::Duration::from_millis(500));
        self.start_service(service_data)?;
        Ok(())
    }

    /// 获取 Dnsmasq 服务状态
    pub fn get_service_status(&self, service_data: &ServiceData) -> Result<ServiceStatus> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        let pid_file = install_path.join("dnsmasq.pid");

        if !pid_file.exists() {
            return Ok(ServiceStatus::Stopped);
        }

        let pid_str = std::fs::read_to_string(&pid_file)?;
        let pid = pid_str.trim();

        // 检查进程是否存在
        #[cfg(not(target_os = "windows"))]
        {
            let output = Command::new("ps")
                .arg("-p")
                .arg(pid)
                .output()?;
            if output.status.success() {
                return Ok(ServiceStatus::Running);
            }
        }

        #[cfg(target_os = "windows")]
        {
             let output = Command::new("tasklist")
                .arg("/FI")
                .arg(format!("PID eq {}", pid))
                .output()?;
             let stdout = String::from_utf8_lossy(&output.stdout);
             if stdout.contains(pid) {
                 return Ok(ServiceStatus::Running);
             }
        }

        Ok(ServiceStatus::Stopped)
    }
}
