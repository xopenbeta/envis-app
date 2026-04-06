use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadStatus, DownloadTask};
use crate::manager::shell_manamger::ShellManager;
use crate::types::ServiceData;
use anyhow::{anyhow, Result};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use xmltree::{Element, EmitterConfig, XMLNode};

/// 全局 Maven 服务管理器单例
static GLOBAL_MAVEN_SERVICE: OnceLock<Arc<MavenService>> = OnceLock::new();

/// Maven 服务管理器
pub struct MavenService {}

impl MavenService {
    const MAVEN_VERSION_FOR_JAVA_8: &'static str = "3.8.8";
    const MAVEN_VERSION_FOR_JAVA_11: &'static str = "3.9.6";
    const MAVEN_VERSION_FOR_JAVA_MODERN: &'static str = "3.9.9";
    const ENVIS_MAVEN_MIRROR_ID: &'static str = "envis-mirror";
    pub const DEFAULT_MAVEN_REPO_URL: &'static str = "https://repo.maven.apache.org/maven2";
    const MAVEN_REPO_ENV_PLACEHOLDER: &'static str = "${env.MAVEN_REPO_URL}";
    const MAVEN_LOCAL_REPO_ENV_PLACEHOLDER: &'static str = "${env.MAVEN_LOCAL_REPO}";

    /// 获取全局 Maven 服务管理器单例
    pub fn global() -> Arc<MavenService> {
        GLOBAL_MAVEN_SERVICE
            .get_or_init(|| Arc::new(MavenService::new()))
            .clone()
    }

    /// 创建新的 Maven 服务管理器
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

