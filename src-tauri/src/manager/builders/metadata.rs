use crate::types::{ServiceData, ServiceType};
use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::services::JavaService;
use anyhow::Result;
use std::collections::HashMap;
use std::path::PathBuf;
use std::fs;

/// 元数据构建器
/// 负责为不同服务类型构建默认的 metadata 配置
pub struct MetadataBuilder;

impl MetadataBuilder {
    /// 构建默认的服务 metadata
    /// 根据服务类型和环境ID创建相应的默认配置
    pub fn build_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<HashMap<String, serde_json::Value>> {
        let mut metadata = HashMap::new();

        match service_data.service_type {
            ServiceType::Nodejs => {
                // 为 Node.js 服务创建默认的包管理器配置
                Self::build_nodejs_default_metadata(environment_id, service_data, &mut metadata)?;
            }
            ServiceType::Nginx => {
                // 为 Nginx 服务创建默认配置
                Self::build_nginx_default_metadata(environment_id, service_data, &mut metadata)?;
            }
            ServiceType::Mongodb => {
                // 为 MongoDB 服务创建默认配置
                Self::build_mongodb_default_metadata(environment_id, service_data, &mut metadata)?;
            }
            ServiceType::Mariadb => {
                // 为 MariaDB 服务创建默认配置
                Self::build_mariadb_default_metadata(environment_id, service_data, &mut metadata)?;
            }
            ServiceType::Mysql => {
                // 为 MySQL 服务创建默认配置
                Self::build_mysql_default_metadata(environment_id, service_data, &mut metadata)?;
            }
            ServiceType::Postgresql => {
                // 为 PostgreSQL 服务创建默认配置
                Self::build_postgresql_default_metadata(environment_id, service_data, &mut metadata)?;
            }
            ServiceType::Python => {
                // 为 Python 服务创建默认配置
                Self::build_python_default_metadata(environment_id, service_data, &mut metadata)?;
            }
            ServiceType::Java => {
                // 为 Java 服务创建默认配置
                Self::build_java_default_metadata(environment_id, service_data, &mut metadata)?;
            }
            ServiceType::Custom => {
                // 为自定义服务创建默认配置
                Self::build_custom_default_metadata(environment_id, service_data, &mut metadata)?;
            }
            ServiceType::Host => {
                // 为 Host 服务创建默认配置
                Self::build_host_default_metadata(environment_id, service_data, &mut metadata)?;
            }
            ServiceType::SSL => {
                // 为 SSL 服务创建默认配置
                Self::build_ssl_default_metadata(environment_id, service_data, &mut metadata)?;
            }
            ServiceType::Dnsmasq => {
                // 为 Dnsmasq 服务创建默认配置
                Self::build_dnsmasq_default_metadata(environment_id, service_data, &mut metadata)?;
            }
        }

        Ok(metadata)
    }

    /// 构建 Node.js 服务的默认 metadata
    fn build_nodejs_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        // 获取 services 根目录
        let app_config_manager = AppConfigManager::global();
        let app_config_manager = app_config_manager.lock().unwrap();
        let envs_folder = app_config_manager.get_envs_folder();
        let service_data_folder = PathBuf::from(envs_folder)
            .join(environment_id)
            .join("nodejs")
            .join(&service_data.version);

        // 确保服务目录存在
        if !service_data_folder.exists() {
            fs::create_dir_all(&service_data_folder)?;
        }

        // 设置 Node.js 相关环境变量
        // NODE_PATH 已经不推荐使用
        // metadata.insert(
        //     "NODE_PATH".to_string(),
        //     serde_json::Value::String(String::new()),
        // );

        // 设置全局安装路径前缀
        metadata.insert(
            "NPM_CONFIG_PREFIX".to_string(),
            serde_json::Value::String(service_data_folder.to_string_lossy().to_string()),
        );

        // 设置仓库地址
        metadata.insert(
            "NPM_CONFIG_REGISTRY".to_string(),
            serde_json::Value::String(String::new()),
        );

