use crate::manager::app_config_manager::AppConfigManager;
use crate::types::ServiceData;
use anyhow::Result;
use std::path::Path;

/// 环境路径构建器
/// 负责为不同服务类型构建 PATH 路径配置
pub struct EnvPathBuilder;

impl EnvPathBuilder {
    /// 为指定服务类型构建 PATH 路径列表
    /// 通过 AppConfig 构建完整的绝对路径
    pub fn build_paths(service_data: &ServiceData) -> Result<Vec<String>> {
        let mut paths = Vec::new();

        // 获取 AppConfigManager 实例
        let app_config_manager = AppConfigManager::global();
        let app_config = app_config_manager.lock().unwrap();
        let services_folder = app_config.get_services_folder();

        // 获取服务对应的目录名（小写）- 直接使用枚举的方法
        let service_dir_name = service_data.service_type.dir_name();
        let service_sub_dirs = service_data.service_type.sub_dirs();

        // 构建服务的完整路径：services_folder/service_dir_name/service_version
        let service_folder = Path::new(&services_folder)
            .join(service_dir_name)
            .join(&service_data.version);

        for subdir in service_sub_dirs {
            let path = if subdir.is_empty() {
                // 空字符串表示服务根目录
                service_folder.clone()
            } else {
                service_folder.join(subdir)
            };
            let absolute_path = path.canonicalize().unwrap_or(path); // 转换为绝对路径
            paths.push(absolute_path.to_string_lossy().to_string());
        }

        Ok(paths)
    }
}
