use envis_core::manager::app_config_manager::AppConfigManager;
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
