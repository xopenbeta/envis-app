use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadTask};
use crate::manager::shell_manamger::ShellManager;
use crate::types::ServiceData;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

use std::process::Command;

/// Python 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonVersion {
    pub version: String,
    pub date: String,
}

/// 全局 Python 服务管理器单例
static GLOBAL_PYTHON_SERVICE: OnceLock<Arc<PythonService>> = OnceLock::new();

/// Python 服务管理器
pub struct PythonService {}

impl PythonService {
    /// 获取全局 Python 服务管理器单例
    pub fn global() -> Arc<PythonService> {
        GLOBAL_PYTHON_SERVICE
            .get_or_init(|| Arc::new(Self::new()))
            .clone()
    }

    /// 创建新的 Python 服务管理器（内部使用）
    fn new() -> Self {
        Self {}
    }

    /// 获取可用的 Python 版本列表
    pub fn get_available_versions(&self) -> Vec<PythonVersion> {
        vec![
            PythonVersion {
                version: "3.14.2".to_string(),
                date: "2025-12-09".to_string(),
            },
            PythonVersion {
                version: "3.13.11".to_string(),
                date: "2025-12-09".to_string(),
            },
            PythonVersion {
                version: "3.12.12".to_string(),
                date: "2025-12-09".to_string(),
            },
            PythonVersion {
                version: "3.10.19".to_string(),
                date: "2025-12-09".to_string(),
            },
        ]
    }

