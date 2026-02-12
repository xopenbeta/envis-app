use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadTask};
use crate::manager::shell_manamger::ShellManager;
use crate::types::ServiceData;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

use std::process::Command;

/// Python 安装模式
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PythonInstallMode {
    /// 预编译二进制（默认，来自 astral-sh/python-build-standalone）
    Prebuilt,
    /// 使用 python-build 编译（来自 pyenv 项目）
    PythonBuild,
    /// 本地编译（使用 configure + make）
    LocalBuild,
}

impl Default for PythonInstallMode {
    fn default() -> Self {
        Self::Prebuilt
    }
}

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

    /// 获取 Python 可执行文件路径
    pub fn get_executable_path(&self, version: &str) -> PathBuf {
        let install_path = self.get_install_path(version);
        if cfg!(target_os = "windows") {
            install_path.join("python.exe")
        } else {
            // Check bin/python3 first
            let p3 = install_path.join("bin").join("python3");
            if p3.exists() {
                p3
            } else {
                install_path.join("bin").join("python")
            }
        }
    }

    /// 检查指定版本的 Python 是否支持 venv
    pub fn check_venv_support(&self, version: &str) -> bool {
        let python_path = self.get_executable_path(version);
        if !python_path.exists() {
            return false;
        }

        // 执行 python -m venv --help
        if let Ok(output) = Command::new(python_path)
            .args(&["-m", "venv", "--help"])
            .output()
        {
            return output.status.success();
        }
        false
    }

    /// 获取 venvs 存储目录
    pub fn get_venvs_dir(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<PathBuf> {
        let env_manager = EnvServDataManager::global();
        let env_manager = env_manager.lock().unwrap();
        let (_, _, _, _, service_data_folder, _) =
            env_manager.build_service_paths(environment_id, service_data)?;
        Ok(service_data_folder.join("venvs"))
    }

    /// 获取虚拟环境列表
    pub fn list_venvs(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<Vec<String>> {
        let venvs_dir = self.get_venvs_dir(environment_id, service_data)?;
        if !venvs_dir.exists() {
            return Ok(vec![]);
        }

        let mut venvs = Vec::new();
        for entry in std::fs::read_dir(venvs_dir)? {
            let entry = entry?;
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    venvs.push(name.to_string());
                }
            }
        }
        Ok(venvs)
    }

    /// 创建虚拟环境
    pub fn create_venv(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
        venv_name: &str,
    ) -> Result<()> {
        let python_path = self.get_executable_path(&service_data.version);
        let venvs_dir = self.get_venvs_dir(environment_id, service_data)?;
        if !venvs_dir.exists() {
            std::fs::create_dir_all(&venvs_dir)?;
        }
        let venv_path = venvs_dir.join(venv_name);

        let output = Command::new(python_path)
            .args(&["-m", "venv", venv_path.to_str().unwrap()])
            .output()?;

        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "创建 venv 失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    }

    /// 删除虚拟环境
    pub fn remove_venv(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
        venv_name: &str,
    ) -> Result<()> {
        let venvs_dir = self.get_venvs_dir(environment_id, service_data)?;
        let venv_path = venvs_dir.join(venv_name);
        if venv_path.exists() {
            std::fs::remove_dir_all(venv_path)?;
        }
        Ok(())
    }

    /// 创建新的 Python 服务管理器（内部使用）
    fn new() -> Self {
        Self {}
    }

    /// 获取可用的 Python 版本列表（仅包含已预编译的版本）
    pub fn get_available_versions(&self) -> Vec<PythonVersion> {
        vec![
            PythonVersion {
                version: "3.13.1".to_string(),
                date: "2024-12-09".to_string(),
            },
            PythonVersion {
                version: "2.7.18".to_string(),
                date: "2020-04-20".to_string(),
            },
        ]
    }

    /// 检查 Python 是否已安装
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        if cfg!(target_os = "windows") {
            install_path.join("python.exe").exists()
        } else {
            install_path.join("bin").join("python3").exists() || 
            install_path.join("bin").join("python").exists() ||
            install_path.join("bin").join("python2").exists()
        }
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

    /// 构建下载 URL 和文件名（根据安装模式）
    fn build_download_info(&self, version: &str, mode: PythonInstallMode) -> Result<(Vec<String>, String)> {
        match mode {
            PythonInstallMode::Prebuilt => self.build_prebuilt_download_info(version),
            PythonInstallMode::PythonBuild | PythonInstallMode::LocalBuild => self.build_source_download_info(version),
        }
    }

    /// 构建预编译二进制下载 URL（from xopenbeta/python-archive）
    fn build_prebuilt_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        // 确定操作系统和架构 - 使用实际的文件命名格式
        let (os, arch) = if cfg!(target_os = "macos") {
            if cfg!(target_arch = "aarch64") {
                ("macos", "arm64")
            } else {
                ("macos", "x86_64")
            }
        } else if cfg!(target_os = "linux") {
            if cfg!(target_arch = "aarch64") {
                ("linux", "aarch64")
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

        // 确定文件扩展名
        let ext = if cfg!(target_os = "windows") {
            "zip"
        } else {
            "tar.gz"
        };

        // 构建文件名: python-3.13.1-macos-arm64.tar.gz
        let filename = format!("python-{}-{}-{}.{}", version, os, arch, ext);
        
        // GitHub releases URL - 使用 latest 标签访问最新的 release
        // 所有 Python 版本都打包在同一个 release 中
        let github_url = format!(
            "https://github.com/xopenbeta/python-archive/releases/latest/download/{}",
            filename
        );

        Ok((vec![github_url], filename))
    }

    /// 构建 Python 2.7 官方预编译包下载信息
    /// macOS: .pkg 安装包（可用 pkgutil 解包提取）
    /// Windows: .msi 安装包（可用 msiexec 静默解压）
    /// Linux: 无官方预编译包，自动回退到源码编译
    fn build_python27_prebuilt_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
        if cfg!(target_os = "macos") {
            let filename = format!("python-{}-macosx10.9.pkg", version);
            let url = format!(
                "https://www.python.org/ftp/python/{}/{}",
                version, filename
            );
            Ok((vec![url], filename))
        } else if cfg!(target_os = "windows") {
            let filename = if cfg!(target_arch = "x86_64") {
                format!("python-{}.amd64.msi", version)
            } else {
                format!("python-{}.msi", version)
            };
            let url = format!(
                "https://www.python.org/ftp/python/{}/{}",
                version, filename
            );
            Ok((vec![url], filename))
        } else {
            // Linux 没有官方预编译包，回退到源码
            log::warn!("Linux 平台无 Python 2.7 官方预编译包，将使用源码编译");
            self.build_source_download_info(version)
        }
    }

    /// 构建源码下载 URL（for python-build or local build）
    fn build_source_download_info(&self, version: &str) -> Result<(Vec<String>, String)> {
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

    /// 下载并安装 Python（指定安装模式）
    pub async fn download_and_install_with_mode(&self, version: &str, mode: PythonInstallMode) -> Result<DownloadResult> {

        if self.is_installed(version) {
            return Ok(DownloadResult {
                success: false,
                message: "Python 已安装".to_string(),
                task: None,
            });
        }

        let (urls, filename) = self.build_download_info(version, mode)?;
        let install_path = self.get_install_path(version);
        let task_id = format!("python-{}", version);

        let download_manager = DownloadManager::global();
        let version_for_callback = version.to_string();
        let mode_for_callback = mode;

        let success_callback = Arc::new(move |task: &DownloadTask| {
            log::info!(
                "Python {} 下载完成: {} - {} (模式: {:?})",
                version_for_callback,
                task.id,
                task.filename,
                mode_for_callback
            );

            // 异步执行安装步骤
            let task_for_spawn = task.clone();
            let version_for_spawn = version_for_callback.clone();
            let mode_for_spawn = mode_for_callback;
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
                    log::info!("Python {} 开始安装 (模式: {:?})", version_for_spawn, mode_for_spawn);
                }

                // 执行安装（统一方法，根据模式选择）
                match service_for_spawn
                    .install(&task_for_spawn, &version_for_spawn, mode_for_spawn)
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

    /// 统一的安装方法（根据模式选择安装方式）
    pub async fn install(&self, task: &DownloadTask, version: &str, mode: PythonInstallMode) -> Result<()> {
        match mode {
            PythonInstallMode::Prebuilt => self.install_prebuilt(task, version).await,
            PythonInstallMode::PythonBuild => self.install_with_python_build(task, version).await,
            PythonInstallMode::LocalBuild => self.install_with_local_build(task, version).await,
        }
    }

    /// 安装预编译的 Python 二进制
    async fn install_prebuilt(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let archive_path = &task.target_path;
        let install_dir = self.get_install_path(version);
        
        // 确保安装目录存在
        std::fs::create_dir_all(&install_dir)?;

        log::info!("正在解压预编译 Python 到: {:?}", install_dir);
        
        // 根据文件类型选择解压方式
        if archive_path.extension().and_then(|s| s.to_str()) == Some("zip") {
            // Windows: 解压 zip
            log::info!("检测到 zip 文件，使用 zip 解压...");
            self.extract_zip(archive_path, &install_dir).await?;
        } else {
            // Linux/macOS: 解压 tar.gz
            let status = Command::new("tar")
                .arg("-xzf")
                .arg(archive_path)
                .arg("-C")
                .arg(&install_dir)
                .arg("--strip-components=1")  // 移除顶层目录
                .status()?;

            if !status.success() {
                return Err(anyhow!("解压预编译 Python 失败"));
            }
        }

        // 设置可执行权限（Unix 系统）
        #[cfg(not(target_os = "windows"))]
        {
            let bin_dir = install_dir.join("bin");
            if bin_dir.exists() {
                use std::os::unix::fs::PermissionsExt;
                for entry in std::fs::read_dir(&bin_dir)? {
                    let entry = entry?;
                    let bin_path = entry.path();
                    if bin_path.is_file() {
                        if let Ok(metadata) = std::fs::metadata(&bin_path) {
                            let mut perms = metadata.permissions();
                            perms.set_mode(0o755);
                            if let Err(e) = std::fs::set_permissions(&bin_path, perms) {
                                log::warn!("无法设置权限 {:?}: {}", bin_path, e);
                            }
                        }
                    }
                }
                log::info!("已设置 bin/ 目录下所有文件的可执行权限");
            }
        }

        // macOS: 修复动态链接库路径
        #[cfg(target_os = "macos")]
        {
            log::info!("正在修复 macOS 动态链接库路径...");
            if let Err(e) = self.fix_macos_dylib_paths(&install_dir, version) {
                log::warn!("修复动态链接库路径时出现警告: {}", e);
            } else {
                log::info!("动态链接库路径修复完成");
            }
        }

        // 清理压缩包
        log::info!("清理临时文件...");
        std::fs::remove_file(archive_path)?;

        log::info!("Python {} 预编译版本安装完成", version);

        Ok(())
    }

    /// 安装 Python 2.7 官方预编译包
    /// macOS: 从 .pkg 中提取 Python framework
    /// Windows: 从 .msi 中静默解压
    async fn install_prebuilt_python27(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let archive_path = &task.target_path;
        let install_dir = self.get_install_path(version);
        
        std::fs::create_dir_all(&install_dir)?;

        if cfg!(target_os = "macos") {
            self.install_python27_from_pkg(archive_path, &install_dir, version)?
        } else if cfg!(target_os = "windows") {
            self.install_python27_from_msi(archive_path, &install_dir, version)?
        } else {
            return Err(anyhow!("Linux 平台不支持 Python 2.7 预编译安装，请使用源码编译模式"));
        }

        // 清理安装包
        log::info!("清理临时文件...");
        if archive_path.exists() {
            std::fs::remove_file(archive_path)?;
        }

        log::info!("Python {} 预编译版本安装完成", version);
        Ok(())
    }

    /// 从 macOS .pkg 安装包中提取 Python 2.7
    /// .pkg 是 xar 归档，内含 Payload (cpio 格式)，可以无需 root 权限提取
    fn install_python27_from_pkg(&self, pkg_path: &PathBuf, install_dir: &PathBuf, version: &str) -> Result<()> {
        log::info!("正在从 macOS .pkg 中提取 Python {} ...", version);
        
        // 创建临时解包目录
        let tmp_dir = install_dir.parent().unwrap().join(format!("pkg-extract-{}", version));
        if tmp_dir.exists() {
            std::fs::remove_dir_all(&tmp_dir)?;
        }
        std::fs::create_dir_all(&tmp_dir)?;

        // Step 1: 使用 pkgutil 展开 .pkg
        log::info!("Step 1: pkgutil --expand-full ...");
        let status = Command::new("pkgutil")
            .arg("--expand-full")
            .arg(pkg_path)
            .arg(&tmp_dir.join("expanded"))
            .status()?;

        if !status.success() {
            // 清理
            let _ = std::fs::remove_dir_all(&tmp_dir);
            return Err(anyhow!("pkgutil --expand-full 失败"));
        }

        // Step 2: 在展开的目录中查找 Python framework 文件
        // 典型结构: expanded/Python_Framework.pkg/Payload/Library/Frameworks/Python.framework/Versions/2.7/
        let expanded_dir = tmp_dir.join("expanded");
        log::info!("Step 2: 在 {:?} 中搜索 Python framework...", expanded_dir);
        
        let python_framework_path = self.find_python27_in_expanded_pkg(&expanded_dir, version)?;
        log::info!("找到 Python framework: {:?}", python_framework_path);

        // Step 3: 将 Python framework 的内容复制到安装目录
        // framework 结构: bin/, lib/, include/, share/ 等
        log::info!("Step 3: 复制 Python 到安装目录 {:?}", install_dir);
        self.copy_python27_framework(&python_framework_path, install_dir)?;

        // Step 4: 修复 bin 目录中的可执行文件权限
        #[cfg(not(target_os = "windows"))]
        {
            let bin_dir = install_dir.join("bin");
            if bin_dir.exists() {
                use std::os::unix::fs::PermissionsExt;
                for entry in std::fs::read_dir(&bin_dir)? {
                    let entry = entry?;
                    if entry.path().is_file() {
                        let mut perms = std::fs::metadata(entry.path())?.permissions();
                        perms.set_mode(0o755);
                        std::fs::set_permissions(entry.path(), perms)?;
                    }
                }
                log::info!("已设置 bin/ 目录下所有文件的可执行权限");
            }
        }

        // 清理临时目录
        log::info!("清理临时解包目录...");
        let _ = std::fs::remove_dir_all(&tmp_dir);

        Ok(())
    }

    /// 在展开的 .pkg 目录中查找 Python 2.7 framework 路径
    fn find_python27_in_expanded_pkg(&self, expanded_dir: &PathBuf, version: &str) -> Result<PathBuf> {
        let major_minor = if let Some(pos) = version.rfind('.') {
            &version[..pos]  // "2.7.18" -> "2.7"
        } else {
            version
        };

        // 搜索模式:
        // 1. expanded/Python_Framework.pkg/Payload/Library/Frameworks/Python.framework/Versions/2.7
        // 2. 递归搜索包含 Versions/2.7 的路径
        for entry in walkdir_recursive(expanded_dir)? {
            let path = entry;
            if path.is_dir() {
                let path_str = path.to_string_lossy();
                if path_str.ends_with(&format!("Versions/{}", major_minor)) 
                    && path_str.contains("Python.framework") {
                    return Ok(path);
                }
            }
        }

        // 如果没找到 framework 格式, 尝试找 Payload 目录
        for entry in walkdir_recursive(expanded_dir)? {
            let path = entry;
            if path.is_dir() && path.file_name().map_or(false, |n| n == "Payload") {
                // 检查 Payload 下是否有 bin/python2.7 之类的
                let bin_check = path.join("usr").join("local").join("bin").join("python2.7");
                if bin_check.exists() {
                    return Ok(path.join("usr").join("local"));
                }
            }
        }

        Err(anyhow!("在 .pkg 展开目录中未找到 Python {} framework", version))
    }

    /// 将 Python 2.7 framework 内容复制到安装目录
    fn copy_python27_framework(&self, framework_path: &PathBuf, install_dir: &PathBuf) -> Result<()> {
        // Python.framework/Versions/2.7/ 下通常有: bin/, lib/, include/, share/
        for entry in std::fs::read_dir(framework_path)? {
            let entry = entry?;
            let src = entry.path();
            let dest = install_dir.join(entry.file_name());
            
            if src.is_dir() {
                copy_dir_recursive(&src, &dest)?;
            } else {
                std::fs::copy(&src, &dest)?;
            }
        }
        Ok(())
    }

    /// 从 Windows .msi 安装包中提取 Python 2.7
    fn install_python27_from_msi(&self, msi_path: &PathBuf, install_dir: &PathBuf, version: &str) -> Result<()> {
        log::info!("正在从 Windows .msi 中提取 Python {} ...", version);
        
        // 使用 msiexec 静默解压到指定目录
        // msiexec /a <msi_path> /qn TARGETDIR=<install_dir>
        let status = Command::new("msiexec")
            .arg("/a")
            .arg(msi_path)
            .arg("/qn")
            .arg(format!("TARGETDIR={}", install_dir.to_string_lossy()))
            .status()?;

        if !status.success() {
            return Err(anyhow!("msiexec 解压失败"));
        }

        log::info!("Python {} 从 .msi 提取完成", version);
        Ok(())
    }

    /// 使用 python-build 工具安装
    async fn install_with_python_build(&self, task: &DownloadTask, version: &str) -> Result<()> {
        let install_dir = self.get_install_path(version);
        
        // 确保安装目录存在
        std::fs::create_dir_all(&install_dir)?;

        log::info!("使用 python-build 编译安装 Python {}...", version);

        // 检查是否安装了 python-build（来自 pyenv）
        let python_build_check = Command::new("python-build")
            .arg("--version")
            .output();

        if python_build_check.is_err() || !python_build_check.unwrap().status.success() {
            return Err(anyhow!(
                "python-build 未安装。请先安装 pyenv 或独立的 python-build 工具。\n\
                安装方法:\n\
                - macOS: brew install pyenv\n\
                - Linux: curl https://pyenv.run | bash\n\
                - 或访问: https://github.com/pyenv/pyenv#installation"
            ));
        }

        log::info!("开始使用 python-build 编译 Python... 这可能需要较长时间");

        // 使用 python-build 编译安装
        // python-build <version> <install_path>
        let status = Command::new("python-build")
            .arg(version)
            .arg(&install_dir)
            .env("PYTHON_BUILD_CACHE_PATH", task.target_path.parent().unwrap())
            .status()?;

        if !status.success() {
            return Err(anyhow!("python-build 编译失败"));
        }

        // 清理下载的源码包（如果存在）
        log::info!("清理临时文件...");
        if task.target_path.exists() {
            let _ = std::fs::remove_file(&task.target_path);
        }

        log::info!("Python {} 使用 python-build 编译完成", version);

        Ok(())
    }

    /// 使用本地编译安装（configure + make）
    async fn install_with_local_build(&self, task: &DownloadTask, version: &str) -> Result<()> {
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

        log::info!("Python {} 本地编译安装完成", version);

        Ok(())
    }

    /// 修复 macOS 动态链接库路径
    /// 使用 install_name_tool 将硬编码的编译时路径替换为实际安装路径
    #[cfg(target_os = "macos")]
    fn fix_macos_dylib_paths(&self, install_dir: &PathBuf, version: &str) -> Result<()> {
        let lib_dir = install_dir.join("lib");
        let bin_dir = install_dir.join("bin");

        // 获取 Python 的主版本号 (例如 "2.7" 或 "3.13")
        let major_minor = if let Some(pos) = version.rfind('.') {
            &version[..pos]
        } else {
            version
        };

        // 1. 找到主 dylib 文件
        let dylib_name = if version.starts_with("2.") {
            format!("libpython{}.dylib", major_minor)
        } else {
            format!("libpython{}.dylib", major_minor)
        };

        let actual_dylib_path = lib_dir.join(&dylib_name);
        
        if !actual_dylib_path.exists() {
            log::warn!("未找到主 dylib 文件: {:?}", actual_dylib_path);
            return Ok(()); // 不是致命错误，可能是静态编译的
        }

        log::info!("找到主 dylib: {:?}", actual_dylib_path);

        // 2. 修复所有可执行文件中的 dylib 引用
        if bin_dir.exists() {
            for entry in std::fs::read_dir(&bin_dir)? {
                let entry = entry?;
                let bin_path = entry.path();
                
                if bin_path.is_file() && !bin_path.is_symlink() {
                    // 检查是否是可执行文件
                    if let Ok(metadata) = std::fs::metadata(&bin_path) {
                        use std::os::unix::fs::PermissionsExt;
                        if metadata.permissions().mode() & 0o111 != 0 {
                            self.fix_binary_dylib_path(&bin_path, &actual_dylib_path, version)?;
                        }
                    }
                }
            }
        }

        // 3. 修复 lib 目录中所有 dylib 的 install_name
        if lib_dir.exists() {
            for entry in walkdir_recursive(&lib_dir)? {
                if entry.is_file() {
                    let path_str = entry.to_string_lossy();
                    if path_str.ends_with(".dylib") || path_str.contains(".dylib.") {
                        self.fix_dylib_install_name(&entry)?;
                    }
                }
            }
        }

        Ok(())
    }

    /// 修复单个二进制文件的 dylib 引用
    #[cfg(target_os = "macos")]
    fn fix_binary_dylib_path(&self, bin_path: &PathBuf, actual_dylib_path: &PathBuf, version: &str) -> Result<()> {
        // 检查当前的依赖路径
        let output = Command::new("otool")
            .arg("-L")
            .arg(bin_path)
            .output()?;

        if !output.status.success() {
            return Ok(()); // 不是 Mach-O 文件，跳过
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        
        // 查找所有包含错误路径的 dylib 引用
        for line in output_str.lines() {
            let line = line.trim();
            
            // 匹配类似 "/Users/runner/work/python-archive/python-archive/dist/python-2.7.18/lib/libpython2.7.dylib"
            if line.contains("/Users/runner/") || line.contains("/python-archive/") {
                if let Some(dylib_path) = line.split_whitespace().next() {
                    log::info!("修复 {:?} 中的路径: {}", bin_path.file_name().unwrap(), dylib_path);
                    
                    // 使用 install_name_tool 替换路径
                    let status = Command::new("install_name_tool")
                        .arg("-change")
                        .arg(dylib_path)
                        .arg(actual_dylib_path)
                        .arg(bin_path)
                        .status()?;

                    if !status.success() {
                        log::warn!("install_name_tool 执行失败，但继续...");
                    }
                }
            }
        }

        // 添加 rpath 指向 lib 目录
        let lib_dir = actual_dylib_path.parent().unwrap();
        let _ = Command::new("install_name_tool")
            .arg("-add_rpath")
            .arg(lib_dir)
            .arg(bin_path)
            .status(); // 忽略错误（可能已存在）

        Ok(())
    }

    /// 修复 dylib 的 install_name (自身ID)
    #[cfg(target_os = "macos")]
    fn fix_dylib_install_name(&self, dylib_path: &PathBuf) -> Result<()> {
        // 检查当前的 install_name
        let output = Command::new("otool")
            .arg("-D")
            .arg(dylib_path)
            .output()?;

        if !output.status.success() {
            return Ok(());
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        
        // 如果 install_name 包含错误路径，修复它
        for line in output_str.lines().skip(1) { // 跳过第一行（文件名）
            let line = line.trim();
            if line.contains("/Users/runner/") || line.contains("/python-archive/") {
                // 设置新的 install_name 为相对路径或 @rpath
                let dylib_name = dylib_path.file_name().unwrap().to_string_lossy();
                let new_install_name = format!("@rpath/{}", dylib_name);
                
                log::info!("修复 dylib install_name: {:?} -> {}", dylib_name, new_install_name);
                
                let status = Command::new("install_name_tool")
                    .arg("-id")
                    .arg(&new_install_name)
                    .arg(dylib_path)
                    .status()?;

                if !status.success() {
                    log::warn!("设置 install_name 失败: {:?}", dylib_path);
                }
                
                break;
            }
        }

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

    /// 解压 zip 格式文件 (用于 Windows 预编译版本)
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
            shell_manager.add_alias("pip", "pip3")?;
            log::info!("已设置 python3 别名为 python，pip3 别名为 pip");
        } else {
            // 删除 alias
            shell_manager.delete_alias("python")?;
            shell_manager.delete_alias("pip")?;
            log::info!("已移除 python 和 pip 别名");
        }

        Ok(())
    }
}

/// 递归遍历目录，返回所有路径
fn walkdir_recursive(dir: &PathBuf) -> Result<Vec<PathBuf>> {
    let mut results = Vec::new();
    if !dir.exists() {
        return Ok(results);
    }
    
    let mut stack = vec![dir.clone()];
    while let Some(current) = stack.pop() {
        if current.is_dir() {
            results.push(current.clone());
            for entry in std::fs::read_dir(&current)? {
                let entry = entry?;
                stack.push(entry.path());
            }
        } else {
            results.push(current);
        }
    }
    Ok(results)
}

/// 递归复制目录
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<()> {
    if !dst.exists() {
        std::fs::create_dir_all(dst)?;
    }
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if src_path.is_symlink() {
            // 保留符号链接
            let link_target = std::fs::read_link(&src_path)?;
            #[cfg(unix)]
            std::os::unix::fs::symlink(&link_target, &dst_path)?;
            #[cfg(windows)]
            {
                if link_target.is_dir() {
                    std::os::windows::fs::symlink_dir(&link_target, &dst_path)?;
                } else {
                    std::os::windows::fs::symlink_file(&link_target, &dst_path)?;
                }
            }
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}
