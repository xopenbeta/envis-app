use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

// 环境与服务数据相关类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EnvironmentStatus {
    Active,
    Inactive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Environment {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_default: Option<bool>,
    pub status: EnvironmentStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Hash, Eq, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServiceType {
    Redis,
    Mongodb,
    Mariadb,
    Mysql,
    Postgresql,
    Nginx,
    Nodejs,
    Python,
    Java,
    Custom,
    Host,
    SSL,
    Dnsmasq,
    Nasm,
    // 可以根据需要添加更多服务类型
}

impl ServiceType {
    /// 获取服务类型对应的目录名（小写）
    pub fn dir_name(&self) -> &'static str {
        match self {
            ServiceType::Redis => "redis",
            ServiceType::Mongodb => "mongodb",
            ServiceType::Mariadb => "mariadb",
            ServiceType::Mysql => "mysql",
            ServiceType::Postgresql => "postgresql",
            ServiceType::Nginx => "nginx",
            ServiceType::Nodejs => "nodejs",
            ServiceType::Python => "python",
            ServiceType::Java => "java",
            ServiceType::Custom => "custom",
            ServiceType::Host => "host",
            ServiceType::SSL => "ssl",
            ServiceType::Dnsmasq => "dnsmasq",
            ServiceType::Nasm => "nasm",
        }
    }

    /// 定义每种服务类型需要添加到 PATH 的子目录
    pub fn sub_dirs(&self) -> &'static [&'static str] {
        match self {
            ServiceType::Redis => &["bin"],
            ServiceType::Nodejs => {
                // Windows: node.exe/npm/npx 在根目录
                // Unix: node/npm/npx 在 bin 子目录
                if cfg!(target_os = "windows") {
                    &[""] // 空字符串表示根目录
                } else {
                    &["bin"]
                }
            }
            ServiceType::Mongodb => &["bin"], // MongoDB 可执行文件目录
            ServiceType::Mariadb => &["bin"], // MariaDB 可执行文件目录
            ServiceType::Mysql => &["bin"],   // MySQL 可执行文件目录
            ServiceType::Postgresql => &["bin"], // PostgreSQL 可执行文件目录
            ServiceType::Nginx => {
                if cfg!(target_os = "windows") {
                    &["", "sbin"]
                } else {
                    &["sbin"]
                }
            } // Nginx 可执行文件目录
            ServiceType::Python => {
                // Windows: python.exe 位于安装根目录
                // Unix: Python 可执行文件位于 bin 子目录
                if cfg!(target_os = "windows") {
                    &[""]
                } else {
                    &["bin"]
                }
            }
            ServiceType::Java => &["bin"],    // Java 可执行文件目录
            ServiceType::Custom => &[],       // 自定义服务由用户配置
            ServiceType::Host => &[],         // Host 服务不需要 PATH
            ServiceType::SSL => &[],          // SSL 服务不需要 PATH
            ServiceType::Dnsmasq => &["sbin"], // Dnsmasq 可执行文件目录
            ServiceType::Nasm => &[""],       // Nasm 解压后执行文件在根目录或自身路径
        }
    }

    /// 获取该服务类型需要设置的环境变量
    pub fn env_vars(&self) -> Vec<&'static str> {
        match self {
            ServiceType::Redis => vec![],
            ServiceType::Nodejs => vec![
                "NPM_CONFIG_PREFIX", // npm 全局安装路径
            ],
            ServiceType::Mongodb => vec![],
            ServiceType::Mariadb => vec![],
            ServiceType::Mysql => vec![],
            ServiceType::Postgresql => vec![],
            ServiceType::Nginx => vec![],
            ServiceType::Python => vec!["PYTHON_HOME"],
            ServiceType::Java => vec!["JAVA_HOME", "JAVA_OPTS", "MAVEN_HOME", "GRADLE_HOME"], // Java 环境变量
            ServiceType::Custom => vec![],  // 自定义服务由用户配置
            ServiceType::Host => vec![],    // Host 服务不需要环境变量
            ServiceType::SSL => vec![],     // SSL 服务不需要环境变量
            ServiceType::Dnsmasq => vec![], // Dnsmasq 服务不需要环境变量
            ServiceType::Nasm => vec![],
        }
    }

    /// 判断该服务类型是否需要下载安装（Custom、Host、SSL 不需要）
    pub fn needs_download(&self) -> bool {
        !matches!(self, ServiceType::Custom | ServiceType::Host | ServiceType::SSL)
    }

    pub fn default_name(&self) -> String {
        match self {
            ServiceType::Redis => "Redis".to_string(),
            ServiceType::Mongodb => "MongoDB".to_string(),
            ServiceType::Mariadb => "MariaDB".to_string(),
            ServiceType::Mysql => "MySQL".to_string(),
            ServiceType::Postgresql => "PostgreSQL".to_string(),
            ServiceType::Nginx => "Nginx".to_string(),
            ServiceType::Nodejs => "Node.js".to_string(),
            ServiceType::Python => "Python".to_string(),
            ServiceType::Java => "Java".to_string(),
            ServiceType::Custom => "Custom".to_string(),
            ServiceType::Host => "Host".to_string(),
            ServiceType::SSL => "SSL".to_string(),
            ServiceType::Dnsmasq => "Dnsmasq".to_string(),
            ServiceType::Nasm => "Nasm".to_string(),
        }
    }

    pub fn metadata_keys(&self) -> Vec<&'static str> {
        match self {
            ServiceType::Redis => vec![
                "REDIS_CONFIG",
                "REDIS_PASSWORD",
            ],
            ServiceType::Nodejs => vec!["NPM_CONFIG_PREFIX"],
            ServiceType::Mongodb => vec!["MONGODB_CONFIG", "MONGODB_KEYFILE_PATH"],
            ServiceType::Mariadb => vec![],
            ServiceType::Mysql => vec![],
            ServiceType::Postgresql => vec![],
            ServiceType::Nginx => vec![],
            ServiceType::Python => vec!["PYTHON_HOME"],
            ServiceType::Java => vec!["JAVA_HOME", "JAVA_OPTS", "MAVEN_HOME", "GRADLE_HOME"],
            ServiceType::Custom => vec![
                "paths",   // 自定义路径列表
                "envVars", // 自定义环境变量
            ],
            ServiceType::Host => vec![
                "hosts", // host 条目列表
            ],
            ServiceType::SSL => vec![
                "SSL_CA_INITIALIZED",   // CA 是否已初始化
                "SSL_CA_CERT_PATH",     // CA 证书路径
                "SSL_CA_KEY_PATH",      // CA 私钥路径
                "SSL_CA_COMMON_NAME",   // CA 通用名称
                "SSL_CA_ORGANIZATION",  // CA 组织名称
                "SSL_CA_VALIDITY_DAYS", // CA 有效期
                "SSL_CERTIFICATES",     // 已签发的证书列表
            ],
            ServiceType::Dnsmasq => vec!["DNSMASQ_CONF"],
            ServiceType::Nasm => vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceDataStatus {
    Active,
    Inactive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceStatus {
    Unknown,
    Error,
    Running,
    Stopped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceData {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub service_type: ServiceType,
    pub version: String,
    pub status: ServiceDataStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub created_at: String,
    pub updated_at: String,
}

/// 创建服务数据的请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateServiceDataRequest {
    #[serde(rename = "type")]
    pub service_type: ServiceType,
    pub version: String,
}

/// 更新服务数据的请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateServiceDataRequest {
    pub id: String,
    pub name: Option<String>,
    // 不允许更新 type 和 version
    // #[serde(rename = "type")]
    // pub service_type: Option<ServiceType>,
    // pub version: Option<String>,
    pub status: Option<ServiceDataStatus>,
    pub sort: Option<i32>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// 统一的命令响应结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResponse {
    pub success: bool,
    pub msg: String,
    pub data: Option<Value>,
}

impl CommandResponse {
    pub fn success(msg: String, data: Option<Value>) -> Self {
        Self {
            success: true,
            msg,
            data,
        }
    }

    pub fn error(msg: String) -> Self {
        Self {
            success: false,
            msg,
            data: None,
        }
    }
}

/// 服务下载进度数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceDownloadProgress {
    pub service_type: ServiceType,
    pub version: String,
    pub progress: f64,
    pub downloaded_size: u64,
    pub total_size: u64,
    pub status: String,
    pub error_message: Option<String>,
}

/// 进程资源统计（按进程名聚合）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessStat {
    pub process_name: String,
    /// 所有同名进程的 CPU 使用率之和 (%)
    pub cpu_usage: f32,
    /// 所有同名进程的内存使用量之和 (bytes)
    pub memory_bytes: u64,
    /// 所有同名进程本次刷新间隔内的磁盘读取字节数
    pub disk_read_bytes: u64,
    /// 所有同名进程本次刷新间隔内的磁盘写入字节数
    pub disk_write_bytes: u64,
    /// 匹配到的进程数量
    pub pid_count: usize,
}
