use crate::types::{ServiceData, ServiceType};
use anyhow::Result;
use std::collections::HashMap;

/// 环境变量构建器
/// 负责为不同服务类型构建环境变量配置
pub struct EnvVarBuilder;

impl EnvVarBuilder {
    /// 为指定服务类型构建环境变量
    pub fn build_env_vars_for_service(
        service_type: &ServiceType,
        service_folder: &std::path::Path,
    ) -> Result<HashMap<String, String>> {
        let mut env_vars = HashMap::new();

        match service_type {
            ServiceType::Nodejs => {
                Self::build_nodejs_env_vars(&mut env_vars, service_folder)?;
            }
            ServiceType::Nginx => {
                Self::build_nginx_env_vars(&mut env_vars, service_folder)?;
            }
            ServiceType::Mongodb => {
                Self::build_mongodb_env_vars(&mut env_vars, service_folder)?;
            }
            ServiceType::Mariadb => {
                Self::build_mariadb_env_vars(&mut env_vars, service_folder)?;
            }
            ServiceType::Mysql => {
                Self::build_mysql_env_vars(&mut env_vars, service_folder)?;
            }
            ServiceType::Postgresql => {
                Self::build_postgresql_env_vars(&mut env_vars, service_folder)?;
            }
            ServiceType::Python => {
                Self::build_python_env_vars(&mut env_vars, service_folder)?;
            }
            ServiceType::Custom => {
                // 自定义服务由用户配置，不需要默认环境变量
            }
            ServiceType::Host => {
                // Host 服务不需要环境变量
            }
            ServiceType::SSL => {
                // SSL 服务不需要环境变量
            }
            ServiceType::Dnsmasq => {
                // Dnsmasq 服务不需要环境变量
            }
        }

        Ok(env_vars)
    }

    /// 构建 Node.js 服务的环境变量
    fn build_nodejs_env_vars(
        env_vars: &mut HashMap<String, String>,
        service_folder: &std::path::Path,
    ) -> Result<()> {
        // 设置 NODE_PATH
        env_vars.insert(
            "NODE_PATH".to_string(),
            service_folder.to_string_lossy().to_string(),
        );

        // 设置 NPM_CONFIG_PREFIX（全局安装路径）
        let global_prefix = service_folder.join("global");
        env_vars.insert(
            "NPM_CONFIG_PREFIX".to_string(),
            global_prefix.to_string_lossy().to_string(),
        );

        Ok(())
    }

    /// 构建 Nginx 服务的环境变量
    fn build_nginx_env_vars(
        env_vars: &mut HashMap<String, String>,
        service_folder: &std::path::Path,
    ) -> Result<()> {
        // 设置 NGINX_HOME
        env_vars.insert(
            "NGINX_HOME".to_string(),
            service_folder.to_string_lossy().to_string(),
        );

        // 设置 NGINX_CONF（配置文件路径）
        let conf_file = service_folder.join("conf").join("nginx.conf");
        env_vars.insert(
            "NGINX_CONF".to_string(),
            conf_file.to_string_lossy().to_string(),
        );

        Ok(())
    }

    /// 构建 MongoDB 服务的环境变量
    fn build_mongodb_env_vars(
        env_vars: &mut HashMap<String, String>,
        service_folder: &std::path::Path,
    ) -> Result<()> {
        Ok(())
    }

    /// 构建 MariaDB 服务的环境变量
    fn build_mariadb_env_vars(
        env_vars: &mut HashMap<String, String>,
        service_folder: &std::path::Path,
    ) -> Result<()> {
        Ok(())
    }

    /// 构建 MySQL 服务的环境变量
    fn build_mysql_env_vars(
        env_vars: &mut HashMap<String, String>,
        service_folder: &std::path::Path,
    ) -> Result<()> {
        Ok(())
    }

    /// 构建 PostgreSQL 服务的环境变量
    fn build_postgresql_env_vars(
        env_vars: &mut HashMap<String, String>,
        service_folder: &std::path::Path,
    ) -> Result<()> {
        Ok(())
    }

    /// 构建 Python 服务的环境变量
    fn build_python_env_vars(
        env_vars: &mut HashMap<String, String>,
        service_folder: &std::path::Path,
    ) -> Result<()> {
        // 设置 PYTHONPATH
        let lib_path = service_folder.join("lib");
        env_vars.insert(
            "PYTHONPATH".to_string(),
            lib_path.to_string_lossy().to_string(),
        );

        Ok(())
    }
}