        log::debug!(
            "已为 Node.js 服务 {} {} (env: {}) 创建默认 metadata",
            service_data.name,
            service_data.version,
            environment_id
        );
        Ok(())
    }

    /// 构建 Nginx 服务的默认 metadata
    fn build_nginx_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        // 获取 services 根目录
        let app_config_manager = AppConfigManager::global();
        let app_config_manager = app_config_manager.lock().unwrap();
        let envs_folder = app_config_manager.get_envs_folder();
        let service_data_folder = PathBuf::from(envs_folder)
            .join(environment_id)
            .join("nginx")
            .join(&service_data.version);

        // 确保服务目录存在
        if !service_data_folder.exists() {
            fs::create_dir_all(&service_data_folder)?;
        }

        // 默认的 nginx.conf 文件路径（放在服务根目录）
        let nginx_conf_path = service_data_folder.join("nginx.conf");
        // 如果不存在则创建一个默认配置文件（避免覆盖用户已存在的配置）
        if !nginx_conf_path.exists() {
            let default_conf = r#"# Auto-generated default nginx.conf by envis
worker_processes  1;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    keepalive_timeout  65;

    server {
        listen       80;
        server_name  localhost;

        location / {
            root   html;
            index  index.html index.htm;
        }
    }
}
"#;
            fs::write(&nginx_conf_path, default_conf)?;
            log::debug!(
                "已为 Nginx 服务 {} {} (env: {}) 创建默认 nginx.conf 文件: {}",
                service_data.name,
                service_data.version,
                environment_id,
                nginx_conf_path.to_string_lossy()
            );
        } else {
            log::debug!(
                "检测到 Nginx 服务 {} {} (env: {}) 已存在 nginx.conf，跳过创建: {}",
                service_data.name,
                service_data.version,
                environment_id,
                nginx_conf_path.to_string_lossy()
            );
        }

        // 将配置文件路径写入 metadata
        metadata.insert(
            "NGINX_CONF".to_string(),
            serde_json::Value::String(nginx_conf_path.to_string_lossy().to_string()),
        );

        Ok(())
    }

    /// 构建 MongoDB 服务的默认 metadata
    fn build_mongodb_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        let _ = metadata; // 当前无默认键，保持签名一致
        log::debug!(
            "已为 MongoDB 服务 {} {} (env: {}) 创建默认 metadata",
            service_data.name,
            service_data.version,
            environment_id
        );
        Ok(())
    }

    /// 构建 MariaDB 服务的默认 metadata
    fn build_mariadb_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        let _ = metadata; // 当前无默认键，保持签名一致
        log::debug!(
            "已为 MariaDB 服务 {} {} (env: {}) 创建默认 metadata",
            service_data.name,
            service_data.version,
            environment_id
        );
        Ok(())
    }

    /// 构建 MySQL 服务的默认 metadata
    fn build_mysql_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        let _ = metadata; // 当前无默认键，保持签名一致
        log::debug!(
            "已为 MySQL 服务 {} {} (env: {}) 创建默认 metadata",
            service_data.name,
            service_data.version,
            environment_id
        );
        Ok(())
    }

    /// 构建 PostgreSQL 服务的默认 metadata
    fn build_postgresql_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        let _ = metadata; // 当前无默认键，保持签名一致
        log::debug!(
            "已为 PostgreSQL 服务 {} {} (env: {}) 创建默认 metadata",
            service_data.name,
            service_data.version,
            environment_id
        );
        Ok(())
    }

    /// 构建 Python 服务的默认 metadata
    fn build_python_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        // 设置 Python 相关环境变量
        metadata.insert(
            "PYTHONPATH".to_string(),
            serde_json::Value::String(String::new()),
        );

        // 设置 pip 镜像源
        metadata.insert(
            "PIP_INDEX_URL".to_string(),
            serde_json::Value::String(String::new()),
        );

        // 设置 pip 信任主机
        metadata.insert(
            "PIP_TRUSTED_HOST".to_string(),
            serde_json::Value::String(String::new()),
        );

        log::debug!(
            "已为 Python 服务 {} {} (env: {}) 创建默认 metadata",
            service_data.name,
            service_data.version,
            environment_id
        );
        Ok(())
    }

    /// 构建 Java 服务的默认 metadata
    fn build_java_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        // 获取 services 根目录
        let envs_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            app_config_manager.get_envs_folder()
        };
        let service_data_folder = PathBuf::from(envs_folder)
            .join(environment_id)
            .join("java")
            .join(&service_data.version);

        // 设置 JAVA_HOME
        metadata.insert(
            "JAVA_HOME".to_string(),
            serde_json::Value::String(service_data_folder.to_string_lossy().to_string()),
        );

        // 设置 JAVA_OPTS（默认为空）
        metadata.insert(
            "JAVA_OPTS".to_string(),
            serde_json::Value::String(String::new()),
        );

        // 设置 MAVEN_HOME（若当前 Java 版本对应 Maven 已存在则自动写入）
        let java_service = JavaService::global();
        let maven_home = java_service
            .get_maven_home(&service_data.version)
            .unwrap_or_default();
        metadata.insert(
            "MAVEN_HOME".to_string(),
            serde_json::Value::String(maven_home),
        );

        // 设置 GRADLE_HOME（默认为空）
        metadata.insert(
            "GRADLE_HOME".to_string(),
            serde_json::Value::String(String::new()),
        );

        log::debug!(
            "已为 Java 服务 {} {} (env: {}) 创建默认 metadata",
            service_data.name,
            service_data.version,
            environment_id
        );
        Ok(())
    }

    /// 构建自定义服务的默认 metadata
    fn build_custom_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        // 设置默认空的路径列表
        metadata.insert("paths".to_string(), serde_json::Value::Array(vec![]));

        // 设置默认空的环境变量对象
        metadata.insert(
            "envVars".to_string(),
            serde_json::Value::Object(serde_json::Map::new()),
        );

        log::debug!(
            "已为自定义服务 {} {} (env: {}) 创建默认 metadata",
            service_data.name,
            service_data.version,
            environment_id
        );
        Ok(())
    }

    /// 构建 Host 服务的默认 metadata
    fn build_host_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        // 设置默认空的 hosts 列表
        metadata.insert("hosts".to_string(), serde_json::Value::Array(vec![]));

        log::debug!(
            "已为 Host 服务 {} {} (env: {}) 创建默认 metadata",
            service_data.name,
            service_data.version,
            environment_id
        );
        Ok(())
    }

    /// 构建 SSL 服务的默认 metadata
    fn build_ssl_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        // 设置 CA 初始化状态为 false
        metadata.insert(
            "SSL_CA_INITIALIZED".to_string(),
            serde_json::Value::Bool(false),
        );

        // 设置默认空的证书列表
        metadata.insert(
            "SSL_CERTIFICATES".to_string(),
            serde_json::Value::Array(vec![]),
        );

        log::debug!(
            "已为 SSL 服务 {} {} (env: {}) 创建默认 metadata",
            service_data.name,
            service_data.version,
            environment_id
        );
        Ok(())
    }

    /// 构建 Dnsmasq 服务的默认 metadata
    fn build_dnsmasq_default_metadata(
        environment_id: &str,
        service_data: &ServiceData,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        // 获取 services 根目录
        let app_config_manager = AppConfigManager::global();
        let app_config_manager = app_config_manager.lock().unwrap();
        let envs_folder = app_config_manager.get_envs_folder();
        let service_data_folder = PathBuf::from(envs_folder)
            .join(environment_id)
            .join("dnsmasq")
            .join(&service_data.version);

        // 确保服务目录存在
        if !service_data_folder.exists() {
            fs::create_dir_all(&service_data_folder)?;
        }

        // 默认的 dnsmasq.conf 文件路径（放在服务根目录）
        let dnsmasq_conf_path = service_data_folder.join("dnsmasq.conf");
        // 如果不存在则创建一个默认配置文件（避免覆盖用户已存在的配置）
        if !dnsmasq_conf_path.exists() {
            let default_conf = r#"# Auto-generated default dnsmasq.conf by envis
# 监听端口 (默认 53，非 root 用户建议使用 5353 或其他高端口)
port=5353

# 监听地址
# listen-address=127.0.0.1

# 不读取 /etc/resolv.conf
# no-resolv

# 上游 DNS 服务器
# server=8.8.8.8
# server=114.114.114.114

# 泛域名解析示例
# address=/test.com/127.0.0.1

# 日志文件
# log-facility=/tmp/dnsmasq.log
# log-queries
"#;
            fs::write(&dnsmasq_conf_path, default_conf)?;
            log::debug!(
                "已为 Dnsmasq 服务 {} {} (env: {}) 创建默认 dnsmasq.conf 文件: {}",
                service_data.name,
                service_data.version,
                environment_id,
                dnsmasq_conf_path.to_string_lossy()
            );
        } else {
            log::debug!(
                "检测到 Dnsmasq 服务 {} {} (env: {}) 已存在 dnsmasq.conf，跳过创建: {}",
                service_data.name,
                service_data.version,
                environment_id,
                dnsmasq_conf_path.to_string_lossy()
            );
        }

        // 将配置文件路径写入 metadata
        metadata.insert(
            "DNSMASQ_CONF".to_string(),
            serde_json::Value::String(dnsmasq_conf_path.to_string_lossy().to_string()),
        );

        Ok(())
    }
}
