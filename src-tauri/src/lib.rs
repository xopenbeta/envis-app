// GUI 相关逻辑已全部迁移至 envis-gui crate。
// 此文件作为薄包装层：
//   - 通过 tauri::generate_context!() 生成并传入 tauri 上下文（该宏必须在
//     含有 tauri.conf.json 的主 crate 中调用，故不能移入 envis-gui）。
//   - 重新导出 handle_cli 供 main.rs 调用。

// 重新导出 CLI 相关函数供 main.rs 使用
pub use envis_cli::cli::handle_cli;

// 在移动端构建时：相当于给 run 函数加上 #[tauri::mobile_entry_point]，让它成为移动端入口。
// 在桌面端构建时：不会添加这个属性，run 只是普通函数，你通常会在 main() 里调用它。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    envis_gui::run(tauri::generate_context!())
}
