use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadStatus, DownloadTask};
use crate::manager::shell_manamger::ShellManager;
use crate::types::ServiceData;
use anyhow::{anyhow, Result};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

/// 全局 Gradle 服务管理器单例
static GLOBAL_GRADLE_SERVICE: OnceLock<Arc<GradleService>> = OnceLock::new();

/// Gradle 服务管理器
pub struct GradleService {}

impl GradleService {
    // Gradle 版本：针对不同 Java 版本选择合适的 Gradle
    const GRADLE_VERSION_FOR_JAVA_8: &'static str = "7.6.4";
    const GRADLE_VERSION_FOR_JAVA_11: &'static str = "8.5";
    const GRADLE_VERSION_FOR_JAVA_MODERN: &'static str = "8.12";

    /// 获取全局 Gradle 服务管理器单例
    pub fn global() -> Arc<GradleService> {
        GLOBAL_GRADLE_SERVICE
            .get_or_init(|| Arc::new(GradleService::new()))
            .clone()
    }

    /// 创建新的 Gradle 服务管理器
    pub fn new() -> Self {
        Self {}
    }

    fn parse_java_major_version(&self, version: &str) -> u32 {
        let normalized = version.trim_start_matches('v');
        if let Some(first_segment) = normalized.split('.').next() {
            return first_segment.parse::<u32>().unwrap_or(17);
        }
        17
    }

