//! 环境导出 / 导入逻辑
//!
//! 导出规则：
//! - 仅保留每种服务类型对应的"远程仓库/镜像源"配置（`ServiceType::export_metadata_keys`）。
//! - 排除本地路径（数据目录、日志目录、配置文件路径等）。
//! - 排除需初始化才有意义的信息（数据库密码、用户名等）。
//!
//! 导入规则：
//! - 解析导出 JSON，创建新环境，然后逐一创建服务数据并写入可导出的 metadata。
//! - 不触发下载或初始化流程。

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::manager::env_serv_data_manager::EnvServDataManager;
use crate::manager::environment_manager::EnvironmentManager;
use crate::types::{ServiceData, ServiceType, UpdateServiceDataRequest};

// ── 导出数据结构 ─────────────────────────────────────────────────────────────

/// 单个服务的导出数据（仅含跨机器有意义的字段）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportedServiceData {
    /// 服务显示名称
    pub name: String,
    /// 服务类型（小写字符串，与 `ServiceType` 序列化一致）
    #[serde(rename = "type")]
    pub service_type: ServiceType,
    /// 版本
    pub version: String,
    /// 经过过滤的 metadata（仅含远程仓库/镜像源等可移植配置）
    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub metadata: HashMap<String, serde_json::Value>,
}

/// 环境的完整导出数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportedEnvironment {
    /// 格式版本号，供未来兼容性校验
    pub export_version: u32,
    /// 环境名称
    pub name: String,
    /// 该环境包含的服务列表
    pub services: Vec<ExportedServiceData>,
}

impl ExportedEnvironment {
    pub const CURRENT_VERSION: u32 = 1;
}

// ── 导出 ─────────────────────────────────────────────────────────────────────

/// 将指定环境（含其服务数据）序列化为可移植的 JSON 字符串。
///
/// `environment_id`：要导出的环境 ID（必须已存在）。
pub fn export_environment(environment_id: &str) -> Result<String> {
    // 读取环境信息
    let env_manager = EnvironmentManager::global();
    let env_manager = env_manager.lock().unwrap();
    let environments = env_manager.get_all_environments()?;
    let environment = environments
        .into_iter()
        .find(|e| e.id == environment_id)
        .context(format!("找不到环境 ID: {}", environment_id))?;

    // 读取该环境的所有服务数据
    let serv_manager = EnvServDataManager::global();
    let serv_manager = serv_manager.lock().unwrap();
    let service_datas: Vec<ServiceData> = serv_manager
        .get_environment_all_service_datas(environment_id)
        .unwrap_or_default();

    // 对每个服务只保留可导出的 metadata 字段
    let exported_services: Vec<ExportedServiceData> = service_datas
        .into_iter()
        .map(|sd| {
            let export_keys = sd.service_type.export_metadata_keys();
            let filtered_meta: HashMap<String, serde_json::Value> = sd
                .metadata
                .unwrap_or_default()
                .into_iter()
                .filter(|(k, _)| export_keys.contains(&k.as_str()))
                .filter(|(_, v)| {
                    // 过滤掉空字符串值（未设置的配置）
                    match v {
                        serde_json::Value::String(s) => !s.trim().is_empty(),
                        _ => true,
                    }
                })
                .collect();

            ExportedServiceData {
                name: sd.name,
                service_type: sd.service_type,
                version: sd.version,
                metadata: filtered_meta,
            }
        })
        .collect();

    let exported = ExportedEnvironment {
        export_version: ExportedEnvironment::CURRENT_VERSION,
        name: environment.name,
        services: exported_services,
    };

    serde_json::to_string_pretty(&exported).context("序列化导出数据失败")
}

// ── 导入 ─────────────────────────────────────────────────────────────────────

