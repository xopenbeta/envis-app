use anyhow::{Context, Result};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

// Shell 配置相关常量
const ENVIS_ACTIVE_BLOCK_START: &str = "# BEGIN Envis Environment Block";
const ENVIS_WARNING: &str =
    "# WARNING: This block is automatically managed by Envis. Do not edit manually!";
const ENVIS_ACTIVE_BLOCK_END: &str = "# END Envis Environment Block";

// 支持的 Shell 类型
#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)]
pub enum ShellType {
    Bash,
    Zsh,
    PowerShell,
    PowerShellCore,
    Cmd,
}

impl ShellType {
    fn config_file_name(&self) -> &str {
        match self {
            ShellType::Bash => ".bash_profile",
            ShellType::Zsh => ".zshrc",
            ShellType::PowerShell => "Microsoft.PowerShell_profile.ps1",
            ShellType::PowerShellCore => "Microsoft.PowerShell_profile.ps1",
            ShellType::Cmd => "envis_autorun.cmd",
        }
    }
}

/// 全局 Shell 管理器单例
static SHELL_MANAGER: OnceLock<Arc<Mutex<ShellManager>>> = OnceLock::new();

/// Shell 管理器
pub struct ShellManager {
    config_file_paths: Vec<PathBuf>, // shell 配置文件路径列表,构造函数里设置的
    #[allow(dead_code)]
    is_development: bool, // 是否为开发环境,构造函数里设置的
}

impl ShellManager {
    /// 获取全局 Shell 管理器实例
    pub fn global() -> Arc<Mutex<ShellManager>> {
        SHELL_MANAGER
            .get_or_init(|| {
                let manager = Self::new().expect("Failed to initialize ShellManager");
                Arc::new(Mutex::new(manager))
            })
            .clone()
    }

    /// 创建新的 Shell 管理器
    fn new() -> Result<Self> {
        // 检查是否为开发环境
        let is_development = cfg!(debug_assertions);

        let home_dir = dirs::home_dir().context("无法获取用户主目录")?;

        // 根据操作系统给出配置文件路径
        let config_file_paths = if cfg!(target_os = "windows") {
            // Windows 系统
            let documents_dir = dirs::document_dir().context("无法获取文档目录")?;
            
            let mut paths = Vec::new();
            
            // CMD 配置文件（开发和线上都需要）
            let cmd_dir = documents_dir.join("envis");
            let cmd_profile = cmd_dir.join("envis_autorun.cmd");
            paths.push(cmd_profile);
            
            if !is_development {
                // 线上环境才添加 PowerShell 配置文件
                
                // PowerShell 5.x 配置文件
                let ps5_dir = documents_dir.join("WindowsPowerShell");
                let ps5_profile = ps5_dir.join("Microsoft.PowerShell_profile.ps1");
                paths.push(ps5_profile);
                
                // PowerShell 7+ 配置文件
                let ps7_dir = documents_dir.join("PowerShell");
                let ps7_profile = ps7_dir.join("Microsoft.PowerShell_profile.ps1");
                paths.push(ps7_profile);
            }
            
            paths
        } else {
            // 无论是开发还是生产环境，都同时管理 Bash 和 Zsh
            vec![
                home_dir.join(ShellType::Bash.config_file_name()),
                home_dir.join(ShellType::Zsh.config_file_name()),
            ]
        };

        let manager = Self {
            config_file_paths,
            is_development,
        };

        // 初始化环境变量块
        manager.initialize_env_block()?;

        // Windows 下设置 CMD 的 AutoRun 注册表
        #[cfg(target_os = "windows")]
        manager.setup_cmd_autorun()?;

        Ok(manager)
    }

    /// 设置 CMD 的 AutoRun 注册表项
    #[cfg(target_os = "windows")]
    fn setup_cmd_autorun(&self) -> Result<()> {
        // 获取 CMD 配置文件路径
        let cmd_config_path = self.config_file_paths.iter()
            .find(|p| p.extension().and_then(|s| s.to_str()) == Some("cmd"))
            .context("无法找到 CMD 配置文件路径")?;

        // 使用 PowerShell 命令设置注册表
        // 先创建注册表路径（如果不存在），然后设置 AutoRun 值
        let autorun_value = format!("\"{}\"", cmd_config_path.display());
        let ps_command = format!(
            "if (!(Test-Path 'HKCU:\\Software\\Microsoft\\Command Processor')) {{ New-Item -Path 'HKCU:\\Software\\Microsoft\\Command Processor' -Force | Out-Null }}; Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Command Processor' -Name 'AutoRun' -Value '{}' -Force",
            autorun_value.replace("'", "''") // 转义单引号
        );

        let output = Command::new("powershell")
            .args(&["-NoProfile", "-Command", &ps_command])
            .output()
            .context("执行 PowerShell 命令失败")?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            log::warn!("设置 CMD AutoRun 失败: {}，但这不会影响 PowerShell 使用", error_msg);
            // 不返回错误，允许继续初始化（CMD AutoRun 是可选功能）
            return Ok(());
        }

