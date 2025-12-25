use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::env_serv_data_manager::ServiceDataResult;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadTask};
use crate::types::{ServiceData, ServiceStatus};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// MongoDB 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MongodbVersion {
    pub version: String,
    pub date: String,
}

/// 全局 MongoDB 服务管理器单例
static GLOBAL_MONGODB_SERVICE: OnceLock<Arc<MongodbService>> = OnceLock::new();

/// MongoDB 服务管理器
pub struct MongodbService {}

impl MongodbService {
    /// 获取全局 MongoDB 服务管理器单例
    pub fn global() -> Arc<MongodbService> {
        GLOBAL_MONGODB_SERVICE
            .get_or_init(|| Arc::new(MongodbService::new()))
            .clone()
    }

    fn new() -> Self {
        Self {}
    }

    /// 获取可用的 MongoDB 版本列表（示例）
    pub fn get_available_versions(&self) -> Vec<MongodbVersion> {
        vec![
            MongodbVersion {
                version: "8.2.1".to_string(),
                date: "2024-10-01".to_string(),
            },
            MongodbVersion {
                version: "8.0.4".to_string(),
                date: "2024-09-15".to_string(),
            },
            MongodbVersion {
                version: "7.0.15".to_string(),
                date: "2024-08-20".to_string(),
            },
            MongodbVersion {
                version: "6.0.14".to_string(),
                date: "2024-08-01".to_string(),
            },
        ]
    }

    /// 获取 MongoDB 服务数据目录
    fn get_service_data_folder(&self, environment_id: &str, version: &str) -> PathBuf {
        let app_config_manager = AppConfigManager::global();
        let app_config_manager = app_config_manager.lock().unwrap();
        let envs_folder = app_config_manager.get_envs_folder();

        PathBuf::from(envs_folder)
            .join(environment_id)
            .join("mongodb")
            .join(version)
    }

