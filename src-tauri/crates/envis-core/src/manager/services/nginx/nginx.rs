use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::env_serv_data_manager::ServiceDataResult;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadTask};
use crate::types::{ServiceData, ServiceStatus};
use crate::utils::create_command;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::copy;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, OnceLock};

/// Nginx 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NginxVersion {
    pub version: String,
    pub stable: bool,
    pub date: String,
}

/// 全局 Nginx 服务管理器单例
static GLOBAL_NGINX_SERVICE: OnceLock<Arc<NginxService>> = OnceLock::new();

/// Nginx 服务管理器
pub struct NginxService {}

impl NginxService {
    /// 获取全局 Nginx 服务管理器单例
    pub fn global() -> Arc<NginxService> {
        GLOBAL_NGINX_SERVICE
            .get_or_init(|| Arc::new(Self::new()))
            .clone()
    }

    /// 创建新的 Nginx 服务管理器（内部使用）
    fn new() -> Self {
        Self {}
    }

    /// 获取可用的 Nginx 版本列表（静态列表示例）
    pub fn get_available_versions(&self) -> Vec<NginxVersion> {
        vec![
            NginxVersion {
                version: "1.28.3".to_string(),
                stable: false,
                date: "2026-04-14".to_string(),
            },
            NginxVersion {
                version: "1.26.3".to_string(),
                stable: true,
                date: "2026-04-14".to_string(),
            },
        ]
    }

    /// 检查 Nginx 是否已安装（判断 sbin/nginx 是否存在）
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        #[cfg(target_os = "windows")]
        if let Err(error) = self.normalize_windows_binary_name(&install_path) {
            log::warn!("修正 Windows Nginx 可执行文件名失败: {}", error);
        }