    /// 检查 Python 是否已安装
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        let python_binary = if cfg!(target_os = "windows") {
            install_path.join("python.exe")
        } else {
            install_path.join("bin").join("python3")
        };
        python_binary.exists()
    }

    /// 获取 Python 安装路径
    fn get_install_path(&self, version: &str) -> PathBuf {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        };
        services_folder.join("python").join(version)
    }

    /// 构建下载 URL 和文件名
    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        let filename = format!("Python-{}.tar.xz", version);
        let official_url = format!(
            "https://www.python.org/ftp/python/{}/{}",
            version, filename
        );
        // 也可以添加国内镜像，例如淘宝镜像（如果可用）
        let mirror_url = format!(
            "https://npm.taobao.org/mirrors/python/{}/{}",
            version, filename
        );

        Ok((vec![official_url, mirror_url], filename))
    }

    /// 下载并安装 Python
    pub async fn download_and_install(&self, version: &str) -> Result<DownloadResult> {
        if self.is_installed(version) {
            return Ok(DownloadResult {
                success: false,
                message: "Python 已安装".to_string(),
                task: None,
            });
        }

        let (urls, filename) = self.build_download_info(version)?;
        let install_path = self.get_install_path(version);
        let task_id = format!("python-{}", version);

        let download_manager = DownloadManager::global();
        let version_for_callback = version.to_string();

        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!(
                "Python {} 下载完成: {} - {}",
                version_for_callback,
                task.id,
                task.filename
            );

            // 异步执行安装步骤
            let task_for_spawn = task.clone();
            let version_for_spawn = version_for_callback.clone();
            let service_for_spawn = PythonService::global();

            tokio::spawn(async move {
                // 更新状态为 Installing
                let download_manager = DownloadManager::global();
                if let Err(e) = download_manager.update_task_status(
                    &task_for_spawn.id,
                    crate::manager::services::DownloadStatus::Installing,
                    None,
                ) {
                    log::error!("更新任务状态失败: {}", e);
                } else {
                    log::info!("Python {} 开始安装", version_for_spawn);
                }

                // 执行安装
                match service_for_spawn
                    .extract_and_install(&task_for_spawn, &version_for_spawn)
                    .await
                {
                    Ok(_) => {
                        // 安装成功，更新状态为 Installed
                        if let Err(e) = download_manager.update_task_status(
                            &task_for_spawn.id,
                            crate::manager::services::DownloadStatus::Installed,
                            None,
                        ) {
                            log::error!("更新任务状态失败: {}", e);
                        }
                        log::info!("Python {} 安装成功", version_for_spawn);
                    }
                    Err(e) => {
                        // 安装失败，更新状态为 Failed
                        if let Err(update_err) = download_manager.update_task_status(
                            &task_for_spawn.id,
                            crate::manager::services::DownloadStatus::Failed,
                            Some(format!("安装失败: {}", e)),
                        ) {
                            log::error!("更新任务状态失败: {}", update_err);
                        }
                        log::error!("Python {} 安装失败: {}", version_for_spawn, e);
                    }
                }
            });
        });

        // 开始下载
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
                        format!("Python {} 下载完成", version),
                        Some(task),
                    ))
                } else {
                    Ok(DownloadResult::error(format!(
                        "Python {} 下载任务未找到",
                        version
                    )))
                }
            }
            Err(e) => Ok(DownloadResult::error(format!(
                "Python {} 下载失败: {}",
                version, e
            ))),
        }
    }

    /// 解压和安装 Python (编译安装)
    pub async fn extract_and_install(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let archive_path = &task.target_path;
        let install_dir = self.get_install_path(version);
        
        // 确保安装目录存在
        std::fs::create_dir_all(&install_dir)?;
        
        // 创建临时构建目录
        let build_dir = install_dir.parent().unwrap().join(format!("build-{}", version));
        if build_dir.exists() {
            std::fs::remove_dir_all(&build_dir)?;
        }
        std::fs::create_dir_all(&build_dir)?;

        log::info!("正在解压源码到: {:?}", build_dir);
        
        // 使用系统 tar 命令解压，支持 .tar.xz
        let status = Command::new("tar")
            .arg("-xf")
            .arg(archive_path)
            .arg("-C")
            .arg(&build_dir)
            .status()?;

        if !status.success() {
            return Err(anyhow!("解压失败"));
        }

        // 找到解压后的源码目录 (通常是 Python-x.y.z)
        let source_dir = std::fs::read_dir(&build_dir)?
            .filter_map(|entry| entry.ok())
            .find(|entry| entry.path().is_dir() && entry.file_name().to_string_lossy().starts_with("Python"))
            .map(|entry| entry.path())
            .ok_or_else(|| anyhow!("未找到源码目录"))?;

        log::info!("源码目录: {:?}", source_dir);
        log::info!("开始配置编译选项...");

        // ./configure --prefix={install_dir} --enable-optimizations
        let status = Command::new("./configure")
            .current_dir(&source_dir)
            .arg(format!("--prefix={}", install_dir.to_string_lossy()))
            .arg("--enable-optimizations")
            .status()?;

        if !status.success() {
            return Err(anyhow!("配置失败 (configure failed)"));
        }

        log::info!("开始编译 (make)... 这可能需要一段时间");

        // 获取 CPU 核心数以并行编译
        let cpu_count = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(1)
            .to_string();

        // make -jN
        let status = Command::new("make")
            .current_dir(&source_dir)
            .arg("-j")
            .arg(&cpu_count)
            .status()?;

        if !status.success() {
            return Err(anyhow!("编译失败 (make failed)"));
        }

        log::info!("开始安装 (make install)...");

        // make install
        let status = Command::new("make")
            .current_dir(&source_dir)
            .arg("install")
            .status()?;

        if !status.success() {
            return Err(anyhow!("安装失败 (make install failed)"));
        }

        // 清理构建目录和压缩包
        log::info!("清理临时文件...");
        std::fs::remove_dir_all(&build_dir)?;
        std::fs::remove_file(archive_path)?;

        log::info!("Python {} 编译安装完成", version);

        Ok(())
    }

    /// 解压 tar 格式文件 (不再使用，保留用于兼容性或未来需求)
    #[allow(dead_code)]
    async fn extract_tar(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        use flate2::read::GzDecoder;
        use tar::Archive;

        let file = std::fs::File::open(archive_path)?;
        let decoder = GzDecoder::new(file);
        let mut archive = Archive::new(decoder);

        for entry in archive.entries()? {
            let mut entry = entry?;
            let path = entry.path()?;
            let components: Vec<_> = path.components().collect();

            if components.len() > 1 {
                let new_path: PathBuf = components[1..].iter().collect();
                let target_path = target_dir.join(new_path);

                if let Some(parent) = target_path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                entry.unpack(&target_path)?;
            }
        }

        Ok(())
    }

    /// 解压 zip 格式文件 (不再使用，保留用于兼容性或未来需求)
    #[allow(dead_code)]
    async fn extract_zip(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        use zip::ZipArchive;

        let file = std::fs::File::open(archive_path)?;
        let mut archive = ZipArchive::new(file)?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let outpath = match file.enclosed_name() {
                Some(path) => {
                    let components: Vec<_> = path.components().collect();
                    if components.len() > 1 {
                        let new_path: PathBuf = components[1..].iter().collect();
                        target_dir.join(new_path)
                    } else {
                        continue;
                    }
                }
                None => continue,
            };

            if file.name().ends_with('/') {
                std::fs::create_dir_all(&outpath)?;
            } else {
                if let Some(p) = outpath.parent() {
                    std::fs::create_dir_all(p)?;
                }
                let mut outfile = std::fs::File::create(&outpath)?;
                std::io::copy(&mut file, &mut outfile)?;
            }
        }

        Ok(())
    }

    /// 设置可执行权限 (Unix 系统) (不再使用，make install 会处理权限)
    #[cfg(not(target_os = "windows"))]
    #[allow(dead_code)]
    fn set_executable_permissions(&self, install_dir: &PathBuf) -> Result<()> {
        use std::os::unix::fs::PermissionsExt;

        let bin_dir = install_dir.join("bin");
        if bin_dir.exists() {
            for entry in std::fs::read_dir(&bin_dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_file() {
                    let mut perms = std::fs::metadata(&path)?.permissions();
                    perms.set_mode(0o755);
                    std::fs::set_permissions(&path, perms)?;
                }
            }
        }

        Ok(())
    }

    /// 取消 Python 下载
    pub fn cancel_download(&self, version: &str) -> Result<()> {
        let task_id = format!("python-{}", version);
        DownloadManager::global().cancel_download(&task_id)
    }

    /// 获取下载进度
    pub fn get_download_progress(&self, version: &str) -> Option<DownloadTask> {
        let task_id = format!("python-{}", version);
        DownloadManager::global().get_task_status(&task_id)
    }

    /// 激活 Python 服务
    pub fn activate_service(&self, service_data: &ServiceData) -> Result<()> {
        let install_path = self.get_install_path(&service_data.version);

        let bin_path = if cfg!(target_os = "windows") {
            install_path.to_string_lossy().to_string()
        } else {
            install_path.join("bin").to_string_lossy().to_string()
        };

        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

    shell_manager.add_path(&bin_path)?;

        Ok(())
    }

    /// 取消激活 Python 服务
    pub fn deactivate_service(&self, service_data: &ServiceData) -> Result<()> {
        let install_path = self.get_install_path(&service_data.version);

        let bin_path = if cfg!(target_os = "windows") {
            install_path.to_string_lossy().to_string()
        } else {
            install_path.join("bin").to_string_lossy().to_string()
        };

        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();
    shell_manager.delete_path(&bin_path)?;

        Ok(())
    }

    /// 设置 pip 镜像源
    pub fn set_pip_index_url(
        &self,
        service_data: &ServiceData,
        index_url: &str,
    ) -> Result<()> {
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

    shell_manager.add_export("PIP_INDEX_URL", index_url)?;

        Ok(())
    }

    /// 设置 pip 信任主机
    pub fn set_pip_trusted_host(
        &self,
        service_data: &ServiceData,
        trusted_host: &str,
    ) -> Result<()> {
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

    shell_manager.add_export("PIP_TRUSTED_HOST", trusted_host)?;

        Ok(())
    }

    /// 设置 python3 别名为 python
    pub fn set_python3_as_python(
        &self,
        service_data: &ServiceData,
        enable: bool,
    ) -> Result<()> {
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

        if enable {
            // 添加 alias python=python3
            shell_manager.add_alias("python", "python3")?;
            log::info!("已设置 python3 别名为 python");
        } else {
            // 删除 alias
            shell_manager.delete_alias("python")?;
            log::info!("已移除 python 别名");
        }

        Ok(())
    }
}