    /// 检查 MongoDB 是否已安装（判断 bin/mongod 是否存在）
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        let mongod_bin = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mongod.exe")
        } else {
            install_path.join("bin").join("mongod")
        };
        let installed = mongod_bin.exists();
        // log::debug!(
        //     "检查 MongoDB {} 安装状态: {}",
        //     version,
        //     if installed { "已安装" } else { "未安装" }
        // );
        installed
    }

    fn get_install_path(&self, version: &str) -> PathBuf {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        };
        services_folder.join("mongodb").join(version)
    }

    /// 根据 MongoDB 版本选择对应的 mongosh 版本
    fn get_mongosh_version_for_mongodb(&self, mongodb_version: &str) -> &str {
        // 解析 MongoDB 主版本号
        let major_version = mongodb_version
            .split('.')
            .next()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);

        // MongoDB 7.0+ 使用 mongosh 2.5.8
        // MongoDB 6.0 及以下使用 mongosh 1.10.6
        if major_version >= 7 {
            "2.5.8"
        } else {
            "1.10.6"
        }
    }

    /// 构建 mongosh 下载文件名和 URL 列表
    fn build_mongosh_download_info(&self, mongosh_version: &str) -> Result<(Vec<String>, String)> {
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        // 构建 mongosh 的下载文件名
        // 格式：mongosh-{version}-{platform}-{arch}.{ext}
        let (platform_str, arch_str, ext) = match platform {
            "macos" => {
                let arch = if arch == "aarch64" { "arm64" } else { "x64" };
                ("darwin", arch, "zip")
            }
            "linux" => {
                let arch = if arch == "aarch64" { "arm64" } else { "x64" };
                ("linux", arch, "tgz")
            }
            "windows" => {
                let arch = if arch == "x86_64" { "x64" } else { "x86" };
                ("win32", arch, "zip")
            }
            _ => return Err(anyhow!("不支持的操作系统: {}", platform)),
        };

        let filename = format!(
            "mongosh-{}-{}-{}.{}",
            mongosh_version, platform_str, arch_str, ext
        );

        // 构建下载 URL（使用官方 MongoDB Compass 下载源）
        let url = format!("https://downloads.mongodb.com/compass/{}", filename);

        Ok((vec![url], filename))
    }

    /// 构建下载文件名和 URL 列表
    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        // 构建官方命名方式，参考 fastdl.mongodb.org 的常见路径格式
        // 注意：MongoDB 的真实文件名非常复杂，这里实现对常见组合的支持：
        // - macos (darwin) 会包含 macos 或 macos-arm64 等
        // - linux 会包含 linux-x86_64 或 linux-aarch64
        // - windows 会使用 zip
        let filename = match platform {
            "macos" => {
                // macOS 二进制通常为 tgz，arch aarch64 -> arm64
                // MongoDB 官方下载格式：mongodb-macos-arm64-{version}.tgz
                let arch_str = if arch == "aarch64" { "arm64" } else { "x86_64" };
                format!("mongodb-macos-{}-{}.tgz", arch_str, version)
            }
            "linux" => {
                let arch_str = if arch == "aarch64" {
                    "aarch64"
                } else {
                    "x86_64"
                };
                format!("mongodb-linux-{}-{}.tgz", arch_str, version)
            }
            "windows" => {
                let arch_str = if arch == "x86_64" { "x86_64" } else { "i386" };
                format!("mongodb-windows-{}-{}.zip", arch_str, version)
            }
            _ => return Err(anyhow!("不支持的操作系统: {}", platform)),
        };

        // 构建下载源列表，优先使用官方源，国内镜像作为备用
        let mut urls: Vec<String> = Vec::new();

        // 官方源 - 优先使用
        if platform == "windows" {
            urls.push(format!("https://fastdl.mongodb.org/windows/{}", filename));
        } else if platform == "linux" {
            urls.push(format!("https://fastdl.mongodb.org/linux/{}", filename));
            // 阿里云镜像作为备用
            urls.push(format!(
                "https://mirrors.aliyun.com/mongodb/linux/{}",
                filename
            ));
        } else {
            urls.push(format!("https://fastdl.mongodb.org/osx/{}", filename));
        }

        Ok((urls, filename))
    }

    /// 下载并安装 MongoDB（与 Node.js 模式一致：下载后异步解压和安装）
    pub async fn download_and_install(&self, version: &str) -> Result<DownloadResult> {
        log::info!("开始下载 MongoDB {}", version);

        if self.is_installed(version) {
            log::warn!("MongoDB {} 已经安装，跳过下载", version);
            return Ok(DownloadResult::success(
                format!("MongoDB {} 已经安装", version),
                None,
            ));
        }

        let (urls, filename) = self.build_download_info(version)?;
        log::debug!("MongoDB {} 下载 URL: {:?}", version, urls);

        let install_path = self.get_install_path(version);
        let task_id = format!("mongodb-{}", version);
        let download_manager = DownloadManager::global();

        let version_for_callback = version.to_string();
        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!(
                "MongoDB {} 下载完成: {} - {}",
                version_for_callback,
                task.id,
                task.filename
            );
            let task_for_spawn = task.clone();
            let version_for_spawn = version_for_callback.clone();
            let service_for_spawn = MongodbService::global();

            tokio::spawn(async move {
                let download_manager = DownloadManager::global();

                // 步骤 1: 安装 MongoDB
                if let Err(e) = download_manager.update_task_status(
                    &task_for_spawn.id,
                    crate::manager::services::DownloadStatus::Installing,
                    None,
                ) {
                    log::error!("更新任务状态失败: {}", e);
                } else {
                    log::info!("MongoDB {} 开始安装", version_for_spawn);
                }

                match service_for_spawn
                    .extract_and_install(&task_for_spawn, &version_for_spawn)
                    .await
                {
                    Ok(_) => {
                        log::info!("MongoDB {} 安装成功，开始下载 mongosh", version_for_spawn);

                        // 步骤 2: 将状态改回 Downloading，准备下载 mongosh
                        if let Err(e) = download_manager.update_task_status(
                            &task_for_spawn.id,
                            crate::manager::services::DownloadStatus::Downloading,
                            None,
                        ) {
                            log::error!("更新任务状态为 Downloading 失败: {}", e);
                        }

                        // 步骤 3: 下载并安装 mongosh（共用同一个 task）
                        let mongosh_version =
                            service_for_spawn.get_mongosh_version_for_mongodb(&version_for_spawn);
                        match service_for_spawn
                            .download_and_install_mongosh_with_task(
                                &task_for_spawn.id,
                                &version_for_spawn,
                                mongosh_version,
                            )
                            .await
                        {
                            Ok(_) => {
                                log::info!("mongosh {} 安装成功", mongosh_version);
                                if let Err(e) = download_manager.update_task_status(
                                    &task_for_spawn.id,
                                    crate::manager::services::DownloadStatus::Installed,
                                    None,
                                ) {
                                    log::error!("更新任务状态失败: {}", e);
                                } else {
                                    log::info!("MongoDB {} 和 mongosh 安装完成", version_for_spawn);
                                }
                            }
                            Err(e) => {
                                log::error!("mongosh 安装失败: {}，但 MongoDB 已安装成功", e);
                                // mongosh 安装失败不影响 MongoDB 的使用
                                if let Err(update_err) = download_manager.update_task_status(
                                    &task_for_spawn.id,
                                    crate::manager::services::DownloadStatus::Installed,
                                    Some(format!("MongoDB 已安装，但 mongosh 安装失败: {}", e)),
                                ) {
                                    log::error!("更新任务状态失败: {}", update_err);
                                }
                            }
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
                        log::error!("MongoDB {} 安装失败: {}", version_for_spawn, e);
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
                    log::info!("MongoDB {} 下载任务已创建", version);
                    Ok(DownloadResult::success(
                        format!("MongoDB {} 下载完成", version),
                        Some(task),
                    ))
                } else {
                    log::error!("无法获取 MongoDB {} 下载任务状态", version);
                    Ok(DownloadResult::error("无法获取下载任务状态".to_string()))
                }
            }
            Err(e) => {
                log::error!("MongoDB {} 下载失败: {}", version, e);
                Ok(DownloadResult::error(format!("下载失败: {}", e)))
            }
        }
    }

    /// 下载并安装 mongosh（共用 MongoDB 的 task）
    async fn download_and_install_mongosh_with_task(
        &self,
        task_id: &str,
        mongodb_version: &str,
        mongosh_version: &str,
    ) -> Result<()> {
        log::info!(
            "开始下载 mongosh {}（使用 task: {}）",
            mongosh_version,
            task_id
        );

        let (urls, filename) = self.build_mongosh_download_info(mongosh_version)?;
        log::debug!("mongosh {} 下载 URL: {:?}", mongosh_version, urls);

        let install_path = self.get_install_path(mongodb_version);
        let mongosh_target_path = install_path.join(&filename);
        let download_manager = DownloadManager::global();

        // 更新 task 的下载信息（复用 MongoDB 的 task_id）
        {
            let mut tasks = download_manager.tasks.lock().unwrap();
            if let Some(task) = tasks.get_mut(task_id) {
                task.urls = urls.clone();
                task.current_url_index = 0;
                task.url = urls.first().unwrap_or(&String::new()).clone();
                task.filename = filename.clone();
                task.target_path = mongosh_target_path.clone(); // 更新为 mongosh 的目标路径
                task.downloaded_size = 0;
                task.total_size = 0;
                task.progress = 0.0;
                task.status = crate::manager::services::DownloadStatus::Downloading;
                task.error_message = None;
                task.failed_urls.clear();
                task.success_callback = None; // 清除 callback，避免重复触发
            } else {
                return Err(anyhow!("未找到 task: {}", task_id));
            }
        }

        // 使用 download_with_fallback 下载 mongosh
        download_manager.download_with_fallback(task_id).await?;

        // 下载完成后，设置为 Installing 状态并解压安装
        if let Err(e) = download_manager.update_task_status(
            task_id,
            crate::manager::services::DownloadStatus::Installing,
            None,
        ) {
            log::error!("更新任务状态为 Installing 失败: {}", e);
        }

        // 使用 task 中的实际下载路径进行解压
        self.extract_mongosh(&mongosh_target_path, &filename, mongodb_version)
            .await?;

        log::info!("mongosh 安装完成");
        Ok(())
    }

    // /// 下载并安装 mongosh（旧方法，保留用于独立下载）
    // #[allow(dead_code)]
    // async fn download_and_install_mongosh(&self, mongodb_version: &str, mongosh_version: &str) -> Result<()> {
    //     log::info!("开始下载 mongosh {}", mongosh_version);

    //     let (urls, filename) = self.build_mongosh_download_info(mongosh_version)?;
    //     log::debug!("mongosh {} 下载 URL: {:?}", mongosh_version, urls);

    //     let install_path = self.get_install_path(mongodb_version);
    //     let mongosh_task_id = format!("mongosh-{}", mongodb_version);
    //     let download_manager = DownloadManager::global();

    //     // 同步下载 mongosh（不使用回调，因为这是在 MongoDB 安装完成后执行的）
    //     download_manager
    //         .start_download(
    //             mongosh_task_id.clone(),
    //             urls,
    //             install_path.clone(),
    //             filename.clone(),
    //             false, // 不需要持久化，这是临时下载
    //             None,  // 不需要回调
    //         )
    //         .await?;

    //     // 等待下载完成
    //     let max_wait = 120; // 最多等待 120 秒
    //     for _ in 0..max_wait {
    //         tokio::time::sleep(Duration::from_secs(1)).await;

    //         if let Some(task) = download_manager.get_task_status(&mongosh_task_id) {
    //             match task.status {
    //                 crate::manager::services::DownloadStatus::Installed => {
    //                     log::info!("mongosh 下载完成，开始安装");

    //                     // 解压安装 mongosh 到 MongoDB 的 bin 目录
    //                     self.extract_mongosh(&task.target_path, &filename, mongodb_version).await?;
    //                     log::info!("mongosh 安装完成");
    //                     return Ok(());
    //                 }
    //                 crate::manager::services::DownloadStatus::Failed => {
    //                     return Err(anyhow!("mongosh 下载失败: {}", task.error_message.unwrap_or_default()));
    //                 }
    //                 _ => {
    //                     // 继续等待
    //                 }
    //             }
    //         }
    //     }

    //     Err(anyhow!("mongosh 下载超时"))
    // }

    /// 解压 mongosh 到 MongoDB 的 bin 目录
    async fn extract_mongosh(
        &self,
        archive_path: &PathBuf,
        filename: &str,
        mongodb_version: &str,
    ) -> Result<()> {
        log::info!("开始解压 mongosh: {:?}", archive_path);

        let install_dir = self.get_install_path(mongodb_version);
        let bin_dir = install_dir.join("bin");
        std::fs::create_dir_all(&bin_dir)?;

        // 检查压缩文件是否存在
        if !archive_path.exists() {
            return Err(anyhow!("mongosh 压缩文件不存在: {:?}", archive_path));
        }
        log::info!(
            "mongosh 压缩文件大小: {} 字节",
            archive_path.metadata()?.len()
        );

        // 创建临时解压目录
        let temp_dir = install_dir.join("temp_mongosh");
        // 如果临时目录已存在，先删除
        if temp_dir.exists() {
            std::fs::remove_dir_all(&temp_dir)?;
        }
        std::fs::create_dir_all(&temp_dir)?;

        // 解压文件
        if filename.ends_with(".zip") {
            log::info!("使用 unzip 解压 mongosh...");
            let output = Command::new("unzip")
                .args(&[
                    "-q",
                    "-o", // 覆盖已存在的文件
                    &archive_path.to_string_lossy(),
                    "-d",
                    &temp_dir.to_string_lossy(),
                ])
                .output()?;
            if !output.status.success() {
                return Err(anyhow!(
                    "解压 mongosh 失败: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
            log::info!("mongosh 解压成功");
        } else if filename.ends_with(".tgz") || filename.ends_with(".tar.gz") {
            log::info!("使用 tar 解压 mongosh...");
            let output = Command::new("tar")
                .args(&[
                    "-xzf",
                    &archive_path.to_string_lossy(),
                    "-C",
                    &temp_dir.to_string_lossy(),
                ])
                .output()?;
            if !output.status.success() {
                return Err(anyhow!(
                    "解压 mongosh 失败: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
            log::info!("mongosh 解压成功");
        }

        // 查找解压后的 mongosh 可执行文件
        let mongosh_exe = if cfg!(target_os = "windows") {
            "mongosh.exe"
        } else {
            "mongosh"
        };

        let mut found_mongosh: Option<PathBuf> = None;
        for entry in walkdir::WalkDir::new(&temp_dir)
            .max_depth(5)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let p = entry.path();
            if p.is_file() {
                if let Some(name) = p.file_name().and_then(|s| s.to_str()) {
                    if name == mongosh_exe {
                        found_mongosh = Some(p.to_path_buf());
                        break;
                    }
                }
            }
        }

        if let Some(mongosh_path) = found_mongosh {
            // 复制 mongosh 到 MongoDB 的 bin 目录
            let dest = bin_dir.join(mongosh_exe);
            std::fs::copy(&mongosh_path, &dest)?;

            // 设置可执行权限（Unix 系统）
            #[cfg(not(target_os = "windows"))]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = std::fs::metadata(&dest)?.permissions();
                perms.set_mode(0o755);
                std::fs::set_permissions(&dest, perms)?;
            }

            log::info!("mongosh 已复制到: {}", dest.display());
        } else {
            return Err(anyhow!("未找到 mongosh 可执行文件"));
        }

        // 清理临时目录和下载文件
        std::fs::remove_dir_all(&temp_dir)?;
        if archive_path.exists() {
            std::fs::remove_file(archive_path)?;
        }

        Ok(())
    }

    /// 解压并安装 MongoDB，示例实现：对 tgz 使用 tar 解压，对 zip 使用 unzip
    pub async fn extract_and_install(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let archive_path = &task.target_path;
        let install_dir = self.get_install_path(version);
        std::fs::create_dir_all(&install_dir)?;
        use std::process::Command;

        if task.filename.ends_with(".tgz") || task.filename.ends_with(".tar.gz") {
            // 支持 .tgz/.tar.gz 的解压，注意 strip-components 可能需要根据包内目录结构调整
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

        // 有时候二进制位于子目录（如 mongodb-macos-x64/bin），尝试查找 mongod 并如果不在根目录则将其移动到 install_dir/bin
        let mut found_mongod: Option<PathBuf> = None;
        // 先在 install_dir/bin 查找
        let candidate = install_dir
            .join("bin")
            .join(if cfg!(target_os = "windows") {
                "mongod.exe"
            } else {
                "mongod"
            });
        if candidate.exists() {
            found_mongod = Some(candidate);
        } else {
            // 深度遍历一次查找可执行文件
            for entry in walkdir::WalkDir::new(&install_dir)
                .max_depth(4)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let p = entry.path();
                if p.is_file() {
                    if let Some(name) = p.file_name().and_then(|s| s.to_str()) {
                        if name == "mongod" || name == "mongod.exe" {
                            found_mongod = Some(p.to_path_buf());
                            break;
                        }
                    }
                }
            }
        }

        if let Some(mongod_path) = found_mongod {
            // 如果 mongod 不在 expected bin 目录，则尝试创建 bin 并移动
            let expected_bin = install_dir.join("bin");
            std::fs::create_dir_all(&expected_bin)?;
            let dest = expected_bin.join(mongod_path.file_name().unwrap());
            if mongod_path != dest {
                std::fs::rename(&mongod_path, &dest)?;
            }
            // 设置可执行权限
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

    /// 获取 MongoDB 服务运行状态（基于 mongod 进程的检测）
    pub fn get_service_status(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        let mongod = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mongod.exe")
        } else {
            install_path.join("bin").join("mongod")
        };

        if !mongod.exists() {
            return Ok(ServiceDataResult {
                success: false,
                message: "mongod 可执行文件不存在".to_string(),
                data: None,
            });
        }

        // 先尝试从 metadata 指定的配置文件路径读取，否则使用安装目录下的 mongod.conf
        let config_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_CONFIG"))
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| install_path.join("mongod.conf"));

        // 默认值
        let mut port = "27017".to_string();
        let mut bind_ip = "127.0.0.1".to_string();

        // 使用 serde_yaml 解析 MongoDB 配置文件
        if config_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&config_path) {
                // 尝试解析 YAML
                if let Ok(yaml_value) = serde_yaml::from_str::<serde_yaml::Value>(&content) {
                    // 尝试提取 net.port
                    if let Some(net) = yaml_value.get("net") {
                        if let Some(port_value) = net.get("port") {
                            if let Some(p) = port_value.as_u64() {
                                port = p.to_string();
                            } else if let Some(p) = port_value.as_str() {
                                port = p.to_string();
                            }
                        }

                        // 尝试提取 net.bindIp 或 net.bind_ip
                        if let Some(bind_ip_value) =
                            net.get("bindIp").or_else(|| net.get("bind_ip"))
                        {
                            if let Some(ip) = bind_ip_value.as_str() {
                                bind_ip = ip.to_string();
                            }
                        }
                    }
                }
            }
        }

        // 检查是否有 mongod 进程在指定端口运行（优先使用端口检测）
        let running = if cfg!(target_os = "windows") {
            // Windows: 继续使用 tasklist 判断 mongod.exe 是否存在（更可靠且避免复杂的 netstat->pid->映射）
            let output = Command::new("tasklist")
                .arg("/FI")
                .arg("IMAGENAME eq mongod.exe")
                .output();
            match output {
                Ok(o) => String::from_utf8_lossy(&o.stdout).contains("mongod.exe"),
                Err(_) => false,
            }
        } else {
            // Unix-like: 首先尝试用 lsof 检查端口占用并判断是否由 mongod 占用
            // log::info!("Unix-like: 使用 lsof 检查端口 {}", port);
            let port_arg = format!(":{}", port);
            let output = Command::new("lsof")
                .arg("-iTCP")
                .arg(&port_arg)
                .arg("-sTCP:LISTEN")
                .output();

            match output {
                Ok(o) => {
                    let stdout = String::from_utf8_lossy(&o.stdout);
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    // log::debug!("lsof stdout: {}", stdout);
                    if !stderr.is_empty() {
                        // log::debug!("lsof stderr: {}", stderr);
                    }

                    // 有时 lsof 输出会包含完整命令/可执行名，检查是否包含 mongod
                    if stdout.contains("mongod") {
                        // log::info!("检测到 mongod 在端口 {} 上监听", port);
                        true
                    } else if !stdout.trim().is_empty() {
                        // 如果 lsof 有输出但不包含 mongod，说明端口被其他程序占用
                        // log::warn!(
                        //     "端口 {} 被其他进程占用（lsof 输出非空但未包含 mongod）：{}",
                        //     port,
                        //     stdout.lines().next().unwrap_or("...")
                        // );
                        false
                    } else {
                        // log::info!("lsof 未返回监听信息，回退到 pgrep 检查 mongod 进程");
                        let output = Command::new("pgrep").arg("-x").arg("mongod").output();
                        match output {
                            Ok(o2) => {
                                let stdout2 = String::from_utf8_lossy(&o2.stdout);
                                // log::debug!("pgrep stdout: {}", stdout2);
                                if o2.status.success() && !stdout2.is_empty() {
                                    // log::info!("pgrep 检测到 mongod 进程存在");
                                    true
                                } else {
                                    // log::info!("pgrep 未检测到 mongod 进程");
                                    false
                                }
                            }
                            Err(e2) => {
                                // log::error!("执行 pgrep 失败: {}", e2);
                                false
                            }
                        }
                    }
                }
                Err(e) => {
                    // 如果 lsof 不可用，回退到 pgrep 检查进程名（不基于端口）
                    // log::warn!("执行 lsof 失败: {}，回退到 pgrep 检查 mongod 进程", e);
                    let output = Command::new("pgrep").arg("-x").arg("mongod").output();
                    match output {
                        Ok(o) => {
                            let stdout = String::from_utf8_lossy(&o.stdout);
                            // log::debug!("pgrep stdout: {}", stdout);
                            let found = o.status.success() && !stdout.is_empty();
                            if found {
                                // log::info!("pgrep 检测到 mongod 进程");
                            } else {
                                // log::info!("pgrep 未检测到 mongod 进程");
                            }
                            found
                        }
                        Err(e2) => {
                            // log::error!("执行 pgrep 也失败: {}", e2);
                            false
                        }
                    }
                }
            }
        };

        let status = if running {
            ServiceStatus::Running
        } else {
            ServiceStatus::Stopped
        };
        let data = serde_json::json!({
            "isRunning": running,
            "status": status,
            "port": port,
            "bindIp": bind_ip,
            "configPath": config_path.to_string_lossy().to_string(),
        });

        Ok(ServiceDataResult {
            success: true,
            message: "获取状态成功".to_string(),
            data: Some(data),
        })
    }

    /// 启动 MongoDB 服务（使用配置文件启动）
    pub fn start_service(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        log::info!("==================== 开始启动 MongoDB 服务 ====================");
        log::info!("环境 ID: {}", environment_id);
        log::info!("服务数据: {:?}", service_data);

        let version = &service_data.version;
        log::info!("MongoDB 版本: {}", version);

        let install_path = self.get_install_path(version);
        log::info!("安装路径: {:?}", install_path);

        let mongod = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mongod.exe")
        } else {
            install_path.join("bin").join("mongod")
        };
        log::info!("mongod 可执行文件路径: {:?}", mongod);

        if !mongod.exists() {
            log::error!("mongod 可执行文件不存在: {:?}", mongod);
            return Ok(ServiceDataResult {
                success: false,
                message: "mongod 可执行文件不存在".to_string(),
                data: None,
            });
        }
        log::info!("mongod 可执行文件存在，继续启动流程");

        // 从 metadata 读取配置文件路径
        let config_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_CONFIG"))
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| install_path.join("mongod.conf"));
        log::info!("配置文件路径: {:?}", config_path);

        // 如果配置文件不存在，直接报错（不再自动生成默认配置）
        if !config_path.exists() {
            log::error!("配置文件不存在: {:?}", config_path);
            return Ok(ServiceDataResult {
                success: false,
                message: format!("配置文件不存在: {}", config_path.display()),
                data: None,
            });
        }
        log::info!("配置文件存在: {:?}", config_path);

        // 确保配置文件中指定的目录存在
        log::info!("检查并创建配置文件中指定的目录...");
        self.ensure_config_directories(&config_path)?;
        log::info!("目录检查完成");

        // 根据操作系统构建启动命令
        let os_type = if cfg!(target_os = "windows") {
            "Windows"
        } else if cfg!(target_os = "macos") {
            "macOS"
        } else {
            "Linux"
        };
        log::info!("检测到操作系统: {}", os_type);

        let child_res = if cfg!(target_os = "windows") {
            // Windows: 直接启动，不使用 --fork
            log::info!("使用 Windows 启动模式（不使用 --fork）");
            log::info!("启动命令: {:?} --config {:?}", mongod, config_path);
            Command::new(&mongod)
                .arg("--config")
                .arg(&config_path)
                .spawn()
        } else if cfg!(target_os = "macos") {
            // macOS: 不支持 --fork，使用后台进程方式
            log::info!("使用 macOS 启动模式（后台进程，重定向输入输出）");
            log::info!("启动命令: {:?} --config {:?}", mongod, config_path);
            Command::new(&mongod)
                .arg("--config")
                .arg(&config_path)
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()
        } else {
            // Linux: 可以在配置文件中指定 fork: true
            log::info!("使用 Linux 启动模式");
            log::info!("启动命令: {:?} --config {:?}", mongod, config_path);
            Command::new(&mongod)
                .arg("--config")
                .arg(&config_path)
                .spawn()
        };

        match child_res {
            Ok(child) => {
                log::info!("MongoDB 进程已启动，PID: {:?}", child.id());
                log::info!("等待 500ms 让服务完成初始化...");

                // 等待一小段时间让服务启动
                std::thread::sleep(Duration::from_millis(500));

                log::info!("MongoDB 启动流程完成");
                log::info!("==================== MongoDB 服务启动成功 ====================");

                Ok(ServiceDataResult {
                    success: true,
                    message: format!(
                        "MongoDB 启动命令已发送（使用配置文件: {}）",
                        config_path.display()
                    ),
                    data: Some(serde_json::json!({
                        "configPath": config_path.to_string_lossy().to_string(),
                    })),
                })
            }
            Err(e) => {
                log::error!("MongoDB 启动失败: {}", e);
                log::error!("==================== MongoDB 服务启动失败 ====================");

                Ok(ServiceDataResult {
                    success: false,
                    message: format!("启动失败: {}", e),
                    data: None,
                })
            }
        }
    }

    /// 确保配置文件中指定的目录存在
    fn ensure_config_directories(&self, config_path: &PathBuf) -> Result<()> {
        if !config_path.exists() {
            return Ok(());
        }

        let content = std::fs::read_to_string(config_path)?;
        if let Ok(yaml_value) = serde_yaml::from_str::<serde_yaml::Value>(&content) {
            // 确保 storage.dbPath 目录存在
            if let Some(storage) = yaml_value.get("storage") {
                if let Some(db_path) = storage.get("dbPath") {
                    if let Some(path_str) = db_path.as_str() {
                        let path = PathBuf::from(path_str);
                        if !path.exists() {
                            log::info!("创建数据目录: {:?}", path);
                            std::fs::create_dir_all(&path)?;
                        }
                    }
                }
            }

            // 确保 systemLog.path 的父目录存在
            if let Some(system_log) = yaml_value.get("systemLog") {
                if let Some(log_path) = system_log.get("path") {
                    if let Some(path_str) = log_path.as_str() {
                        let path = PathBuf::from(path_str);
                        if let Some(parent) = path.parent() {
                            if !parent.exists() {
                                log::info!("创建日志目录: {:?}", parent);
                                std::fs::create_dir_all(parent)?;
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    pub fn stop_service(
        &self,
        environment_id: &str,
        _service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        log::info!("==================== 开始停止 MongoDB 服务 ====================");
        log::info!("环境 ID: {}", environment_id);

        let os_type = if cfg!(target_os = "windows") {
            "Windows"
        } else {
            "Unix-like (macOS/Linux)"
        };
        log::info!("检测到操作系统: {}", os_type);

        let res = if cfg!(target_os = "windows") {
            // Windows: 使用 taskkill
            log::info!("使用 Windows taskkill 命令停止 MongoDB");
            log::info!("执行命令: taskkill /IM mongod.exe /F");

            let output = Command::new("taskkill")
                .args(&["/IM", "mongod.exe", "/F"])
                .output();

            if let Ok(ref o) = output {
                let stdout = String::from_utf8_lossy(&o.stdout);
                let stderr = String::from_utf8_lossy(&o.stderr);
                log::info!("taskkill 标准输出: {}", stdout);
                if !stderr.is_empty() {
                    log::warn!("taskkill 标准错误: {}", stderr);
                }
            }

            output
        } else {
            // Unix-like: 优先使用 pkill -x 精确匹配进程名
            // -x 表示精确匹配进程名，避免误杀其他包含 mongod 的进程
            log::info!("使用 Unix pkill 命令停止 MongoDB");
            log::info!("执行命令: pkill -x mongod");
            log::info!("说明: -x 参数确保只终止名称完全匹配 'mongod' 的进程");

            let output = Command::new("pkill").args(&["-x", "mongod"]).output();

            if let Ok(ref o) = output {
                let stdout = String::from_utf8_lossy(&o.stdout);
                let stderr = String::from_utf8_lossy(&o.stderr);
                if !stdout.is_empty() {
                    log::info!("pkill 标准输出: {}", stdout);
                }
                if !stderr.is_empty() {
                    log::warn!("pkill 标准错误: {}", stderr);
                }
            }

            output
        };

        match res {
            Ok(o) => {
                // pkill 返回 0 表示成功，1 表示没有找到进程，2+ 表示错误
                let exit_code = o.status.code().unwrap_or(-1);
                log::info!("命令执行完成，退出码: {}", exit_code);

                if exit_code == 0 || exit_code == 1 {
                    // 0 = 成功停止, 1 = 进程不存在(也算成功)
                    if exit_code == 0 {
                        log::info!("MongoDB 进程已成功终止");
                    } else {
                        log::info!("MongoDB 进程不存在或已停止（退出码 1）");
                    }
                    log::info!("==================== MongoDB 服务停止成功 ====================");

                    Ok(ServiceDataResult {
                        success: true,
                        message: "停止 MongoDB 成功".to_string(),
                        data: None,
                    })
                } else {
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    log::error!("停止 MongoDB 失败，退出码: {}", exit_code);
                    log::error!("错误信息: {}", stderr);
                    log::error!("==================== MongoDB 服务停止失败 ====================");

                    Ok(ServiceDataResult {
                        success: false,
                        message: format!("停止失败(exit {}): {}", exit_code, stderr),
                        data: None,
                    })
                }
            }
            Err(e) => {
                log::error!("执行停止命令时发生错误: {}", e);
                log::error!("可能的原因: 1) 命令不存在 2) 权限不足 3) 系统错误");
                log::error!("==================== MongoDB 服务停止失败 ====================");

                Ok(ServiceDataResult {
                    success: false,
                    message: format!("停止命令失败: {}", e),
                    data: None,
                })
            }
        }
    }

    pub fn restart_service(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let _ = self.stop_service(environment_id, service_data);
        // 小延迟
        std::thread::sleep(Duration::from_millis(300));
        self.start_service(environment_id, service_data)
    }

    // 配置相关操作:直接返回配置文件内容字符串
    pub fn get_mongodb_config(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        let service_data_folder = self.get_service_data_folder(environment_id, version);

        // 从 metadata 读取配置文件路径
        let config_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_CONFIG"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let config_path = if config_path.is_empty() {
            service_data_folder.join("mongod.conf")
        } else {
            PathBuf::from(config_path)
        };

        // 读取配置文件内容
        let config_content = if config_path.exists() {
            std::fs::read_to_string(&config_path)
                .unwrap_or_else(|e| format!("读取配置文件失败: {}", e))
        } else {
            String::new()
        };

        let data = serde_json::json!({
            "configPath": config_path.to_string_lossy().to_string(),
            "content": config_content,
        });

        Ok(ServiceDataResult {
            success: true,
            message: "获取 MongoDB 配置成功".to_string(),
            data: Some(data),
        })
    }

    /// 取消下载
    pub fn cancel_download(&self, version: &str) -> Result<()> {
        let task_id = format!("mongodb-{}", version);
        let download_manager = DownloadManager::global();
        download_manager.cancel_download(&task_id)
    }

    /// 获取下载进度
    pub fn get_download_progress(&self, version: &str) -> Option<DownloadTask> {
        let task_id = format!("mongodb-{}", version);
        let download_manager = DownloadManager::global();
        download_manager.get_task_status(&task_id)
    }

    /// 打开 MongoDB Compass（尝试使用系统默认的 Compass 应用）
    pub fn open_compass(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);

        // 从 metadata 读取配置文件路径
        let config_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_CONFIG"))
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| install_path.join("mongod.conf"));

        // 解析配置获取端口和绑定地址
        let mut port = "27017".to_string();
        let mut bind_ip = "127.0.0.1".to_string();

        if config_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&config_path) {
                if let Ok(config) = serde_yaml::from_str::<serde_json::Value>(&content) {
                    if let Some(net) = config.get("net") {
                        if let Some(p) = net.get("port") {
                            port = p.to_string();
                        }
                        if let Some(ip) = net.get("bindIp") {
                            bind_ip = ip.as_str().unwrap_or("127.0.0.1").to_string();
                        }
                    }
                }
            }
        }

        // 构建连接字符串
        let connection_string = format!("mongodb://{}:{}", bind_ip, port);

        // 根据操作系统打开 MongoDB Compass
        let result = if cfg!(target_os = "macos") {
            // macOS: 使用 open 命令打开 Compass，并传递连接字符串
            Command::new("open")
                .arg("-a")
                .arg("MongoDB Compass")
                .arg("--args")
                .arg(&connection_string)
                .spawn()
        } else if cfg!(target_os = "windows") {
            // Windows: 尝试直接启动 MongoDBCompass.exe
            Command::new("cmd")
                .args(&["/C", "start", "mongodb-compass://", &connection_string])
                .spawn()
        } else {
            // Linux: 尝试使用 mongodb-compass 命令
            Command::new("mongodb-compass")
                .arg(&connection_string)
                .spawn()
        };

        match result {
            Ok(_) => Ok(ServiceDataResult {
                success: true,
                message: "MongoDB Compass 已打开".to_string(),
                data: Some(serde_json::json!({
                    "connectionString": connection_string,
                })),
            }),
            Err(e) => Ok(ServiceDataResult {
                success: false,
                message: format!(
                    "无法打开 MongoDB Compass: {}。请确保已安装 MongoDB Compass。",
                    e
                ),
                data: None,
            }),
        }
    }

    /// 打开 Mongo Shell（使用安装目录中的 mongosh 或系统的 mongosh）
    pub fn open_shell(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let version = &service_data.version;
        let install_path = self.get_install_path(version);

        // 从 metadata 读取配置文件路径
        let config_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_CONFIG"))
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| install_path.join("mongod.conf"));

        // 解析配置获取端口和绑定地址
        let mut port = "27017".to_string();
        let mut bind_ip = "127.0.0.1".to_string();

        if config_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&config_path) {
                if let Ok(config) = serde_yaml::from_str::<serde_json::Value>(&content) {
                    if let Some(net) = config.get("net") {
                        if let Some(p) = net.get("port") {
                            port = p.to_string();
                        }
                        if let Some(ip) = net.get("bindIp") {
                            bind_ip = ip.as_str().unwrap_or("127.0.0.1").to_string();
                        }
                    }
                }
            }
        }

        // 构建连接字符串
        let connection_string = format!("mongodb://{}:{}", bind_ip, port);

        // 检查是否有 mongosh（新版本的 Shell）
        let mongosh_in_bin = install_path
            .join("bin")
            .join(if cfg!(target_os = "windows") {
                "mongosh.exe"
            } else {
                "mongosh"
            });
        let mongo_in_bin = install_path
            .join("bin")
            .join(if cfg!(target_os = "windows") {
                "mongo.exe"
            } else {
                "mongo"
            });

        // 根据操作系统打开终端并运行 mongo shell
        let result = if cfg!(target_os = "macos") {
            // macOS: 使用 Terminal.app
            let shell_cmd = if mongosh_in_bin.exists() {
                format!("{} {}", mongosh_in_bin.display(), connection_string)
            } else if mongo_in_bin.exists() {
                format!("{} {}", mongo_in_bin.display(), connection_string)
            } else {
                format!("mongosh {}", connection_string)
            };

            Command::new("osascript")
                .arg("-e")
                .arg(format!(
                    "tell application \"Terminal\" to do script \"{}\"",
                    shell_cmd
                ))
                .arg("-e")
                .arg("tell application \"Terminal\" to activate")
                .spawn()
        } else if cfg!(target_os = "windows") {
            // Windows: 使用 cmd
            let shell_cmd = if mongosh_in_bin.exists() {
                mongosh_in_bin.to_string_lossy().to_string()
            } else if mongo_in_bin.exists() {
                mongo_in_bin.to_string_lossy().to_string()
            } else {
                "mongosh".to_string()
            };

            Command::new("cmd")
                .args(&["/C", "start", "cmd", "/K", &shell_cmd, &connection_string])
                .spawn()
        } else {
            // Linux: 尝试使用 gnome-terminal 或 xterm
            let shell_cmd = if mongosh_in_bin.exists() {
                mongosh_in_bin.to_string_lossy().to_string()
            } else if mongo_in_bin.exists() {
                mongo_in_bin.to_string_lossy().to_string()
            } else {
                "mongosh".to_string()
            };

            Command::new("gnome-terminal")
                .arg("--")
                .arg(&shell_cmd)
                .arg(&connection_string)
                .spawn()
                .or_else(|_| {
                    Command::new("xterm")
                        .arg("-e")
                        .arg(format!("{} {}", shell_cmd, connection_string))
                        .spawn()
                })
        };

        match result {
            Ok(_) => Ok(ServiceDataResult {
                success: true,
                message: "Mongo Shell 已打开".to_string(),
                data: Some(serde_json::json!({
                    "connectionString": connection_string,
                })),
            }),
            Err(e) => Ok(ServiceDataResult {
                success: false,
                message: format!(
                    "无法打开 Mongo Shell: {}。请确保已安装 mongosh 或 mongo。",
                    e
                ),
                data: None,
            }),
        }
    }

    /// 初始化 MongoDB 服务
    /// 创建必要的配置文件、keyfile、数据目录等
    pub fn initialize_mongodb(
        &self,
        app_handle: &AppHandle,
        environment_id: &str,
        service_data: &ServiceData,
        admin_username: String,
        admin_password: String,
        port: Option<String>,
        bind_ip: Option<String>,
        enable_replica_set: bool,
        reset: bool,
    ) -> Result<ServiceDataResult> {
        // 辅助函数：发送进度事件
        let emit_progress = |step: &str, message: &str| {
            let full_message = format!("MongoDB: {}", message);
            let _ = app_handle.emit(
                "mongodb-init-progress",
                serde_json::json!({
                    "step": step,
                    "message": full_message,
                }),
            );
            log::info!("[MongoDB 初始化进度] {}: {}", step, message);
        };

        let version = &service_data.version;
        let install_path = self.get_install_path(version);
        let service_data_folder = self.get_service_data_folder(environment_id, version);

        // 步骤 0: 检查 MongoDB 是否已安装
        emit_progress("mongodb_check_installation", "检查安装状态...");
        let mongod = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mongod.exe")
        } else {
            install_path.join("bin").join("mongod")
        };

        if !mongod.exists() {
            emit_progress("mongodb_check_installation", "未安装");
            return Ok(ServiceDataResult {
                success: false,
                message: format!("MongoDB {} 未安装，请先下载并安装", version),
                data: Some(serde_json::json!({
                    "step": "mongodb_check_installation",
                    "error": "MongoDB 未安装"
                })),
            });
        }
        emit_progress("mongodb_check_installation", "已安装");

        // 如果是重置,先清理现有数据,但保留该空文件夹本身,因为文件夹本身就代表了一个服务数据
        // 且保留根目录下的 service.json 文件（不要删除）
        if reset && service_data_folder.exists() {
            emit_progress("mongodb_reset", "清理现有数据...");
            log::info!("重置模式：清理现有数据（保留空文件夹及 service.json）...");
            std::fs::read_dir(&service_data_folder)
                .map_err(|e| anyhow!("读取服务数据目录失败: {}", e))?
                .for_each(|entry_res| {
                    if let Ok(entry) = entry_res {
                        let path = entry.path();
                        // 保留根目录下的 service.json
                        if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
                            if name == "service.json" {
                                return;
                            }
                        }
                        // 跳过符号链接的特殊处理可以按需添加
                        let _ = if path.is_dir() {
                            std::fs::remove_dir_all(&path)
                        } else {
                            std::fs::remove_file(&path)
                        };
                    }
                });
            emit_progress("mongodb_reset", "数据清理完成");
        }

        // 检查是否已初始化（非重置模式）
        if !reset {
            emit_progress("mongodb_check_existing", "检查初始化状态...");
            if self.is_initialized(environment_id, service_data) {
                emit_progress("mongodb_check_existing", "已初始化");
                return Ok(ServiceDataResult {
                    success: false,
                    message: "MongoDB 已经初始化，如需重新初始化请使用重置功能".to_string(),
                    data: Some(serde_json::json!({
                        "step": "mongodb_check_existing",
                        "error": "已初始化"
                    })),
                });
            }
            emit_progress("mongodb_check_existing", "未初始化，继续执行初始化流程");
        }

        let port = port.unwrap_or_else(|| "27017".to_string());
        let bind_ip = bind_ip.unwrap_or_else(|| "127.0.0.1".to_string());

        // 步骤 1: 创建目录结构
        emit_progress("mongodb_create_directories", "创建目录结构...");
        log::info!("步骤 1/6: 创建目录结构...");
        std::fs::create_dir_all(&service_data_folder)
            .map_err(|e| anyhow!("创建服务数据目录失败: {}", e))?;

        let data_dir = service_data_folder.join("data");
        std::fs::create_dir_all(&data_dir).map_err(|e| anyhow!("创建数据目录失败: {}", e))?;

        let log_dir = service_data_folder.join("logs");
        std::fs::create_dir_all(&log_dir).map_err(|e| anyhow!("创建日志目录失败: {}", e))?;
        emit_progress("mongodb_create_directories", "目录结构创建完成");

        // 步骤 2: 生成 keyfile（仅在副本集模式下需要）
        let keyfile_path = if enable_replica_set {
            emit_progress("mongodb_create_keyfile", "生成安全密钥文件...");
            log::info!("步骤 2/6: 生成安全密钥文件...");
            let keyfile_path = service_data_folder.join("mongodb-keyfile");
            self.create_keyfile(&keyfile_path)
                .map_err(|e| anyhow!("创建 keyfile 失败: {}", e))?;
            emit_progress("mongodb_create_keyfile", "安全密钥文件生成完成");
            keyfile_path
        } else {
            emit_progress("mongodb_create_keyfile", "跳过 keyfile 生成（单机模式）");
            log::info!("步骤 2/6: 跳过 keyfile 生成（单机模式不需要）");
            PathBuf::new() // 空路径，不会被使用
        };

        // 步骤 3: 创建配置文件
        emit_progress("mongodb_create_config", "创建配置文件...");
        log::info!("步骤 3/6: 创建配置文件...");
        let config_path = service_data_folder.join("mongod.conf");
        self.create_default_config(
            &config_path,
            &data_dir,
            &log_dir,
            &keyfile_path,
            &port,
            &bind_ip,
            enable_replica_set,
        )
        .map_err(|e| anyhow!("创建配置文件失败: {}", e))?;
        emit_progress("mongodb_create_config", "配置文件创建完成");

        // 步骤 4: 创建管理员用户
        emit_progress("mongodb_create_admin", "启动临时实例并创建管理员用户...");
        log::info!("步骤 4/6: 启动临时实例并创建管理员用户...");
        let temp_port = "27018"; // 使用临时端口避免冲突
        let init_result = self.initialize_with_admin_user(
            &mongod,
            &data_dir,
            &log_dir,
            temp_port,
            &admin_username,
            &admin_password,
        );

        if let Err(e) = init_result {
            emit_progress(
                "mongodb_create_admin",
                &format!("创建管理员用户失败: {}", e),
            );
            let _ = std::fs::remove_dir_all(&service_data_folder);
            return Ok(ServiceDataResult {
                success: false,
                message: format!("创建管理员用户失败: {}", e),
                data: Some(serde_json::json!({
                    "step": "mongodb_create_admin",
                    "error": e.to_string()
                })),
            });
        }
        emit_progress("mongodb_create_admin", "管理员用户创建完成");

        // 步骤 5: 初始化副本集（如果启用）
        let replica_set_initialized = if enable_replica_set {
            emit_progress("mongodb_init_replica_set", "初始化副本集...");
            log::info!("步骤 5/6: 初始化副本集...");
            let replica_result = self.initialize_replica_set(
                &mongod,
                &config_path,
                &log_dir,
                &admin_username,
                &admin_password,
                &port,
            );

            if let Err(e) = replica_result {
                emit_progress(
                    "mongodb_init_replica_set",
                    &format!("副本集初始化失败: {}. 服务可正常使用", e),
                );
                log::warn!(
                    "副本集初始化失败: {}. 服务可正常使用，但建议手动执行 rs.initiate()",
                    e
                );
                false
            } else {
                emit_progress("mongodb_init_replica_set", "副本集初始化完成");
                true
            }
        } else {
            emit_progress("mongodb_init_replica_set", "跳过副本集初始化（未启用）");
            log::info!("步骤 5/6: 跳过副本集初始化（未启用）");
            false
        };

        emit_progress("mongodb_complete", "初始化完成！");
        log::info!("MongoDB 初始化完成！");

        Ok(ServiceDataResult {
            success: true,
            message: "MongoDB 初始化成功".to_string(),
            data: Some(serde_json::json!({
                "configPath": config_path.to_string_lossy().to_string(),
                "dataPath": data_dir.to_string_lossy().to_string(),
                "logPath": log_dir.to_string_lossy().to_string(),
                "keyfilePath": if enable_replica_set { keyfile_path.to_string_lossy().to_string() } else { "".to_string() },
                "adminUsername": admin_username,
                "adminPassword": admin_password,
                "port": port,
                "bindIp": bind_ip,
                "replicaSetInitialized": replica_set_initialized,
            })),
        })
    }

    /// 创建 keyfile
    fn create_keyfile(&self, keyfile_path: &PathBuf) -> Result<()> {
        use base64::{engine::general_purpose, Engine as _};
        use rand::Rng;

        // 生成 1024 字节的随机密钥（Base64 编码）
        let mut rng = rand::thread_rng();
        let key: Vec<u8> = (0..756).map(|_| rng.gen()).collect(); // 756 bytes -> ~1024 chars in base64
        let key_base64 = general_purpose::STANDARD.encode(&key);

        // 写入 keyfile
        std::fs::write(keyfile_path, key_base64)?;

        // 设置权限（Unix 系统需要 400）
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(keyfile_path)?.permissions();
            perms.set_mode(0o400);
            std::fs::set_permissions(keyfile_path, perms)?;
        }

        Ok(())
    }

    /// 创建默认配置文件
    fn create_default_config(
        &self,
        config_path: &PathBuf,
        data_dir: &PathBuf,
        log_dir: &PathBuf,
        keyfile_path: &PathBuf,
        port: &str,
        bind_ip: &str,
        enable_replica_set: bool,
    ) -> Result<()> {
        let log_file = log_dir.join("mongod.log");

        // 根据是否启用副本集生成不同的配置
        let config_content = if enable_replica_set {
            format!(
                r#"# MongoDB Configuration File

# Where and how to store data.
storage:
  dbPath: {}

# Where to write logging data.
systemLog:
  destination: file
  logAppend: true
  path: {}

# Network interfaces
net:
  port: {}
  bindIp: {}

# Security
security:
  authorization: enabled
  keyFile: {}

# Replication
replication:
  replSetName: rs0
"#,
                data_dir.to_string_lossy().replace('\\', "/"),
                log_file.to_string_lossy().replace('\\', "/"),
                port,
                bind_ip,
                keyfile_path.to_string_lossy().replace('\\', "/")
            )
        } else {
            // 单机模式：不需要 keyFile 和副本集配置
            format!(
                r#"# MongoDB Configuration File

# Where and how to store data.
storage:
  dbPath: {}

# Where to write logging data.
systemLog:
  destination: file
  logAppend: true
  path: {}

# Network interfaces
net:
  port: {}
  bindIp: {}

# Security
security:
  authorization: enabled
"#,
                data_dir.to_string_lossy().replace('\\', "/"),
                log_file.to_string_lossy().replace('\\', "/"),
                port,
                bind_ip
            )
        };

        std::fs::write(config_path, config_content)?;
        Ok(())
    }

    /// 使用管理员用户初始化 MongoDB
    fn initialize_with_admin_user(
        &self,
        mongod: &PathBuf,
        data_dir: &PathBuf,
        log_dir: &PathBuf,
        port: &str,
        admin_username: &str,
        admin_password: &str,
    ) -> Result<()> {
        log::info!("开始创建管理员用户 (用户名: {})", admin_username);

        let log_file = log_dir.join("mongod-init.log");

        // 启动 MongoDB（无认证，无副本集）
        let mongod_args: Vec<String> = vec![
            "--dbpath".to_string(),
            data_dir.to_string_lossy().to_string(),
            "--port".to_string(),
            port.to_string(),
            "--bind_ip".to_string(),
            "127.0.0.1".to_string(),
            "--logpath".to_string(),
            log_file.to_string_lossy().to_string(),
            "--logappend".to_string(),
        ];

        log::info!("启动临时 MongoDB 实例...");
        log::info!("启动命令: {} {}", mongod.display(), mongod_args.join(" "));

        let mut child = Command::new(mongod)
            .args(&mongod_args)
            .spawn()
            .map_err(|e| anyhow!("启动临时 MongoDB 实例失败: {}", e))?;

        // 等待 MongoDB 启动
        log::info!("等待 MongoDB 启动 (3秒)...");
        std::thread::sleep(Duration::from_secs(3));

        // 使用 mongosh (与 mongod 在同一个 bin 目录下)
        let mongosh = if cfg!(target_os = "windows") {
            mongod.parent().unwrap().join("mongosh.exe")
        } else {
            mongod.parent().unwrap().join("mongosh")
        };

        log::info!("mongosh 路径: {}", mongosh.display());

        // 创建管理员用户
        log::info!("准备创建管理员用户...");
        let create_user_script = format!(
            r#"
            db = db.getSiblingDB('admin');
            db.createUser({{
                user: '{}',
                pwd: '{}',
                roles: [{{ role: 'root', db: 'admin' }}]
            }});
            db.adminCommand({{ fsync: 1 }});
            "#,
            admin_username, admin_password
        );

        let mongosh_args: Vec<String> = vec![
            "--port".to_string(),
            port.to_string(),
            "--eval".to_string(),
            create_user_script.clone(),
        ];

        log::info!(
            "执行完整命令: {} --port {} --eval \"{}\"",
            mongosh.display(),
            port,
            create_user_script.replace('\n', " ").trim()
        );

        let result = Command::new(&mongosh)
            .args(&["--port", port, "--eval", &create_user_script])
            .output();

        // 等待用户创建完成并写入磁盘
        log::info!("等待用户数据写入磁盘 (2秒)...");
        std::thread::sleep(Duration::from_secs(2));

        // 停止 MongoDB
        log::info!("停止临时 MongoDB 实例...");
        child.kill()?;
        child.wait()?;

        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);

                log::info!("mongosh 执行结果 - stdout: {}", stdout);
                if !stderr.is_empty() {
                    log::warn!("mongosh 执行结果 - stderr: {}", stderr);
                }

                if output.status.success() {
                    log::info!("管理员用户创建成功");
                    Ok(())
                } else {
                    log::error!("创建管理员用户失败 - 退出码: {:?}", output.status.code());
                    Err(anyhow!(
                        "创建管理员用户失败: stdout={}, stderr={}",
                        stdout,
                        stderr
                    ))
                }
            }
            Err(e) => {
                log::error!("执行 mongosh 命令失败: {}", e);
                Err(anyhow!("执行 mongosh 失败: {}. 请确保已安装 mongosh", e))
            }
        }
    }
    /// 初始化副本集
    fn initialize_replica_set(
        &self,
        mongod: &PathBuf,
        config_path: &PathBuf,
        log_dir: &PathBuf,
        _admin_username: &str,
        _admin_password: &str,
        port: &str,
    ) -> Result<()> {
        log::info!("开始初始化副本集 (端口: {})", port);

        // 解析配置文件以获取必要的参数
        let config_content =
            std::fs::read_to_string(config_path).map_err(|e| anyhow!("读取配置文件失败: {}", e))?;
        let config: serde_yaml::Value = serde_yaml::from_str(&config_content)
            .map_err(|e| anyhow!("解析配置文件失败: {}", e))?;

        let data_dir = config
            .get("storage")
            .and_then(|s| s.get("dbPath"))
            .and_then(|p| p.as_str())
            .ok_or_else(|| anyhow!("配置文件中未找到 dbPath"))?;

        // 启动 MongoDB（不使用 keyFile，只启用认证和副本集）
        log::info!("启动 MongoDB 进行副本集初始化（不使用 keyFile）...");

        let init_log_file = log_dir.join("mongod-replica-init.log");

        // 构建并打印启动 mongod 的命令（不使用 keyFile）
        let mongod_args: Vec<String> = vec![
            "--dbpath".to_string(),
            data_dir.to_string(),
            "--port".to_string(),
            port.to_string(),
            "--bind_ip".to_string(),
            "127.0.0.1".to_string(),
            "--logpath".to_string(),
            init_log_file.to_string_lossy().to_string(),
            "--logappend".to_string(),
            "--replSet".to_string(),
            "rs0".to_string(),
        ];
        log::info!("启动命令: {} {}", mongod.display(), mongod_args.join(" "));

        let mut child = Command::new(mongod)
            .args(&mongod_args)
            .spawn()
            .map_err(|e| {
                log::error!("启动 MongoDB 失败: {}", e);
                anyhow!("启动 MongoDB 失败: {}", e)
            })?;

        // 等待 MongoDB 启动
        log::info!("等待 MongoDB 启动 (5秒)...");
        std::thread::sleep(Duration::from_secs(5));

        // 使用 mongosh 初始化副本集 (mongosh 与 mongod 在同一个 bin 目录下)
        let mongosh = if cfg!(target_os = "windows") {
            mongod.parent().unwrap().join("mongosh.exe")
        } else {
            mongod.parent().unwrap().join("mongosh")
        };

        log::info!("mongosh 路径: {}", mongosh.display());

        // 使用正确的主机名（与配置文件中的 replSetName 一致）
        let init_replica_script = format!(
            r#"
            rs.initiate({{
                _id: "rs0",
                members: [{{ _id: 0, host: "localhost:{}" }}]
            }});
            "#,
            port
        );

        // 构建并打印 mongosh 执行的命令（不使用认证，因为此时还没有启用 keyFile）
        let mongosh_args: Vec<String> = vec![
            "--port".to_string(),
            port.to_string(),
            "--eval".to_string(),
            init_replica_script.clone(),
        ];
        log::info!(
            "执行命令: {} {} --eval [脚本内容]",
            mongosh.display(),
            mongosh_args[0..2].join(" ")
        );

        log::info!("执行副本集初始化命令...");
        let result = Command::new(&mongosh).args(&mongosh_args).output();

        // 等待副本集初始化完成
        log::info!("等待副本集初始化完成 (2秒)...");
        std::thread::sleep(Duration::from_secs(2));

        // 停止 MongoDB
        log::info!("停止 MongoDB 实例...");
        child.kill()?;
        child.wait()?;

        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);

                log::info!("mongosh 执行结果 - stdout: {}", stdout);
                if !stderr.is_empty() {
                    log::warn!("mongosh 执行结果 - stderr: {}", stderr);
                }

                if output.status.success() {
                    log::info!("副本集初始化成功");
                    Ok(())
                } else {
                    log::error!("副本集初始化失败 - 退出码: {:?}", output.status.code());
                    log::error!("详细错误信息 - stdout: {}", stdout);
                    log::error!("详细错误信息 - stderr: {}", stderr);
                    Err(anyhow!(
                        "副本集初始化失败: stdout={}, stderr={}",
                        stdout,
                        stderr
                    ))
                }
            }
            Err(e) => {
                log::error!("执行 mongosh 命令失败: {}", e);
                Err(anyhow!("执行 mongosh 失败: {}", e))
            }
        }
    }

    /// 检查 MongoDB 是否已初始化
    pub fn is_initialized(&self, environment_id: &str, service_data: &ServiceData) -> bool {
        let version = &service_data.version;
        let service_data_folder = self.get_service_data_folder(environment_id, version);

        // 检查配置文件和数据目录是否存在（keyfile 不再是必需的）
        let config_path = service_data_folder.join("mongod.conf");
        let data_dir = service_data_folder.join("data");

        config_path.exists() && data_dir.exists()
    }

    /// 列出所有数据库
    pub fn list_databases(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        // log::info!("列出 MongoDB 数据库");

        // 从 metadata 中获取管理员用户名和密码
        let admin_username = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_ADMIN_USERNAME"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员用户名"))?;

        let admin_password = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_ADMIN_PASSWORD"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员密码"))?;

        // 从配置文件中读取端口
        let config_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_CONFIG"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到配置文件路径"))?;

        let config_content = std::fs::read_to_string(config_path)?;
        let port = Self::parse_port_from_config(&config_content)?;

        // 获取 mongosh 路径
        let install_path = self.get_install_path(&service_data.version);
        let mongosh_bin = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mongosh.exe")
        } else {
            install_path.join("bin").join("mongosh")
        };

        if !mongosh_bin.exists() {
            return Err(anyhow!("mongosh 未安装，请先安装 MongoDB"));
        }

        // 构建连接字符串（添加 authSource=admin 指定认证数据库）
        let connection_string = format!(
            "mongodb://{}:{}@127.0.0.1:{}/?authSource=admin",
            admin_username, admin_password, port
        );

        // 执行 mongosh 命令列出数据库
        let output = Command::new(&mongosh_bin)
            .arg(&connection_string)
            .arg("--quiet")
            .arg("--eval")
            .arg("JSON.stringify(db.adminCommand({ listDatabases: 1 }))")
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("列出数据库失败: {}", error));
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        // log::debug!("mongosh 输出: {}", output_str);

        // 解析 JSON 输出
        let json: serde_json::Value = serde_json::from_str(output_str.trim())?;
        let databases = json
            .get("databases")
            .and_then(|v| v.as_array())
            .ok_or_else(|| anyhow!("无法解析数据库列表"))?;

        let db_list: Vec<serde_json::Value> = databases
            .iter()
            .map(|db| {
                serde_json::json!({
                    "name": db.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                    "sizeOnDisk": db.get("sizeOnDisk").and_then(|v| v.as_i64()).unwrap_or(0),
                    "empty": db.get("empty").and_then(|v| v.as_bool()).unwrap_or(false)
                })
            })
            .collect();

        Ok(ServiceDataResult {
            success: true,
            message: "获取数据库列表成功".to_string(),
            data: Some(serde_json::json!({ "databases": db_list })),
        })
    }

    /// 创建数据库
    pub fn create_database(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        database_name: String,
    ) -> Result<ServiceDataResult> {
        log::info!("创建 MongoDB 数据库: {}", database_name);

        // 验证数据库名称
        if database_name.is_empty() {
            return Err(anyhow!("数据库名称不能为空"));
        }

        // 从 metadata 中获取管理员用户名和密码
        let admin_username = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_ADMIN_USERNAME"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员用户名"))?;

        let admin_password = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_ADMIN_PASSWORD"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员密码"))?;

        // 从配置文件中读取端口
        let config_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_CONFIG"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到配置文件路径"))?;

        let config_content = std::fs::read_to_string(config_path)?;
        let port = Self::parse_port_from_config(&config_content)?;

        // 获取 mongosh 路径
        let install_path = self.get_install_path(&service_data.version);
        let mongosh_bin = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mongosh.exe")
        } else {
            install_path.join("bin").join("mongosh")
        };

        if !mongosh_bin.exists() {
            return Err(anyhow!("mongosh 未安装，请先安装 MongoDB"));
        }

        // 构建连接字符串（添加 authSource=admin 指定认证数据库）
        let connection_string = format!(
            "mongodb://{}:{}@127.0.0.1:{}/?authSource=admin",
            admin_username, admin_password, port
        );

        // 创建数据库（通过在数据库中创建一个集合来实现）
        let create_command = format!(
            "\"db = db.getSiblingDB('{}'); db.createCollection('_init'); JSON.stringify({{ ok: 1, database: '{}' }});\"",
            database_name, database_name
        );
        log::info!("准备执行创建数据库命令");
        log::info!("mongosh 路径: {}", mongosh_bin.display());
        log::info!("连接字符串: {}", connection_string);
        log::info!(
            "执行命令: {} {} --quiet --eval {}",
            mongosh_bin.display(),
            &connection_string,
            create_command.replace('\n', " ")
        );
        let output = Command::new(&mongosh_bin)
            .arg(&connection_string)
            .arg("--quiet")
            .arg("--eval")
            .arg(&create_command)
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("创建数据库失败: {}", error));
        }

        Ok(ServiceDataResult {
            success: true,
            message: format!("数据库 '{}' 创建成功", database_name),
            data: Some(serde_json::json!({ "database": database_name })),
        })
    }

    /// 从配置文件内容中解析端口
    fn parse_port_from_config(config_content: &str) -> Result<String> {
        for line in config_content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("port:") {
                if let Some(port) = trimmed.strip_prefix("port:") {
                    return Ok(port.trim().to_string());
                }
            }
        }
        Err(anyhow!("无法从配置文件中解析端口"))
    }

    /// 列出指定数据库的所有集合
    pub fn list_collections(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        database_name: String,
    ) -> Result<ServiceDataResult> {
        log::info!("列出 MongoDB 数据库 '{}' 的集合", database_name);

        // 从 metadata 中获取管理员用户名和密码
        let admin_username = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_ADMIN_USERNAME"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员用户名"))?;

        let admin_password = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_ADMIN_PASSWORD"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员密码"))?;

        // 从配置文件中读取端口
        let config_path = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("MONGODB_CONFIG"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到配置文件路径"))?;

        let config_content = std::fs::read_to_string(config_path)?;
        let port = Self::parse_port_from_config(&config_content)?;

        // 获取 mongosh 路径
        let install_path = self.get_install_path(&service_data.version);
        let mongosh_bin = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mongosh.exe")
        } else {
            install_path.join("bin").join("mongosh")
        };

        if !mongosh_bin.exists() {
            return Err(anyhow!("mongosh 未安装，请先安装 MongoDB"));
        }

        // 构建连接字符串（添加 authSource=admin 指定认证数据库）
        let connection_string = format!(
            "mongodb://{}:{}@127.0.0.1:{}/?authSource=admin",
            admin_username, admin_password, port
        );

        // 执行 mongosh 命令列出集合
        let list_command = format!(
            "db = db.getSiblingDB('{}'); JSON.stringify(db.getCollectionNames());",
            database_name
        );

        let output = Command::new(&mongosh_bin)
            .arg(&connection_string)
            .arg("--quiet")
            .arg("--eval")
            .arg(&list_command)
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("列出集合失败: {}", error));
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        log::debug!("mongosh 输出: {}", output_str);

        // 解析 JSON 输出
        let collections: Vec<String> = serde_json::from_str(output_str.trim())?;

        Ok(ServiceDataResult {
            success: true,
            message: format!("获取数据库 '{}' 的集合列表成功", database_name),
            data: Some(serde_json::json!({ "collections": collections })),
        })
    }

    /// 创建普通用户
    pub fn create_user(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        username: String,
        password: String,
        databases: Vec<String>, // 可访问的数据库列表
        roles: Vec<String>,     // 角色列表，如 "readWrite", "read"
    ) -> Result<ServiceDataResult> {
        log::info!("创建 MongoDB 用户: {}", username);

        // 从配置中获取端口
        let metadata = service_data
            .metadata
            .as_ref()
            .ok_or_else(|| anyhow!("未找到 metadata"))?;

        let config_path = metadata
            .get("MONGODB_CONFIG")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到 MongoDB 配置文件路径"))?;

        let config_content = std::fs::read_to_string(config_path)?;
        let port = Self::parse_port_from_config(&config_content)?;

        // 获取管理员凭据
        let admin_username = metadata
            .get("MONGODB_ADMIN_USERNAME")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员用户名"))?;
        let admin_password = metadata
            .get("MONGODB_ADMIN_PASSWORD")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员密码"))?;

        // 获取 mongosh 路径
        let install_path = self.get_install_path(&service_data.version);
        let mongosh_path = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mongosh.exe")
        } else {
            install_path.join("bin").join("mongosh")
        };

        if !mongosh_path.exists() {
            return Err(anyhow!("mongosh 未安装"));
        }

        // 构建用户角色数组
        let mut roles_array = Vec::new();
        for db in &databases {
            for role in &roles {
                roles_array.push(format!("{{ role: '{}', db: '{}' }}", role, db));
            }
        }
        let roles_str = roles_array.join(", ");

        // 构建创建用户的命令
        let create_user_script = format!(
            r#"
            db.getSiblingDB('admin').auth('{}', '{}');
            db.getSiblingDB('admin').createUser({{
                user: '{}',
                pwd: '{}',
                roles: [{}]
            }});
            "#,
            admin_username, admin_password, username, password, roles_str
        );

        log::debug!("创建用户脚本: {}", create_user_script);

        let output = Command::new(&mongosh_path)
            .arg("--port")
            .arg(&port)
            .arg("--quiet")
            .arg("--eval")
            .arg(&create_user_script)
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("创建用户失败: {}", error));
        }

        let result_str = String::from_utf8_lossy(&output.stdout);
        log::info!("创建用户成功: {}", result_str);

        Ok(ServiceDataResult {
            success: true,
            message: format!("用户 {} 创建成功", username),
            data: Some(serde_json::json!({
                "username": username,
                "databases": databases,
                "roles": roles
            })),
        })
    }

    /// 列出所有用户
    pub fn list_users(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        // log::info!("列出 MongoDB 所有用户");

        // 从配置中获取端口
        let metadata = service_data
            .metadata
            .as_ref()
            .ok_or_else(|| anyhow!("未找到 metadata"))?;

        let config_path = metadata
            .get("MONGODB_CONFIG")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到 MongoDB 配置文件路径"))?;

        let config_content = std::fs::read_to_string(config_path)?;
        let port = Self::parse_port_from_config(&config_content)?;

        // 获取管理员凭据
        let admin_username = metadata
            .get("MONGODB_ADMIN_USERNAME")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员用户名"))?;
        let admin_password = metadata
            .get("MONGODB_ADMIN_PASSWORD")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员密码"))?;

        // 获取 mongosh 路径
        let install_path = self.get_install_path(&service_data.version);
        let mongosh_path = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mongosh.exe")
        } else {
            install_path.join("bin").join("mongosh")
        };

        if !mongosh_path.exists() {
            return Err(anyhow!("mongosh 未安装"));
        }

        // 构建列出用户的命令
        let list_users_script = format!(
            r#"
            db.getSiblingDB('admin').auth('{}', '{}');
            const users = db.getSiblingDB('admin').getUsers();
            print(JSON.stringify(users));
            "#,
            admin_username, admin_password
        );

        let output = Command::new(&mongosh_path)
            .arg("--port")
            .arg(&port)
            .arg("--quiet")
            .arg("--eval")
            .arg(&list_users_script)
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("列出用户失败: {}", error));
        }

        let result_str = String::from_utf8_lossy(&output.stdout);

        // 解析用户列表
        let users_value: serde_json::Value = serde_json::from_str(result_str.trim())?;
        let users = users_value["users"]
            .as_array()
            .ok_or_else(|| anyhow!("解析用户列表失败"))?;

        // log::info!("用户列表获取成功，共 {} 个用户", users.len());

        Ok(ServiceDataResult {
            success: true,
            message: format!("获取用户列表成功，共 {} 个用户", users.len()),
            data: Some(serde_json::json!({
                "users": users
            })),
        })
    }

    /// 更新用户权限
    pub fn update_user_roles(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        username: String,
        databases: Vec<String>,
        roles: Vec<String>,
    ) -> Result<ServiceDataResult> {
        log::info!("更新用户 {} 的权限", username);

        // 从配置中获取端口
        let metadata = service_data
            .metadata
            .as_ref()
            .ok_or_else(|| anyhow!("未找到 metadata"))?;

        let config_path = metadata
            .get("MONGODB_CONFIG")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到 MongoDB 配置文件路径"))?;

        let config_content = std::fs::read_to_string(config_path)?;
        let port = Self::parse_port_from_config(&config_content)?;

        // 获取管理员凭据
        let admin_username = metadata
            .get("MONGODB_ADMIN_USERNAME")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员用户名"))?;
        let admin_password = metadata
            .get("MONGODB_ADMIN_PASSWORD")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员密码"))?;

        // 获取 mongosh 路径
        let install_path = self.get_install_path(&service_data.version);
        let mongosh_path = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mongosh.exe")
        } else {
            install_path.join("bin").join("mongosh")
        };

        if !mongosh_path.exists() {
            return Err(anyhow!("mongosh 未安装"));
        }

        // 构建角色数组
        let mut roles_array = Vec::new();
        for db in &databases {
            for role in &roles {
                roles_array.push(format!("{{ role: '{}', db: '{}' }}", role, db));
            }
        }
        let roles_str = roles_array.join(", ");

        // 构建更新用户权限的命令
        let update_script = format!(
            r#"
            db.getSiblingDB('admin').auth('{}', '{}');
            db.getSiblingDB('admin').updateUser('{}', {{
                roles: [{}]
            }});
            "#,
            admin_username, admin_password, username, roles_str
        );

        log::debug!("更新用户权限脚本: {}", update_script);

        let output = Command::new(&mongosh_path)
            .arg("--port")
            .arg(&port)
            .arg("--quiet")
            .arg("--eval")
            .arg(&update_script)
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("更新用户权限失败: {}", error));
        }

        log::info!("用户 {} 权限更新成功", username);

        Ok(ServiceDataResult {
            success: true,
            message: format!("用户 {} 权限更新成功", username),
            data: Some(serde_json::json!({
                "username": username,
                "databases": databases,
                "roles": roles
            })),
        })
    }

    /// 删除用户
    pub fn delete_user(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        username: String,
    ) -> Result<ServiceDataResult> {
        log::info!("删除 MongoDB 用户: {}", username);

        // 不允许删除管理员用户
        let metadata = service_data
            .metadata
            .as_ref()
            .ok_or_else(|| anyhow!("未找到 metadata"))?;

        let admin_username = metadata
            .get("MONGODB_ADMIN_USERNAME")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员用户名"))?;

        if &username == admin_username {
            return Err(anyhow!("不能删除管理员用户"));
        }

        // 从配置中获取端口
        let config_path = metadata
            .get("MONGODB_CONFIG")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到 MongoDB 配置文件路径"))?;

        let config_content = std::fs::read_to_string(config_path)?;
        let port = Self::parse_port_from_config(&config_content)?;

        // 获取管理员凭据
        let admin_password = metadata
            .get("MONGODB_ADMIN_PASSWORD")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("未找到管理员密码"))?;

        // 获取 mongosh 路径
        let install_path = self.get_install_path(&service_data.version);
        let mongosh_path = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mongosh.exe")
        } else {
            install_path.join("bin").join("mongosh")
        };

        if !mongosh_path.exists() {
            return Err(anyhow!("mongosh 未安装"));
        }

        // 构建删除用户的命令
        let delete_user_script = format!(
            r#"
            db.getSiblingDB('admin').auth('{}', '{}');
            db.getSiblingDB('admin').dropUser('{}');
            "#,
            admin_username, admin_password, username
        );

        let output = Command::new(&mongosh_path)
            .arg("--port")
            .arg(&port)
            .arg("--quiet")
            .arg("--eval")
            .arg(&delete_user_script)
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("删除用户失败: {}", error));
        }

        log::info!("用户 {} 删除成功", username);

        Ok(ServiceDataResult {
            success: true,
            message: format!("用户 {} 删除成功", username),
            data: Some(serde_json::json!({
                "username": username
            })),
        })
    }
}