        log::info!("CMD AutoRun 已设置为: {}", autorun_value);
        Ok(())
    }

    /// 初始化环境变量块
    fn initialize_env_block(&self) -> Result<()> {
        // 获取 envis 可执行文件路径
        let envis_path = match std::env::current_exe() {
            Ok(exe) => {
                log::debug!("ShellManager: 当前可执行文件路径: {:?}", exe);
                match exe.parent() {
                    Some(parent) => {
                        let path = parent.to_path_buf();
                        log::debug!("ShellManager: envis 命令目录: {:?}", path);
                        Some(path)
                    }
                    None => {
                        log::warn!("ShellManager: 无法获取可执行文件的父目录");
                        None
                    }
                }
            }
            Err(e) => {
                log::warn!("ShellManager: 无法获取当前可执行文件路径: {}", e);
                None
            }
        };
        
        // 对所有配置文件执行初始化
        for config_file_path in &self.config_file_paths {
            // 确保配置文件所在目录存在
            if let Some(parent_dir) = config_file_path.parent() {
                if !parent_dir.exists() {
                    fs::create_dir_all(parent_dir).context("创建配置文件目录失败")?;
                }
            }

            let content = if config_file_path.exists() {
                fs::read_to_string(config_file_path).context("读取 Shell 配置文件失败")?
            } else {
                String::new()
            };

            // 检查是否已存在环境变量块,如果存在先删除
            let mut base_content = content.clone();
            if base_content.contains(ENVIS_ACTIVE_BLOCK_START) {
                base_content = self.remove_env_block(&base_content)?;
            }

            // 判断文件类型以使用正确的注释前缀
            let is_cmd = config_file_path.extension().and_then(|s| s.to_str()) == Some("cmd");
            let is_ps = config_file_path.extension().and_then(|s| s.to_str()) == Some("ps1");
            
            // 构建 envis 路径添加命令（如果可执行文件路径可用）
            let envis_path_line = if let Some(ref path) = envis_path {
                let path_str = path.to_string_lossy();
                if is_cmd {
                    format!("set PATH={};%PATH%\n", path_str)
                } else if is_ps {
                    format!("$env:Path = \"{};\" + $env:Path\n", path_str)
                } else {
                    format!("export PATH=\"{}:$PATH\"\n", path_str)
                }
            } else {
                String::new()
            };
            
            let block_content = if is_cmd {
                // CMD 使用 REM 作为注释（不包含 # 符号）
                let prefix = if base_content.is_empty() {
                    "@echo off\n"
                } else {
                    "\n"
                };
                format!(
                    "{}REM {}\nREM {}\n{}REM {}\n",
                    prefix, ENVIS_ACTIVE_BLOCK_START, ENVIS_WARNING, envis_path_line, ENVIS_ACTIVE_BLOCK_END
                )
            } else {
                // PowerShell 和 Unix Shell 使用 # 作为注释
                format!(
                    "\n{}\n{}\n{}{}\n",
                    ENVIS_ACTIVE_BLOCK_START, ENVIS_WARNING, envis_path_line, ENVIS_ACTIVE_BLOCK_END
                )
            };

            let new_content = if base_content.is_empty() {
                block_content
            } else {
                format!("{}{}", base_content, block_content)
            };
            // 原子写入并备份原文件
            self.write_content_atomic_for_path(config_file_path, &new_content)?;
        }
        
        // 记录日志
        if let Some(path) = envis_path {
            log::info!("ShellManager: 已将 envis 命令路径添加到环境配置: {}", path.display());
            log::debug!("ShellManager: 现在可以在终端中使用 'envis' 命令了");
        } else {
            log::warn!("ShellManager: 未能添加 envis 命令路径（无法获取可执行文件路径）");
        }

        Ok(())
    }

    /// echo Envis: Current environment is environment name, environment id
    pub fn add_echo_environment(
        &self,
        environment_name: &str,
        environment_id: &str,
    ) -> Result<()> {
        // 为每个配置文件生成对应的 echo 命令
        for config_file_path in &self.config_file_paths {
            let is_cmd = config_file_path.extension().and_then(|s| s.to_str()) == Some("cmd");
            let is_ps = config_file_path.extension().and_then(|s| s.to_str()) == Some("ps1");
            
            let echo_line = if is_cmd {
                // CMD 语法 - 不使用 ANSI 颜色代码
                format!(
                    "echo Envis: Current environment is {}, {}",
                    environment_name, environment_id
                )
            } else if is_ps {
                // PowerShell 语法
                format!(
                    "Write-Host 'Envis: Current environment is {}, {}' -ForegroundColor Green",
                    environment_name, environment_id
                )
            } else {
                // Unix Shell 语法
                format!("echo Envis: Current environment is {}, {}", environment_name, environment_id)
            };
            
            // 先删除已有的 echo 行，避免重复显示
            let prefix = if is_cmd {
                "echo Envis: Current environment is"
            } else if is_ps {
                "Write-Host 'Envis: Current environment is"
            } else {
                "echo Envis: Current environment is"
            };
            let _ = self.remove_line_from_file(config_file_path, prefix);
            self.add_line_to_file(config_file_path, &echo_line)?;
        }
        
        Ok(())
    }

    /// 移除环境 echo 信息
    pub fn remove_echo_environment(&self) -> Result<()> {
        // 为每个配置文件删除对应的 echo 命令
        for config_file_path in &self.config_file_paths {
            let is_cmd = config_file_path.extension().and_then(|s| s.to_str()) == Some("cmd");
            let is_ps = config_file_path.extension().and_then(|s| s.to_str()) == Some("ps1");
            
            let prefix = if is_cmd {
                "echo Envis: Current environment is"
            } else if is_ps {
                "Write-Host 'Envis: Current environment is"
            } else {
                "echo Envis: Current environment is"
            };
            
            let _ = self.remove_line_from_file(config_file_path, prefix);
        }
        
        Ok(())
    }

    /// 添加环境变量导出
    pub fn add_export(&self, key: &str, value: &str) -> Result<()> {
        // 为每个配置文件生成对应的环境变量设置命令
        for config_file_path in &self.config_file_paths {
            let is_cmd = config_file_path.extension().and_then(|s| s.to_str()) == Some("cmd");
            let is_ps = config_file_path.extension().and_then(|s| s.to_str()) == Some("ps1");
            
            let (prefix, export_line) = if is_cmd {
                // CMD 语法
                (
                    format!("set {}=", key),
                    format!("set {}={}", key, value)
                )
            } else if is_ps {
                // PowerShell 语法
                (
                    format!("$env:{} =", key),
                    format!("$env:{} = \"{}\"", key, value)
                )
            } else {
                // Unix Shell 语法
                (
                    format!("export {}=", key),
                    format!("export {}=\"{}\"", key, value)
                )
            };
            
            // 先删除已有的同名 export 行，避免重复添加
            let _ = self.remove_line_from_file(config_file_path, &prefix);
            self.add_line_to_file(config_file_path, &export_line)?;
        }
        
        Ok(())
    }

    /// 删除环境变量导出
    pub fn delete_export(&self, key: &str) -> Result<()> {
        for config_file_path in &self.config_file_paths {
            let is_cmd = config_file_path.extension().and_then(|s| s.to_str()) == Some("cmd");
            let is_ps = config_file_path.extension().and_then(|s| s.to_str()) == Some("ps1");
            
            let prefix = if is_cmd {
                format!("set {}=", key)
            } else if is_ps {
                format!("$env:{} =", key)
            } else {
                format!("export {}=", key)
            };
            
            self.remove_line_from_file(config_file_path, &prefix)?;
        }
        
        Ok(())
    }

    /// 添加 PATH 路径
    pub fn add_path(&self, path: &str) -> Result<()> {
        // 为每个配置文件单独处理
        for config_file_path in &self.config_file_paths {
            let is_cmd = config_file_path.extension().and_then(|s| s.to_str()) == Some("cmd");
            let is_ps = config_file_path.extension().and_then(|s| s.to_str()) == Some("ps1");
            
            // 先读取当前的 PATH 设置
            let current_paths = self.get_current_paths_from_file(config_file_path)?;

            // 如果路径已存在，跳过
            if current_paths.contains(path) {
                continue;
            }

            // 构建新的 PATH 导出语句
            let mut all_paths: Vec<String> = current_paths.into_iter().collect();
            all_paths.insert(0, path.to_string()); // 新路径插入到最前面

            let (path_line, remove_prefix) = if is_cmd {
                // CMD 语法 - 使用分号分隔
                (
                    format!("set PATH={};%PATH%", all_paths.join(";")),
                    "set PATH=",
                )
            } else if is_ps {
                // PowerShell 语法 - 使用分号分隔
                (
                    format!("$env:Path = \"{};$env:Path\"", all_paths.join(";")),
                    "$env:Path =",
                )
            } else {
                // Unix Shell 语法 - 使用冒号分隔
                (
                    format!("export PATH=\"{}:$PATH\"", all_paths.join(":")),
                    "export PATH=",
                )
            };

            // 先删除所有现有的 PATH 设置
            self.remove_line_from_file(config_file_path, remove_prefix)?;

            // 添加新的 PATH 设置
            self.add_line_to_file(config_file_path, &path_line)?;
        }
        
        Ok(())
    }

    /// 删除 PATH 路径
    pub fn delete_path(&self, path: &str) -> Result<()> {
        for config_file_path in &self.config_file_paths {
            let is_cmd = config_file_path.extension().and_then(|s| s.to_str()) == Some("cmd");
            let is_ps = config_file_path.extension().and_then(|s| s.to_str()) == Some("ps1");
            
            let mut current_paths = self.get_current_paths_from_file(config_file_path)?;
            current_paths.remove(path);

            let remove_prefix = if is_cmd {
                "set PATH="
            } else if is_ps {
                "$env:Path ="
            } else {
                "export PATH="
            };

            // 先删除所有现有的 PATH 设置
            self.remove_line_from_file(config_file_path, remove_prefix)?;

            if !current_paths.is_empty() {
                // 重新构建 PATH
                let all_paths: Vec<String> = current_paths.into_iter().collect();
                let path_line = if is_cmd {
                    format!("set PATH={};%PATH%", all_paths.join(";"))
                } else if is_ps {
                    format!("$env:Path = \"{};$env:Path\"", all_paths.join(";"))
                } else {
                    format!("export PATH=\"{}:$PATH\"", all_paths.join(":"))
                };
        self.add_line_to_file(config_file_path, &path_line)?;
            }
        }

        Ok(())
    }

    /// 获取当前在环境变量块中的 PATH 路径（从第一个配置文件）
    #[allow(dead_code)]
    fn get_current_paths(&self) -> Result<HashSet<String>> {
        let path = &self.config_file_paths[0];
        self.get_current_paths_from_file(path)
    }

    /// 从指定配置文件获取当前在环境变量块中的 PATH 路径
    fn get_current_paths_from_file(&self, config_file_path: &PathBuf) -> Result<HashSet<String>> {
        // 如果配置文件不存在，返回空集合
        if !config_file_path.exists() {
            return Ok(HashSet::new());
        }
        
        let content = fs::read_to_string(config_file_path).context("读取 Shell 配置文件失败")?;
    let block_content = self.extract_env_block_content(&content)?;
        let mut paths = HashSet::new();

        let is_cmd = config_file_path.extension().and_then(|s| s.to_str()) == Some("cmd");
        let is_ps = config_file_path.extension().and_then(|s| s.to_str()) == Some("ps1");

        let (path_prefix, separator) = if is_cmd {
            ("set PATH=", ';')
        } else if is_ps {
            ("$env:Path =", ';')
        } else {
            ("export PATH=", ':')
        };

        for line in block_content.lines() {
            let line = line.trim();
            if line.starts_with(path_prefix) {
                // 解析 PATH 的 RHS，支持多种形式：有无引号、$PATH/$env:Path/%PATH% 在左或右
                if let Some(rhs) = line.splitn(2, '=').nth(1) {
                    let mut rhs = rhs.trim();
                    // 去掉外层引号
                    if (rhs.starts_with('"') && rhs.ends_with('"'))
                        || (rhs.starts_with('\'') && rhs.ends_with('\''))
                    {
                        rhs = &rhs[1..rhs.len() - 1];
                    }

                    // 将 $PATH/$env:Path/%PATH% 占位移除，保留其它路径
                    let cleaned = if is_cmd {
                        rhs.replace("%PATH%;", "")
                            .replace(";%PATH%", "")
                            .replace("%PATH%", "")
                    } else if is_ps {
                        rhs.replace("$env:Path;", "")
                            .replace(";$env:Path", "")
                            .replace("$env:Path", "")
                    } else {
                        rhs.replace("$PATH:", "")
                            .replace(":$PATH", "")
                            .replace("$PATH", "")
                    };

                    for p in cleaned.split(separator) {
                        let p = p.trim();
                        if !p.is_empty() {
                            paths.insert(p.to_string());
                        }
                    }
                }
            }
        }

        Ok(paths)
    }

    /// 备份指定路径的文件并以原子方式写入新内容
    fn write_content_atomic_for_path(&self, path: &PathBuf, new_content: &str) -> Result<()> {
        // 备份原文件(如存在)
        if path.exists() {
            let ts = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
            let backup = path.with_extension(format!("envbak{}", ts));
            fs::copy(path, &backup).context("备份 Shell 配置文件失败")?;
            
            // 清理旧备份文件，只保留最近的 2 个
            self.cleanup_old_backups(path, 2)?;
        }

        // 写临时文件并重命名
        let tmp = path.with_extension("tmp");
        
        // 使用 Result 确保临时文件在失败时被清理
        let write_result = (|| -> Result<()> {
            fs::write(&tmp, new_content).context("写入临时文件失败")?;
            fs::rename(&tmp, path).context("原子替换 Shell 配置文件失败")?;
            Ok(())
        })();

        // 如果操作失败，清理临时文件
        if write_result.is_err() && tmp.exists() {
            let _ = fs::remove_file(&tmp); // 忽略清理失败的错误
        }

        write_result
    }

    /// 清理旧的备份文件，只保留最近的 N 个
    fn cleanup_old_backups(&self, config_path: &PathBuf, keep_count: usize) -> Result<()> {
        let parent_dir = match config_path.parent() {
            Some(dir) => dir,
            None => return Ok(()), // 没有父目录，跳过清理
        };

        let file_stem = match config_path.file_stem() {
            Some(stem) => stem.to_string_lossy().to_string(),
            None => return Ok(()), // 无法获取文件名，跳过清理
        };

        // 收集所有备份文件
        let mut backups = Vec::new();
        if let Ok(entries) = fs::read_dir(parent_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    let ext_str = ext.to_string_lossy();
                    // 匹配格式为 .envbak{timestamp} 的备份文件
                    if ext_str.starts_with("envbak") && path.file_stem().map(|s| s.to_string_lossy().to_string()) == Some(file_stem.clone()) {
                        if let Ok(metadata) = entry.metadata() {
                            if let Ok(modified) = metadata.modified() {
                                backups.push((path, modified));
                            }
                        }
                    }
                }
            }
        }

        // 如果备份文件数量超过限制，删除最旧的
        if backups.len() > keep_count {
            // 按修改时间排序（最新的在前）
            backups.sort_by(|a, b| b.1.cmp(&a.1));
            
            // 删除超出数量的旧备份
            for (old_backup, _) in backups.iter().skip(keep_count) {
                if let Err(e) = fs::remove_file(old_backup) {
                    log::warn!("删除旧备份文件失败 {}: {}", old_backup.display(), e);
                } else {
                    log::debug!("已删除旧备份文件: {}", old_backup.display());
                }
            }
        }

        Ok(())
    }

    /// 在指定配置文件的环境变量块中添加行
    fn add_line_to_file(&self, config_file_path: &PathBuf, line: &str) -> Result<()> {
        if !config_file_path.exists() {
            // 如果文件不存在，先创建空文件
            if let Some(parent_dir) = config_file_path.parent() {
                if !parent_dir.exists() {
                    fs::create_dir_all(parent_dir).context("创建配置文件目录失败")?;
                }
            }
            fs::write(config_file_path, "").context("创建配置文件失败")?;
        }
        
        let content = fs::read_to_string(config_file_path).context("读取 Shell 配置文件失败")?;
        let new_content = self.insert_line_in_block(&content, line)?;
        self.write_content_atomic_for_path(config_file_path, &new_content)?;
        Ok(())
    }

    /// 从指定配置文件的环境变量块中删除包含指定前缀的行
    fn remove_line_from_file(&self, config_file_path: &PathBuf, line_prefix: &str) -> Result<()> {
        if !config_file_path.exists() {
            return Ok(());
        }
        
        let content = fs::read_to_string(config_file_path).context("读取 Shell 配置文件失败")?;
        let new_content = self.remove_lines_with_prefix_from_block(&content, line_prefix)?;
        self.write_content_atomic_for_path(config_file_path, &new_content)?;
        Ok(())
    }

    /// 在环境变量块中添加行（兼容旧版本）
    #[allow(dead_code)]
    fn add_line_to_block(&self, line: &str) -> Result<()> {
        // 对所有配置文件执行添加操作
        for path in &self.config_file_paths {
            let content = fs::read_to_string(path).context("读取 Shell 配置文件失败")?;
            let new_content = self.insert_line_in_block(&content, line)?;
            self.write_content_atomic_for_path(path, &new_content)?;
        }
        Ok(())
    }

    /// 从环境变量块中删除包含指定前缀的行（兼容旧版本）
    #[allow(dead_code)]
    fn remove_line_from_block(&self, line_prefix: &str) -> Result<()> {
        // 对所有配置文件执行删除操作
        for path in &self.config_file_paths {
            let content = fs::read_to_string(path).context("读取 Shell 配置文件失败")?;
            let new_content =
                self.remove_lines_with_prefix_from_block(&content, line_prefix)?;
            self.write_content_atomic_for_path(path, &new_content)?;
        }
        Ok(())
    }

    /// 在环境变量块中插入新行
    fn insert_line_in_block(
        &self,
        content: &str,
        new_line: &str,
    ) -> Result<String> {
        let lines: Vec<&str> = content.lines().collect();
        let mut result_lines = Vec::new();
        let mut inside_block = false;

        let block_start = ENVIS_ACTIVE_BLOCK_START;
        let block_end = ENVIS_ACTIVE_BLOCK_END;

        for line in lines {
            let trimmed = line.trim();
            // 移除 REM 前缀，但保留 # 前缀，因为常量中包含 #
            let cleaned = if trimmed.starts_with("REM ") {
                trimmed[4..].trim()
            } else {
                trimmed
            };
            
            if cleaned == block_start {
                inside_block = true;
                result_lines.push(line);
            } else if cleaned == block_end {
                if !inside_block {
                    return Err(anyhow::anyhow!("环境变量块损坏"));
                }
                // 在结束标记前插入新行
                result_lines.push(new_line);
                result_lines.push(line);
                inside_block = false;
            } else {
                result_lines.push(line);
            }
        }

        Ok(result_lines.join("\n"))
    }

    /// 从环境变量块中删除包含指定前缀的行
    fn remove_lines_with_prefix_from_block(
        &self,
        content: &str,
        prefix: &str,
    ) -> Result<String> {
        let lines: Vec<&str> = content.lines().collect();
        let mut result_lines = Vec::new();
        let mut inside_block = false;

        let block_start = ENVIS_ACTIVE_BLOCK_START;
        let block_end = ENVIS_ACTIVE_BLOCK_END;

        for line in lines {
            let trimmed = line.trim();
            // 移除 REM 前缀，但保留 # 前缀
            let cleaned = if trimmed.starts_with("REM ") {
                trimmed[4..].trim()
            } else {
                trimmed
            };
            
            if cleaned == block_start {
                inside_block = true;
                result_lines.push(line);
            } else if cleaned == block_end {
                inside_block = false;
                result_lines.push(line);
            } else if inside_block && line.trim().starts_with(prefix) {
                // 跳过匹配前缀的行
                continue;
            } else {
                result_lines.push(line);
            }
        }

        Ok(result_lines.join("\n"))
    }

    /// 提取环境变量块的内容
    fn extract_env_block_content(&self, content: &str) -> Result<String> {
        let lines: Vec<&str> = content.lines().collect();
        let mut block_lines = Vec::new();
        let mut inside_block = false;

        let block_start = ENVIS_ACTIVE_BLOCK_START;
        let block_end = ENVIS_ACTIVE_BLOCK_END;

        for line in lines {
            let trimmed = line.trim();
            // 移除 REM 前缀，但保留 # 前缀
            let cleaned = if trimmed.starts_with("REM ") {
                trimmed[4..].trim()
            } else {
                trimmed
            };
            
            if cleaned == block_start {
                inside_block = true;
                continue;
            } else if cleaned == block_end {
                break;
            } else if inside_block {
                // 检查是否是警告行
                if cleaned != ENVIS_WARNING {
                    block_lines.push(line);
                }
            }
        }

        Ok(block_lines.join("\n"))
    }

    /// 清除环境块内容(但保留块结构)
    pub fn clear_shell_environment_block_content(&self) -> Result<()> {
        // 对所有配置文件执行清除操作
        for path in &self.config_file_paths {
            let content = fs::read_to_string(path).context("读取 Shell 配置文件失败")?;
            let new_content = self.clear_env_block_content(&content)?;
            self.write_content_atomic_for_path(path, &new_content)?;
        }
        Ok(())
    }

    /// 清除环境变量块的内容（保留开始和结束标记）
    fn clear_env_block_content(&self, content: &str) -> Result<String> {
        let lines: Vec<&str> = content.lines().collect();
        let mut result_lines = Vec::new();
        let mut inside_block = false;

        let block_start = ENVIS_ACTIVE_BLOCK_START;
        let block_end = ENVIS_ACTIVE_BLOCK_END;

        for line in lines {
            let trimmed = line.trim();
            // 移除 REM 前缀，但保留 # 前缀
            let cleaned = if trimmed.starts_with("REM ") {
                trimmed[4..].trim()
            } else {
                trimmed
            };
            
            if cleaned == block_start {
                inside_block = true;
                result_lines.push(line);
            } else if cleaned == ENVIS_WARNING && inside_block {
                // 保留警告行
                result_lines.push(line);
            } else if cleaned == block_end {
                inside_block = false;
                result_lines.push(line);
            } else if !inside_block {
                result_lines.push(line);
            }
            // 跳过块内的所有其他内容
        }

        Ok(result_lines.join("\n"))
    }

    /// 从文件内容中删除整个环境变量块
    fn remove_env_block(&self, content: &str) -> Result<String> {
        let lines: Vec<&str> = content.lines().collect();
        let mut result_lines = Vec::new();
        let mut inside_block = false;

        let block_start = ENVIS_ACTIVE_BLOCK_START; // "# BEGIN ..."
        let block_end = ENVIS_ACTIVE_BLOCK_END;     // "# END ..."

        // 同时兼容 CMD 中以 REM 开头的块标记
        let cmd_block_start = format!("REM {}", block_start);
        let cmd_block_end = format!("REM {}", block_end);

        for line in lines {
            let trimmed = line.trim();

            if !inside_block && (trimmed == block_start || trimmed == cmd_block_start) {
                inside_block = true;
                continue;
            } else if inside_block && (trimmed == block_end || trimmed == cmd_block_end) {
                inside_block = false;
                continue;
            } else if !inside_block {
                result_lines.push(line);
            }
        }

        // 移除末尾的空行
        while let Some(last) = result_lines.last() {
            if last.is_empty() {
                result_lines.pop();
            } else {
                break;
            }
        }

        Ok(result_lines.join("\n"))
    }

    /// 打开一个新的终端窗口
    #[allow(dead_code)]
    pub fn open_terminal_window(&self) -> Result<()> {
        #[cfg(target_os = "macos")]
        {
            // 使用 macOS 的 open 命令打开默认终端
            Command::new("open")
                .arg("-a")
                .arg("Terminal")
                .status()
                .context("打开终端窗口失败")?;
        }
        #[cfg(target_os = "windows")]
        {
            // 打开 Windows 的 cmd
            Command::new("cmd").status().context("打开终端窗口失败")?;
        }
        #[cfg(target_os = "linux")]
        {
            // 尝试打开 gnome-terminal，如果没有可以扩展支持其他终端
            Command::new("gnome-terminal")
                .status()
                .context("打开终端窗口失败")?;
        }
        Ok(())
    }

    /// 根据指定的终端类型打开终端窗口
    pub fn open_terminal_with_type(terminal_type: Option<String>) -> Result<()> {
        #[cfg(target_os = "macos")]
        {
            let terminal_app = match terminal_type.as_deref() {
                Some("iterm2") => "iTerm",
                Some("terminal") => "Terminal",
                Some("warp") => "Warp",
                _ => "Terminal", // 默认使用 Terminal.app
            };

            Command::new("open")
                .arg("-a")
                .arg(terminal_app)
                .status()
                .context(format!("打开终端 {} 失败", terminal_app))?;
        }

        #[cfg(target_os = "windows")]
        {
            // 获取用户主目录
            let home_dir = dirs::home_dir().context("无法获取用户主目录")?;
            
            match terminal_type.as_deref() {
                Some("powershell") => {
                    // 使用 start 命令在新窗口中打开 PowerShell，并切换到用户目录
                    let ps_command = format!("start powershell -NoExit -Command \"Set-Location '{}'\"", home_dir.display());
                    Command::new("cmd")
                        .args(["/C", &ps_command])
                        .spawn()
                        .context("打开 PowerShell 失败")?;
                }
                Some("pwsh") => {
                    // 使用 start 命令在新窗口中打开 PowerShell Core，并切换到用户目录
                    let pwsh_command = format!("start pwsh -NoExit -Command \"Set-Location '{}'\"", home_dir.display());
                    Command::new("cmd")
                        .args(["/C", &pwsh_command])
                        .spawn()
                        .context("打开 PowerShell Core 失败")?;
                }
                Some("wt") => {
                    // Windows Terminal 可以直接启动，并设置工作目录
                    Command::new("wt")
                        .args(["-d", home_dir.to_str().unwrap_or("%USERPROFILE%")])
                        .spawn()
                        .context("打开 Windows Terminal 失败")?;
                }
                _ => {
                    // 默认使用 cmd，在新窗口中打开，并切换到用户目录
                    let cmd_command = format!("start cmd /K \"cd /d {}\"", home_dir.display());
                    Command::new("cmd")
                        .args(["/C", &cmd_command])
                        .spawn()
                        .context("打开 CMD 失败")?;
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            let terminal_cmd = match terminal_type.as_deref() {
                Some("konsole") => "konsole",
                Some("xterm") => "xterm",
                Some("alacritty") => "alacritty",
                Some("kitty") => "kitty",
                _ => "gnome-terminal", // 默认使用 gnome-terminal
            };

            Command::new(terminal_cmd)
                .status()
                .context(format!("打开终端 {} 失败", terminal_cmd))?;
        }

        Ok(())
    }

    /// 添加 Alias
    pub fn add_alias(&self, key: &str, value: &str) -> Result<()> {
        for config_file_path in &self.config_file_paths {
            let is_cmd = config_file_path.extension().and_then(|s| s.to_str()) == Some("cmd");
            let is_ps = config_file_path.extension().and_then(|s| s.to_str()) == Some("ps1");
            
            let (prefix, alias_line) = if is_cmd {
                // CMD 语法: doskey key=value $*
                (
                    format!("doskey {}=", key),
                    format!("doskey {}={} $*", key, value)
                )
            } else if is_ps {
                // PowerShell 语法: function key { value $args }
                // 注意：这里假设 value 是一个合法的命令字符串
                (
                    format!("function {} {{", key),
                    format!("function {} {{ {} $args }}", key, value)
                )
            } else {
                // Unix Shell 语法: alias key="value"
                (
                    format!("alias {}=", key),
                    format!("alias {}=\"{}\"", key, value)
                )
            };
            
            // 先删除已有的同名 alias 行
            let _ = self.remove_line_from_file(config_file_path, &prefix);
            if let Err(e) = self.add_line_to_file(config_file_path, &alias_line) {
                log::error!("Failed to add alias to {}: {}", config_file_path.display(), e);
            }
        }
        
        Ok(())
    }

    /// 删除 Alias
    pub fn delete_alias(&self, key: &str) -> Result<()> {
        for config_file_path in &self.config_file_paths {
            let is_cmd = config_file_path.extension().and_then(|s| s.to_str()) == Some("cmd");
            let is_ps = config_file_path.extension().and_then(|s| s.to_str()) == Some("ps1");
            
            let prefix = if is_cmd {
                format!("doskey {}=", key)
            } else if is_ps {
                format!("function {} {{", key)
            } else {
                format!("alias {}=", key)
            };
            
            if let Err(e) = self.remove_line_from_file(config_file_path, &prefix) {
                log::error!("Failed to remove alias from {}: {}", config_file_path.display(), e);
            }
        }
        
        Ok(())
    }

    /// 在加载了 shell 配置文件的环境中执行命令
    /// 返回 (stdout, stderr, exit_code)
    pub fn execute_command_with_env(&self, command: &str) -> Result<(String, String, i32)> {
        let output = if cfg!(target_os = "windows") {
            // Windows: 尝试使用 PowerShell
            let documents_dir = dirs::document_dir().context("无法获取文档目录")?;
            let ps_profile = documents_dir
                .join("WindowsPowerShell")
                .join("Microsoft.PowerShell_profile.ps1");
            
            // 构造 PowerShell 命令，先加载配置文件（如果存在）
            let ps_command = if ps_profile.exists() {
                format!("try {{ . '{}' }} catch {{ }}; {}", ps_profile.display(), command)
            } else {
                command.to_string()
            };
            
            Command::new("powershell")
                .args(["-NoLogo", "-Command", &ps_command])
                .output()
        } else {
            // macOS/Linux: 使用 login shell 以获取完整的环境变量
            let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
            
            // 确定 shell 类型和参数
            let shell_cmd = if shell.contains("zsh") {
                "zsh"
            } else if shell.contains("bash") {
                "bash"
            } else {
                // 默认使用 bash
                "bash"
            };
            
            // 使用 -l (login shell) 和 -c 选项来执行命令
            // login shell 会自动加载 .zshrc (zsh) 或 .bash_profile (bash)
            // 这样可以获取到完整的 PATH，包括 VS Code 的 code 命令等
            Command::new(shell_cmd)
                .args(["-l", "-c", command])
                .output()
        };

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let exit_code = output.status.code().unwrap_or(-1);
                Ok((stdout, stderr, exit_code))
            }
            Err(e) => {
                Err(anyhow::anyhow!("执行命令失败: {}", e))
            }
        }
    }
}

