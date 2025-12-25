use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};

use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::shell_manamger::ShellManager;
use crate::types::{Environment, EnvironmentStatus};

const ENV_CONFIG_FILE_NAME: &str = "environment.json";

/// 环境操作结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentResult {
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

/// 活跃环境信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveEnvironmentInfo {
    pub has_environment_block: bool,
    pub current_environment_id: Option<String>,
    pub current_environment_name: Option<String>,
    pub current_environment: Option<Environment>,
}

/// 全局环境管理器单例
static ENVIRONMENT_MANAGER: OnceLock<Arc<Mutex<EnvironmentManager>>> = OnceLock::new();

/// 环境管理器
pub struct EnvironmentManager {}

impl EnvironmentManager {
    /// 获取全局环境管理器实例
    pub fn global() -> Arc<Mutex<EnvironmentManager>> {
        ENVIRONMENT_MANAGER
            .get_or_init(|| {
                let manager = Self::new();
                Arc::new(Mutex::new(manager))
            })
            .clone()
    }

    /// 创建新的环境管理器
    fn new() -> Self {
        Self {}
    }

    /// 获取所有环境
    pub fn get_all_environments(&self) -> Result<Vec<Environment>> {
        let envs_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            app_config_manager.get_envs_folder()
        };

        let mut environments = Vec::new();
        let envs_path = Path::new(&envs_folder);

        if !envs_path.exists() {
            // 理论上在软件开启时设置了，如果还没有证明未知错误
            return Ok(environments);
        }

        let entries = fs::read_dir(envs_path).context("读取环境文件夹失败")?;

        for entry in entries {
            let entry = entry.context("读取目录项失败")?;
            let env_path = entry.path();

            if env_path.is_dir() {
                let env_config_path = env_path.join(ENV_CONFIG_FILE_NAME);
                if env_config_path.exists() {
                    match self.load_environment_from_file(&env_config_path) {
                        Ok(environment) => environments.push(environment),
                        Err(e) => {
                            log::error!("读取环境配置失败: {:?}, 错误: {}", env_path, e);
                        }
                    }
                }
            }
        }

