use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

// 全局常量：配置与目录结构
pub const CONFIG_FILE_NAME: &str = ".envis.json";
pub const ENVIS_DIR: &str = ".envis";
pub const SERVICES_FOLDER: &str = "services";
pub const ENVS_FOLDER: &str = "envs";

/// 配置文件结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub envis_folder: String,
    pub auto_start_app_on_login: bool,
    pub auto_activate_last_used_environment_on_app_start: bool,
    #[serde(default)]
    pub last_used_environment_ids: Vec<String>,
    pub stop_all_services_on_exit: bool,
    pub terminal_tool: Option<String>,
    #[serde(default = "default_true")]
    pub deactivate_other_environments_on_activate: bool,
    #[serde(default = "default_true")]
    pub show_environment_name_on_terminal_open: bool,
    #[serde(default)]
    pub show_service_info_on_terminal_open: bool,
}

fn default_true() -> bool { true }

impl Default for AppConfig {
    fn default() -> Self {
        let home_dir = dirs::home_dir().expect("无法获取用户主目录");
        let envis_dir = home_dir.join(ENVIS_DIR);

        Self {
            envis_folder: envis_dir.to_string_lossy().to_string(),
            auto_start_app_on_login: false,
            auto_activate_last_used_environment_on_app_start: true,
            last_used_environment_ids: vec![],
            stop_all_services_on_exit: false,
            terminal_tool: None,
            deactivate_other_environments_on_activate: true,
            show_environment_name_on_terminal_open: true,
            show_service_info_on_terminal_open: false,
        }
    }
}

/// 全局配置管理器单例
static APP_CONFIG_MANAGER: OnceLock<Arc<Mutex<AppConfigManager>>> = OnceLock::new();

/// 配置管理器
pub struct AppConfigManager {
    app_config: AppConfig,
    app_config_path: PathBuf,
}

impl AppConfigManager {
    /// 获取全局配置管理器实例
    pub fn global() -> Arc<Mutex<AppConfigManager>> {
        APP_CONFIG_MANAGER
            .get_or_init(|| {
                let manager = Self::new().expect("Failed to initialize AppConfigManager");
                Arc::new(Mutex::new(manager))
            })
            .clone()
    }

    /// 创建新的配置管理器
    fn new() -> Result<Self> {
        let home_dir = dirs::home_dir().expect("无法获取用户主目录");
        let app_config_path = home_dir.join(CONFIG_FILE_NAME);

        let mut app_config = match fs::read_to_string(&app_config_path) {
            Ok(app_config_content) => {
                match serde_json::from_str(&app_config_content) {
                    Ok(config) => config,
                    Err(_) => {
                        // 解析失败，使用默认配置并覆盖原文件，不能说配置文件坏了就彻底打不开软件了。。。
                        let default_app_config = AppConfig::default();
                        let app_config_content = serde_json::to_string_pretty(&default_app_config)
                            .context("序列化默认配置失败")?;
                        fs::write(&app_config_path, app_config_content)
                            .context("写入默认配置文件失败")?;
                        default_app_config
                    }
                }
            }
            Err(_) => {
                // 文件不存在或读取失败，使用默认配置并写入
                let default_app_config = AppConfig::default();
                let app_config_content = serde_json::to_string_pretty(&default_app_config)
                    .context("序列化默认配置失败")?;
                fs::write(&app_config_path, app_config_content).context("写入默认配置文件失败")?;
                default_app_config
            }
        };

    Self::sync_last_used_fields(&mut app_config);

    // 确保 .envis 目录存在
        let envis_dir = PathBuf::from(app_config.envis_folder.clone());
        if !envis_dir.exists() {
            fs::create_dir_all(&envis_dir).context("创建 .envis 目录失败")?;
        }

        // 创建默认的服务和环境目录
        let services_dir = envis_dir.join(SERVICES_FOLDER);
        if !services_dir.exists() {
            fs::create_dir_all(&services_dir).context("创建 services 目录失败")?;
        }

        let envs_dir = envis_dir.join(ENVS_FOLDER);
        if !envs_dir.exists() {
            fs::create_dir_all(&envs_dir).context("创建 envs 目录失败")?;
        }

        Ok(Self {
            app_config,
            app_config_path,
        })
    }

    /// 获取当前配置
    pub fn get_app_config(&self) -> AppConfig {
        self.app_config.clone()
    }