        let nginx_bin = self.resolve_nginx_binary(&install_path);
        let installed = nginx_bin.exists();
        // log::debug!(
        //     "检查 Nginx {} 安装状态: {}",
        //     version,
        //     if installed { "已安装" } else { "未安装" }
        // );
        installed
    }

    /// 获取 Nginx 安装路径
    fn get_install_path(&self, version: &str) -> PathBuf {
        let services_folder = {
            let app = AppConfigManager::global();
            let app = app.lock().unwrap();
            std::path::PathBuf::from(app.get_services_folder())
        };
        services_folder.join("nginx").join(version)
    }

    fn nginx_binary_candidates(&self, install_path: &Path) -> Vec<PathBuf> {
        if cfg!(target_os = "windows") {
            vec![
                install_path.join("nginx.exe"),
                install_path.join("nginx"),
                install_path.join("sbin").join("nginx.exe"),
                install_path.join("sbin").join("nginx"),
            ]
        } else {
            vec![
                install_path.join("sbin").join("nginx"),
                install_path.join("nginx"),
            ]
        }
    }

    fn resolve_nginx_binary(&self, install_path: &Path) -> PathBuf {
        self.nginx_binary_candidates(install_path)
            .into_iter()
            .find(|path| path.exists())
            .unwrap_or_else(|| {
                if cfg!(target_os = "windows") {
                    install_path.join("nginx.exe")
                } else {
                    install_path.join("sbin").join("nginx")
                }
            })
    }

    #[cfg(target_os = "windows")]
    fn normalize_windows_binary_name(&self, install_path: &Path) -> Result<()> {
        let binary_with_ext = install_path.join("nginx.exe");
        if binary_with_ext.exists() {
            return Ok(());
        }

        for candidate in [install_path.join("nginx"), install_path.join("sbin").join("nginx")] {
            if candidate.exists() {
                let renamed = candidate.with_extension("exe");
                std::fs::rename(&candidate, &renamed)?;
                log::info!(
                    "Windows 下检测到无扩展名 Nginx 可执行文件，已重命名为: {}",
                    renamed.display()
                );
                return Ok(());
            }
        }

        Ok(())
    }

    /// 构建下载 URL 和文件名
    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        let (os, arch) = if cfg!(target_os = "macos") {
            if cfg!(target_arch = "aarch64") {
                ("macos", "arm64")
            } else {
                ("macos", "x86_64")
            }
        } else if cfg!(target_os = "linux") {
            if cfg!(target_arch = "aarch64") {
                ("linux", "arm64")
            } else {
                ("linux", "x86_64")
            }
        } else if cfg!(target_os = "windows") {
            if cfg!(target_arch = "aarch64") {
                ("windows", "arm64")
            } else {
                ("windows", "x86_64")
            }
        } else {
            return Err(anyhow!("不支持的操作系统"));
        };

        let ext = if cfg!(target_os = "windows") {
            "zip"
        } else {
            "tar.gz"
        };

        let filename = format!("nginx-{}-{}-{}.{}", version, os, arch, ext);
        let github_url = format!(
            "https://github.com/xopenbeta/nginx-archive/releases/latest/download/{}",
            filename
        );

        Ok((vec![github_url], filename))
    }

    /// 下载并安装 Nginx
    pub async fn download_and_install(&self, version: &str) -> Result<DownloadResult> {
        if self.is_installed(version) {
            return Ok(DownloadResult::success(
                format!("Nginx {} 已经安装", version),
                None,
            ));
        }

        let (urls, filename) = self.build_download_info(version)?;
        let install_path = self.get_install_path(version);
        let task_id = format!("nginx-{}", version);
        let download_manager = DownloadManager::global();

        let version_for_callback = version.to_string();
        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!(
                "Nginx {} 下载完成: {} - {}",
                version_for_callback,
                task.id,
                task.filename
            );
            let task_for_spawn = task.clone();
            let version_for_spawn = version_for_callback.clone();
            let service_for_spawn = NginxService::global();

            tokio::spawn(async move {
                let download_manager = DownloadManager::global();
                if let Err(e) = download_manager.update_task_status(
                    &task_for_spawn.id,
                    crate::manager::services::DownloadStatus::Installing,
                    None,
                ) {
                    log::error!("更新任务状态失败: {}", e);
                } else {
                    log::info!("Nginx {} 开始安装", version_for_spawn);
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
                            log::info!("Nginx {} 安装成功", version_for_spawn);
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
                        log::error!("Nginx {} 安装失败: {}", version_for_spawn, e);
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
                        format!("Nginx {} 下载完成", version),
                        Some(task),
                    ))
                } else {
                    Ok(DownloadResult::error("无法获取下载任务状态".to_string()))
                }
            }
            Err(e) => Ok(DownloadResult::error(format!("下载失败: {}", e))),
        }
    }

    /// 解压和安装 Nginx
    pub async fn extract_and_install(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let archive_path = &task.target_path;
        let install_path = self.get_install_path(version);
        std::fs::create_dir_all(&install_path)?;

        self.clear_install_directory(&install_path, archive_path)?;

        let temp_dir = install_path
            .parent()
            .unwrap_or(&install_path)
            .join(format!("nginx_extract_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir)?;

        let extract_result = if archive_path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("zip"))
        {
            self.extract_zip(archive_path, &temp_dir).await
        } else {
            self.extract_tar_to(archive_path, &temp_dir).await
        };

        if let Err(error) = extract_result {
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Err(error);
        }

        self.promote_extracted_contents(&temp_dir, &install_path)?;
        let _ = std::fs::remove_dir_all(&temp_dir);

        #[cfg(target_os = "windows")]
        self.normalize_windows_binary_name(&install_path)?;

        #[cfg(not(target_os = "windows"))]
        self.set_executable_permissions(&install_path)?;

        let nginx_bin = self.resolve_nginx_binary(&install_path);
        if !nginx_bin.exists() {
            return Err(anyhow!(
                "安装完成后未找到 Nginx 可执行文件: {}",
                nginx_bin.display()
            ));
        }

        if archive_path.exists() {
            let _ = std::fs::remove_file(archive_path);
        }
        Ok(())
    }

    fn clear_install_directory(&self, install_dir: &PathBuf, archive_path: &PathBuf) -> Result<()> {
        if !install_dir.exists() {
            return Ok(());
        }

        for entry in std::fs::read_dir(install_dir)? {
            let entry = entry?;
            let entry_path = entry.path();
            if entry_path == *archive_path {
                continue;
            }

            if entry_path.is_dir() {
                std::fs::remove_dir_all(entry_path)?;
            } else {
                std::fs::remove_file(entry_path)?;
            }
        }

        Ok(())
    }

    fn promote_extracted_contents(&self, extracted_dir: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        let entries: Vec<_> = std::fs::read_dir(extracted_dir)?.collect::<std::result::Result<Vec<_>, _>>()?;

        if entries.is_empty() {
            return Err(anyhow!("压缩包为空，未提取到任何文件"));
        }

        let source_dir = if entries.len() == 1 && entries[0].path().is_dir() {
            entries[0].path()
        } else {
            extracted_dir.clone()
        };

        for entry in std::fs::read_dir(&source_dir)? {
            let entry = entry?;
            let destination = target_dir.join(entry.file_name());
            std::fs::rename(entry.path(), destination)?;
        }

        Ok(())
    }

    /// 解压 tar.gz 到目标目录
    async fn extract_tar_to(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        std::fs::create_dir_all(target_dir)?;
        let file = File::open(archive_path)?;
        let decoder = flate2::read::GzDecoder::new(file);
        let mut archive = tar::Archive::new(decoder);
        archive.unpack(target_dir)?;
        Ok(())
    }

    /// 解压 zip 格式文件
    async fn extract_zip(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        use zip::ZipArchive;

        std::fs::create_dir_all(target_dir)?;

        let file = File::open(archive_path)?;
        let mut archive = ZipArchive::new(file)?;

        for index in 0..archive.len() {
            let mut file = archive.by_index(index)?;
            let outpath = target_dir.join(file.mangled_name());

            if file.name().ends_with('/') {
                std::fs::create_dir_all(&outpath)?;
                continue;
            }

            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent)?;
            }

            let mut outfile = File::create(&outpath)?;
            copy(&mut file, &mut outfile)?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = file.unix_mode() {
                    std::fs::set_permissions(&outpath, std::fs::Permissions::from_mode(mode))?;
                }
            }
        }

        Ok(())
    }

    /// 设置可执行权限 (Unix 系统)
    #[cfg(not(target_os = "windows"))]
    fn set_executable_permissions(&self, install_dir: &PathBuf) -> Result<()> {
        use std::os::unix::fs::PermissionsExt;
        let sbin_dir = install_dir.join("sbin");
        if sbin_dir.exists() {
            for entry in std::fs::read_dir(&sbin_dir)? {
                let entry = entry?;
                let metadata = entry.metadata()?;
                let mut permissions = metadata.permissions();
                permissions.set_mode(0o755);
                std::fs::set_permissions(entry.path(), permissions)?;
            }
        }
        Ok(())
    }

    /// 取消 Nginx 下载
    pub fn cancel_download(&self, version: &str) -> Result<()> {
        let task_id = format!("nginx-{}", version);
        DownloadManager::global().cancel_download(&task_id)
    }

    /// 获取下载进度
    pub fn get_download_progress(&self, version: &str) -> Option<DownloadTask> {
        let task_id = format!("nginx-{}", version);
        DownloadManager::global().get_task_status(&task_id)
    }

    fn create_runtime_command(
        &self,
        nginx_bin: &PathBuf,
        install_path: &PathBuf,
        conf_path: &PathBuf,
    ) -> Command {
        let mut command = create_command(nginx_bin);
        command
            .current_dir(install_path)
            .arg("-p")
            .arg(install_path)
            .arg("-c")
            .arg(conf_path);
        command
    }

    /// 启动 Nginx 服务
    pub fn start_service(&self, service_data: &ServiceData) -> Result<ServiceDataResult> {
        log::info!("启动 Nginx 服务");
        let version = &service_data.version;
        let install_path = self.get_install_path(version);

        #[cfg(target_os = "windows")]
        self.normalize_windows_binary_name(&install_path)?;

        log::info!("安装路径: {:?}", install_path);
        let nginx_bin = self.resolve_nginx_binary(&install_path);
        log::info!("Nginx 可执行文件路径: {:?}", nginx_bin);

        if !nginx_bin.exists() {
            log::error!("Nginx 可执行文件不存在: {:?}", nginx_bin);
            return Ok(ServiceDataResult {
                success: false,
                message: "Nginx 可执行文件不存在".to_string(),
                data: None,
            });
        }

        // 确保 logs 目录存在
        let logs_dir = install_path.join("logs");
        if !logs_dir.exists() {
            if let Err(e) = std::fs::create_dir_all(&logs_dir) {
                log::warn!("创建 logs 目录失败: {}", e);
            }
        }

        // 读取 metadata 的配置路径，否则报错
        let conf_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("NGINX_CONF"))
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| install_path.join("conf").join("nginx.conf"));
        // 若不存在直接返回失败
        if !conf_path.exists() {
            log::error!("Nginx 配置文件不存在: {:?}", conf_path);
            return Ok(ServiceDataResult {
                success: false,
                message: format!("Nginx 配置文件不存在: {}", conf_path.display()),
                data: None,
            });
        }

        // 检查并复制 mime.types 到配置文件所在目录
        if let Some(conf_dir) = conf_path.parent() {
            let target_mime_types = conf_dir.join("mime.types");
            if !target_mime_types.exists() {
                let source_mime_types = install_path.join("conf").join("mime.types");
                if source_mime_types.exists() {
                    if let Err(e) = std::fs::copy(&source_mime_types, &target_mime_types) {
                        log::warn!("复制 mime.types 失败: {}", e);
                    } else {
                        log::info!("已复制 mime.types 到配置目录");
                    }
                } else {
                    log::warn!("源 mime.types 不存在: {:?}", source_mime_types);
                }
            }
        }

        // 执行 {nginx_bin} -c {config_path} 启动服务
        let output = self
            .create_runtime_command(&nginx_bin, &install_path, &conf_path)
            .output()
            .map_err(|e| anyhow!("启动 Nginx 失败: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("启动 Nginx 失败: {}", stderr));
        }

        log::info!("Nginx 服务启动成功");
        Ok(ServiceDataResult {
            success: true,
            message: "Nginx 启动成功".to_string(),
            data: Some(serde_json::json!({
                "configPath": conf_path.to_string_lossy().to_string()
            })),
        })
    }

    /// 停止 Nginx 服务
    pub fn stop_service(&self, service_data: &ServiceData) -> Result<()> {
        log::info!("停止 Nginx 服务");
        let version = &service_data.version;
        let install_path = self.get_install_path(version);

        #[cfg(target_os = "windows")]
        self.normalize_windows_binary_name(&install_path)?;

        let nginx_bin = self.resolve_nginx_binary(&install_path);

        if !nginx_bin.exists() {
            return Err(anyhow!("Nginx 可执行文件不存在: {:?}", nginx_bin));
        }

        // 获取配置文件路径（与 start_service 逻辑保持一致：优先 metadata，回退到安装目录 conf/nginx.conf）
        let conf_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("NGINX_CONF"))
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| install_path.join("conf").join("nginx.conf"));

        if !conf_path.exists() {
            return Err(anyhow!("Nginx 配置文件不存在: {}", conf_path.display()));
        }

        // 使用安装路径下的 nginx 执行优雅停止
        let output = self
            .create_runtime_command(&nginx_bin, &install_path, &conf_path)
            .arg("-s")
            .arg("stop")
            .output()
            .map_err(|e| anyhow!("停止 Nginx 失败: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("停止 Nginx 失败: {}", stderr));
        }

        log::info!("Nginx 服务停止成功");
        Ok(())
    }

    /// 重启 Nginx 服务
    pub fn restart_service(&self, service_data: &ServiceData) -> Result<()> {
        log::info!("重启 Nginx 服务");
        let version = &service_data.version;
        let install_path = self.get_install_path(version);

        #[cfg(target_os = "windows")]
        self.normalize_windows_binary_name(&install_path)?;

        let nginx_bin = self.resolve_nginx_binary(&install_path);

        if !nginx_bin.exists() {
            return Err(anyhow!("Nginx 可执行文件不存在: {:?}", nginx_bin));
        }

        let conf_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("NGINX_CONF"))
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| install_path.join("conf").join("nginx.conf"));

        if !conf_path.exists() {
            return Err(anyhow!("Nginx 配置文件不存在: {}", conf_path.display()));
        }

        // 使用安装路径下的 nginx 执行优雅重载
        let output = self
            .create_runtime_command(&nginx_bin, &install_path, &conf_path)
            .arg("-s")
            .arg("reload")
            .output()
            .map_err(|e| anyhow!("重启 Nginx 失败: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("重启 Nginx 失败: {}", stderr));
        }

        log::info!("Nginx 服务重启成功");
        Ok(())
    }

    /// 获取 Nginx 服务状态
    pub fn get_service_status(&self, service_data: &ServiceData) -> Result<ServiceStatus> {
        // log::info!("获取 Nginx 服务状态");

        // 获取配置文件路径
        let conf_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("NGINX_CONF"))
            .and_then(|v| v.as_str());

        if conf_path.is_none() {
            return Ok(ServiceStatus::Unknown);
        }

        let conf_path = conf_path.unwrap();

        // 使用 ps 命令检查 nginx 进程
        let output = if cfg!(target_os = "windows") {
            create_command("tasklist")
                .arg("/FI")
                .arg("IMAGENAME eq nginx.exe")
                .output()
        } else {
            create_command("sh")
                .arg("-c")
                .arg(format!(
                    "ps aux | grep '[n]ginx: master process' | grep '{}'",
                    conf_path
                ))
                .output()
        };

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if stdout.contains("nginx") {
                    // log::info!("Nginx 服务正在运行");
                    Ok(ServiceStatus::Running)
                } else {
                    // log::info!("Nginx 服务未运行");
                    Ok(ServiceStatus::Stopped)
                }
            }
            Err(e) => {
                log::warn!("检查 Nginx 服务状态失败: {}", e);
                Ok(ServiceStatus::Unknown)
            }
        }
    }
}