/// 初始化 Shell 管理器
pub fn initialize_shell_manager() -> Result<()> {
    match std::panic::catch_unwind(|| ShellManager::global()) {
        Ok(_) => {
            log::info!("Shell 管理器初始化成功");
            Ok(())
        }
        Err(_) => {
            log::error!("Shell 管理器初始化失败: ShellManager::global() 发生 panic");
            Err(anyhow::anyhow!("Shell 管理器初始化失败"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_manager_with_content(content: &str) -> ShellManager {
        let tmp = std::env::temp_dir().join("envis_test_shellrc");
        let _ = fs::write(&tmp, content);
        ShellManager {
            config_file_paths: vec![tmp],
            is_development: true,
        }
    }

    #[test]
    fn test_insert_and_remove_lines() {
        let initial = "line1\n# BEGIN Envis Active Environment Block\n# WARNING: This block is automatically managed by Envis. Do not edit manually!\n# END Envis Active Environment Block\nline2\n";
        let mgr = make_manager_with_content(initial);

        // 插入一行
        let res = mgr
            .insert_line_in_block(initial, "export FOO=\"bar\"")
            .unwrap();
        assert!(res.contains("export FOO=\"bar\""));

        // 删除前缀行
        let removed = mgr
            .remove_lines_with_prefix_from_block(&res, "export FOO=")
            .unwrap();
        assert!(!removed.contains("export FOO=\"bar\""));
    }

    #[test]
    fn test_get_current_paths_various_forms() {
        let block = "# BEGIN Envis Active Environment Block\n# WARNING: This block is automatically managed by Envis. Do not edit manually!\nexport PATH=\"/a:/b:$PATH\"\nexport PATH='/c:$PATH'\nexport PATH=$PATH:/d\n# END Envis Active Environment Block\n";
        let mgr = make_manager_with_content(block);

    let paths = mgr.get_current_paths().unwrap();
        assert!(paths.contains("/a"), "paths: {:?}", paths);
        assert!(paths.contains("/b"), "paths: {:?}", paths);
        assert!(paths.contains("/c"), "paths: {:?}", paths);
        assert!(paths.contains("/d"), "paths: {:?}", paths);
    }
}
