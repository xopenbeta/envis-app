use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::services::traits::ServiceLifecycle;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadStatus, DownloadTask};
use crate::manager::shell_manamger::ShellManager;
use crate::types::ServiceData;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

/// Rust 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RustVersion {
    pub version: String,
    pub stable: bool,
    pub date: String,
}

/// 全局 Rust 服务管理器单例
static GLOBAL_RUST_SERVICE: OnceLock<Arc<RustService>> = OnceLock::new();

/// Rust 服务管理器
pub struct RustService {}

impl RustService {
    /// 获取全局 Rust 服务管理器单例
    pub fn global() -> Arc<RustService> {
        GLOBAL_RUST_SERVICE
            .get_or_init(|| Arc::new(RustService::new()))
            .clone()
    }

    /// 创建新的 Rust 服务管理器
    pub fn new() -> Self {
        Self {}
    }

    /// 获取可用的 Rust 版本列表
    pub fn get_available_versions(&self) -> Vec<RustVersion> {
        vec![
            RustVersion {
                version: "1.70.0".to_string(),
                stable: true,
                date: "2023-06-01".to_string(),
            },
            RustVersion {
                version: "1.75.0".to_string(),
                stable: true,
                date: "2023-12-28".to_string(),
            },
            RustVersion {
                version: "1.80.0".to_string(),
                stable: true,
                date: "2024-07-25".to_string(),
            },
            RustVersion {
                version: "1.85.0".to_string(),
                stable: true,
                date: "2025-02-20".to_string(),
            },
            RustVersion {
                version: "1.86.0".to_string(),
                stable: true,
                date: "2025-04-03".to_string(),
            },
        ]
    }

