use std::ffi::OsStr;
use std::process::Command;

/// 创建一个在 Windows 上不弹出终端窗口的 Command
///
/// 在 Windows 平台上自动设置 `CREATE_NO_WINDOW` 标志（0x08000000），
/// 防止执行外部命令时弹出终端窗口。
///
/// # 示例
/// ```
/// use crate::utils::command::create_command;
///
/// let output = create_command("ipconfig")
///     .arg("/all")
///     .output()?;
/// ```
pub fn create_command<S: AsRef<OsStr>>(program: S) -> Command {
    let mut cmd = Command::new(program);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd
}
