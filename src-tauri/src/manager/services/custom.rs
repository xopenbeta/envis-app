use anyhow::{Context, Result};
use serde_json;
use std::sync::{Arc, OnceLock};

use crate::manager::services::traits::ServiceLifecycle;
use crate::manager::shell_manamger::ShellManager;
use crate::types::ServiceData;

static GLOBAL_CUSTOM_SERVICE: OnceLock<Arc<CustomService>> = OnceLock::new();

pub struct CustomService;

impl CustomService {
    pub fn global() -> Arc<Self> {
        GLOBAL_CUSTOM_SERVICE
            .get_or_init(|| Arc::new(Self::new()))
            .clone()
    }

    pub fn new() -> Self {
        Self
    }
}

impl ServiceLifecycle for CustomService {
    fn active(
        &self,
        _environment_id: &str,
        service_data: &ServiceData,
        _password: Option<String>,
    ) -> Result<()> {
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager
            .lock()
            .map_err(|e| anyhow::anyhow!("获取 Shell 管理器锁失败: {}", e))?;

        if let Some(metadata) = &service_data.metadata {
            // 处理自定义环境变量
            if let Some(env_vars_value) = metadata.get("envVars") {
                if let serde_json::Value::Object(env_vars_obj) = env_vars_value {
                    for (key, value) in env_vars_obj {
                        let value_str = match value {
                            serde_json::Value::String(s) => s.clone(),
                            _ => value.to_string().trim_matches('"').to_string(),
                        };
                        shell_manager
                            .add_export(key, &value_str)
                            .with_context(|| format!("设置自定义环境变量 {} 失败", key))?;
                        log::debug!("已设置自定义环境变量: {}={}", key, value_str);
                    }
                }
            }

            // 处理自定义路径
            if let Some(paths_value) = metadata.get("paths") {
                if let serde_json::Value::Array(paths_array) = paths_value {
                    for path_value in paths_array {
                        if let serde_json::Value::String(path_str) = path_value {
                            // 即使路径不存在也添加到 PATH
                            shell_manager
                                .add_path(path_str)
                                .with_context(|| format!("添加自定义路径到 PATH 失败: {}", path_str))?;
                            log::debug!("已添加自定义路径到 PATH: {}", path_str);
                        }
                    }
                }
            }

            // 处理自定义 Alias
            if let Some(aliases_value) = metadata.get("aliases") {
                if let serde_json::Value::Object(aliases_obj) = aliases_value {
                    for (key, value) in aliases_obj {
                        let value_str = match value {
                            serde_json::Value::String(s) => s.clone(),
                            _ => value.to_string().trim_matches('"').to_string(),
                        };
                        shell_manager
                            .add_alias(key, &value_str)
                            .with_context(|| format!("设置自定义 Alias {} 失败", key))?;
                        log::debug!("已设置自定义 Alias: {}={}", key, value_str);
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
        _password: Option<String>,
    ) -> Result<()> {
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager
            .lock()
            .map_err(|e| anyhow::anyhow!("获取 Shell 管理器锁失败: {}", e))?;

        if let Some(metadata) = &service_data.metadata {
            // 移除自定义环境变量
            if let Some(env_vars_value) = metadata.get("envVars") {
                if let serde_json::Value::Object(env_vars_obj) = env_vars_value {
                    for key in env_vars_obj.keys() {
                        shell_manager
                            .delete_export(key)
                            .with_context(|| format!("移除自定义环境变量 {} 失败", key))?;
                        log::debug!("已移除自定义环境变量: {}", key);
                    }
                }
            }

            // 移除自定义路径
            if let Some(paths_value) = metadata.get("paths") {
                if let serde_json::Value::Array(paths_array) = paths_value {
                    for path_value in paths_array {
                        if let serde_json::Value::String(path_str) = path_value {
                            shell_manager
                                .delete_path(path_str)
                                .with_context(|| {
                                    format!("从 PATH 移除自定义路径失败: {}", path_str)
                                })?;
                            log::debug!("已从 PATH 移除自定义路径: {}", path_str);
                        }
                    }
                }
            }

            // 移除自定义 Alias
            if let Some(aliases_value) = metadata.get("aliases") {
                if let serde_json::Value::Object(aliases_obj) = aliases_value {
                    for key in aliases_obj.keys() {
                        shell_manager
                            .delete_alias(key)
                            .with_context(|| format!("移除自定义 Alias {} 失败", key))?;
                        log::debug!("已移除自定义 Alias: {}", key);
                    }
                }
            }
        }
        Ok(())
    }
}
