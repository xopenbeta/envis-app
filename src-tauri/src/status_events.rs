use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

/// 初始化事件模块，保存 AppHandle 供后续推送使用。
/// 应在 setup 回调中调用一次。
pub fn init(handle: AppHandle) {
    let _ = APP_HANDLE.set(handle);
}

fn emit(event: &str, payload: serde_json::Value) {
    if let Some(handle) = APP_HANDLE.get() {
        if let Err(e) = handle.emit(event, payload) {
            log::warn!("推送状态事件 {} 失败: {}", event, e);
        }
    }
}

/// 推送环境状态变化事件（激活 / 停用）
pub fn emit_environment_status(environment_id: &str) {
    emit(
        "status:environment",
        serde_json::json!({ "environmentId": environment_id }),
    );
}

/// 推送服务数据激活状态变化事件（激活 / 停用）
pub fn emit_service_data_status(environment_id: &str, service_id: &str) {
    emit(
        "status:service-data",
        serde_json::json!({ "environmentId": environment_id, "serviceId": service_id }),
    );
}

/// 推送服务运行状态变化事件（启动 / 停止 / 重启）
pub fn emit_service_status(environment_id: &str, service_id: &str) {
    emit(
        "status:service",
        serde_json::json!({ "environmentId": environment_id, "serviceId": service_id }),
    );
}
