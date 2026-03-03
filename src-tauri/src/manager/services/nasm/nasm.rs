use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadTask};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

/// NASM 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NasmVersion {
    pub version: String,
    pub date: String,
}

/// 全局 NASM 服务管理器单例
static GLOBAL_NASM_SERVICE: OnceLock<Arc<NasmService>> = OnceLock::new();

/// NASM 服务管理器
pub struct NasmService {}

impl NasmService {
    /// 获取全局 NASM 服务管理器单例
    pub fn global() -> Arc<NasmService> {
        GLOBAL_NASM_SERVICE
            .get_or_init(|| Arc::new(Self::new()))
            .clone()
    }

    /// 创建新的 NASM 服务管理器
    pub fn new() -> Self {
        Self {}
    }

    /// 获取可用的 NASM 版本列表（静态）
    pub fn get_available_versions(&self) -> Vec<NasmVersion> {
        vec![
            NasmVersion {
                version: "2.16.03".to_string(),
                date: "2024-04-17".to_string(),
            },
            NasmVersion {
                version: "2.16.02".to_string(),
                date: "2023-12-16".to_string(),
            },
            NasmVersion {
                version: "2.16.01".to_string(),
                date: "2023-06-03".to_string(),
            },
            NasmVersion {
                version: "2.15.05".to_string(),
                date: "2020-08-28".to_string(),
            },
        ]
    }