    fn get_maven_version_for_java(&self, java_version: &str) -> &'static str {
        let major = self.parse_java_major_version(java_version);
        if major <= 8 {
            Self::MAVEN_VERSION_FOR_JAVA_8
        } else if major <= 11 {
            Self::MAVEN_VERSION_FOR_JAVA_11
        } else {
            Self::MAVEN_VERSION_FOR_JAVA_MODERN
        }
    }

    fn get_maven_task_id(&self, java_version: &str) -> String {
        format!("java-{}-maven", java_version)
    }

    fn get_maven_install_path(&self, java_version: &str) -> PathBuf {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        };
        let maven_version = self.get_maven_version_for_java(java_version);
        services_folder
            .join("java")
            .join(java_version)
            .join("maven")
            .join(maven_version)
    }

    /// 检查 Maven 是否已安装
    pub fn is_maven_installed(&self, java_version: &str) -> bool {
        let install_path = self.get_maven_install_path(java_version);
        let maven_binary = if cfg!(target_os = "windows") {
            install_path.join("bin").join("mvn.cmd")
        } else {
            install_path.join("bin").join("mvn")
        };
        maven_binary.exists()
    }

    /// 获取 Maven 安装目录
    pub fn get_maven_home(&self, java_version: &str) -> Option<String> {
        if self.is_maven_installed(java_version) {
            Some(
                self.get_maven_install_path(java_version)
                    .to_string_lossy()
                    .to_string(),
            )
        } else {
            None
        }
    }

    fn get_maven_settings_path(&self, java_version: &str) -> Option<PathBuf> {
        self.get_maven_home(java_version)
            .map(PathBuf::from)
            .map(|p| p.join("conf").join("settings.xml"))
    }

    fn find_child<'a>(parent: &'a Element, name: &str) -> Option<&'a Element> {
        parent.children.iter().find_map(|node| match node {
            XMLNode::Element(element) if element.name == name => Some(element),
            _ => None,
        })
    }

    fn find_child_mut<'a>(parent: &'a mut Element, name: &str) -> Option<&'a mut Element> {
        parent.children.iter_mut().find_map(|node| match node {
            XMLNode::Element(element) if element.name == name => Some(element),
            _ => None,
        })
    }

    fn get_or_insert_child_mut<'a>(parent: &'a mut Element, name: &str) -> &'a mut Element {
        if let Some(index) = parent
            .children
            .iter()
            .position(|node| matches!(node, XMLNode::Element(element) if element.name == name))
        {
            match parent.children.get_mut(index) {
                Some(XMLNode::Element(element)) => return element,
                _ => unreachable!(),
            }
        }

        parent.children.push(XMLNode::Element(Element::new(name)));
        match parent.children.last_mut() {
            Some(XMLNode::Element(element)) => element,
            _ => unreachable!(),
        }
    }

    fn child_text(parent: &Element, child_name: &str) -> Option<String> {
        Self::find_child(parent, child_name)
            .and_then(|child| child.get_text())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    }

    fn set_child_text(parent: &mut Element, child_name: &str, value: &str) {
        let child = Self::get_or_insert_child_mut(parent, child_name);
        child
            .children
            .retain(|node| !matches!(node, XMLNode::Text(_) | XMLNode::CData(_)));
        child.children.push(XMLNode::Text(value.to_string()));
    }

    fn parse_settings_xml(content: &str) -> Result<Element> {
        Element::parse(content.as_bytes()).map_err(|e| anyhow!("解析 settings.xml 失败: {}", e))
    }

    fn write_settings_xml(settings_path: &PathBuf, root: &Element) -> Result<()> {
        let mut output = Vec::new();
        let emitter = EmitterConfig::new().perform_indent(true);
        root.write_with_config(&mut output, emitter)
            .map_err(|e| anyhow!("序列化 settings.xml 失败: {}", e))?;
        std::fs::write(settings_path, output).map_err(|e| anyhow!("写入 settings.xml 失败: {}", e))
    }


    /// 确保 Maven settings.xml 使用环境变量占位符（仓库地址和本地仓库路径）
    pub fn ensure_maven_settings_use_env_placeholders(&self, java_version: &str) -> Result<()> {
        // 设置远程仓库地址环境变量占位符
        self.set_maven_repository_to_settings(java_version, Self::MAVEN_REPO_ENV_PLACEHOLDER)?;
        
        // 设置本地仓库路径环境变量占位符
        self.set_maven_local_repository_to_settings(java_version, Self::MAVEN_LOCAL_REPO_ENV_PLACEHOLDER)?;
        
        Ok(())
    }

    // 不用在这里写获取仓库地址方法，因为被放在了metadata里

    pub fn set_maven_repository_to_settings(
        &self,
        java_version: &str,
        repository_url: &str,
    ) -> Result<PathBuf> {
        let repository_url = repository_url.trim();
        if repository_url.is_empty() {
            return Err(anyhow!("Maven 仓库地址不能为空"));
        }

        let settings_path = self
            .get_maven_settings_path(java_version)
            .ok_or_else(|| anyhow!("Maven 未初始化，无法写入 settings.xml"))?;

        if let Some(parent) = settings_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| anyhow!("创建 Maven 配置目录失败: {}", e))?;
        }

        let mut root = if settings_path.exists() {
            let content = std::fs::read_to_string(&settings_path)
                .map_err(|e| anyhow!("读取 settings.xml 失败: {}", e))?;
            Self::parse_settings_xml(&content)?
        } else {
            Element::new("settings")
        };

        if root.name != "settings" {
            return Err(anyhow!("settings.xml 根节点不是 <settings>"));
        }

        let mirrors = Self::get_or_insert_child_mut(&mut root, "mirrors");

        let mut found = false;
        for node in mirrors.children.iter_mut() {
            if let XMLNode::Element(mirror) = node {
                if mirror.name != "mirror" {
                    continue;
                }
                let mirror_id = Self::child_text(mirror, "id");
                if mirror_id.as_deref() == Some(Self::ENVIS_MAVEN_MIRROR_ID) {
                    Self::set_child_text(mirror, "id", Self::ENVIS_MAVEN_MIRROR_ID);
                    Self::set_child_text(mirror, "name", "Envis Maven Mirror");
                    Self::set_child_text(mirror, "url", repository_url);
                    Self::set_child_text(mirror, "mirrorOf", "*");
                    found = true;
                    break;
                }
            }
        }

        if !found {
            let mut mirror = Element::new("mirror");
            Self::set_child_text(&mut mirror, "id", Self::ENVIS_MAVEN_MIRROR_ID);
            Self::set_child_text(&mut mirror, "name", "Envis Maven Mirror");
            Self::set_child_text(&mut mirror, "url", repository_url);
            Self::set_child_text(&mut mirror, "mirrorOf", "*");
            mirrors.children.push(XMLNode::Element(mirror));
        }

        Self::write_settings_xml(&settings_path, &root)?;

        Ok(settings_path)
    }

    /// 设置 Maven 本地仓库路径（写入 settings.xml 的 <localRepository>）
    pub fn set_maven_local_repository_to_settings(
        &self,
        java_version: &str,
        local_repo: &str,
    ) -> Result<()> {
        let local_repo = local_repo.trim();
        if local_repo.is_empty() {
            return Err(anyhow!("Maven 本地仓库路径不能为空"));
        }

        let settings_path = self
            .get_maven_settings_path(java_version)
            .ok_or_else(|| anyhow!("Maven 未初始化，无法写入 settings.xml"))?;

        if let Some(parent) = settings_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| anyhow!("创建 Maven 配置目录失败: {}", e))?;
        }

        let mut root = if settings_path.exists() {
            let content = std::fs::read_to_string(&settings_path)
                .map_err(|e| anyhow!("读取 settings.xml 失败: {}", e))?;
            Self::parse_settings_xml(&content)?
        } else {
            Element::new("settings")
        };

        if root.name != "settings" {
            return Err(anyhow!("settings.xml 根节点不是 <settings>"));
        }

        Self::set_child_text(&mut root, "localRepository", local_repo);
        Self::write_settings_xml(&settings_path, &root)?;

        Ok(())
    }

    /// 构建 Maven 下载 URL 和文件名
    fn build_maven_download_info(&self, java_version: &str) -> Result<(Vec<String>, String)> {
        let maven_version = self.get_maven_version_for_java(java_version);
        let ext = if cfg!(target_os = "windows") {
            "zip"
        } else {
            "tar.gz"
        };

        let filename = format!("apache-maven-{}-bin.{}", maven_version, ext);
        let urls = vec![
            format!(
                "https://mirrors.huaweicloud.com/apache/maven/maven-3/{}/binaries/{}",
                maven_version, filename
            ),
            format!(
                "https://mirrors.tuna.tsinghua.edu.cn/apache/maven/maven-3/{}/binaries/{}",
                maven_version, filename
            ),
            format!(
                "https://dlcdn.apache.org/maven/maven-3/{}/binaries/{}",
                maven_version, filename
            ),
            format!(
                "https://archive.apache.org/dist/maven/maven-3/{}/binaries/{}",
                maven_version, filename
            ),
            format!(
                "https://mirrors.aliyun.com/apache/maven/maven-3/{}/binaries/{}",
                maven_version, filename
            ),
        ];

        Ok((urls, filename))
    }

    /// 下载并安装 Maven
    pub async fn download_and_install_maven(&self, java_version: &str) -> Result<DownloadResult> {
        if self.is_maven_installed(java_version) {
            return Ok(DownloadResult::success("Maven 已经安装".to_string(), None));
        }

        let (urls, filename) = self.build_maven_download_info(java_version)?;
        let install_path = self.get_maven_install_path(java_version);
        let task_id = self.get_maven_task_id(java_version);
        let download_manager = DownloadManager::global();
        let java_version_for_callback = java_version.to_string();

        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!("Maven 下载完成: {}", task.filename);

            let task_for_spawn = task.clone();
            let service_for_spawn = MavenService::global();
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
                    .extract_and_install_maven(&task_for_spawn, &java_version_for_spawn)
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
                            log::info!("Maven 安装成功");
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
                        log::error!("Maven 安装失败: {}", e);
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
                        "Maven 下载任务已开始".to_string(),
                        Some(task),
                    ))
                } else {
                    Ok(DownloadResult::error(
                        "无法获取 Maven 下载任务状态".to_string(),
                    ))
                }
            }
            Err(e) => Ok(DownloadResult::error(format!("Maven 下载失败: {}", e))),
        }
    }

    /// 解压和安装 Maven
    pub async fn extract_and_install_maven(
        &self,
        task: &DownloadTask,
        java_version: &str,
    ) -> Result<()> {
        let archive_path = &task.target_path;
        let install_dir = self.get_maven_install_path(java_version);

        std::fs::create_dir_all(&install_dir)?;

        if task.filename.ends_with(".tar.gz") {
            super::java::extract_tar(archive_path, &install_dir).await?;
        } else if task.filename.ends_with(".zip") {
            super::java::extract_zip(archive_path, &install_dir).await?;
            // 先删除压缩包，再提升目录（避免 zip 文件干扰子目录检测）
            let _ = std::fs::remove_file(archive_path);
            super::java::flatten_single_subdir(&install_dir)?;
        } else {
            return Err(anyhow!("不支持的 Maven 压缩格式"));
        }

        #[cfg(not(target_os = "windows"))]
        super::java::set_executable_permissions(&install_dir)?;

        // 统一设置环境变量占位符
        self.ensure_maven_settings_use_env_placeholders(java_version)?;

        // zip 文件已在上方提前删除，tar.gz 在此清理
        let _ = std::fs::remove_file(archive_path);

        log::info!("Maven 解压和安装完成");
        Ok(())
    }

    /// 获取 Maven 下载进度
    pub fn get_maven_download_progress(&self, java_version: &str) -> Option<DownloadTask> {
        let task_id = self.get_maven_task_id(java_version);
        DownloadManager::global().get_task_status(&task_id)
    }

    /// 激活 Maven 服务（设置环境变量）
    pub fn activate(&self, java_version: &str, service_data: &ServiceData) -> Result<()> {
        let metadata_maven_home = service_data
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("MAVEN_HOME"))
            .and_then(|value| value.as_str())
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(|value| value.to_string());

        let metadata_maven_repo_url = service_data
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("MAVEN_REPO_URL"))
            .and_then(|value| value.as_str())
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .unwrap_or(Self::DEFAULT_MAVEN_REPO_URL);

        let metadata_maven_local_repo = service_data
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("MAVEN_LOCAL_REPO"))
            .and_then(|v| v.as_str())
            .map(|v| v.trim())
            .filter(|v| !v.is_empty())
            .map(|v| v.to_string());

        // 统一获取一次锁，完成所有 shell_manager 操作
        {
            let shell_manager = ShellManager::global();
            let shell_manager = shell_manager.lock().unwrap();

            // 设置 MAVEN_HOME
            if let Some(maven_home) = &metadata_maven_home {
                shell_manager.add_export("MAVEN_HOME", maven_home)?;
                shell_manager.add_export("M2_HOME", maven_home)?;
                let maven_bin = format!("{}/bin", maven_home);
                shell_manager.add_path(&maven_bin)?;
            }

            // 设置 MAVEN_REPO_URL
            shell_manager.add_export("MAVEN_REPO_URL", metadata_maven_repo_url)?;

            // 设置 MAVEN_LOCAL_REPO
            if let Some(local_repo) = &metadata_maven_local_repo {
                shell_manager.add_export("MAVEN_LOCAL_REPO", local_repo)?;
            }
        } // shell_manager 锁在这里释放

        // 统一设置 settings.xml 中的环境变量占位符（文件操作，不需要锁）
        if let Err(e) = self.ensure_maven_settings_use_env_placeholders(java_version) {
            log::warn!("激活时设置 Maven 环境变量占位符失败: {}", e);
        }

        Ok(())
    }

    /// 取消激活 Maven 服务（删除环境变量）
    pub fn deactivate(&self, service_data: &ServiceData) -> Result<()> {
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

        let metadata_maven_home = service_data
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("MAVEN_HOME"))
            .and_then(|value| value.as_str())
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(|value| value.to_string());

        if let Some(maven_home) = metadata_maven_home {
            let maven_bin = format!("{}/bin", maven_home);
            shell_manager.delete_path(&maven_bin)?;
        }

        shell_manager.delete_export("MAVEN_HOME")?;
        shell_manager.delete_export("M2_HOME")?;
        shell_manager.delete_export("MAVEN_REPO_URL")?;
        shell_manager.delete_export("MAVEN_LOCAL_REPO")?;

        Ok(())
    }
}
