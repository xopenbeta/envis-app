use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::services::traits::ServiceLifecycle;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadTask};
use crate::manager::shell_manamger::ShellManager;
use crate::types::ServiceData;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

/// Node.js 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodejsVersion {
    pub version: String,
    pub lts: bool,
    pub date: String,
}

/// 全局 npm 包信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalPackage {
    pub name: String,
    pub version: String,
}

/// 全局 Node.js 服务管理器单例
static GLOBAL_NODEJS_SERVICE: OnceLock<Arc<NodejsService>> = OnceLock::new();

/// Node.js 服务管理器
pub struct NodejsService {}

impl NodejsService {
    /// 获取全局 Node.js 服务管理器单例
    pub fn global() -> Arc<NodejsService> {
        GLOBAL_NODEJS_SERVICE
            .get_or_init(|| Arc::new(NodejsService::new()))
            .clone()
    }

    /// 创建新的 Node.js 服务管理器
    pub fn new() -> Self {
        Self {}
    }

    /// 获取可用的 Node.js 版本列表
    pub fn get_available_versions(&self) -> Vec<NodejsVersion> {
        vec![
            NodejsVersion {
                version: "v14.21.3".to_string(),
                lts: true,
                date: "2023-02-16".to_string(),
            },
            NodejsVersion {
                version: "v16.20.2".to_string(),
                lts: true,
                date: "2023-08-08".to_string(),
            },
            NodejsVersion {
                version: "v18.20.7".to_string(),
                lts: true,
                date: "2024-10-03".to_string(),
            },
            NodejsVersion {
                version: "v20.19.1".to_string(),
                lts: true,
                date: "2024-10-03".to_string(),
            },
            NodejsVersion {
                version: "v22.14.0".to_string(),
                lts: false,
                date: "2024-12-03".to_string(),
            },
        ]
    }

