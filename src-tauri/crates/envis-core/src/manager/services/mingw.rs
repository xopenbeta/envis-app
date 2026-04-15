use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::services::traits::ServiceLifecycle;
use crate::manager::services::{DownloadManager, DownloadResult, DownloadTask};
use crate::manager::shell_manamger::ShellManager;
use crate::types::ServiceData;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

/// MinGW 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinGWVersion {
    pub version: String,
    pub date: String,
}

/// 全局 MinGW 服务管理器单例
static GLOBAL_MINGW_SERVICE: OnceLock<Arc<MinGWService>> = OnceLock::new();

/// MinGW 服务管理器
pub struct MinGWService {}

impl MinGWService {
    /// 获取全局 MinGW 服务管理器单例
    pub fn global() -> Arc<MinGWService> {
        GLOBAL_MINGW_SERVICE
            .get_or_init(|| Arc::new(MinGWService::new()))
            .clone()
    }

    /// 创建新的 MinGW 服务管理器
    pub fn new() -> Self {
        Self {}
    }

    /// 获取可用的 MinGW 版本列表
    pub fn get_available_versions(&self) -> Vec<MinGWVersion> {
        vec![
            MinGWVersion {
                version: "13.2.0".to_string(),
                date: "2023-08-01".to_string(),
            },
            MinGWVersion {
                version: "14.1.0".to_string(),
                date: "2024-05-01".to_string(),
            },
        ]
    }

    /// 检查 MinGW 是否已安装
    pub fn is_installed(&self, version: &str) -> bool {
        let install_path = self.get_install_path(version);
        let gcc_binary = if cfg!(target_os = "windows") {
            install_path.join("bin").join("gcc.exe")
        } else {
            install_path.join("bin").join("gcc")
        };
        gcc_binary.exists()
    }

    /// 获取 MinGW 安装路径
    fn get_install_path(&self, version: &str) -> PathBuf {
        let services_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            std::path::PathBuf::from(app_config_manager.get_services_folder())
        };
        services_folder.join("mingw").join(version)
    }

    /// 激活 MinGW 服务并将其添加到环境
    pub fn activate_service(&self, service_data: &ServiceData) -> Result<()> {
        let install_path = self.get_install_path(&service_data.version);

        if !self.is_installed(&service_data.version) {
            return Err(anyhow!("MinGW 版本 {} 未安装", service_data.version));
        }

        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

        let bin_path = install_path.join("bin").to_string_lossy().to_string();
        shell_manager.add_path(&bin_path)?;

        Ok(())
    }

    /// 停用 MinGW 服务并将其从环境中移除
    pub fn deactivate_service(&self, service_data: &ServiceData) -> Result<()> {
        let install_path = self.get_install_path(&service_data.version);

        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();

        let bin_path = install_path.join("bin").to_string_lossy().to_string();
        shell_manager.delete_path(&bin_path)?;

        Ok(())
    }
}

impl ServiceLifecycle for MinGWService {
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
