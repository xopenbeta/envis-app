use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};

/// Host 条目
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HostEntry {
    pub id: String,
    pub ip: String,
    pub hostname: String,
    pub comment: Option<String>,
    pub enabled: bool,
}

/// 全局 Host 管理器单例
static HOST_MANAGER: OnceLock<Arc<Mutex<HostManager>>> = OnceLock::new();

/// Host 管理器
pub struct HostManager {
    hosts_file_path: PathBuf,
}

// Envis 管理的 hosts 块标记
const ENVIS_HOSTS_BLOCK_START: &str = "# BEGIN Envis Managed Hosts Block";
const ENVIS_HOSTS_BLOCK_END: &str = "# END Envis Managed Hosts Block";
const ENVIS_HOSTS_WARNING: &str =
    "# WARNING: This block is automatically managed by Envis. Do not edit manually!";

impl HostManager {
    /// 获取全局 Host 管理器实例
    pub fn global() -> Arc<Mutex<HostManager>> {
        HOST_MANAGER
            .get_or_init(|| {
                Arc::new(Mutex::new(
                    HostManager::new().expect("Failed to create HostManager"),
                ))
            })
            .clone()
    }

    /// 创建新的 Host 管理器
    fn new() -> Result<Self> {
        let hosts_file_path = Self::get_hosts_file_path()?;

        let manager = Self { hosts_file_path };

        // 不在初始化时创建 hosts 块，延迟到第一次写入时
        // manager.initialize_hosts_block()?;

        Ok(manager)
    }

