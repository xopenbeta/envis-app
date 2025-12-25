use crate::manager::file_manager::{FileManager, PathInfo};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::AppHandle;

/// 统一的命令返回结果
#[derive(Debug, Serialize, Deserialize)]
pub struct FileCommandResult {
    pub success: bool,
    pub message: String,
    pub data: Option<Value>,
}

/// 文件对话框过滤器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

/// 打开文件选择对话框（单个文件）
#[tauri::command]
pub async fn open_file_dialog(
    app_handle: AppHandle,
    title: Option<String>,
    filters: Option<Vec<FileFilter>>,
    default_path: Option<String>,
) -> Result<FileCommandResult, String> {
    // 转换过滤器格式
    let converted_filters: Option<Vec<(&str, Vec<&str>)>> = filters.as_ref().map(|f| {
        f.iter()
            .map(|filter| {
                let name = filter.name.as_str();
                let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
                (name, extensions)
            })
            .collect()
    });

    let filters_ref = converted_filters.as_ref().map(|f| {
        f.iter()
            .map(|(name, exts)| (*name, exts.as_slice()))
            .collect::<Vec<(&str, &[&str])>>()
    });

    let default_path = default_path.map(PathBuf::from);

    match FileManager::open_file_dialog(&app_handle, title.as_deref(), filters_ref, default_path)
        .await
    {
        Ok(Some(path)) => {
            let data = serde_json::json!({ "path": path.to_string_lossy().to_string() });
            Ok(FileCommandResult {
                success: true,
                message: "选择文件成功".to_string(),
                data: Some(data),
            })
        }
        Ok(None) => Ok(FileCommandResult {
            success: false,
            message: "用户取消选择".to_string(),
            data: None,
        }),
        Err(e) => Ok(FileCommandResult {
            success: false,
            message: format!("选择文件失败: {}", e),
            data: None,
        }),
    }
}

/// 打开文件选择对话框（多个文件）
#[tauri::command]
pub async fn open_files_dialog(
    app_handle: AppHandle,
    title: Option<String>,
    filters: Option<Vec<FileFilter>>,
    default_path: Option<String>,
) -> Result<FileCommandResult, String> {
    // 转换过滤器格式
    let converted_filters: Option<Vec<(&str, Vec<&str>)>> = filters.as_ref().map(|f| {
        f.iter()
            .map(|filter| {
                let name = filter.name.as_str();
                let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
                (name, extensions)
            })
            .collect()
    });

    let filters_ref = converted_filters.as_ref().map(|f| {
        f.iter()
            .map(|(name, exts)| (*name, exts.as_slice()))
            .collect::<Vec<(&str, &[&str])>>()
    });

    let default_path = default_path.map(PathBuf::from);

    match FileManager::open_files_dialog(&app_handle, title.as_deref(), filters_ref, default_path)
        .await
    {
        Ok(Some(paths)) => {
            let paths_str: Vec<String> = paths
                .into_iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            let data = serde_json::json!({ "paths": paths_str });
            Ok(FileCommandResult {
                success: true,
                message: "选择文件成功".to_string(),
                data: Some(data),
            })
        }
        Ok(None) => Ok(FileCommandResult {
            success: false,
            message: "用户取消选择".to_string(),
            data: None,
        }),
        Err(e) => Ok(FileCommandResult {
            success: false,
            message: format!("选择文件失败: {}", e),
            data: None,
        }),
    }
}

/// 打开文件夹选择对话框
#[tauri::command]
pub async fn open_folder_dialog(
    app_handle: AppHandle,
    title: Option<String>,
    default_path: Option<String>,
) -> Result<FileCommandResult, String> {
    let default_path = default_path.map(PathBuf::from);

    match FileManager::open_folder_dialog(&app_handle, title.as_deref(), default_path).await {
        Ok(Some(path)) => {
            let data = serde_json::json!({ "path": path.to_string_lossy().to_string() });
            Ok(FileCommandResult {
                success: true,
                message: "选择文件夹成功".to_string(),
                data: Some(data),
            })
        }
        Ok(None) => Ok(FileCommandResult {
            success: false,
            message: "用户取消选择".to_string(),
            data: None,
        }),
        Err(e) => Ok(FileCommandResult {
            success: false,
            message: format!("选择文件夹失败: {}", e),
            data: None,
        }),
    }
}

/// 在系统文件管理器中打开路径
#[tauri::command]
pub async fn open_in_file_manager(path: String) -> Result<FileCommandResult, String> {
    match FileManager::open_in_file_manager(&path) {
        Ok(()) => Ok(FileCommandResult {
            success: true,
            message: "打开文件管理器成功".to_string(),
            data: None,
        }),
        Err(e) => Ok(FileCommandResult {
            success: false,
            message: format!("打开文件管理器失败: {}", e),
            data: None,
        }),
    }
}
