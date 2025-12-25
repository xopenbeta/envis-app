use crate::manager::services::ssl::{SslService, CAConfig};
use crate::types::{CommandResponse, ServiceData};

/// 检查 CA 是否已初始化
#[tauri::command]
pub async fn check_ca_initialized(
    environment_id: String,
) -> Result<CommandResponse, String> {
    let ssl_service = SslService::global();
    let initialized = ssl_service.is_ca_initialized(&environment_id);
    
    let data = serde_json::json!({
        "initialized": initialized
    });
    
    Ok(CommandResponse::success(
        if initialized { "CA 已初始化" } else { "CA 未初始化" }.to_string(),
        Some(data),
    ))
}

/// 初始化 CA
#[tauri::command]
pub async fn initialize_ca(
    environment_id: String,
    service_data: ServiceData,
    common_name: String,
    organization: String,
    organizational_unit: Option<String>,
    country: String,
    state: String,
    locality: String,
    validity_days: i32,
) -> Result<CommandResponse, String> {
    log::info!("开始初始化 CA for environment: {}", environment_id);
    
    let ca_config = CAConfig {
        common_name,
        organization,
        organizational_unit,
        country,
        state,
        locality,
        validity_days,
    };
    
    let ssl_service = SslService::global();
    match ssl_service.initialize_ca(&environment_id, &service_data, ca_config) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("初始化 CA 失败: {}", e))),
    }
}

/// 获取 CA 信息
#[tauri::command]
pub async fn get_ca_info(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let ssl_service = SslService::global();
    match ssl_service.get_ca_info(&environment_id, &service_data) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("获取 CA 信息失败: {}", e))),
    }
}

/// 签发证书
#[tauri::command]
pub async fn issue_certificate(
    environment_id: String,
    service_data: ServiceData,
    domain: String,
    subject_alt_names: Option<Vec<String>>,
    validity_days: i32,
) -> Result<CommandResponse, String> {
    log::info!("开始签发证书: {}", domain);
    
    let ssl_service = SslService::global();
    match ssl_service.issue_certificate(
        &environment_id,
        &service_data,
        domain,
        subject_alt_names,
        validity_days,
    ) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("签发证书失败: {}", e))),
    }
}

/// 列出所有证书
#[tauri::command]
pub async fn list_certificates(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let ssl_service = SslService::global();
    match ssl_service.list_certificates(&environment_id, &service_data) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("列出证书失败: {}", e))),
    }
}

/// 删除证书
#[tauri::command]
pub async fn delete_certificate(
    environment_id: String,
    service_data: ServiceData,
    domain: String,
) -> Result<CommandResponse, String> {
    log::info!("删除证书: {}", domain);
    
    let ssl_service = SslService::global();
    match ssl_service.delete_certificate(&environment_id, &service_data, domain) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("删除证书失败: {}", e))),
    }
}

/// 导出 CA 证书
#[tauri::command]
pub async fn export_ca_certificate(
    environment_id: String,
    service_data: ServiceData,
) -> Result<CommandResponse, String> {
    let ssl_service = SslService::global();
    match ssl_service.export_ca_certificate(&environment_id, &service_data) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("导出 CA 证书失败: {}", e))),
    }
}

/// 检查 CA 证书是否已安装到系统
#[tauri::command]
pub async fn check_ca_installed(
    environment_id: String,
) -> Result<CommandResponse, String> {
    let ssl_service = SslService::global();
    match ssl_service.check_ca_installed(&environment_id) {
        Ok(result) => Ok(CommandResponse::success(result.message, result.data)),
        Err(e) => Ok(CommandResponse::error(format!("检查 CA 安装状态失败: {}", e))),
    }
}
