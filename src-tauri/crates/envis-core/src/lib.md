## 跨平台路径处理约定

本项目是跨平台项目，路径处理必须避免手工拼接分隔符。

### 基础原则

1. 路径拼接统一使用 `PathBuf` 和 `Path::join`。
2. 仅在和外部进程或配置文件交互时，将 `Path` 转成字符串。
3. 不在业务代码中散落 `replace('/', '\\')` 或 `replace('\\', '/')`，统一走工具函数。

### 统一工具函数

已在 `src-tauri/crates/envis-core/src/utils/path.rs` 提供：

1. `to_windows_path_string(path)`：将路径转成 Windows 友好的 `\\` 分隔符字符串。
2. `to_forward_slash_path_string(path)`：将路径转成统一 `/` 分隔符字符串，适合写入配置文件。

### 已落地的典型场景

1. 在 Windows 中调用 `explorer` 打开路径时，使用 `to_windows_path_string`。
2. 生成 MongoDB 配置文件路径时，使用 `to_forward_slash_path_string`。

后续新增服务时，若涉及路径字符串输出，优先复用上述工具函数，保持跨平台行为一致。