    fn get_gradle_version_for_java(&self, java_version: &str) -> &'static str {
        let major = self.parse_java_major_version(java_version);
        if major <= 8 {
            Self::GRADLE_VERSION_FOR_JAVA_8
        } else if major <= 11 {
            Self::GRADLE_VERSION_FOR_JAVA_11
        } else {
            Self::GRADLE_VERSION_FOR_JAVA_MODERN
        }
    }

    fn get_gradle_task_id(&self, java_version: &str) -> String {
        format!("java-{}-gradle", java_version)
    }

    /// 获取 Gradle 安装路径
    fn get_gradle_install_path(&self, java_version: &str) -> PathBuf {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        };
        let gradle_version = self.get_gradle_version_for_java(java_version);
        services_folder
            .join("java")
            .join(java_version)
            .join("gradle")
            .join(gradle_version)
    }

    /// 检查 Gradle 是否已安装
    pub fn is_gradle_installed(&self, java_version: &str) -> bool {
        let install_path = self.get_gradle_install_path(java_version);
        let gradle_binary = if cfg!(target_os = "windows") {
            install_path.join("bin").join("gradle.bat")
        } else {
            install_path.join("bin").join("gradle")
        };
        gradle_binary.exists()
    }

    /// 获取 Gradle 安装目录（已安装时返回路径）
    pub fn get_gradle_home(&self, java_version: &str) -> Option<String> {
        if self.is_gradle_installed(java_version) {
            Some(
                self.get_gradle_install_path(java_version)
                    .to_string_lossy()
                    .to_string(),
            )
        } else {
            None
        }
    }

    /// 构建 Gradle 下载 URL 和文件名
    fn build_gradle_download_info(&self, java_version: &str) -> Result<(Vec<String>, String)> {
        let gradle_version = self.get_gradle_version_for_java(java_version);
        let ext = if cfg!(target_os = "windows") {
            "zip"
        } else {
            "zip" // Gradle 统一使用 zip
        };

        let filename = format!("gradle-{}-bin.{}", gradle_version, ext);
        let urls = vec![
            format!(
                "https://mirrors.huaweicloud.com/gradle/{}/{}",
                gradle_version, filename
            ),
            format!(
                "https://mirrors.aliyun.com/gradle/distributions/{}",
                filename
            ),
            format!("https://services.gradle.org/distributions/{}", filename),
        ];

        Ok((urls, filename))
    }

    /// 下载并安装 Gradle
    pub async fn download_and_install_gradle(&self, java_version: &str) -> Result<DownloadResult> {
        if self.is_gradle_installed(java_version) {
            return Ok(DownloadResult::success("Gradle 已经安装".to_string(), None));
        }

        let (urls, filename) = self.build_gradle_download_info(java_version)?;
        let install_path = self.get_gradle_install_path(java_version);
        let task_id = self.get_gradle_task_id(java_version);
        let download_manager = DownloadManager::global();
        let java_version_for_callback = java_version.to_string();

        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!("Gradle 下载完成: {}", task.filename);

            let task_for_spawn = task.clone();
            let service_for_spawn = GradleService::global();
            let java_version_for_spawn = java_version_for_callback.clone();

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
                    .extract_and_install_gradle(&task_for_spawn, &java_version_for_spawn)
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
                            log::info!("Gradle 安装成功");
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
                        log::error!("Gradle 安装失败: {}", e);
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
                        "Gradle 下载任务已开始".to_string(),
                        Some(task),
                    ))
                } else {
                    Ok(DownloadResult::error(
                        "无法获取 Gradle 下载任务状态".to_string(),
                    ))
                }
            }
            Err(e) => Ok(DownloadResult::error(format!("Gradle 下载失败: {}", e))),
        }
    }

    /// 解压和安装 Gradle
    pub async fn extract_and_install_gradle(
        &self,
        task: &DownloadTask,
        java_version: &str,
    ) -> Result<()> {
        let archive_path = &task.target_path;
        let install_dir = self.get_gradle_install_path(java_version);

        std::fs::create_dir_all(&install_dir)?;

        // Gradle 统一使用 zip 格式
        super::java::extract_zip(archive_path, &install_dir).await?;
        // 先删除压缩包，再提升目录（避免 zip 文件干扰子目录检测）
        let _ = std::fs::remove_file(archive_path);
        super::java::flatten_single_subdir(&install_dir)?;

        #[cfg(not(target_os = "windows"))]
        super::java::set_executable_permissions(&install_dir)?;

        // zip 文件已在上方提前删除，此处清理不会报错

        log::info!("Gradle 解压和安装完成");
        Ok(())
    }

    /// 获取 Gradle 下载进度
    pub fn get_gradle_download_progress(&self, java_version: &str) -> Option<DownloadTask> {
        let task_id = self.get_gradle_task_id(java_version);
        DownloadManager::global().get_task_status(&task_id)
    }

    /// 激活 Gradle 服务（设置环境变量）
    pub fn activate(&self, service_data: &ServiceData) -> Result<()> {
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

        if let Some(metadata) = &service_data.metadata {
            if let Some(gradle_home) = metadata
                .get("GRADLE_HOME")
                .and_then(|v| v.as_str())
                .map(|v| v.trim())
                .filter(|v| !v.is_empty())
            {
                shell_manager.add_export("GRADLE_HOME", gradle_home)?;
                let gradle_bin = format!("{}/bin", gradle_home);
                shell_manager.add_path(&gradle_bin)?;
            }

            if let Some(gradle_user_home) = metadata
                .get("GRADLE_USER_HOME")
                .and_then(|v| v.as_str())
                .map(|v| v.trim())
                .filter(|v| !v.is_empty())
            {
                shell_manager.add_export("GRADLE_USER_HOME", gradle_user_home)?;
            }
        }

        Ok(())
    }

    /// 取消激活 Gradle 服务（删除环境变量）
    pub fn deactivate(&self, service_data: &ServiceData) -> Result<()> {
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

        let metadata_gradle_home = service_data
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("GRADLE_HOME"))
            .and_then(|value| value.as_str())
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(|value| value.to_string());

        if let Some(gradle_home) = metadata_gradle_home {
            let gradle_bin = format!("{}/bin", gradle_home);
            shell_manager.delete_path(&gradle_bin)?;
        }

        shell_manager.delete_export("GRADLE_HOME")?;
        shell_manager.delete_export("GRADLE_USER_HOME")?;

        Ok(())
    }
}
