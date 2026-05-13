use envis_core::manager::app_config_manager::AppConfigManager;
use envis_core::manager::services::{
    DnsmasqService, DownloadManager, MariadbService, MongodbService, MysqlService, NginxService,
    PostgresqlService, RedisService,
};
use envis_core::types::{ServiceData, ServiceType};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::OnceLock;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

const POLL_INTERVAL_MS: u64 = 500;
const ENV_CONFIG_FILE: &str = "environment.json";
const SERVICE_CONFIG_FILE: &str = "service.json";

/// 初始化事件模块，保存 AppHandle 供后续推送使用，并启动配置文件轮询线程。
/// 应在 setup 回调中调用一次。
pub fn init(handle: AppHandle) {
    let _ = APP_HANDLE.set(handle);
    start_config_watcher();
    start_service_status_watcher();
    start_download_watcher();
}

fn emit(event: &str, payload: serde_json::Value) {
    if let Some(handle) = APP_HANDLE.get() {
        if let Err(e) = handle.emit(event, payload) {
            log::warn!("推送状态事件 {} 失败: {}", event, e);
        }
    }
}

/// 推送环境状态变化事件（激活 / 停用），status 为 "active" 或 "inactive"
pub fn emit_environment_status(environment_id: &str, status: &str) {
    emit(
        "status:environment",
        serde_json::json!({ "environmentId": environment_id, "status": status }),
    );
}

/// 推送服务数据激活状态变化事件（激活 / 停用），status 为 "active" 或 "inactive"
pub fn emit_service_data_status(environment_id: &str, service_id: &str, status: &str) {
    emit(
        "status:service-data",
        serde_json::json!({ "environmentId": environment_id, "serviceId": service_id, "status": status }),
    );
}

/// 推送服务运行状态变化事件（启动 / 停止 / 重启），status 为 "running" 或 "stopped"
pub fn emit_service_status(environment_id: &str, service_id: &str, status: &str) {
    emit(
        "status:service",
        serde_json::json!({ "environmentId": environment_id, "serviceId": service_id, "status": status }),
    );
}

/// 推送服务下载状态变化事件，status 为 DownloadStatus 的小写字符串，progress 为 0-100
pub fn emit_download_status(task_id: &str, status: &str, progress: f64) {
    emit(
        "status:download",
        serde_json::json!({ "taskId": task_id, "status": status, "progress": progress }),
    );
}

// ── 配置文件轮询 ────────────────────────────────────────────────────────────

/// 启动后台轮询线程，每隔 [`POLL_INTERVAL_SECS`] 秒扫描 `envs_folder` 下所有
/// `environment.json` 和 `service.json` 文件的 `status` 字段。
/// 一旦检测到与上次快照不同，则通过 `emit_*` 函数向前端推送对应事件。
fn start_config_watcher() {
    std::thread::spawn(|| {
        // env_id -> status 字符串
        let mut env_snapshot: HashMap<String, String> = HashMap::new();
        // (env_id, service_id) -> status 字符串
        let mut svc_snapshot: HashMap<(String, String), String> = HashMap::new();

        loop {
            std::thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));

            let envs_folder = {
                let global = AppConfigManager::global();
                let guard = match global.lock() {
                    Ok(g) => g,
                    Err(e) => {
                        log::warn!("status_events: 获取 AppConfigManager 锁失败: {}", e);
                        continue;
                    }
                };
                guard.get_envs_folder()
            };

            let envs_path = Path::new(&envs_folder);
            if !envs_path.exists() {
                continue;
            }

            let entries = match fs::read_dir(envs_path) {
                Ok(e) => e,
                Err(e) => {
                    log::warn!("status_events: 读取 envs_folder 失败: {}", e);
                    continue;
                }
            };

            for entry in entries.flatten() {
                let env_path = entry.path();
                if !env_path.is_dir() {
                    continue;
                }

                let env_id = match env_path.file_name().and_then(|n| n.to_str()) {
                    Some(id) => id.to_string(),
                    None => continue,
                };

                // ── 检测 environment.json 的 status 变化 ──────────────────
                let env_config_path = env_path.join(ENV_CONFIG_FILE);
                if env_config_path.exists() {
                    if let Some(status) = read_status_field(&env_config_path) {
                        let prev = env_snapshot.get(&env_id);
                        let changed = prev.map(|p| p != &status).unwrap_or(false);
                        let is_first = prev.is_none();

                        env_snapshot.insert(env_id.clone(), status.clone());

                        if changed && !is_first {
                            log::debug!(
                                "status_events: 环境状态变化 env_id={} status={} → 推送事件",
                                env_id, status
                            );
                            emit_environment_status(&env_id, &status);
                        }
                    }
                }

                // ── 检测 service.json 的 status 变化 ──────────────────────
                // 路径结构: envs_folder/<env_id>/<service_type>/<version>/service.json
                let svc_type_entries = match fs::read_dir(&env_path) {
                    Ok(e) => e,
                    Err(_) => continue,
                };

                for svc_type_entry in svc_type_entries.flatten() {
                    let svc_type_path = svc_type_entry.path();
                    if !svc_type_path.is_dir() {
                        continue;
                    }

                    let version_entries = match fs::read_dir(&svc_type_path) {
                        Ok(e) => e,
                        Err(_) => continue,
                    };

                    for version_entry in version_entries.flatten() {
                        let version_path = version_entry.path();
                        if !version_path.is_dir() {
                            continue;
                        }

                        let svc_config_path = version_path.join(SERVICE_CONFIG_FILE);
                        if !svc_config_path.exists() {
                            continue;
                        }

                        if let Some((svc_id, status)) =
                            read_id_and_status_field(&svc_config_path)
                        {
                            let key = (env_id.clone(), svc_id.clone());
                            let prev = svc_snapshot.get(&key);
                            let changed = prev.map(|p| p != &status).unwrap_or(false);
                            let is_first = prev.is_none();

                            svc_snapshot.insert(key, status.clone());

                            if changed && !is_first {
                                log::debug!(
                                    "status_events: 服务数据状态变化 env_id={} svc_id={} status={} → 推送事件",
                                    env_id,
                                    svc_id,
                                    status
                                );
                                emit_service_data_status(&env_id, &svc_id, &status);
                            }
                        }
                    }
                }
            }
        }
    });
}

