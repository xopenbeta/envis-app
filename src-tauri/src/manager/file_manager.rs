use anyhow::{Context, Result};
use std::path::PathBuf;
use std::process::Command;
use std::sync::OnceLock;
use tauri::AppHandle;

/// 文件管理器，提供文件和文件夹操作功能
pub struct FileManager;

static INSTANCE: OnceLock<FileManager> = OnceLock::new();

impl FileManager {
    /// 获取单例实例
    pub fn instance() -> &'static FileManager {
        INSTANCE.get_or_init(|| FileManager::new())
    }

    /// 创建新的文件管理器实例（私有方法）
    fn new() -> Self {
        Self
    }

    /// 打开文件选择对话框，选择单个文件
    pub async fn open_file_dialog(
        app_handle: &AppHandle,
        title: Option<&str>,
        filters: Option<Vec<(&str, &[&str])>>,
        default_path: Option<PathBuf>,
    ) -> Result<Option<PathBuf>> {
        use tauri_plugin_dialog::DialogExt;
        use tokio::sync::oneshot;

        let mut dialog = app_handle.dialog().file();

        // 设置标题
        if let Some(title) = title {
            dialog = dialog.set_title(title);
        }

        // 设置文件过滤器
        if let Some(filters) = filters {
            for (name, extensions) in filters {
                dialog = dialog.add_filter(name, extensions);
            }
        }

        // 设置默认路径
        if let Some(default_path) = default_path {
            dialog = dialog.set_directory(default_path);
        }

        let (tx, rx) = oneshot::channel();
        dialog.pick_file(move |file_path| {
            let _ = tx.send(file_path);
        });

        let file_path = rx
            .await
            .map_err(|_| anyhow::anyhow!("Failed to receive file path"))?;
        Ok(file_path.and_then(|f| f.as_path().map(|p| p.to_owned())))
    }

    /// 打开文件选择对话框，选择多个文件
    pub async fn open_files_dialog(
        app_handle: &AppHandle,
        title: Option<&str>,
        filters: Option<Vec<(&str, &[&str])>>,
        default_path: Option<PathBuf>,
    ) -> Result<Option<Vec<PathBuf>>> {
        use tauri_plugin_dialog::DialogExt;
        use tokio::sync::oneshot;

        let mut dialog = app_handle.dialog().file();

        // 设置标题
        if let Some(title) = title {
            dialog = dialog.set_title(title);
        }

        // 设置文件过滤器
        if let Some(filters) = filters {
            for (name, extensions) in filters {
                dialog = dialog.add_filter(name, extensions);
            }
        }

        // 设置默认路径
        if let Some(default_path) = default_path {
            dialog = dialog.set_directory(default_path);
        }

        let (tx, rx) = oneshot::channel();
        dialog.pick_files(move |file_paths| {
            let _ = tx.send(file_paths);
        });

        let file_paths = rx
            .await
            .map_err(|_| anyhow::anyhow!("Failed to receive file paths"))?;
        Ok(file_paths.map(|paths| {
            paths
                .into_iter()
                .filter_map(|f| f.as_path().map(|p| p.to_owned()))
                .collect()
        }))
    }

    /// 打开文件夹选择对话框
    pub async fn open_folder_dialog(
        app_handle: &AppHandle,
        title: Option<&str>,
        default_path: Option<PathBuf>,
    ) -> Result<Option<PathBuf>> {
        use tauri_plugin_dialog::DialogExt;
        use tokio::sync::oneshot;

        let mut dialog = app_handle.dialog().file();

        // 设置标题
        if let Some(title) = title {
            dialog = dialog.set_title(title);
        }

        // 设置默认路径
        if let Some(default_path) = default_path {
            dialog = dialog.set_directory(default_path);
        }

        let (tx, rx) = oneshot::channel();
        dialog.pick_folder(move |folder_path| {
            let _ = tx.send(folder_path);
        });

        let folder_path = rx
            .await
            .map_err(|_| anyhow::anyhow!("Failed to receive folder path"))?;
        Ok(folder_path.and_then(|f| f.as_path().map(|p| p.to_owned())))
    }

    /// 在系统文件管理器中打开指定路径
    /// macOS: 在 Finder 中打开
    /// Windows: 在资源管理器中打开
    /// Linux: 在默认文件管理器中打开
    pub fn open_in_file_manager<P: AsRef<std::path::Path>>(path: P) -> Result<()> {
        let path = path.as_ref();

        // 如果路径不存在，尝试打开其父目录
        let target_path = if !path.exists() {
            // 如果路径看起来像文件（有扩展名），尝试获取父目录
            if let Some(parent) = path.parent() {
                if parent.exists() {
                    log::warn!(
                        "路径 {} 不存在，尝试打开父目录: {}",
                        path.display(),
                        parent.display()
                    );
                    parent
                } else {
                    return Err(anyhow::anyhow!(
                        "路径及其父目录均不存在: {}",
                        path.display()
                    ));
                }
            } else {
                return Err(anyhow::anyhow!("路径不存在: {}", path.display()));
            }
        } else {
            path
        };

        #[cfg(target_os = "macos")]
        {
            // macOS: 使用 open 命令在 Finder 中打开
            let mut command = Command::new("open");
            if target_path.is_file() {
                // 如果是文件，选中该文件
                command.arg("-R").arg(target_path);
            } else {
                // 如果是文件夹，直接打开
                command.arg(target_path);
            }

            command.status().context("在 Finder 中打开路径失败")?;
        }

        #[cfg(target_os = "windows")]
        {
            // Windows: 使用 explorer 命令
            let mut command = Command::new("explorer");
            if target_path.is_file() {
                // 如果是文件，选中该文件
                command.arg("/select,").arg(target_path);
            } else {
                // 如果是文件夹，直接打开
                command.arg(target_path);
            }

            command.status().context("在资源管理器中打开路径失败")?;
        }

        #[cfg(target_os = "linux")]
        {
            // Linux: 尝试使用 xdg-open
            let mut command = Command::new("xdg-open");
            if target_path.is_file() {
                // 如果是文件，打开其父目录
                if let Some(parent) = target_path.parent() {
                    command.arg(parent);
                } else {
                    command.arg(target_path);
                }
            } else {
                // 如果是文件夹，直接打开
                command.arg(target_path);
            }

            command.status().context("在文件管理器中打开路径失败")?;
        }

        Ok(())
    }

    /// 在 Finder 中显示文件（macOS 专用）
    #[cfg(target_os = "macos")]
    pub fn reveal_in_finder<P: AsRef<std::path::Path>>(path: P) -> Result<()> {
        let path = path.as_ref();

        // 检查路径是否存在
        if !path.exists() {
            return Err(anyhow::anyhow!("路径不存在: {}", path.display()));
        }

        // 使用 open -R 命令在 Finder 中选中文件
        let status = Command::new("open")
            .arg("-R")
            .arg(path)
            .status()
            .context("在 Finder 中显示文件失败")?;

        if !status.success() {
            return Err(anyhow::anyhow!("在 Finder 中显示文件失败"));
        }

        Ok(())
    }

    /// 获取文件/文件夹的信息
    pub fn get_path_info<P: AsRef<std::path::Path>>(path: P) -> Result<PathInfo> {
        let path = path.as_ref();
        let metadata =
            std::fs::metadata(path).context(format!("获取路径信息失败: {}", path.display()))?;

        Ok(PathInfo {
            path: path.to_path_buf(),
            is_file: metadata.is_file(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified: metadata.modified().ok(),
            created: metadata.created().ok(),
        })
    }

    /// 检查路径是否存在
    pub fn path_exists<P: AsRef<std::path::Path>>(path: P) -> bool {
        path.as_ref().exists()
    }

    /// 创建目录（如果不存在）
    pub fn create_dir_if_not_exists<P: AsRef<std::path::Path>>(path: P) -> Result<()> {
        let path = path.as_ref();
        if !path.exists() {
            std::fs::create_dir_all(path).context(format!("创建目录失败: {}", path.display()))?;
        }
        Ok(())
    }
}

/// 路径信息结构
#[derive(Debug, Clone)]
pub struct PathInfo {
    pub path: PathBuf,
    pub is_file: bool,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<std::time::SystemTime>,
    pub created: Option<std::time::SystemTime>,
}

impl Default for FileManager {
    fn default() -> Self {
        Self::new()
    }
}