        // 按 sort 属性排序（如果有），否则按创建时间排序
        environments.sort_by(|a, b| match (a.sort, b.sort) {
            (Some(sa), Some(sb)) => sa.cmp(&sb),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.created_at.cmp(&b.created_at),
        });
        Ok(environments)
    }

    /// 创建环境
    pub fn create_environment(&self, environment: &Environment) -> Result<EnvironmentResult> {
        // 保存环境配置
        self.save_environment(&environment)?;

        log::info!("环境已创建: {} ({})", environment.name, environment.id);

        Ok(EnvironmentResult {
            success: true,
            message: format!("环境 '{}' 创建成功", environment.name),
            data: Some(serde_json::json!({ "environment": &environment })),
        })
    }

    /// 保存环境
    pub fn save_environment(&self, environment: &Environment) -> Result<EnvironmentResult> {
        let envs_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            app_config_manager.get_envs_folder()
        };

        let env_path = Path::new(&envs_folder).join(&environment.id);
        // 需要创建该文件夹，因为在创建env的时候需要
        if !env_path.exists() {
            fs::create_dir_all(&env_path).context("创建环境文件夹失败")?;
        }
        let env_config_path = env_path.join(ENV_CONFIG_FILE_NAME);
        let json_content =
            serde_json::to_string_pretty(environment).context("序列化环境配置失败")?;
        log::debug!("环境配置文件路径: {:?}", env_config_path);
        fs::write(&env_config_path, json_content).context("写入环境配置文件失败")?;

        log::info!("环境配置已保存: {} ({})", environment.name, environment.id);

        Ok(EnvironmentResult {
            success: true,
            message: "环境配置已保存".to_string(),
            data: Some(serde_json::to_value(environment).context("环境序列化到 data 失败")?),
        })
    }

    /// 删除环境
    pub fn delete_environment(&self, environment: &Environment) -> Result<EnvironmentResult> {
        let envs_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            app_config_manager.get_envs_folder()
        };

        let env_path = Path::new(&envs_folder).join(&environment.id);

        log::info!("开始删除环境: {} ({})", environment.name, environment.id);

        // 如果当前环境是活跃的，先停用它（仅仅只停用环境）
        if environment.status == EnvironmentStatus::Active {
            // 停用当前活跃环境
            let mut env = environment.clone();
            self.deactivate_environment(&mut env)?;
        }

        // 递归删除整个环境文件夹
        if env_path.exists() {
            fs::remove_dir_all(&env_path).context("删除环境文件夹失败")?;
            log::info!("环境文件夹已删除: {}", environment.id);
        }

        Ok(EnvironmentResult {
            success: true,
            message: "环境已删除".to_string(),
            data: None,
        })
    }

    /// 检查环境是否存在
    pub fn is_environment_exists(&self, environment: &Environment) -> Result<bool> {
        let envs_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            app_config_manager.get_envs_folder()
        };

        let env_folder = Path::new(&envs_folder).join(&environment.id);
        let env_config_path = env_folder.join(ENV_CONFIG_FILE_NAME);

        Ok(env_config_path.exists())
    }

    /// 激活环境
    pub fn activate_environment(
        &self,
        environment: &mut Environment,
    ) -> Result<EnvironmentResult> {
        let environment_name = environment.name.clone();
        let environment_id = environment.id.clone();

        // 设置终端配置文件
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();
        shell_manager
            .clear_shell_environment_block_content()
            .context("清除shell环境块失败")?;
        
        // 添加 echo 信息到对应的 block（global 或 active）
        shell_manager
            .add_echo_environment(&environment_name, &environment_id)
            .context("添加echo环境信息失败")?;

        // 更新环境状态和时间戳
        environment.status = EnvironmentStatus::Active;
        environment.updated_at = Utc::now().to_rfc3339();

        // 保存环境配置
        self.save_environment(environment)?;

        Ok(EnvironmentResult {
            success: true,
            message: "环境已激活".to_string(),
            data: Some(serde_json::to_value(environment).context("环境序列化到 data 失败")?),
        })
    }

    /// 停用环境
    pub fn deactivate_environment(
        &self,
        environment: &mut Environment,
    ) -> Result<EnvironmentResult> {
        // 清除当前活跃环境的 shell 环境块内容
        let shell_manager = ShellManager::global();
        let shell_manager = shell_manager.lock().unwrap();
        shell_manager
            .clear_shell_environment_block_content()
            .context("清除shell环境块失败")?;

        // 更新环境状态和时间戳
        environment.status = EnvironmentStatus::Inactive;
        environment.updated_at = Utc::now().to_rfc3339();

        // 保存环境配置
        self.save_environment(environment)?;

        Ok(EnvironmentResult {
            success: true,
            message: "环境已停用".to_string(),
            data: Some(serde_json::to_value(environment).context("环境序列化到 data 失败")?),
        })
    }

    /// 从文件加载环境配置
    fn load_environment_from_file(&self, config_path: &Path) -> Result<Environment> {
        let config_content = fs::read_to_string(config_path).context("读取环境配置文件失败")?;
        let environment: Environment =
            serde_json::from_str(&config_content).context("解析环境配置失败")?;
        Ok(environment)
    }
}

/// 初始化环境管理器
pub fn initialize_environment_manager() -> Result<()> {
    match std::panic::catch_unwind(|| EnvironmentManager::global()) {
        Ok(_) => {
            log::info!("环境管理器初始化成功");
            Ok(())
        }
        Err(_) => {
            log::error!("环境管理器初始化失败: EnvironmentManager::global() 发生 panic");
            Err(anyhow::anyhow!("环境管理器初始化失败"))
        }
    }
}
