use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use uuid::Uuid;

use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::builders::{EnvPathBuilder, EnvVarBuilder, MetadataBuilder};
use crate::manager::host_manager::{HostEntry, HostManager};
use crate::manager::services::{
    CustomService, HostService, NodejsService, ServiceLifecycle, StandardService,
};
use crate::manager::shell_manamger::ShellManager;
use crate::types::{
    ServiceData, ServiceDataStatus, ServiceType, UpdateServiceDataRequest,
};

const ENV_SERVICE_CONFIG_FILE_NAME: &str = "service.json";

/// 服务数据操作结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceDataResult {
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

/// 全局环境服务数据管理器单例
static ENV_SERV_DATA_MANAGER: OnceLock<Arc<Mutex<EnvServDataManager>>> = OnceLock::new();

/// 环境服务数据管理器
pub struct EnvServDataManager {}

impl EnvServDataManager {
    /// 获取全局环境服务数据管理器实例
    pub fn global() -> Arc<Mutex<EnvServDataManager>> {
        ENV_SERV_DATA_MANAGER
            .get_or_init(|| {
                let manager = Self::new();
                Arc::new(Mutex::new(manager))
            })
            .clone()
    }

    /// 创建新的环境服务数据管理器
    fn new() -> Self {
        Self {}
    }

    /// 设置（新增/更新）指定服务数据的 metadata 键值并持久化到当前环境
    /// - 从全局配置读取当前激活的环境ID
    /// - 若当前环境ID为空则返回错误
    /// - 更新 service_data.metadata[key] = value，并刷新 updated_at
    /// - 调用 save_service_data 进行落盘
    pub fn set_metadata(
        &self,
        environment_id: &str,
        service_data: &mut ServiceData,
        metadata_key: &str,
        metadata_value: serde_json::Value,
    ) -> Result<ServiceDataResult> {
        if environment_id.is_empty() {
            return Ok(ServiceDataResult {
                success: false,
                message: "当前未选择环境，无法设置 metadata".to_string(),
                data: None,
            });
        }

        // 确保 metadata Map 存在并插入/更新键值
        if service_data.metadata.is_none() {
            service_data.metadata = Some(std::collections::HashMap::new());
        }
        if let Some(map) = service_data.metadata.as_mut() {
            map.insert(metadata_key.to_string(), metadata_value.clone());
        }

        // 更新时间并保存
        service_data.updated_at = Utc::now().to_rfc3339();
        self.save_service_data(&environment_id, service_data)?;

        Ok(ServiceDataResult {
            success: true,
            message: format!("已设置 metadata: {}", metadata_key),
            data: Some(serde_json::json!({
                "key": metadata_key,
                "value": metadata_value,
            })),
        })
    }

    /// 获取指定环境的所有服务数据
    pub fn get_environment_all_service_datas(
        &self,
        environment_id: &str,
    ) -> Result<Vec<ServiceData>> {
        let envs_folder = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            app_config_manager.get_envs_folder()
        }; // 锁在这里被释放

        let mut service_datas = Vec::new();
        let env_path = Path::new(&envs_folder).join(environment_id);

        if !env_path.exists() {
            return Ok(service_datas);
        }

        // 遍历环境文件夹中的服务类型文件夹
        let entries = fs::read_dir(&env_path).context("读取环境文件夹失败")?;