/// 从 JSON 文件中读取 `status` 字段（字符串形式）。
fn read_status_field(path: &Path) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&content).ok()?;
    value.get("status")?.as_str().map(|s| s.to_string())
}

/// 从 JSON 文件中读取 `id` 和 `status` 字段。
fn read_id_and_status_field(path: &Path) -> Option<(String, String)> {
    let content = fs::read_to_string(path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&content).ok()?;
    let id = value.get("id")?.as_str()?.to_string();
    let status = value.get("status")?.as_str()?.to_string();
    Some((id, status))
}

// ── 服务运行状态轮询 ─────────────────────────────────────────────────────────

/// 启动服务运行状态轮询线程，每 500ms 扫描所有激活环境中的激活服务数据，
/// 通过调用对应服务管理器检测进程运行状态。一旦状态发生变化，
/// 向前端推送 `status:service` 事件。
fn start_service_status_watcher() {
    std::thread::spawn(|| {
        // (env_id, service_id) -> status 字符串快照
        let mut snapshot: HashMap<(String, String), String> = HashMap::new();

        loop {
            std::thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));

            let envs_folder = {
                let global = AppConfigManager::global();
                let guard = match global.lock() {
                    Ok(g) => g,
                    Err(e) => {
                        log::warn!("status_events: service_status_watcher 获取锁失败: {}", e);
                        continue;
                    }
                };
                guard.get_envs_folder()
            };

            let envs_path = Path::new(&envs_folder);
            if !envs_path.exists() {
                continue;
            }

            let entries = match fs::read_dir(envs_path) {
                Ok(e) => e,
                Err(e) => {
                    log::warn!("status_events: service_status_watcher 读取 envs_folder 失败: {}", e);
                    continue;
                }
            };

            for entry in entries.flatten() {
                let env_path = entry.path();
                if !env_path.is_dir() {
                    continue;
                }

                let env_id = match env_path.file_name().and_then(|n| n.to_str()) {
                    Some(id) => id.to_string(),
                    None => continue,
                };

                // 只处理已激活的环境
                let env_config_path = env_path.join(ENV_CONFIG_FILE);
                let env_status = match read_status_field(&env_config_path) {
                    Some(s) => s,
                    None => continue,
                };
                if env_status != "active" {
                    continue;
                }

                // 遍历服务类型目录
                let svc_type_entries = match fs::read_dir(&env_path) {
                    Ok(e) => e,
                    Err(_) => continue,
                };

                for svc_type_entry in svc_type_entries.flatten() {
                    let svc_type_path = svc_type_entry.path();
                    if !svc_type_path.is_dir() {
                        continue;
                    }

                    let version_entries = match fs::read_dir(&svc_type_path) {
                        Ok(e) => e,
                        Err(_) => continue,
                    };

                    for version_entry in version_entries.flatten() {
                        let version_path = version_entry.path();
                        if !version_path.is_dir() {
                            continue;
                        }

                        let svc_config_path = version_path.join(SERVICE_CONFIG_FILE);
                        if !svc_config_path.exists() {
                            continue;
                        }

                        // 读取 id 和 status，跳过未激活的服务数据
                        let (svc_id, svc_status) = match read_id_and_status_field(&svc_config_path) {
                            Some(v) => v,
                            None => continue,
                        };
                        if svc_status != "active" {
                            continue;
                        }

                        // 反序列化完整 ServiceData
                        let service_data: ServiceData = match fs::read_to_string(&svc_config_path)
                            .ok()
                            .and_then(|c| serde_json::from_str(&c).ok())
                        {
                            Some(sd) => sd,
                            None => continue,
                        };

                        // 获取进程运行状态
                        let status_str = match get_service_running_status(&env_id, &service_data) {
                            Some(s) => s,
                            None => continue, // 该类型不支持运行状态检测（如 SSL、Host 等）
                        };

                        // 与快照对比，变化则推送
                        let key = (env_id.clone(), svc_id.clone());
                        let prev = snapshot.get(&key);
                        let changed = prev.map(|p| p != &status_str).unwrap_or(true);
                        snapshot.insert(key, status_str.clone());

                        if changed {
                            log::debug!(
                                "status_events: 服务运行状态变化 env_id={} svc_id={} status={} → 推送事件",
                                env_id, svc_id, status_str
                            );
                            emit_service_status(&env_id, &svc_id, &status_str);
                        }
                    }
                }
            }
        }
    });
}