    /// 获取系统 hosts 文件路径
    pub fn get_hosts_file_path() -> Result<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            Ok(PathBuf::from("C:\\Windows\\System32\\drivers\\etc\\hosts"))
        }

        #[cfg(not(target_os = "windows"))]
        {
            Ok(PathBuf::from("/etc/hosts"))
        }
    }

    /// 创建 Envis 管理块（不写入文件）
    fn create_envis_block(&self, content: &str) -> String {
        format!(
            "{}\n{}\n{}\n{}\n{}",
            content.trim_end(),
            ENVIS_HOSTS_BLOCK_START,
            ENVIS_HOSTS_WARNING,
            "",
            ENVIS_HOSTS_BLOCK_END
        )
    }

    /// 读取 hosts 文件内容
    fn read_hosts_file(&self) -> Result<String> {
        if !self.hosts_file_path.exists() {
            return Ok(String::new());
        }
        fs::read_to_string(&self.hosts_file_path).context("读取 hosts 文件失败")
    }

    /// 写入 hosts 文件（需要提升权限）
    fn write_hosts_file(&self, content: &str, password: &str) -> Result<()> {
        // 在 Unix 系统上，使用 sudo 配合密码
        #[cfg(not(target_os = "windows"))]
        {
            use std::io::Write;
            use std::process::{Command, Stdio};

            // 创建临时文件
            let temp_path = std::env::temp_dir().join("envis_hosts_temp");
            fs::write(&temp_path, content).context("写入临时文件失败")?;

            // 使用 sudo -S 从标准输入读取密码
            let mut child = Command::new("sudo")
                .arg("-S")
                .arg("cp")
                .arg(&temp_path)
                .arg(&self.hosts_file_path)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .context("启动 sudo 命令失败")?;

            // 将密码写入 stdin
            if let Some(mut stdin) = child.stdin.take() {
                writeln!(stdin, "{}", password).context("写入密码失败")?;
            }

            let output = child.wait_with_output().context("等待命令执行失败")?;

            // 删除临时文件
            let _ = fs::remove_file(temp_path);

            if !output.status.success() {
                let error = String::from_utf8_lossy(&output.stderr);
                if error.contains("incorrect password") || error.contains("Sorry, try again") {
                    anyhow::bail!("密码错误，请重新输入");
                } else {
                    anyhow::bail!("写入 hosts 文件失败: {}", error);
                }
            }

            Ok(())
        }

        #[cfg(target_os = "windows")]
        {
            // Windows 上需要以管理员身份运行应用
            fs::write(&self.hosts_file_path, content)
                .context("写入 hosts 文件失败，请以管理员身份运行应用")
        }
    }

    /// 获取所有 Envis 管理的 host 条目（只读操作，不需要权限）
    pub fn get_hosts(&self) -> Result<Vec<HostEntry>> {
        let content = self.read_hosts_file()?;

        // 如果文件为空或不包含 Envis 块，返回空列表
        if !content.contains(ENVIS_HOSTS_BLOCK_START) {
            return Ok(Vec::new());
        }

        let block_content = self.extract_envis_block(&content)?;

        let mut entries = Vec::new();

        for line in block_content.lines() {
            if let Some(entry) = self.parse_host_entry(line) {
                entries.push(entry);
            }
        }

        Ok(entries)
    }

    /// 解析 host 条目
    fn parse_host_entry(&self, line: &str) -> Option<HostEntry> {
        let line = line.trim();

        // 检查是否被注释（禁用）
        let (enabled, line) = if line.starts_with('#') {
            (false, line.trim_start_matches('#').trim())
        } else {
            (true, line)
        };

        // 分割 IP 和主机名
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            return None;
        }

        let ip = parts[0].to_string();
        let hostname = parts[1].to_string();

        // 提取注释（如果有）
        let comment = if let Some(comment_start) = line.find('#') {
            Some(line[comment_start + 1..].trim().to_string())
        } else {
            None
        };

        // 生成 ID（使用 IP + hostname 作为唯一标识）
        let id = format!("{}_{}", ip, hostname);

        Some(HostEntry {
            id,
            ip,
            hostname,
            comment,
            enabled,
        })
    }

    /// 添加 host 条目（写操作，需要权限）
    pub fn add_host(&self, entry: HostEntry, password: &str) -> Result<()> {
        let content = self.read_hosts_file()?;

        // 确保 Envis 块存在
        let content = if !content.contains(ENVIS_HOSTS_BLOCK_START) {
            self.create_envis_block(&content)
        } else {
            content
        };

        let mut block_content = self.extract_envis_block(&content)?;

        // 检查是否已存在相同的条目
        let existing_entry = self.find_entry_in_content(&block_content, &entry.ip, &entry.hostname);
        if existing_entry.is_some() {
            anyhow::bail!("该 host 条目已存在");
        }

        // 添加新条目
        let entry_line = self.format_host_entry(&entry);
        block_content.push_str(&format!("{}\n", entry_line));

        // 更新 hosts 文件
        let new_content = self.replace_envis_block(&content, &block_content)?;
        self.write_hosts_file(&new_content, password)?;

        Ok(())
    }

    /// 更新 host 条目（写操作，需要权限）
    pub fn update_host(
        &self,
        old_entry: HostEntry,
        new_entry: HostEntry,
        password: &str,
    ) -> Result<()> {
        let content = self.read_hosts_file()?;

        if !content.contains(ENVIS_HOSTS_BLOCK_START) {
            anyhow::bail!("找不到 Envis 管理的 hosts 块");
        }

        let block_content = self.extract_envis_block(&content)?;

        // 查找并替换条目
        let mut new_block_content = String::new();
        let mut found = false;

        for line in block_content.lines() {
            if let Some(entry) = self.parse_host_entry(line) {
                if entry.ip == old_entry.ip && entry.hostname == old_entry.hostname {
                    // 找到要更新的条目，替换为新条目
                    new_block_content
                        .push_str(&format!("{}\n", self.format_host_entry(&new_entry)));
                    found = true;
                } else {
                    // 保留其他条目
                    new_block_content.push_str(&format!("{}\n", line));
                }
            } else if !line.trim().is_empty() {
                // 保留注释行等
                new_block_content.push_str(&format!("{}\n", line));
            }
        }

        if !found {
            anyhow::bail!("找不到要更新的 host 条目");
        }

        // 更新 hosts 文件
        let new_content = self.replace_envis_block(&content, &new_block_content)?;
        self.write_hosts_file(&new_content, password)?;

        Ok(())
    }

    /// 删除 host 条目（写操作，需要权限）
    pub fn delete_host(&self, ip: &str, hostname: &str, password: &str) -> Result<()> {
        let content = self.read_hosts_file()?;

        if !content.contains(ENVIS_HOSTS_BLOCK_START) {
            anyhow::bail!("找不到 Envis 管理的 hosts 块");
        }

        let block_content = self.extract_envis_block(&content)?;

        // 过滤掉要删除的条目
        let mut new_block_content = String::new();
        let mut found = false;

        for line in block_content.lines() {
            if let Some(entry) = self.parse_host_entry(line) {
                if entry.ip == ip && entry.hostname == hostname {
                    // 找到要删除的条目，跳过
                    found = true;
                } else {
                    // 保留其他条目
                    new_block_content.push_str(&format!("{}\n", line));
                }
            } else if !line.trim().is_empty() {
                // 保留注释行等
                new_block_content.push_str(&format!("{}\n", line));
            }
        }

        if !found {
            anyhow::bail!("找不到要删除的 host 条目");
        }

        // 更新 hosts 文件
        let new_content = self.replace_envis_block(&content, &new_block_content)?;
        self.write_hosts_file(&new_content, password)?;

        Ok(())
    }

    /// 切换 host 条目的启用状态（写操作，需要权限）
    pub fn toggle_host(&self, ip: &str, hostname: &str, password: &str) -> Result<()> {
        let content = self.read_hosts_file()?;

        if !content.contains(ENVIS_HOSTS_BLOCK_START) {
            anyhow::bail!("找不到 Envis 管理的 hosts 块");
        }

        let block_content = self.extract_envis_block(&content)?;

        // 查找并切换条目状态
        let mut new_block_content = String::new();
        let mut found = false;

        for line in block_content.lines() {
            if let Some(mut entry) = self.parse_host_entry(line) {
                if entry.ip == ip && entry.hostname == hostname {
                    // 找到要切换的条目，反转启用状态
                    entry.enabled = !entry.enabled;
                    new_block_content.push_str(&format!("{}\n", self.format_host_entry(&entry)));
                    found = true;
                } else {
                    // 保留其他条目
                    new_block_content.push_str(&format!("{}\n", line));
                }
            } else if !line.trim().is_empty() {
                // 保留注释行等
                new_block_content.push_str(&format!("{}\n", line));
            }
        }

        if !found {
            anyhow::bail!("找不到要切换的 host 条目");
        }

        // 更新 hosts 文件
        let new_content = self.replace_envis_block(&content, &new_block_content)?;
        self.write_hosts_file(&new_content, password)?;

        Ok(())
    }

    /// 格式化 host 条目为字符串
    fn format_host_entry(&self, entry: &HostEntry) -> String {
        let base = format!("{} {}", entry.ip, entry.hostname);
        let with_comment = if let Some(ref comment) = entry.comment {
            format!("{} # {}", base, comment)
        } else {
            base
        };

        if entry.enabled {
            with_comment
        } else {
            format!("# {}", with_comment)
        }
    }

    /// 检查一行是否是条目行（被注释的条目）
    fn is_entry_line(&self, line: &str) -> bool {
        let line = line.trim();
        if !line.starts_with('#') {
            return true;
        }

        let line = line.trim_start_matches('#').trim();
        let parts: Vec<&str> = line.split_whitespace().collect();
        parts.len() >= 2
    }

    /// 在内容中查找条目
    fn find_entry_in_content(&self, content: &str, ip: &str, hostname: &str) -> Option<HostEntry> {
        for line in content.lines() {
            if let Some(entry) = self.parse_host_entry(line) {
                if entry.ip == ip && entry.hostname == hostname {
                    return Some(entry);
                }
            }
        }
        None
    }

    /// 提取 Envis 管理块的内容
    fn extract_envis_block(&self, content: &str) -> Result<String> {
        let mut in_block = false;
        let mut block_content = String::new();

        for line in content.lines() {
            if line.contains(ENVIS_HOSTS_BLOCK_START) {
                in_block = true;
                continue;
            }

            if line.contains(ENVIS_HOSTS_BLOCK_END) {
                break;
            }

            if in_block && !line.contains(ENVIS_HOSTS_WARNING) {
                block_content.push_str(&format!("{}\n", line));
            }
        }

        Ok(block_content)
    }

    /// 替换 Envis 管理块的内容
    fn replace_envis_block(&self, content: &str, new_block_content: &str) -> Result<String> {
        let mut new_content = String::new();
        let mut in_block = false;
        let mut block_replaced = false;

        for line in content.lines() {
            if line.contains(ENVIS_HOSTS_BLOCK_START) {
                in_block = true;
                new_content.push_str(&format!("{}\n", line));
                new_content.push_str(&format!("{}\n", ENVIS_HOSTS_WARNING));
                new_content.push_str(new_block_content);
                block_replaced = true;
                continue;
            }

            if line.contains(ENVIS_HOSTS_BLOCK_END) {
                in_block = false;
                new_content.push_str(&format!("{}\n", line));
                continue;
            }

            if !in_block {
                new_content.push_str(&format!("{}\n", line));
            }
        }

        if !block_replaced {
            anyhow::bail!("未找到 Envis hosts 管理块");
        }

        Ok(new_content)
    }

    /// 批量添加 host 条目（写操作，需要权限）
    pub fn add_hosts(&self, new_entries: Vec<HostEntry>, password: &str) -> Result<()> {
        let content = self.read_hosts_file()?;

        // 确保 Envis 块存在
        let content = if !content.contains(ENVIS_HOSTS_BLOCK_START) {
            self.create_envis_block(&content)
        } else {
            content
        };

        let block_content = self.extract_envis_block(&content)?;

        let mut new_block_content = String::new();
        let mut handled_indices = std::collections::HashSet::new();

        for line in block_content.lines() {
            if let Some(entry) = self.parse_host_entry(line) {
                // Check if this entry is in new_entries
                if let Some(idx) = new_entries
                    .iter()
                    .position(|e| e.ip == entry.ip && e.hostname == entry.hostname)
                {
                    // Replace with new entry
                    new_block_content.push_str(&format!(
                        "{}\n",
                        self.format_host_entry(&new_entries[idx])
                    ));
                    handled_indices.insert(idx);
                } else {
                    // Keep existing entry
                    new_block_content.push_str(&format!("{}\n", line));
                }
            } else {
                // Keep non-entry line
                new_block_content.push_str(&format!("{}\n", line));
            }
        }

        // Append new entries that were not found in existing lines
        for (idx, entry) in new_entries.iter().enumerate() {
            if !handled_indices.contains(&idx) {
                new_block_content.push_str(&format!("{}\n", self.format_host_entry(entry)));
            }
        }

        // Write back
        let new_content = self.replace_envis_block(&content, &new_block_content)?;
        self.write_hosts_file(&new_content, password)?;

        Ok(())
    }

    /// 批量删除 host 条目（写操作，需要权限）
    pub fn remove_hosts(&self, entries_to_remove: Vec<HostEntry>, password: &str) -> Result<()> {
        let content = self.read_hosts_file()?;

        if !content.contains(ENVIS_HOSTS_BLOCK_START) {
            return Ok(()); // Nothing to remove
        }

        let block_content = self.extract_envis_block(&content)?;
        let mut new_block_content = String::new();

        for line in block_content.lines() {
            if let Some(entry) = self.parse_host_entry(line) {
                // Check if this entry should be removed
                if entries_to_remove
                    .iter()
                    .any(|e| e.ip == entry.ip && e.hostname == entry.hostname)
                {
                    // Skip (remove)
                } else {
                    new_block_content.push_str(&format!("{}\n", line));
                }
            } else {
                new_block_content.push_str(&format!("{}\n", line));
            }
        }

        let new_content = self.replace_envis_block(&content, &new_block_content)?;
        self.write_hosts_file(&new_content, password)?;

        Ok(())
    }

    /// 清空所有 Envis 管理的 host 条目（写操作，需要权限）
    pub fn clear_hosts(&self, password: &str) -> Result<()> {
        let content = self.read_hosts_file()?;

        if !content.contains(ENVIS_HOSTS_BLOCK_START) {
            // 如果没有 Envis 块，不需要做任何事
            return Ok(());
        }

        // 清空 Envis 块的内容
        let new_content = self.replace_envis_block(&content, "")?;
        self.write_hosts_file(&new_content, password)?;
        Ok(())
    }
}

/// 初始化 Host 管理器
pub fn initialize_host_manager() -> Result<()> {
    match std::panic::catch_unwind(|| HostManager::global()) {
        Ok(_) => {
            log::info!("Host 管理器初始化成功");
            Ok(())
        }
        Err(e) => {
            log::error!("Host 管理器初始化失败: {:?}", e);
            Err(anyhow::anyhow!("Host 管理器初始化失败"))
        }
    }
}