    /// 检查 Rust 是否已安装
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        let rustc_binary = if cfg!(target_os = "windows") {
            install_path.join("bin").join("rustc.exe")
        } else {
            install_path.join("bin").join("rustc")
        };
        rustc_binary.exists()
    }

    /// 获取 Rust 安装路径
    fn get_install_path(&self, version: &str) -> PathBuf {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        };
        services_folder.join("rust").join(version)
    }

    /// 构建下载 URL 和文件名
    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        // 构建 Rust target triple
        let (target_triple, ext) = match (platform, arch) {
            ("macos", "aarch64") => ("aarch64-apple-darwin", "tar.gz"),
            ("macos", "x86_64") => ("x86_64-apple-darwin", "tar.gz"),
            ("linux", "aarch64") => ("aarch64-unknown-linux-gnu", "tar.gz"),
            ("linux", "x86_64") => ("x86_64-unknown-linux-gnu", "tar.gz"),
            ("windows", "x86_64") => ("x86_64-pc-windows-msvc", "zip"),
            _ => return Err(anyhow!("不支持的平台/架构: {}/{}", platform, arch)),
        };

        // 验证 Rust 版本是否支持
        match version {
            "1.70.0" | "1.75.0" | "1.80.0" | "1.85.0" | "1.86.0" => {}
            _ => return Err(anyhow!("不支持的 Rust 版本: {}", version)),
        };

        // 文件命名格式：rust-{version}-{target_triple}.{ext}
        let filename = format!("rust-{}-{}.{}", version, target_triple, ext);

        // 下载地址
        let urls = vec![format!(
            "https://github.com/xopenbeta/rust-archive/releases/latest/download/{}",
            filename
        )];

        Ok((urls, filename))
    }

    /// 下载并安装 Rust
    pub async fn download_and_install(&self, version: &str) -> Result<DownloadResult> {
        if self.is_installed(version) {
            return Ok(DownloadResult::success(
                format!("Rust {} 已经安装", version),
                None,
            ));
        }

        let (urls, filename) = self.build_download_info(version)?;
        let install_path = self.get_install_path(version);
        let task_id = format!("rust-{}", version);
        let download_manager = DownloadManager::global();

        let version_for_callback = version.to_string();
        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!("Rust {} 下载完成: {}", version_for_callback, task.filename);

            let task_for_spawn = task.clone();
            let version_for_spawn = version_for_callback.clone();
            let service_for_spawn = RustService::global();

            tokio::spawn(async move {
                let download_manager = DownloadManager::global();
                if let Err(e) = download_manager.update_task_status(
                    &task_for_spawn.id,
                    DownloadStatus::Installing,
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
                            DownloadStatus::Installed,
                            None,
                        ) {
                            log::error!("更新任务状态失败: {}", e);
                        } else {
                            log::info!("Rust {} 安装成功", version_for_spawn);
                        }
                    }
                    Err(e) => {
                        if let Err(update_err) = download_manager.update_task_status(
                            &task_for_spawn.id,
                            DownloadStatus::Failed,
                            Some(format!("安装失败: {}", e)),
                        ) {
                            log::error!("更新任务状态失败: {}", update_err);
                        }
                        log::error!("Rust {} 安装失败: {}", version_for_spawn, e);
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
                        format!("Rust {} 下载完成", version),
                        Some(task),
                    ))
                } else {
                    Ok(DownloadResult::error("无法获取下载任务状态".to_string()))
                }
            }
            Err(e) => Ok(DownloadResult::error(format!("下载失败: {}", e))),
        }
    }

    /// 解压和安装 Rust
    pub async fn extract_and_install(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let archive_path = &task.target_path;
        let install_dir = self.get_install_path(version);

        std::fs::create_dir_all(&install_dir)?;

        if task.filename.ends_with(".tar.gz") {
            extract_tar(archive_path, &install_dir).await?;
        } else if task.filename.ends_with(".zip") {
            extract_zip(archive_path, &install_dir).await?;
            // 先删除压缩包，再提升目录（避免 zip 文件干扰子目录检测）
            let _ = std::fs::remove_file(archive_path);
            flatten_single_subdir(&install_dir)?;
        } else {
            return Err(anyhow!("不支持的压缩格式"));
        }

        #[cfg(not(target_os = "windows"))]
        set_executable_permissions(&install_dir)?;

        // zip 文件已在上方提前删除，tar.gz 在此清理
        let _ = std::fs::remove_file(archive_path);

        log::info!("Rust {} 解压和安装完成", version);
        Ok(())
    }

    /// 取消下载
    pub fn cancel_download(&self, version: &str) -> Result<()> {
        let task_id = format!("rust-{}", version);
        DownloadManager::global().cancel_download(&task_id)
    }

    /// 获取下载进度
    pub fn get_download_progress(&self, version: &str) -> Option<DownloadTask> {
        let task_id = format!("rust-{}", version);
        DownloadManager::global().get_task_status(&task_id)
    }

    /// 激活服务
    pub fn activate_service(&self, service_data: &ServiceData) -> Result<()> {
        let install_path = self.get_install_path(&service_data.version);

        if !self.is_installed(&service_data.version) {
            return Err(anyhow!("Rust {} 未安装", service_data.version));
        }

        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

        let rust_home = install_path.to_string_lossy().to_string();
        let bin_path = install_path.join("bin").to_string_lossy().to_string();

        shell_manager.add_export("RUST_HOME", &rust_home)?;
        shell_manager.add_path(&bin_path)?;

        // 设置 CARGO_HOME：优先使用 metadata 中的自定义路径，否则默认为安装目录下的 cargo 子文件夹
        let cargo_home = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("CARGO_HOME"))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| install_path.join("cargo").to_string_lossy().to_string());

        // 确保 cargo 目录存在
        let cargo_home_path = std::path::PathBuf::from(&cargo_home);
        if !cargo_home_path.exists() {
            std::fs::create_dir_all(&cargo_home_path)?;
        }

        shell_manager.add_export("CARGO_HOME", &cargo_home)?;

        log::info!("Rust {} 服务已激活", service_data.version);
        Ok(())
    }

    /// 取消激活服务
    pub fn deactivate_service(&self, service_data: &ServiceData) -> Result<()> {
        let install_path = self.get_install_path(&service_data.version);

        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

        let bin_path = install_path.join("bin").to_string_lossy().to_string();

        shell_manager.delete_path(&bin_path)?;
        shell_manager.delete_export("RUST_HOME")?;
        shell_manager.delete_export("CARGO_HOME")?;

        log::info!("Rust {} 服务已取消激活", service_data.version);
        Ok(())
    }

    /// 获取 Rust 版本信息
    pub fn get_rust_info(&self, service_data: &ServiceData) -> Result<serde_json::Value> {
        let install_path = self.get_install_path(&service_data.version);

        if !self.is_installed(&service_data.version) {
            return Err(anyhow!("Rust {} 未安装", service_data.version));
        }

        let rustc_binary = if cfg!(target_os = "windows") {
            install_path.join("bin").join("rustc.exe")
        } else {
            install_path.join("bin").join("rustc")
        };

        let cargo_binary = if cfg!(target_os = "windows") {
            install_path.join("bin").join("cargo.exe")
        } else {
            install_path.join("bin").join("cargo")
        };

        // 获取 rustc 版本
        let rustc_output = crate::utils::create_command(rustc_binary.to_str().unwrap_or("rustc"))
            .arg("--version")
            .output();

        let rustc_version = match rustc_output {
            Ok(output) => String::from_utf8_lossy(&output.stdout).trim().to_string(),
            Err(_) => format!("rustc {}", service_data.version),
        };

        // 获取 cargo 版本
        let cargo_output = crate::utils::create_command(cargo_binary.to_str().unwrap_or("cargo"))
            .arg("--version")
            .output();

        let cargo_version = match cargo_output {
            Ok(output) => String::from_utf8_lossy(&output.stdout).trim().to_string(),
            Err(_) => format!("cargo {}", service_data.version),
        };

        Ok(serde_json::json!({
            "version": service_data.version,
            "rustc": rustc_version,
            "cargo": cargo_version,
            "home": install_path.to_string_lossy(),
        }))
    }
}