/// 从 JSON 字符串导入环境（创建新环境和服务数据）。
///
/// 返回新创建的环境 ID 和名称。
/// 若同名环境已存在，会自动在名称后附加序号。
pub fn import_environment(json_content: &str) -> Result<ImportResult> {
    let exported: ExportedEnvironment =
        serde_json::from_str(json_content).context("解析导入 JSON 失败")?;

    // 检查格式版本
    if exported.export_version > ExportedEnvironment::CURRENT_VERSION {
        log::warn!(
            "导入文件版本 {} 高于当前支持版本 {}，尝试继续导入",
            exported.export_version,
            ExportedEnvironment::CURRENT_VERSION
        );
    }

    // 处理同名环境：若已存在则在末尾追加 (1)、(2) ...
    let env_manager = EnvironmentManager::global();
    let mut env_name = {
        let mgr = env_manager.lock().unwrap();
        let existing = mgr.get_all_environments().unwrap_or_default();
        let base_name = exported.name.trim().to_string();
        let mut name = base_name.clone();
        let mut counter = 1u32;
        while existing.iter().any(|e| e.name == name) {
            name = format!("{} ({})", base_name, counter);
            counter += 1;
        }
        name
    };

    // 创建环境
    let env_id = {
        let mgr = env_manager.lock().unwrap();
        let res = mgr
            .create_environment(env_name.clone(), None)
            .context("创建环境失败")?;
        if !res.success {
            anyhow::bail!("创建环境失败: {}", res.message);
        }
        res.data
            .as_ref()
            .and_then(|d| d.get("environment"))
            .and_then(|e| e.get("id"))
            .and_then(|id| id.as_str())
            .context("无法从创建结果中获取环境 ID")?
            .to_string()
    };

    // 逐一创建服务数据，并将可导出的 metadata 写入
    let serv_manager = EnvServDataManager::global();
    let mut service_results: Vec<ServiceImportResult> = Vec::new();

    for svc in &exported.services {
        let result = (|| -> Result<String> {
            let mgr = serv_manager.lock().unwrap();

            // 创建服务数据（会自动构建本地默认 metadata）
            let create_res = mgr.create_service_data(
                &env_id,
                svc.service_type.clone(),
                svc.version.clone(),
            )?;

            if !create_res.success {
                anyhow::bail!("创建服务失败: {}", create_res.message);
            }

            let service_id = create_res
                .data
                .as_ref()
                .and_then(|d| d.get("serviceData"))
                .and_then(|sd| sd.get("id"))
                .and_then(|id| id.as_str())
                .context("无法从创建结果中获取服务 ID")?
                .to_string();

            // 将导入的 metadata 合并写入（只更新有值的字段，不覆盖本地路径等默认值）
            if !svc.metadata.is_empty() {
                // 读取已创建的服务数据（含默认 metadata）
                let service_datas = mgr.get_environment_all_service_datas(&env_id)?;
                let mut target = service_datas
                    .into_iter()
                    .find(|sd| sd.id == service_id)
                    .context("找不到刚创建的服务数据")?;

                let export_keys = svc.service_type.export_metadata_keys();
                let meta = target.metadata.get_or_insert_with(HashMap::new);

                for (k, v) in &svc.metadata {
                    // 安全校验：只允许写入该类型定义的可导出键
                    if export_keys.contains(&k.as_str()) {
                        meta.insert(k.clone(), v.clone());
                    }
                }

                // 同时更新名称（如果导入数据中有自定义名称）
                let update_req = UpdateServiceDataRequest {
                    id: service_id.clone(),
                    name: Some(svc.name.clone()),
                    status: None,
                    sort: None,
                    metadata: Some(target.metadata.clone().unwrap_or_default()),
                };
                mgr.update_service_data(&env_id, update_req)?;
            } else if svc.name != svc.service_type.default_name() {
                // 只更新名称
                let update_req = UpdateServiceDataRequest {
                    id: service_id.clone(),
                    name: Some(svc.name.clone()),
                    status: None,
                    sort: None,
                    metadata: None,
                };
                mgr.update_service_data(&env_id, update_req)?;
            }

            Ok(service_id)
        })();

        match result {
            Ok(id) => service_results.push(ServiceImportResult {
                service_type: svc.service_type.clone(),
                version: svc.version.clone(),
                success: true,
                error: None,
                service_id: Some(id),
            }),
            Err(e) => {
                log::warn!("导入服务 {:?} {} 失败: {}", svc.service_type, svc.version, e);
                service_results.push(ServiceImportResult {
                    service_type: svc.service_type.clone(),
                    version: svc.version.clone(),
                    success: false,
                    error: Some(e.to_string()),
                    service_id: None,
                });
            }
        }
    }

    log::info!(
        "环境导入完成: {} ({})，服务数: {}",
        env_name,
        env_id,
        service_results.len()
    );

    Ok(ImportResult {
        environment_id: env_id,
        environment_name: env_name,
        services: service_results,
    })
}

// ── 结果结构 ─────────────────────────────────────────────────────────────────

/// 单个服务的导入结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceImportResult {
    pub service_type: ServiceType,
    pub version: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_id: Option<String>,
}

/// 整体导入结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub environment_id: String,
    pub environment_name: String,
    pub services: Vec<ServiceImportResult>,
}
