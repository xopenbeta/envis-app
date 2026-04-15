//! 构建器模块
//!
//! 该模块包含用于构建服务环境变量、路径和元数据的各种构建器。
//! 这些构建器将原本在 EnvServDataManager 中的构建逻辑分离出来，
//! 提供更清晰的职责分离和更好的代码组织。

pub mod envpaths;
pub mod envvars;
pub mod metadata;

pub use envpaths::EnvPathBuilder;
pub use envvars::EnvVarBuilder;
pub use metadata::MetadataBuilder;
