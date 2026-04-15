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

        if let Some(metadata) = &service_data.metadata {
            if let Some(hosts_value) = metadata.get("hosts") {
                if let Ok(hosts) = serde_json::from_value::<Vec<HostEntry>>(hosts_value.clone()) {
                    let host_manager = HostManager::global();
                    let host_manager = host_manager
                        .lock()
                        .map_err(|e| anyhow!("获取 Host 管理器锁失败: {}", e))?;

                    #[cfg(target_os = "windows")]
                    host_manager
                        .add_hosts(hosts.clone(), "")
                        .context("添加 hosts 失败")?;

                    #[cfg(not(target_os = "windows"))]
                    {
                        let pwd = password
                            .as_deref()
                            .ok_or_else(|| anyhow!("needAdminPasswordToModifyHosts"))?;
                        host_manager
                            .add_hosts(hosts.clone(), pwd)
                            .context("添加 hosts 失败")?;
                    }

                    log::info!("已添加 hosts: {} 条目", hosts.len());
                }
            }
        }
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

        if let Some(metadata) = &service_data.metadata {
            if let Some(hosts_value) = metadata.get("hosts") {
                if let Ok(hosts) = serde_json::from_value::<Vec<HostEntry>>(hosts_value.clone()) {
                    let host_manager = HostManager::global();
                    let host_manager = host_manager
                        .lock()
                        .map_err(|e| anyhow!("获取 Host 管理器锁失败: {}", e))?;

                    #[cfg(target_os = "windows")]
                    host_manager
                        .remove_hosts(hosts.clone(), "")
                        .context("移除 hosts 失败")?;

                    #[cfg(not(target_os = "windows"))]
                    {
                        let pwd = password
                            .as_deref()
                            .ok_or_else(|| anyhow!("needAdminPasswordToModifyHosts"))?;
                        host_manager
                            .remove_hosts(hosts.clone(), pwd)
                            .context("移除 hosts 失败")?;
                    }

                    log::info!("已移除 hosts: {} 条目", hosts.len());
                }
            }
        }
        Ok(())
    }
}