    /// 设置当前配置
    pub fn set_app_config(&mut self, mut app_config: AppConfig) -> Result<()> {
        let old_envis_folder = self.app_config.envis_folder.clone();
        let new_envis_folder = app_config.envis_folder.clone();

        Self::sync_last_used_fields(&mut app_config);

        // 如果 envis_folder 路径发生变化，需要迁移数据
        if old_envis_folder != new_envis_folder {
            log::info!("检测到 .envis 路径变更，从 {} 迁移到 {}", old_envis_folder, new_envis_folder);
            self.migrate_envis_folder(&old_envis_folder, &new_envis_folder)?;
        }

        self.app_config = app_config;
        log::debug!("设置新配置: {:?}", self.app_config);
        self.save_app_config()?;
        Ok(())
    }

    fn sync_last_used_fields(app_config: &mut AppConfig) {
        // 去重并保持顺序
        if !app_config.last_used_environment_ids.is_empty() {
            let mut seen = HashSet::new();
            app_config.last_used_environment_ids.retain(|id| seen.insert(id.clone()));
        }
    }

    /// 迁移 .envis 文件夹数据
    fn migrate_envis_folder(&self, old_folder: &str, new_folder: &str) -> Result<()> {
        let old_path = PathBuf::from(old_folder);
        let new_path = PathBuf::from(new_folder);

        // 确保新路径存在
        if !new_path.exists() {
            fs::create_dir_all(&new_path)
                .context(format!("创建新 .envis 目录失败: {}", new_folder))?;
        }

        // 创建新路径下的子目录
        let new_services_dir = new_path.join(SERVICES_FOLDER);
        if !new_services_dir.exists() {
            fs::create_dir_all(&new_services_dir)
                .context(format!("创建 services 目录失败: {:?}", new_services_dir))?;
        }

        let new_envs_dir = new_path.join(ENVS_FOLDER);
        if !new_envs_dir.exists() {
            fs::create_dir_all(&new_envs_dir)
                .context(format!("创建 envs 目录失败: {:?}", new_envs_dir))?;
        }

        // 如果旧路径存在，迁移数据
        if old_path.exists() {
            // 迁移 services 文件夹
            let old_services_dir = old_path.join(SERVICES_FOLDER);
            if old_services_dir.exists() {
                log::info!("迁移 services 文件夹: {:?} -> {:?}", old_services_dir, new_services_dir);
                self.copy_dir_all(&old_services_dir, &new_services_dir)
                    .context("迁移 services 文件夹失败")?;
            }

            // 迁移 envs 文件夹
            let old_envs_dir = old_path.join(ENVS_FOLDER);
            if old_envs_dir.exists() {
                log::info!("迁移 envs 文件夹: {:?} -> {:?}", old_envs_dir, new_envs_dir);
                self.copy_dir_all(&old_envs_dir, &new_envs_dir)
                    .context("迁移 envs 文件夹失败")?;
            }

            log::info!(".envis 文件夹迁移完成");
        }

        Ok(())
    }

    /// 递归复制目录
    fn copy_dir_all(&self, src: &Path, dst: &Path) -> Result<()> {
        if !dst.exists() {
            fs::create_dir_all(dst)?;
        }

        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let ty = entry.file_type()?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());

            if ty.is_dir() {
                self.copy_dir_all(&src_path, &dst_path)?;
            } else {
                fs::copy(&src_path, &dst_path)?;
            }
        }

        Ok(())
    }

    /// 获取服务文件夹路径
    pub fn get_services_folder(&self) -> String {
        Path::new(&self.app_config.envis_folder)
            .join(SERVICES_FOLDER)
            .to_string_lossy()
            .to_string()
    }

    /// 获取环境数据文件夹路径
    pub fn get_envs_folder(&self) -> String {
        Path::new(&self.app_config.envis_folder)
            .join(ENVS_FOLDER)
            .to_string_lossy()
            .to_string()
    }

    /// 获取配置文件夹路径（即配置文件所在的目录）
    pub fn get_app_config_folder_path(&self) -> Result<String> {
        let config_dir = self.app_config_path
            .parent()
            .context("无法获取配置文件所在目录")?;
        Ok(config_dir.to_string_lossy().to_string())
    }

    /// 保存配置到文件
    fn save_app_config(&self) -> Result<()> {
        let app_config_content =
            serde_json::to_string_pretty(&self.app_config).context("序列化配置失败")?;
        fs::write(&self.app_config_path, app_config_content).context("写入配置文件失败")?;
        Ok(())
    }
}

/// 初始化配置管理器
pub fn initialize_config_manager() -> Result<()> {
    match std::panic::catch_unwind(|| AppConfigManager::global()) {
        Ok(_) => {
            log::info!("配置管理器初始化成功");
            Ok(())
        }
        Err(_) => {
            log::error!("配置管理器初始化失败: AppConfigManager::global() 发生 panic");
            Err(anyhow::anyhow!("配置管理器初始化失败"))
        }
    }
}
