use anyhow::{Context, Result};
use std::path::Path;

use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::builders::{EnvPathBuilder, EnvVarBuilder};
use crate::manager::services::traits::ServiceLifecycle;
use crate::manager::shell_manamger::ShellManager;
use crate::types::ServiceData;

pub struct StandardService;

impl StandardService {
    pub fn new() -> Self {
        Self
    }
}

impl ServiceLifecycle for StandardService {
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

        // 构建服务安装目录路径
        let app_config_manager = AppConfigManager::global();
        let services_folder = {
            let manager = app_config_manager.lock().unwrap();
            manager.get_services_folder()
        };
        
        let service_dir_name = service_data.service_type.dir_name();
        let service_folder = Path::new(&services_folder)
            .join(service_dir_name)
            .join(&service_data.version);

        // 构建环境变量
        let env_vars = EnvVarBuilder::build_env_vars_for_service(
            &service_data.service_type,
            &service_folder,
        )?;

        // 优先从 service_data.metadata 替换值（如有），否则使用构建器默认值
        for (env_var_name, default_value) in env_vars.iter() {
            let value_str = if let Some(metadata) = &service_data.metadata {
                if let Some(env_var_value) = metadata.get(env_var_name) {
                    match env_var_value {
                        serde_json::Value::String(s) => s.clone(),
                        _ => env_var_value.to_string().trim_matches('"').to_string(),
                    }
                } else {
                    default_value.clone()
                }
            } else {
                default_value.clone()
            };

            shell_manager
                .add_export(env_var_name, &value_str)
                .with_context(|| format!("设置环境变量 {} 失败", env_var_name))?;
            log::debug!("已设置环境变量: {}={}", env_var_name, value_str);
        }

        // 添加 PATH 路径
        let paths = EnvPathBuilder::build_paths(service_data)?;
        for path_str in paths {
            if std::path::Path::new(&path_str).exists() {
                shell_manager
                    .add_path(&path_str)
                    .with_context(|| format!("添加路径到 PATH 失败: {}", path_str))?;
                log::debug!("已添加到 PATH: {}", path_str);
            } else {
                log::debug!("路径不存在，跳过添加到 PATH: {}", path_str);
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

        // 构建服务安装目录路径
        let app_config_manager = AppConfigManager::global();
        let services_folder = {
            let manager = app_config_manager.lock().unwrap();
            manager.get_services_folder()
        };
        
        let service_dir_name = service_data.service_type.dir_name();
        let service_folder = Path::new(&services_folder)
            .join(service_dir_name)
            .join(&service_data.version);

        let env_vars = EnvVarBuilder::build_env_vars_for_service(
            &service_data.service_type,
            &service_folder,
        )?;
        
        for (env_var_name, _) in env_vars.iter() {
            shell_manager
                .delete_export(env_var_name)
                .with_context(|| format!("移除环境变量 {} 失败", env_var_name))?;
            log::debug!("已移除环境变量: {}", env_var_name);
        }

        // 从 PATH 中移除对应路径
        let paths = EnvPathBuilder::build_paths(service_data)?;
        for path_str in paths {
            shell_manager
                .delete_path(&path_str)
                .with_context(|| format!("从 PATH 移除失败: {}", path_str))?;
            log::debug!("已从 PATH 移除: {}", path_str);
        }

        Ok(())
    }
}