/// 根据服务类型调用对应的服务管理器检测进程运行状态，返回小写状态字符串。
/// 返回 None 表示该服务类型不支持运行状态检测（如 SSL、Host、Custom 等无守护进程的服务）。
fn get_service_running_status(environment_id: &str, service_data: &ServiceData) -> Option<String> {
    match service_data.service_type {
        ServiceType::Nginx => NginxService::global()
            .get_service_status(service_data)
            .ok()
            .and_then(|s| serde_json::to_value(s).ok())
            .and_then(|v| v.as_str().map(|s| s.to_string())),

        ServiceType::Dnsmasq => DnsmasqService::global()
            .get_service_status(service_data)
            .ok()
            .and_then(|s| serde_json::to_value(s).ok())
            .and_then(|v| v.as_str().map(|s| s.to_string())),

        ServiceType::Mongodb => MongodbService::global()
            .get_service_status(environment_id, service_data)
            .ok()
            .and_then(|r| r.data)
            .and_then(|d| d.get("status").and_then(|v| v.as_str()).map(|s| s.to_string())),

        ServiceType::Mariadb => MariadbService::global()
            .get_service_status(environment_id, service_data)
            .ok()
            .and_then(|r| r.data)
            .and_then(|d| d.get("status").and_then(|v| v.as_str()).map(|s| s.to_string())),

        ServiceType::Mysql => MysqlService::global()
            .get_service_status(environment_id, service_data)
            .ok()
            .and_then(|r| r.data)
            .and_then(|d| d.get("status").and_then(|v| v.as_str()).map(|s| s.to_string())),

        ServiceType::Redis => RedisService::global()
            .get_service_status(environment_id, service_data)
            .ok()
            .and_then(|r| r.data)
            .and_then(|d| d.get("status").and_then(|v| v.as_str()).map(|s| s.to_string())),

        ServiceType::Postgresql => PostgresqlService::global()
            .get_service_status(environment_id, service_data)
            .ok()
            .and_then(|r| r.data)
            .and_then(|d| d.get("status").and_then(|v| v.as_str()).map(|s| s.to_string())),

        // Custom、Host、SSL、Java、NodeJs、Python、Rust、Nasm、MinGW 等无守护进程，不需要运行状态检测
        _ => None,
    }
}

// ── 下载状态轮询 ────────────────────────────────────────────────────────────

/// 启动下载状态轮询线程，每 500ms 检查 DownloadManager 中所有任务。
/// 若任务的 (status, progress) 与上次快照不同，则向前端推送 `status:download` 事件。
fn start_download_watcher() {
    std::thread::spawn(|| {
        // task_id -> (status_str, progress)
        let mut snapshot: HashMap<String, (String, u64)> = HashMap::new();

        loop {
            std::thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));

            let tasks = DownloadManager::global().get_all_tasks();

            for task in tasks {
                let status_str = format!("{:?}", task.status).to_lowercase();
                // 用整数进度（避免浮点比较问题）
                let progress_int = task.progress as u64;
                let key = task.id.clone();

                let prev = snapshot.get(&key);
                let changed = prev
                    .map(|(s, p)| s != &status_str || *p != progress_int)
                    .unwrap_or(true);

                snapshot.insert(key, (status_str.clone(), progress_int));

                if changed {
                    log::debug!(
                        "status_events: 下载状态变化 task_id={} status={} progress={:.1} → 推送事件",
                        task.id, status_str, task.progress
                    );
                    emit_download_status(&task.id, &status_str, task.progress);
                }
            }
        }
    });
}
