use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::env_serv_data_manager::ServiceDataResult;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadTask, nginx};
use crate::types::{ServiceData, ServiceStatus};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
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
            NginxVersion { version: "1.26.2".to_string(), stable: true, date: "2024-09-03".to_string() },
            NginxVersion { version: "1.26.1".to_string(), stable: true, date: "2024-05-29".to_string() },
            NginxVersion { version: "1.26.0".to_string(), stable: true, date: "2024-04-23".to_string() },
            NginxVersion { version: "1.24.0".to_string(), stable: true, date: "2023-04-11".to_string() },
            NginxVersion { version: "1.22.1".to_string(), stable: true, date: "2022-10-19".to_string() },
        ]
    }

    /// 检查 Nginx 是否已安装（判断 sbin/nginx 是否存在）
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        let nginx_bin = if cfg!(target_os = "windows") {
            install_path.join("nginx.exe")
        } else {
            install_path.join("sbin").join("nginx")
        };
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

    /// 构建下载 URL 和文件名
    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        let platform = std::env::consts::OS;
        let (filename, urls) = match platform {
            "macos" | "linux" => {
                let filename = format!("nginx-{}.tar.gz", version);
                let urls = vec![
                    format!("https://nginx.org/download/{}", filename),
                    format!("https://mirrors.tuna.tsinghua.edu.cn/nginx/{}", filename),
                ];
                (filename, urls)
            }
            "windows" => {
                let filename = format!("nginx-{}.zip", version);
                let urls = vec![format!("https://nginx.org/download/{}", filename)];
                (filename, urls)
            }
            _ => return Err(anyhow!("不支持的平台: {}", platform)),
        };
        Ok((urls, filename))
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

        if cfg!(target_os = "windows") {
            // Windows 直接解压预编译 zip
            self.extract_zip(archive_path, &install_path).await?;
        } else {
            // Unix: 解压源码到临时 src 目录
            let src_dir = install_path.join("src");
            std::fs::create_dir_all(&src_dir)?;
            self.extract_tar_to(&archive_path, &src_dir).await?;

            // 运行 ./configure && make && make install
            let configure_path = src_dir.join("configure");
            if !configure_path.exists() {
                return Err(anyhow!("配置脚本不存在，可能解压失败"));
            }

            // 基本编译参数（尽量通用）
            let mut args: Vec<String> = vec![
                format!("--prefix={}", install_path.to_string_lossy()),
                "--with-http_ssl_module".to_string(),
                "--with-http_v2_module".to_string(),
                "--with-http_gzip_static_module".to_string(),
                "--with-http_stub_status_module".to_string(),
            ];

            // macOS: 修复 pwritev 可用性导致的编译报错
            // - 设置最低系统版本，避免 SDK/部署目标不一致导致的可用性警告被当作错误
            // - 关闭对 unguarded-availability 的错误提升，避免 clang 将警告视为错误
            // 参考错误：pwritev 在 macOS 11.0 引入，但部署目标为 10.13 时会报错
            #[cfg(target_os = "macos")]
            {
                args.push(
                    "--with-cc-opt=\"-Wno-unguarded-availability-new -Wno-error=unguarded-availability-new -mmacosx-version-min=11.0\"".to_string(),
                );
                args.push("--with-ld-opt=\"-mmacosx-version-min=11.0\"".to_string());
            }

            // 执行 ./configure
            let mut configure_cmd = Command::new("sh");
            #[cfg(target_os = "macos")]
            configure_cmd.env("MACOSX_DEPLOYMENT_TARGET", "11.0");
            let output = configure_cmd
                .arg("-c")
                .arg(format!(
                    "cd '{}' && ./configure {}",
                    src_dir.to_string_lossy(),
                    args.join(" ")
                ))
                .output()?;
            if !output.status.success() {
                return Err(anyhow!(
                    "configure 失败: {}\nSTDOUT: {}",
                    String::from_utf8_lossy(&output.stderr),
                    String::from_utf8_lossy(&output.stdout)
                ));
            }

            // make
            let mut make_cmd = Command::new("sh");
            #[cfg(target_os = "macos")]
            make_cmd.env("MACOSX_DEPLOYMENT_TARGET", "11.0");
            let output = make_cmd
                .arg("-c")
                .arg(format!("cd '{}' && make -j{}", src_dir.to_string_lossy(), num_cpus::get()))
                .output()?;
            if !output.status.success() {
                return Err(anyhow!(
                    "make 失败: {}\nSTDOUT: {}",
                    String::from_utf8_lossy(&output.stderr),
                    String::from_utf8_lossy(&output.stdout)
                ));
            }

            // make install
            let mut install_cmd = Command::new("sh");
            #[cfg(target_os = "macos")]
            install_cmd.env("MACOSX_DEPLOYMENT_TARGET", "11.0");
            let output = install_cmd
                .arg("-c")
                .arg(format!("cd '{}' && make install", src_dir.to_string_lossy()))
                .output()?;
            if !output.status.success() {
                return Err(anyhow!(
                    "make install 失败: {}\nSTDOUT: {}",
                    String::from_utf8_lossy(&output.stderr),
                    String::from_utf8_lossy(&output.stdout)
                ));
            }

            // 清理源码与压缩包
            let _ = std::fs::remove_dir_all(&src_dir);
        }

        // 设置权限（Unix）并删除压缩包
        #[cfg(not(target_os = "windows"))]
        self.set_executable_permissions(&install_path)?;
        if archive_path.exists() { let _ = std::fs::remove_file(archive_path); }
        Ok(())
    }

    /// 解压 tar.gz 到目标目录（strip 根目录）
    async fn extract_tar_to(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        std::fs::create_dir_all(target_dir)?;
        let output = Command::new("tar")
            .arg("-xzf")
            .arg(archive_path)
            .arg("-C")
            .arg(target_dir)
            .arg("--strip-components=1")
            .output()?;
        if !output.status.success() {
            return Err(anyhow!(
                "解压 tar.gz 失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    }

    /// 解压 zip 格式文件
    async fn extract_zip(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        std::fs::create_dir_all(target_dir)?;
        let output = if cfg!(target_os = "windows") {
            Command::new("powershell")
                .arg("-Command")
                .arg(format!(
                    "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                    archive_path.display(),
                    target_dir.display()
                ))
                .output()?
        } else {
            Command::new("unzip")
                .arg("-o")
                .arg(archive_path)
                .arg("-d")
                .arg(target_dir)
                .output()?
        };
        if !output.status.success() {
            return Err(anyhow!(
                "解压 zip 失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        // 将 zip 根目录下内容提取到目标根（如果存在单一子目录）
        #[cfg(not(target_os = "windows"))]
        {
            let entries: Vec<_> = std::fs::read_dir(target_dir)?.filter_map(|e| e.ok()).collect();
            if entries.len() == 1 && entries[0].path().is_dir() {
                let extracted = entries[0].path();
                for e in std::fs::read_dir(&extracted)? {
                    let e = e?;
                    let dest = target_dir.join(e.file_name());
                    std::fs::rename(e.path(), dest)?;
                }
                let _ = std::fs::remove_dir_all(&extracted);
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

    /// 启动 Nginx 服务
    pub fn start_service(&self, service_data: &ServiceData) -> Result<ServiceDataResult> {
        log::info!("启动 Nginx 服务");
        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        log::info!("安装路径: {:?}", install_path);
        let nginx_bin = if cfg!(target_os = "windows") {
            install_path.join("nginx.exe")
        } else {
            install_path.join("sbin").join("nginx")
        };
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
        let output = Command::new(&nginx_bin)
            .arg("-c")
            .arg(&conf_path)
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
        let nginx_bin = if cfg!(target_os = "windows") {
            install_path.join("nginx.exe")
        } else {
            install_path.join("sbin").join("nginx")
        };

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
        let output = Command::new(&nginx_bin)
            .arg("-c")
            .arg(&conf_path)
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
        let nginx_bin = if cfg!(target_os = "windows") {
            install_path.join("nginx.exe")
        } else {
            install_path.join("sbin").join("nginx")
        };

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
        let output = Command::new(&nginx_bin)
            .arg("-c")
            .arg(&conf_path)
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
            Command::new("tasklist")
                .arg("/FI")
                .arg("IMAGENAME eq nginx.exe")
                .output()
        } else {
            Command::new("sh")
                .arg("-c")
                .arg(format!("ps aux | grep '[n]ginx: master process' | grep '{}'", conf_path))
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

