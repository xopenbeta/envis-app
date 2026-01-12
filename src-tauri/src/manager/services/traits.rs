use crate::types::ServiceData;
use anyhow::Result;

/// 服务生命周期特征
/// 定义服务的激活和停用行为
pub trait ServiceLifecycle {
    /// 激活服务
    fn active(&self, environment_id: &str, service_data: &ServiceData, password: Option<String>) -> Result<()>;
    
    /// 停用服务
    fn deactive(&self, environment_id: &str, service_data: &ServiceData, password: Option<String>) -> Result<()>;
}