impl ServiceLifecycle for RustService {
    fn active(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        _password: Option<String>,
    ) -> Result<()> {
        self.activate_service(service_data)
    }

    fn deactive(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        _password: Option<String>,
    ) -> Result<()> {
        self.deactivate_service(service_data)
    }
}

// ─── 共享工具方法 ───────────────────────────────────────────────────────────

/// 解压 tar 格式文件（strip 顶层目录）
async fn extract_tar(archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
    let mut cmd = tokio::process::Command::new("tar");
    cmd.arg("-xzf")
        .arg(archive_path)
        .arg("-C")
        .arg(target_dir)
        .arg("--strip-components=1");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd.output().await?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("解压 tar 文件失败: {}", error));
    }

    Ok(())
}

/// 若 target_dir 下存在唯一的子目录（忽略文件），则将其内容提升到 target_dir
fn flatten_single_subdir(target_dir: &PathBuf) -> Result<()> {
    let subdirs: Vec<_> = std::fs::read_dir(target_dir)
        .map_err(|e| anyhow!("读取目录失败: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .collect();

    if subdirs.len() != 1 {
        return Ok(());
    }

    let nested_dir = subdirs[0].path();

    for entry in std::fs::read_dir(&nested_dir)
        .map_err(|e| anyhow!("读取嵌套目录失败: {}", e))?
    {
        let entry = entry.map_err(|e| anyhow!("读取目录条目失败: {}", e))?;
        let src = entry.path();
        let dest = target_dir.join(entry.file_name());
        std::fs::rename(&src, &dest)
            .map_err(|e| anyhow!("移动 {:?} 到 {:?} 失败: {}", src, dest, e))?;
    }

    std::fs::remove_dir(&nested_dir)
        .map_err(|e| anyhow!("删除嵌套目录 {:?} 失败: {}", nested_dir, e))?;

    Ok(())
}

/// 解压 zip 格式文件
async fn extract_zip(archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
    use std::fs::File;
    use zip::ZipArchive;

    let file = File::open(archive_path)?;
    let mut archive = ZipArchive::new(file)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let outpath = match file.enclosed_name() {
            Some(path) => target_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath)?;
        } else {
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut outfile = File::create(&outpath)?;
            std::io::copy(&mut file, &mut outfile)?;
        }

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

/// 设置可执行权限
#[cfg(not(target_os = "windows"))]
fn set_executable_permissions(install_dir: &PathBuf) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let bin_dir = install_dir.join("bin");
    if !bin_dir.exists() {
        return Ok(());
    }

    for entry in std::fs::read_dir(&bin_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            let mut perms = std::fs::metadata(&path)?.permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&path, perms)?;
        }
    }

    Ok(())
}