    /// 检查 NASM 是否已安装
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        let nasm_binary = if cfg!(target_os = "windows") {
            install_path.join("nasm.exe")
        } else {
            install_path.join("nasm")
        };
        nasm_binary.exists()
    }

    /// 获取 NASM 安装路径
    fn get_install_path(&self, version: &str) -> PathBuf {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        };
        services_folder.join("nasm").join(version)
    }

    /// 构建下载 URL 和文件名
    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        let (filename, urls) = match platform {
            "macos" => {
                let filename = format!("nasm-{}-macosx.zip", version);
                let urls = vec![format!(
                    "https://www.nasm.us/pub/nasm/releasebuilds/{}/macosx/{}",
                    version, filename
                )];
                (filename, urls)
            }
            "windows" => {
                let package_suffix = if arch.contains("64") { "win64" } else { "win32" };
                let filename = format!("nasm-{}-{}.zip", version, package_suffix);
                let urls = vec![format!(
                    "https://www.nasm.us/pub/nasm/releasebuilds/{}/{}/{}",
                    version, package_suffix, filename
                )];
                (filename, urls)
            }
            "linux" => {
                let package_suffix = if arch.contains("64") {
                    "linux-x86_64"
                } else {
                    "linux-x86"
                };
                let filename = format!("nasm-{}-{}.tar.xz", version, package_suffix);
                let urls = vec![format!(
                    "https://www.nasm.us/pub/nasm/releasebuilds/{}/{}/{}",
                    version, package_suffix, filename
                )];
                (filename, urls)
            }
            _ => return Err(anyhow!("不支持的操作系统: {}", platform)),
        };

        Ok((urls, filename))
    }

    /// 下载并安装 NASM
    pub async fn download_and_install(&self, version: &str) -> Result<DownloadResult> {
        if self.is_installed(version) {
            return Ok(DownloadResult::success(
                format!("NASM {} 已经安装", version),
                None,
            ));
        }

        let (urls, filename) = self.build_download_info(version)?;
        let install_path = self.get_install_path(version);
        let task_id = format!("nasm-{}", version);
        let download_manager = DownloadManager::global();

        let version_for_callback = version.to_string();
        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!(
                "NASM {} 下载完成: {} - {}",
                version_for_callback,
                task.id,
                task.filename
            );

            let task_for_spawn = task.clone();
            let version_for_spawn = version_for_callback.clone();
            let service_for_spawn = NasmService::global();

            tokio::spawn(async move {
                let download_manager = DownloadManager::global();
                if let Err(e) = download_manager.update_task_status(
                    &task_for_spawn.id,
                    crate::manager::services::DownloadStatus::Installing,
                    None,
                ) {
                    log::error!("更新任务状态失败: {}", e);
                } else {
                    log::info!("NASM {} 开始安装", version_for_spawn);
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
                            log::info!("NASM {} 安装成功", version_for_spawn);
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
                        log::error!("NASM {} 安装失败: {}", version_for_spawn, e);
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
                        format!("NASM {} 下载完成", version),
                        Some(task),
                    ))
                } else {
                    Ok(DownloadResult::error("无法获取下载任务状态".to_string()))
                }
            }
            Err(e) => Ok(DownloadResult::error(format!("下载失败: {}", e))),
        }
    }

    /// 解压和安装 NASM
    pub async fn extract_and_install(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let archive_path = &task.target_path;
        let install_dir = self.get_install_path(version);
        std::fs::create_dir_all(&install_dir)?;

        if task.filename.ends_with(".tar.gz") || task.filename.ends_with(".tar.xz") {
            self.extract_tar(archive_path, &install_dir).await?;
        } else if task.filename.ends_with(".zip") {
            self.extract_zip(archive_path, &install_dir).await?;
        } else {
            return Err(anyhow!("不支持的压缩包格式: {}", task.filename));
        }

        if archive_path.exists() {
            std::fs::remove_file(archive_path)?;
        }

        #[cfg(not(target_os = "windows"))]
        self.set_executable_permissions(&install_dir)?;

        Ok(())
    }

    /// 解压 tar 文件
    async fn extract_tar(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        use std::process::Command;

        let output = if archive_path.extension().map(|v| v == "gz").unwrap_or(false) {
            Command::new("tar")
                .args(&[
                    "-xzf",
                    &archive_path.to_string_lossy(),
                    "-C",
                    &target_dir.to_string_lossy(),
                    "--strip-components=1",
                ])
                .output()?
        } else {
            Command::new("tar")
                .args(&[
                    "-xJf",
                    &archive_path.to_string_lossy(),
                    "-C",
                    &target_dir.to_string_lossy(),
                    "--strip-components=1",
                ])
                .output()?
        };

        if !output.status.success() {
            return Err(anyhow!(
                "解压失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    /// 解压 zip 文件
    async fn extract_zip(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        use std::fs::File;
        use std::io::copy;
        use zip::ZipArchive;

        let file = File::open(archive_path)?;
        let mut archive = ZipArchive::new(file)?;

        let temp_dir = target_dir
            .parent()
            .unwrap()
            .join(format!("temp_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir)?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let outpath = temp_dir.join(file.mangled_name());

            if file.name().ends_with('/') {
                std::fs::create_dir_all(&outpath)?;
            } else {
                if let Some(p) = outpath.parent() {
                    std::fs::create_dir_all(p)?;
                }
                let mut outfile = File::create(&outpath)?;
                copy(&mut file, &mut outfile)?;
            }

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = file.unix_mode() {
                    std::fs::set_permissions(&outpath, std::fs::Permissions::from_mode(mode))?;
                }
            }
        }

        let entries: Vec<_> = std::fs::read_dir(&temp_dir)?.collect();
        if entries.len() == 1 {
            let entry = entries[0].as_ref().unwrap();
            if entry.path().is_dir() {
                for item in std::fs::read_dir(entry.path())? {
                    let item = item?;
                    let dest = target_dir.join(item.file_name());
                    std::fs::rename(item.path(), dest)?;
                }
            }
        } else {
            for entry in entries {
                let entry = entry?;
                let dest = target_dir.join(entry.file_name());
                std::fs::rename(entry.path(), dest)?;
            }
        }

        std::fs::remove_dir_all(&temp_dir)?;
        Ok(())
    }

    /// 设置可执行权限
    #[cfg(not(target_os = "windows"))]
    fn set_executable_permissions(&self, install_dir: &PathBuf) -> Result<()> {
        use std::os::unix::fs::PermissionsExt;

        let binary_names = ["nasm", "ndisasm"];
        for binary_name in binary_names {
            let path = install_dir.join(binary_name);
            if path.exists() {
                let mut perms = std::fs::metadata(&path)?.permissions();
                perms.set_mode(0o755);
                std::fs::set_permissions(&path, perms)?;
            }
        }

        Ok(())
    }

    /// 取消 NASM 下载
    pub fn cancel_download(&self, version: &str) -> Result<()> {
        let task_id = format!("nasm-{}", version);
        DownloadManager::global().cancel_download(&task_id)
    }

    /// 获取 NASM 下载进度
    pub fn get_download_progress(&self, version: &str) -> Option<DownloadTask> {
        let task_id = format!("nasm-{}", version);
        DownloadManager::global().get_task_status(&task_id)
    }
}
