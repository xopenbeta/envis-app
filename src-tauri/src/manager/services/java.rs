use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::services::traits::ServiceLifecycle;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadStatus, DownloadTask};
use crate::manager::shell_manamger::ShellManager;
use crate::types::ServiceData;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use xmltree::{Element, EmitterConfig, XMLNode};

/// Java 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JavaVersion {
    pub version: String,
    pub lts: bool,
    pub date: String,
}

/// 全局 Java 服务管理器单例
static GLOBAL_JAVA_SERVICE: OnceLock<Arc<JavaService>> = OnceLock::new();

/// Java 服务管理器
pub struct JavaService {}

impl JavaService {
    const MAVEN_VERSION_FOR_JAVA_8: &'static str = "3.8.8";
    const MAVEN_VERSION_FOR_JAVA_11: &'static str = "3.9.6";
    const MAVEN_VERSION_FOR_JAVA_MODERN: &'static str = "3.9.9";
    const ENVIS_MAVEN_MIRROR_ID: &'static str = "envis-mirror";
    pub const DEFAULT_MAVEN_REPO_URL: &'static str = "https://repo.maven.apache.org/maven2";
    const MAVEN_REPO_ENV_PLACEHOLDER: &'static str = "${env.MAVEN_REPO_URL}";

    /// 获取全局 Java 服务管理器单例
    pub fn global() -> Arc<JavaService> {
        GLOBAL_JAVA_SERVICE
            .get_or_init(|| Arc::new(JavaService::new()))
            .clone()
    }

    /// 创建新的 Java 服务管理器
    pub fn new() -> Self {
        Self {}
    }

    /// 获取可用的 Java 版本列表
    pub fn get_available_versions(&self) -> Vec<JavaVersion> {
        vec![
            JavaVersion {
                version: "8".to_string(),
                lts: true,
                date: "2014-03-18".to_string(),
            },
            JavaVersion {
                version: "11".to_string(),
                lts: true,
                date: "2018-09-25".to_string(),
            },
            JavaVersion {
                version: "17".to_string(),
                lts: true,
                date: "2021-09-14".to_string(),
            },
            JavaVersion {
                version: "21".to_string(),
                lts: true,
                date: "2023-09-19".to_string(),
            },
            JavaVersion {
                version: "23".to_string(),
                lts: false,
                date: "2024-09-17".to_string(),
            },
        ]
    }

