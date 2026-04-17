use anyhow::{anyhow, Context, Result};
use serde_json;
use std::sync::{Arc, OnceLock};

use crate::manager::host_manager::{HostEntry, HostManager};
use crate::manager::services::traits::ServiceLifecycle;
use crate::types::ServiceData;

static GLOBAL_HOST_SERVICE: OnceLock<Arc<HostService>> = OnceLock::new();

pub struct HostService;

impl HostService {
    pub fn global() -> Arc<Self> {
        GLOBAL_HOST_SERVICE
            .get_or_init(|| Arc::new(Self::new()))
            .clone()
    }

    pub fn new() -> Self {
        Self
    }
}

impl ServiceLifecycle for HostService {
    fn active(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        password: Option<String>,
    ) -> Result<()> {
        #[cfg(target_os = "windows")]
        let _ = &password;

        let hosts = service_data
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("hosts"))
            .map(|hosts_value| serde_json::from_value::<Vec<HostEntry>>(hosts_value.clone()))
            .transpose()?
            .unwrap_or_default();

        // 如果 hosts 列表为空，说明当前环境没有配置 host 服务，不执行任何操作
        if hosts.is_empty() {
            log::info!("环境未配置 host 服务，跳过 host 管理操作");
            return Ok(());
        }

        let host_manager = HostManager::global();
        let host_manager = host_manager
            .lock()
            .map_err(|e| anyhow!("获取 Host 管理器锁失败: {}", e))?;

        #[cfg(target_os = "windows")]
        {
            host_manager
                .add_hosts(hosts.clone(), "")
                .context("添加 hosts 失败")?;
        }

        #[cfg(not(target_os = "windows"))]
        {
            let pwd = password
                .as_deref()
                .ok_or_else(|| anyhow!("needAdminPasswordToModifyHosts"))?;

            host_manager
                .add_hosts(hosts.clone(), pwd)
                .context("添加 hosts 失败")?;
        }

        log::info!("Host 服务已应用，条目数: {}", hosts.len());

        Ok(())
    }

    fn deactive(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        password: Option<String>,
    ) -> Result<()> {
        #[cfg(target_os = "windows")]
        let _ = &password;

        // 检查当前环境是否配置了 host 服务
        let has_host_service = service_data
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("hosts"))
            .is_some();

        // 如果当前环境没有配置 host 服务，不执行清空操作
        if !has_host_service {
            log::info!("环境未配置 host 服务，跳过 host 清空操作");
            return Ok(());
        }

        let host_manager = HostManager::global();
        let host_manager = host_manager
            .lock()
            .map_err(|e| anyhow!("获取 Host 管理器锁失败: {}", e))?;

        #[cfg(target_os = "windows")]
        host_manager.clear_hosts("").context("清空 hosts 失败")?;

        #[cfg(not(target_os = "windows"))]
        {
            let pwd = password
                .as_deref()
                .ok_or_else(|| anyhow!("needAdminPasswordToModifyHosts"))?;
            host_manager.clear_hosts(pwd).context("清空 hosts 失败")?;
        }

        log::info!("Host 服务已停用，Envis hosts block 已清空");

        Ok(())
    }
}