        for entry in entries {
            let entry = entry.context("读取目录项失败")?;
            let service_type_path = entry.path();

            if service_type_path.is_dir() {
                let service_type_name = service_type_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");

                // 容错，跳过非服务类型的文件夹（如 environment.json 等）
                if service_type_name == "environment.json" || service_type_name.is_empty() {
                    continue;
                }

                // 遍历服务版本文件夹
                if let Ok(version_entries) = fs::read_dir(&service_type_path) {
                    for version_entry in version_entries {
                        if let Ok(version_entry) = version_entry {
                            let version_path = version_entry.path();

                            if version_path.is_dir() {
                                let service_config_path =
                                    version_path.join(ENV_SERVICE_CONFIG_FILE_NAME);

                                if service_config_path.exists() {
                                    match self.load_service_data_from_file(&service_config_path) {
                                        Ok(service_data) => service_datas.push(service_data),
                                        Err(e) => {
                                            log::error!(
                                                "读取服务配置失败: {:?}, 错误: {}",
                                                service_config_path,
                                                e
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 按 sort 属性排序（如果有），否则按创建时间排序
        service_datas.sort_by(|a, b| match (a.sort, b.sort) {
            (Some(sa), Some(sb)) => sa.cmp(&sb),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.created_at.cmp(&b.created_at),
        });

        Ok(service_datas)
    }

    /// 创建服务数据
    pub fn create_service_data(
        &self,
        environment_id: &str,
        service_type: ServiceType,
        version: String,
    ) -> Result<ServiceDataResult> {
        // 1. 生成 ID (uuid v4 前8位 + 时间戳)
        let uuid = Uuid::new_v4().to_string();
        let short_id = &uuid[0..8];
        let timestamp = Utc::now().timestamp();
        let id = format!("{}-{}", short_id, timestamp);

        // 2. 生成名称
        let name = service_type.default_name();

        // 3. 计算 Sort Order - 新增的服务放到最前面
        let service_datas = self.get_environment_all_service_datas(environment_id)?;
        let min_sort = service_datas
            .iter()
            .filter_map(|sd| sd.sort)
            .min()
            .unwrap_or(0);

        let now = Utc::now().to_rfc3339();

        let mut service_data = ServiceData {
            id: id.clone(),
            name,
            service_type: service_type.clone(),
            version,
            status: ServiceDataStatus::Inactive,
            sort: Some(min_sort - 1),
            metadata: None,
            created_at: now.clone(),
            updated_at: now,
        };

        // 4. 构建默认 Metadata
        match self.build_default_metadata(environment_id, &service_data) {
            Ok(default_md) => {
                service_data.metadata = Some(default_md);
            }
            Err(e) => {
                log::warn!("构建默认 metadata 失败: {}", e);
            }
        }

        // 5. 保存
        self.save_service_data(environment_id, &service_data)?;

        Ok(ServiceDataResult {
            success: true,
            message: "服务创建成功".to_string(),
            data: Some(serde_json::json!({ "serviceData": service_data })),
        })
    }

    /// 更新服务数据
    pub fn update_service_data(
        &self,
        environment_id: &str,
        request: UpdateServiceDataRequest,
    ) -> Result<ServiceDataResult> {
        let service_datas = self.get_environment_all_service_datas(environment_id)?;
        let mut target_service = service_datas
            .into_iter()
            .find(|sd| sd.id == request.id)
            .context("找不到指定的服务数据")?;

        // 应用更新
        if let Some(name) = request.name {
            target_service.name = name;
        }
        // 不再允许更新 service_type 和 version
        
        if let Some(status) = request.status {
            target_service.status = status;
        }
        if let Some(sort) = request.sort {
            target_service.sort = Some(sort);
        }
        if let Some(metadata) = request.metadata {
            target_service.metadata = Some(metadata);
        }

        target_service.updated_at = Utc::now().to_rfc3339();

        // 直接保存，不再处理路径变化（因为 type/version 不变，路径就不会变）
        self.save_service_data(environment_id, &target_service)?;

        Ok(ServiceDataResult {
            success: true,
            message: "服务更新成功".to_string(),
            data: Some(serde_json::json!({ "serviceData": target_service })),
        })
    }

    /// 根据 ID 删除服务数据
    pub fn delete_service_data(
        &self,
        environment_id: &str,
        service_id: &str,
    ) -> Result<ServiceDataResult> {
        let service_datas = self.get_environment_all_service_datas(environment_id)?;
        let target_service = service_datas
            .into_iter()
            .find(|sd| sd.id == service_id)
            .context("找不到指定的服务数据")?;

        self.remove_service_directories(environment_id, &target_service)
    }

    /// 保存服务数据到环境
    pub fn save_service_data(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let (_, _, _, _, service_data_folder, service_config_path) =
            self.build_service_paths(environment_id, service_data)?;

        // 确保服务数据文件夹存在
        if !service_data_folder.exists() {
            fs::create_dir_all(&service_data_folder).context("创建服务数据文件夹失败")?;
        }

        let json_content =
            serde_json::to_string_pretty(service_data).context("序列化服务数据失败")?;
        fs::write(&service_config_path, json_content).context("写入服务配置文件失败")?;

        log::info!(
            "服务数据已保存: {} {} ({})",
            service_data.name,
            service_data.version,
            service_data.id
        );

        Ok(ServiceDataResult {
            success: true,
            message: "服务保存成功".to_string(),
            data: None,
        })
    }

    /// 删除服务数据文件夹 (底层实现)
    fn remove_service_directories(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let (_, _, _, _, service_data_folder, _) =
            self.build_service_paths(environment_id, service_data)?;

        // 递归删除整个服务数据文件夹
        if service_data_folder.exists() {
            fs::remove_dir_all(&service_data_folder).context("删除服务数据文件夹失败")?;
            log::info!(
                "服务数据文件夹已删除: {} {}",
                service_data.name,
                service_data.version
            );
        }

        Ok(ServiceDataResult {
            success: true,
            message: "服务删除成功".to_string(),
            data: None,
        })
    }

    /// 激活服务数据 - 将服务的环境变量写入终端配置文件
    pub fn active_service_data(
        &self,
        environment_id: &str,
        service_data: &mut ServiceData,
        password: Option<String>,
    ) -> Result<ServiceDataResult> {
        let handler: Arc<dyn ServiceLifecycle> = match service_data.service_type {
            ServiceType::Host => HostService::global(),
            ServiceType::Custom => CustomService::global(),
            ServiceType::Nodejs => NodejsService::global(),
            _ => StandardService::global(),
        };

        handler.active(environment_id, service_data, password)?;

        // 更新服务状态为 Active
        service_data.status = ServiceDataStatus::Active;
        service_data.updated_at = Utc::now().to_rfc3339();
        self.save_service_data(environment_id, service_data)?;

        Ok(ServiceDataResult {
            success: true,
            message: format!("服务 {} {} 已激活", service_data.name, service_data.version),
            data: None,
        })
    }

    /// 停用服务数据 - 从终端配置文件中移除服务的环境变量
    pub fn deactive_service_data(
        &self,
        environment_id: &str,
        service_data: &mut ServiceData,
        password: Option<String>,
    ) -> Result<ServiceDataResult> {
        let handler: Arc<dyn ServiceLifecycle> = match service_data.service_type {
            ServiceType::Host => HostService::global(),
            ServiceType::Custom => CustomService::global(),
            ServiceType::Nodejs => NodejsService::global(),
            _ => StandardService::global(),
        };

        handler.deactive(environment_id, service_data, password)?;

        // 更新服务状态为 Inactive
        service_data.status = ServiceDataStatus::Inactive;
        service_data.updated_at = Utc::now().to_rfc3339();
        self.save_service_data(environment_id, service_data)?;

        Ok(ServiceDataResult {
            success: true,
            message: format!("服务 {} {} 已停用", service_data.name, service_data.version),
            data: None,
        })
    }

    /// 从文件加载服务数据配置
    fn load_service_data_from_file(&self, config_path: &Path) -> Result<ServiceData> {
        let config_content = fs::read_to_string(config_path).context("读取服务配置文件失败")?;
        let service_data: ServiceData =
            serde_json::from_str(&config_content).context("解析服务配置失败")?;
        Ok(service_data)
    }

    /// 构建默认的服务 metadata
    /// 根据服务类型和环境ID创建相应的默认配置
    pub fn build_default_metadata(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<HashMap<String, serde_json::Value>> {
        MetadataBuilder::build_default_metadata(environment_id, service_data)
    }

    /// 构建服务配置路径
    fn build_service_paths(
        &self,
        environment_id: &str,
        service_data: &ServiceData,
    ) -> Result<(
        String,
        std::path::PathBuf,
        String,
        std::path::PathBuf,
        std::path::PathBuf,
        std::path::PathBuf,
    )> {
        let (envs_folder, services_folder) = {
            let app_config_manager = AppConfigManager::global();
            let app_config_manager = app_config_manager.lock().unwrap();
            (
                app_config_manager.get_envs_folder(),
                app_config_manager.get_services_folder(),
            )
        }; // 锁在这里被释放

        let env_folder = Path::new(&envs_folder).join(environment_id);
        let service_folder = Path::new(&services_folder)
            .join(service_data.service_type.dir_name())
            .join(&service_data.version);
        let service_type_str = service_data.service_type.dir_name();
        let service_data_folder = env_folder
            .join(service_type_str)
            .join(&service_data.version);
        let service_config_path = service_data_folder.join(ENV_SERVICE_CONFIG_FILE_NAME);

        Ok((
            envs_folder,
            env_folder,
            services_folder,
            service_folder,
            service_data_folder,
            service_config_path,
        ))
    }
}

/// 初始化环境服务数据管理器
pub fn initialize_env_serv_data_manager() -> Result<()> {
    match std::panic::catch_unwind(|| EnvServDataManager::global()) {
        Ok(_) => {
            log::info!("环境服务数据管理器初始化成功");
            Ok(())
        }
        Err(_) => {
            log::error!("环境服务数据管理器初始化失败: EnvServDataManager::global() 发生 panic");
            Err(anyhow::anyhow!("环境服务数据管理器初始化失败"))
        }
    }
}