    /// 检查 Java 是否已安装
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        let java_binary = if cfg!(target_os = "windows") {
            install_path.join("bin").join("java.exe")
        } else {
            install_path.join("bin").join("java")
        };
        java_binary.exists()
    }

    /// 获取 Java 安装路径
    fn get_install_path(&self, version: &str) -> PathBuf {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        };
        services_folder.join("java").join(version)
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

    /// 获取 Maven 安装路径
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
        std::fs::write(settings_path, output)
            .map_err(|e| anyhow!("写入 settings.xml 失败: {}", e))
    }

    pub fn ensure_maven_settings_use_env_repo(&self, java_version: &str) -> Result<PathBuf> {
        self.set_maven_repository_to_settings(java_version, Self::MAVEN_REPO_ENV_PLACEHOLDER)
    }

    pub fn get_maven_repository_from_settings(&self, java_version: &str) -> Result<Option<String>> {
        let settings_path = self
            .get_maven_settings_path(java_version)
            .ok_or_else(|| anyhow!("Maven 未初始化，无法读取 settings.xml"))?;

        if !settings_path.exists() {
            return Ok(None);
        }

        let content = std::fs::read_to_string(&settings_path)
            .map_err(|e| anyhow!("读取 settings.xml 失败: {}", e))?;
        let root = Self::parse_settings_xml(&content)?;

        let mirrors = match Self::find_child(&root, "mirrors") {
            Some(mirrors) => mirrors,
            None => return Ok(None),
        };

        for node in &mirrors.children {
            if let XMLNode::Element(mirror) = node {
                if mirror.name != "mirror" {
                    continue;
                }
                let mirror_id = Self::child_text(mirror, "id");
                let url = Self::child_text(mirror, "url");
                if mirror_id.as_deref() == Some(Self::ENVIS_MAVEN_MIRROR_ID) {
                    return Ok(url);
                }
            }
        }

        for node in &mirrors.children {
            if let XMLNode::Element(mirror) = node {
                if mirror.name != "mirror" {
                    continue;
                }
                if let Some(url) = Self::child_text(mirror, "url") {
                    return Ok(Some(url));
                }
            }
        }

        Ok(None)
    }

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
            std::fs::create_dir_all(parent).map_err(|e| anyhow!("创建 Maven 配置目录失败: {}", e))?;
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
                maven_version,
                filename
            ),
            format!(
                "https://mirrors.tuna.tsinghua.edu.cn/apache/maven/maven-3/{}/binaries/{}",
                maven_version,
                filename
            ),
            format!(
                "https://dlcdn.apache.org/maven/maven-3/{}/binaries/{}",
                maven_version,
                filename
            ),
            format!(
                "https://archive.apache.org/dist/maven/maven-3/{}/binaries/{}",
                maven_version,
                filename
            ),
            format!(
                "https://mirrors.aliyun.com/apache/maven/maven-3/{}/binaries/{}",
                maven_version,
                filename
            ),
        ];

        Ok((urls, filename))
    }

    /// 构建下载 URL 和文件名
    fn build_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        // 架构映射
        let arch_name = match arch {
            "x86_64" => "x64",
            "aarch64" => "aarch64",
            _ => return Err(anyhow!("不支持的架构: {}", arch)),
        };

        // 平台和文件扩展名映射
        let (os_name, ext) = match platform {
            "macos" => ("macos", "tar.gz"),
            "linux" => ("linux", "tar.gz"),
            "windows" => ("windows", "zip"),
            _ => return Err(anyhow!("不支持的平台: {}", platform)),
        };

        // 验证 Java 版本是否支持
        match version {
            "8" | "11" | "17" | "21" | "23" => {},
            _ => return Err(anyhow!("不支持的 Java 版本: {}", version)),
        };

        // 新的文件命名格式：jdk-{version}-{platform}-{arch}.{ext}
        let filename = format!(
            "jdk-{}-{}-{}.{}",
            version, os_name, arch_name, ext
        );

        // 新的下载地址
        let urls = vec![
            format!(
                "https://github.com/xopenbeta/java-archive/releases/latest/download/{}",
                filename
            ),
        ];

        Ok((urls, filename))
    }

    /// 下载并安装 Java
    pub async fn download_and_install(&self, version: &str) -> Result<DownloadResult> {
        if self.is_installed(version) {
            return Ok(DownloadResult::success(
                format!("Java {} 已经安装", version),
                None,
            ));
        }

        let (urls, filename) = self.build_download_info(version)?;
        let install_path = self.get_install_path(version);
        let task_id = format!("java-{}", version);
        let download_manager = DownloadManager::global();

        let version_for_callback = version.to_string();
        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!("Java {} 下载完成: {}", version_for_callback, task.filename);

            let task_for_spawn = task.clone();
            let version_for_spawn = version_for_callback.clone();
            let service_for_spawn = JavaService::global();

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
                            log::info!("Java {} 安装成功", version_for_spawn);
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
                        log::error!("Java {} 安装失败: {}", version_for_spawn, e);
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
                        format!("Java {} 下载完成", version),
                        Some(task),
                    ))
                } else {
                    Ok(DownloadResult::error("无法获取下载任务状态".to_string()))
                }
            }
            Err(e) => Ok(DownloadResult::error(format!("下载失败: {}", e))),
        }
    }

    /// 下载并安装 Maven
    pub async fn download_and_install_maven(&self, java_version: &str) -> Result<DownloadResult> {
        if self.is_maven_installed(java_version) {
            return Ok(DownloadResult::success(
                "Maven 已经安装".to_string(),
                None,
            ));
        }

        let (urls, filename) = self.build_maven_download_info(java_version)?;
        let install_path = self.get_maven_install_path(java_version);
        let task_id = self.get_maven_task_id(java_version);
        let download_manager = DownloadManager::global();
        let java_version_for_callback = java_version.to_string();

        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!("Maven 下载完成: {}", task.filename);

            let task_for_spawn = task.clone();
            let service_for_spawn = JavaService::global();
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
                    Ok(DownloadResult::error("无法获取 Maven 下载任务状态".to_string()))
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
            self.extract_tar(archive_path, &install_dir).await?;
        } else if task.filename.ends_with(".zip") {
            self.extract_zip(archive_path, &install_dir).await?;
        } else {
            return Err(anyhow!("不支持的 Maven 压缩格式"));
        }

        #[cfg(not(target_os = "windows"))]
        self.set_executable_permissions(&install_dir)?;

        self.ensure_maven_settings_use_env_repo(java_version)?;

        let _ = std::fs::remove_file(archive_path);

        log::info!("Maven 解压和安装完成");
        Ok(())
    }

    /// 获取 Maven 下载进度
    pub fn get_maven_download_progress(&self, java_version: &str) -> Option<DownloadTask> {
        let task_id = self.get_maven_task_id(java_version);
        DownloadManager::global().get_task_status(&task_id)
    }

    /// 解压和安装 Java
    pub async fn extract_and_install(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let archive_path = &task.target_path;
        let install_dir = self.get_install_path(version);

        std::fs::create_dir_all(&install_dir)?;

        if task.filename.ends_with(".tar.gz") {
            self.extract_tar(archive_path, &install_dir).await?;
        } else if task.filename.ends_with(".zip") {
            self.extract_zip(archive_path, &install_dir).await?;
        } else {
            return Err(anyhow!("不支持的压缩格式"));
        }

        #[cfg(not(target_os = "windows"))]
        self.set_executable_permissions(&install_dir)?;

        let _ = std::fs::remove_file(archive_path);

        log::info!("Java {} 解压和安装完成", version);
        Ok(())
    }

    /// 解压 tar 格式文件
    async fn extract_tar(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        use tokio::process::Command;

        let output = Command::new("tar")
            .arg("-xzf")
            .arg(archive_path)
            .arg("-C")
            .arg(target_dir)
            .arg("--strip-components=1")
            .output()
            .await?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("解压 tar 文件失败: {}", error));
        }

        Ok(())
    }

    /// 解压 zip 格式文件
    async fn extract_zip(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        use std::fs::File;

        let file = File::open(archive_path)?;
        let mut archive = zip::ZipArchive::new(file)?;

        let top_level_dir = if archive.len() > 0 {
            let first_file = archive.by_index(0)?;
            let path = first_file.name();
            path.split('/').next().unwrap_or("").to_string()
        } else {
            String::new()
        };

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let file_path = file.name();

            let relative_path = if !top_level_dir.is_empty() && file_path.starts_with(&top_level_dir)
            {
                file_path
                    .strip_prefix(&top_level_dir)
                    .unwrap_or(file_path)
                    .trim_start_matches('/')
            } else {
                file_path
            };

            if relative_path.is_empty() {
                continue;
            }

            let outpath = target_dir.join(relative_path);

            if file.is_dir() {
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
    fn set_executable_permissions(&self, install_dir: &PathBuf) -> Result<()> {
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

    /// 取消下载
    pub fn cancel_download(&self, version: &str) -> Result<()> {
        let task_id = format!("java-{}", version);
        DownloadManager::global().cancel_download(&task_id)
    }

    /// 获取下载进度
    pub fn get_download_progress(&self, version: &str) -> Option<DownloadTask> {
        let task_id = format!("java-{}", version);
        DownloadManager::global().get_task_status(&task_id)
    }

    /// 激活服务
    pub fn activate_service(&self, service_data: &ServiceData) -> Result<()> {
        let install_path = self.get_install_path(&service_data.version);

        if !self.is_installed(&service_data.version) {
            return Err(anyhow!("Java {} 未安装", service_data.version));
        }

        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

        let java_home = install_path.to_string_lossy().to_string();
        let bin_path = install_path.join("bin").to_string_lossy().to_string();

        shell_manager.add_export("JAVA_HOME", &java_home)?;
        shell_manager.add_path(&bin_path)?;

        let metadata_maven_home = service_data
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("MAVEN_HOME"))
            .and_then(|value| value.as_str())
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(|value| value.to_string());

        if let Some(maven_home) = metadata_maven_home {
            shell_manager.add_export("MAVEN_HOME", &maven_home)?;
            let maven_bin = format!("{}/bin", maven_home);
            shell_manager.add_path(&maven_bin)?;
        }

        let metadata_maven_repo_url = service_data
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("MAVEN_REPO_URL"))
            .and_then(|value| value.as_str())
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .unwrap_or(Self::DEFAULT_MAVEN_REPO_URL);
        shell_manager.add_export("MAVEN_REPO_URL", metadata_maven_repo_url)?;

        if let Some(metadata) = &service_data.metadata {
            if let Some(java_opts) = metadata.get("JAVA_OPTS").and_then(|v| v.as_str()) {
                shell_manager.add_export("JAVA_OPTS", java_opts)?;
            }

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
        }

        log::info!("Java {} 服务已激活", service_data.version);
        Ok(())
    }

    /// 取消激活服务
    pub fn deactivate_service(&self, service_data: &ServiceData) -> Result<()> {
        let install_path = self.get_install_path(&service_data.version);
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

        let bin_path = install_path.join("bin").to_string_lossy().to_string();
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

        shell_manager.delete_path(&bin_path)?;
        shell_manager.delete_export("JAVA_HOME")?;
        shell_manager.delete_export("JAVA_OPTS")?;
        shell_manager.delete_export("MAVEN_HOME")?;
        shell_manager.delete_export("MAVEN_REPO_URL")?;
        shell_manager.delete_export("GRADLE_HOME")?;

        log::info!("Java {} 服务已取消激活", service_data.version);
        Ok(())
    }

    /// 获取 Java 版本信息
    pub fn get_java_info(&self, service_data: &ServiceData) -> Result<serde_json::Value> {
        let install_path = self.get_install_path(&service_data.version);

        if !self.is_installed(&service_data.version) {
            return Err(anyhow!("Java {} 未安装", service_data.version));
        }

        let java_binary = if cfg!(target_os = "windows") {
            install_path.join("bin").join("java.exe")
        } else {
            install_path.join("bin").join("java")
        };

        let output = std::process::Command::new(&java_binary)
            .arg("-version")
            .output()?;

        let version_output = String::from_utf8_lossy(&output.stderr);
        
        let mut java_version = service_data.version.clone();
        let mut vendor = "Unknown".to_string();
        let mut runtime = "Unknown".to_string();

        for line in version_output.lines() {
            if line.contains("version") {
                if let Some(v) = line.split('"').nth(1) {
                    java_version = v.to_string();
                }
            }
            if line.contains("OpenJDK") || line.contains("Runtime") {
                runtime = line.trim().to_string();
            }
            if line.contains("build") {
                vendor = line.trim().to_string();
            }
        }

        Ok(serde_json::json!({
            "version": java_version,
            "vendor": vendor,
            "runtime": runtime,
            "vm": "Java HotSpot(TM) 64-Bit Server VM",
            "home": install_path.to_string_lossy(),
        }))
    }
}

impl ServiceLifecycle for JavaService {
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
