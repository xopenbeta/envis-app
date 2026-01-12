use anyhow::{anyhow, Context, Result};
use serde_json;

use crate::manager::host_manager::{HostEntry, HostManager};
use crate::manager::services::traits::ServiceLifecycle;
use crate::types::ServiceData;

pub struct HostService;

impl HostService {
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
        if let Some(metadata) = &service_data.metadata {
            if let Some(hosts_value) = metadata.get("hosts") {
                if let Ok(hosts) = serde_json::from_value::<Vec<HostEntry>>(hosts_value.clone()) {
                    if let Some(pwd) = &password {
                        let host_manager = HostManager::global();
                        let host_manager = host_manager
                            .lock()
                            .map_err(|e| anyhow!("获取 Host 管理器锁失败: {}", e))?;
                        host_manager
                            .add_hosts(hosts.clone(), pwd)
                            .context("添加 hosts 失败")?;
                        log::info!("已添加 hosts: {} 条目", hosts.len());
                    } else {
                        return Err(anyhow!("needAdminPasswordToModifyHosts"));
                    }
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
        if let Some(metadata) = &service_data.metadata {
            if let Some(hosts_value) = metadata.get("hosts") {
                if let Ok(hosts) = serde_json::from_value::<Vec<HostEntry>>(hosts_value.clone()) {
                    if let Some(pwd) = &password {
                        let host_manager = HostManager::global();
                        let host_manager = host_manager
                            .lock()
                            .map_err(|e| anyhow!("获取 Host 管理器锁失败: {}", e))?;
                        host_manager
                            .remove_hosts(hosts.clone(), pwd)
                            .context("移除 hosts 失败")?;
                        log::info!("已移除 hosts: {} 条目", hosts.len());
                    } else {
                        return Err(anyhow!("needAdminPasswordToModifyHosts"));
                    }
                }
            }
        }
        Ok(())
    }
}
