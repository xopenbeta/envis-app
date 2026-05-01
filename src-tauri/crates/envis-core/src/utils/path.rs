use std::path::Path;

/// 将路径转换为适合 Windows 进程参数的字符串。
///
/// Windows API 通常可接受两种分隔符，但部分命令（如 explorer）
/// 在混合分隔符场景下可能出现回退行为，因此统一为 `\\`。
pub fn to_windows_path_string(path: &Path) -> String {
    path.to_string_lossy().replace('/', "\\")
}

/// 将路径转换为统一的 `/` 分隔符字符串。
///
/// 适用于配置文件中需要稳定跨平台表示路径的场景。
pub fn to_unix_path_string(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}