    /// 检查 Node.js 是否已安装
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        let node_binary = if cfg!(target_os = "windows") {
            install_path.join("node.exe")
        } else {
            install_path.join("bin").join("node")
        };
        node_binary.exists()
    }

    /// 获取 Node.js 安装路径
    fn get_install_path(&self, version: &str) -> PathBuf {
        // 获取 services 文件夹路径
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        }; // 锁在这里被释放
        services_folder.join("nodejs").join(version)
    }

    /// 构建下载 URL 和文件名（支持备用镜像）
    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        let (filename, urls) = match platform {
            "macos" => {
                let arch_suffix = if arch == "aarch64" {
                    if version.starts_with("v14") {
                        "x64"
                    } else {
                        "arm64"
                    }
                } else {
                    "x64"
                };
                let filename = format!("node-{}-darwin-{}.tar.gz", version, arch_suffix);
                let urls = vec![
                    format!(
                        "https://mirrors.aliyun.com/nodejs-release/{}/{}",
                        version, filename
                    ),
                    format!("https://nodejs.org/dist/{}/{}", version, filename),
                    format!(
                        "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/{}/{}",
                        version, filename
                    ),
                    format!(
                        "https://npm.taobao.org/mirrors/node/{}/{}",
                        version, filename
                    ),
                ];
                (filename, urls)
            }
            "linux" => {
                let arch_suffix = if arch == "aarch64" { "arm64" } else { "x64" };
                let filename = format!("node-{}-linux-{}.tar.xz", version, arch_suffix);
                let urls = vec![
                    format!(
                        "https://mirrors.aliyun.com/nodejs-release/{}/{}",
                        version, filename
                    ),
                    format!("https://nodejs.org/dist/{}/{}", version, filename),
                    format!(
                        "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/{}/{}",
                        version, filename
                    ),
                    format!(
                        "https://npm.taobao.org/mirrors/node/{}/{}",
                        version, filename
                    ),
                ];
                (filename, urls)
            }
            "windows" => {
                let arch_suffix = if arch == "x86_64" { "x64" } else { "x86" };
                let filename = format!("node-{}-win-{}.zip", version, arch_suffix);
                let urls = vec![
                    format!(
                        "https://mirrors.aliyun.com/nodejs-release/{}/{}",
                        version, filename
                    ),
                    format!("https://nodejs.org/dist/{}/{}", version, filename),
                    format!(
                        "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/{}/{}",
                        version, filename
                    ),
                    format!(
                        "https://npm.taobao.org/mirrors/node/{}/{}",
                        version, filename
                    ),
                ];
                (filename, urls)
            }
            _ => return Err(anyhow!("不支持的操作系统: {}", platform)),
        };

        Ok((urls, filename))
    }

    /// 下载并安装 Node.js
    pub async fn download_and_install(&self, version: &str) -> Result<DownloadResult> {
        // 检查是否已安装
        if self.is_installed(version) {
            return Ok(DownloadResult::success(
                format!("Node.js {} 已经安装", version),
                None,
            ));
        }

        // 构建下载信息（包含备用URLs）
        let (urls, filename) = self.build_download_info(version)?;
        let install_path = self.get_install_path(version);

        // 创建下载任务ID
        let task_id = format!("nodejs-{}", version);

        // 获取全局下载管理器
        let download_manager = DownloadManager::global();

        // 创建安装回调
        let version_for_callback = version.to_string();

        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!(
                "Node.js {} 下载完成: {} - {}",
                version_for_callback,
                task.id,
                task.filename
            );

            // 异步执行安装步骤 闭包和异步块都需要拥有数据的所有权，在多个地方被使用，所以需要克隆来满足所有权要求
            let task_for_spawn = task.clone();
            let version_for_spawn = version_for_callback.clone();
            let service_for_spawn = NodejsService::global();

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
                    log::info!("Node.js {} 开始安装", version_for_spawn);
                }

                match service_for_spawn
                    .extract_and_install(&task_for_spawn, &version_for_spawn)
                    .await
                {
                    Ok(_) => {
                        // 更新状态为 Installed
                        if let Err(e) = download_manager.update_task_status(
                            &task_for_spawn.id,
                            crate::manager::services::DownloadStatus::Installed,
                            None,
                        ) {
                            log::error!("更新任务状态失败: {}", e);
                        } else {
                            log::info!("Node.js {} 安装成功", version_for_spawn);
                        }
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
                        log::error!("Node.js {} 安装失败: {}", version_for_spawn, e);
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
                        format!("Node.js {} 下载完成", version),
                        Some(task),
                    ))
                } else {
                    Ok(DownloadResult::error("无法获取下载任务状态".to_string()))
                }
            }
            Err(e) => Ok(DownloadResult::error(format!("下载失败: {}", e))),
        }
    }

    /// 解压和安装 Node.js
    pub async fn extract_and_install(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let archive_path = &task.target_path;
        let install_dir = self.get_install_path(version);

        // 确保安装目录存在
        std::fs::create_dir_all(&install_dir)?;

        // 根据文件扩展名选择解压方式
        if task.filename.ends_with(".tar.gz") || task.filename.ends_with(".tar.xz") {
            self.extract_tar(archive_path, &install_dir).await?;
        } else if task.filename.ends_with(".zip") {
            self.extract_zip(archive_path, &install_dir).await?;
        }

        // 删除下载的压缩文件
        if archive_path.exists() {
            std::fs::remove_file(archive_path)?;
        }

        // 设置可执行权限 (非 Windows)
        #[cfg(not(target_os = "windows"))]
        self.set_executable_permissions(&install_dir)?;

        Ok(())
    }

    /// 解压 tar 格式文件
    async fn extract_tar(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        use std::process::Command;

        let output = if archive_path.extension().unwrap() == "gz" {
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

    /// 解压 zip 格式文件
    async fn extract_zip(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        use std::fs::File;
        use std::io::copy;
        use zip::ZipArchive;

        // 打开 zip 文件
        let file = File::open(archive_path)?;
        let mut archive = ZipArchive::new(file)?;

        // 临时解压目录
        let temp_dir = target_dir
            .parent()
            .unwrap()
            .join(format!("temp_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir)?;

        // 解压所有文件
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let outpath = temp_dir.join(file.mangled_name());

            if file.name().ends_with('/') {
                // 创建目录
                std::fs::create_dir_all(&outpath)?;
            } else {
                // 创建父目录
                if let Some(p) = outpath.parent() {
                    std::fs::create_dir_all(p)?;
                }
                // 解压文件
                let mut outfile = File::create(&outpath)?;
                copy(&mut file, &mut outfile)?;
            }

            // 设置文件权限 (Unix)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = file.unix_mode() {
                    std::fs::set_permissions(&outpath, std::fs::Permissions::from_mode(mode))?;
                }
            }
        }

        // 查找解压后的根目录 (通常是 node-vX.X.X-win-x64)
        let entries: Vec<_> = std::fs::read_dir(&temp_dir)?.collect();

        if entries.len() == 1 {
            let entry = entries[0].as_ref().unwrap();
            if entry.path().is_dir() {
                // 移动根目录下的所有内容到目标目录
                for item in std::fs::read_dir(entry.path())? {
                    let item = item?;
                    let dest = target_dir.join(item.file_name());
                    std::fs::rename(item.path(), dest)?;
                }
            }
        } else {
            // 直接移动所有文件
            for entry in entries {
                let entry = entry?;
                let dest = target_dir.join(entry.file_name());
                std::fs::rename(entry.path(), dest)?;
            }
        }

        // 清理临时目录
        std::fs::remove_dir_all(&temp_dir)?;

        Ok(())
    }

    /// 设置可执行权限 (Unix 系统)
    #[cfg(not(target_os = "windows"))]
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

    /// 取消 Node.js 下载
    pub fn cancel_download(&self, version: &str) -> Result<()> {
        let task_id = format!("nodejs-{}", version);
        let download_manager = DownloadManager::global();
        download_manager.cancel_download(&task_id)
    }

    /// 获取下载进度
    pub fn get_download_progress(&self, version: &str) -> Option<DownloadTask> {
        let task_id = format!("nodejs-{}", version);
        let download_manager = DownloadManager::global();
        download_manager.get_task_status(&task_id)
    }

    /// 激活 Node.js 服务及其包管理器环境
    pub fn activate_service(&self, service_data: &ServiceData) -> Result<()> {
        let install_path = self.get_install_path(&service_data.version);

        // 检查 Node.js 是否已安装
        if !self.is_installed(&service_data.version) {
            return Err(anyhow!("Node.js {} 未安装", service_data.version));
        }

        let shell_manager = crate::manager::shell_manamger::ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();
        
        // 添加 Node.js 到 PATH
        let node_bin_path = if cfg!(target_os = "windows") {
            install_path.to_string_lossy().to_string()
        } else {
            install_path.join("bin").to_string_lossy().to_string()
        };

        shell_manager.add_path(&node_bin_path)?;

        // 添加 ${NPM_CONFIG_PREFIX}/bin 到 PATH (如果 NPM_CONFIG_PREFIX 不是空值)
        let npm_config_prefix = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("NPM_CONFIG_PREFIX"))
            .and_then(|v| v.as_str());
        if let Some(prefix) = npm_config_prefix {
            if !prefix.is_empty() {
            let npm_bin_path = PathBuf::from(prefix).join("bin");
            if npm_bin_path.exists() {
                shell_manager.add_path(&npm_bin_path.to_string_lossy().to_string())?;
            }
            }
        }

        // 添加 NPM_CONFIG_PREFIX 环境变量 (如果有)
        if let Some(prefix) = npm_config_prefix {
            if !prefix.is_empty() {
                shell_manager.add_export("NPM_CONFIG_PREFIX", prefix)?;
            }
        }

        // 添加 NPM_CONFIG_REGISTRY 环境变量 (如果有)
        if let Some(registry) = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("NPM_CONFIG_REGISTRY"))
            .and_then(|v| v.as_str())
        {
            shell_manager.add_export("NPM_CONFIG_REGISTRY", registry)?;
        }

        Ok(())
    }

    /// 取消激活 Node.js 服务及其包管理器环境
    pub fn deactivate_service(&self, service_data: &ServiceData) -> Result<()> {
        let install_path = self.get_install_path(&service_data.version);

        let shell_manager = crate::manager::shell_manamger::ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

        // 从 PATH 中移除 Node.js
        let node_bin_path = if cfg!(target_os = "windows") {
            install_path.to_string_lossy().to_string()
        } else {
            install_path.join("bin").to_string_lossy().to_string()
        };

        shell_manager.delete_path(&node_bin_path)?;

        // 从 PATH 中移除 ${NPM_CONFIG_PREFIX}/bin (如果 NPM_CONFIG_PREFIX 不是空值)
        let npm_config_prefix = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("NPM_CONFIG_PREFIX"))
            .and_then(|v| v.as_str());
        if let Some(prefix) = npm_config_prefix {
            if !prefix.is_empty() {
            let npm_bin_path = PathBuf::from(prefix).join("bin");
            if npm_bin_path.exists() {
                shell_manager.delete_path(&npm_bin_path.to_string_lossy().to_string())?;
            }
            }
        }

        // 移除 NPM_CONFIG_PREFIX 环境变量
        shell_manager.delete_export("NPM_CONFIG_PREFIX")?;
        // 移除 NPM_CONFIG_REGISTRY 环境变量
        shell_manager.delete_export("NPM_CONFIG_REGISTRY")?;
        Ok(())
    }

    /// 设置包管理器仓库
    pub fn set_npm_registry(&self, service_data: &mut ServiceData, registry: &str) -> Result<()> {
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();
        shell_manager.add_export("NPM_CONFIG_REGISTRY", registry)?;
        Ok(())
    }

    /// 设置包管理器配置前缀
    pub fn set_npm_config_prefix(
        &self,
        service_data: &mut ServiceData,
        config_prefix: &str,
    ) -> Result<()> {
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();
        
        // 如果之前有 NPM_CONFIG_PREFIX，先从 PATH 中移除旧的 prefix/bin
        if let Some(old_prefix) = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("NPM_CONFIG_PREFIX"))
            .and_then(|v| v.as_str())
        {
            let old_prefix_bin = format!("{}/bin", old_prefix);
            let _ = shell_manager.delete_path(&old_prefix_bin);
        }
        
        // 设置新的 NPM_CONFIG_PREFIX 环境变量
        shell_manager.add_export("NPM_CONFIG_PREFIX", config_prefix)?;
        
        // 添加新的 prefix/bin 到 PATH
        let new_prefix_bin = format!("{}/bin", config_prefix);
        shell_manager.add_path(&new_prefix_bin)?;
        
        Ok(())
    }

    /// 获取全局安装的 npm 包列表
    pub fn get_global_packages(&self, service_data: &ServiceData) -> Result<Vec<GlobalPackage>> {
        use std::process::Command;

        let install_path = self.get_install_path(&service_data.version);
        
        // 检查 Node.js 是否已安装
        if !self.is_installed(&service_data.version) {
            return Err(anyhow!("Node.js {} 未安装", service_data.version));
        }

        // 构建 npm 命令路径
        let npm_path = if cfg!(target_os = "windows") {
            install_path.join("npm.cmd")
        } else {
            install_path.join("bin").join("npm")
        };

        if !npm_path.exists() {
            return Err(anyhow!("npm 不存在: {:?}", npm_path));
        }

        // 设置环境变量
        let mut cmd = Command::new(&npm_path);
        cmd.args(&["list", "-g", "--depth=0", "--json"]);

        // 添加 NPM_CONFIG_PREFIX 环境变量（如果有）
        if let Some(prefix) = service_data
            .metadata
            .as_ref()
            .and_then(|m| m.get("NPM_CONFIG_PREFIX"))
            .and_then(|v| v.as_str())
        {
            cmd.env("NPM_CONFIG_PREFIX", prefix);
        }

        // 执行命令
        let output = cmd.output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("获取全局包列表失败: {}", stderr));
        }

        // 解析 JSON 输出
        let stdout = String::from_utf8_lossy(&output.stdout);
        let json: serde_json::Value = serde_json::from_str(&stdout)
            .map_err(|e| anyhow!("解析 npm list 输出失败: {}", e))?;

        let mut packages = Vec::new();

        if let Some(dependencies) = json.get("dependencies").and_then(|d| d.as_object()) {
            for (name, info) in dependencies {
                let version = info
                    .get("version")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();

                packages.push(GlobalPackage {
                    name: name.clone(),
                    version,
                });
            }
        }

        // 按名称排序
        packages.sort_by(|a, b| a.name.cmp(&b.name));

        Ok(packages)
    }
}

impl ServiceLifecycle for NodejsService {
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
