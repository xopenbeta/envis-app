use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::sync::{Arc, Mutex, OnceLock};
use sysinfo::System;

/// 系统信息数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub cpu_usage: f32,
    pub cpu_count: usize,
    pub cpu_brand: String,
    pub memory_total: u64,
    pub memory_used: u64,
    pub memory_available: u64,
    pub memory_usage_percent: f32,
    pub disks: Vec<DiskInfo>,
    pub network_interfaces: Vec<NetworkInterface>,
    pub ip_addresses: Vec<String>,
    pub uptime: u64,
    pub os_name: String,
    pub os_version: String,
    pub hostname: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_space: u64,
    pub available_space: u64,
    pub used_space: u64,
    pub usage_percent: f32,
    pub file_system: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    pub bytes_received: u64,
    pub bytes_transmitted: u64,
    pub packets_received: u64,
    pub packets_transmitted: u64,
    pub errors_on_received: u64,
    pub errors_on_transmitted: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkStats {
    pub total_bytes_received: u64,
    pub total_bytes_transmitted: u64,
    pub total_packets_received: u64,
    pub total_packets_transmitted: u64,
    pub interfaces: Vec<NetworkInterface>,
}

/// 系统信息管理器 - 单例模式
pub struct SystemInfoManager {
    system: Arc<Mutex<System>>,
    last_network_stats: Arc<Mutex<Option<NetworkStats>>>,
}

impl SystemInfoManager {
    /// 获取单例实例
    pub fn global() -> &'static SystemInfoManager {
        static INSTANCE: OnceLock<SystemInfoManager> = OnceLock::new();
        INSTANCE.get_or_init(|| {
            let mut system = System::new_all();
            system.refresh_all();
            SystemInfoManager {
                system: Arc::new(Mutex::new(system)),
                last_network_stats: Arc::new(Mutex::new(None)),
            }
        })
    }

    /// 刷新系统信息
    pub fn refresh(&self) {
        if let Ok(mut system) = self.system.lock() {
            system.refresh_all();
        }
    }

    /// 获取完整的系统信息
    pub fn get_system_info(&self) -> Result<SystemInfo> {
        self.refresh();

        let system = self
            .system
            .lock()
            .map_err(|_| anyhow::anyhow!("Failed to lock system"))?;

        // CPU 信息
        let cpus = system.cpus();
        let cpu_usage = if !cpus.is_empty() {
            cpus.iter().map(|cpu| cpu.cpu_usage()).sum::<f32>() / cpus.len() as f32
        } else {
            0.0
        };

        let cpu_brand = cpus
            .first()
            .map(|cpu| cpu.brand().to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        // 内存信息
        let memory_total = system.total_memory();
        let memory_used = system.used_memory();
        let memory_available = system.available_memory();
        let memory_usage_percent = if memory_total > 0 {
            (memory_used as f32 / memory_total as f32) * 100.0
        } else {
            0.0
        };

        // 磁盘信息
        let disks = self.get_disk_info()?;

        // 网络接口信息
        let network_interfaces = self.get_network_interfaces()?;

        // IP 地址
        let ip_addresses = self.get_ip_addresses()?;

        // 系统信息
        let uptime = System::uptime();
        let os_name = System::name().unwrap_or_else(|| "Unknown".to_string());
        let os_version = System::os_version().unwrap_or_else(|| "Unknown".to_string());
        let hostname = System::host_name().unwrap_or_else(|| "Unknown".to_string());

        Ok(SystemInfo {
            cpu_usage,
            cpu_count: cpus.len(),
            cpu_brand,
            memory_total,
            memory_used,
            memory_available,
            memory_usage_percent,
            disks,
            network_interfaces,
            ip_addresses,
            uptime,
            os_name,
            os_version,
            hostname,
        })
    }

    /// 获取 CPU 使用率
    fn get_cpu_usage(&self) -> Result<f32> {
        self.refresh();
        let system = self
            .system
            .lock()
            .map_err(|_| anyhow::anyhow!("Failed to lock system"))?;
        let cpus = system.cpus();

        if cpus.is_empty() {
            return Ok(0.0);
        }

        let total_usage: f32 = cpus.iter().map(|cpu| cpu.cpu_usage()).sum();
        Ok(total_usage / cpus.len() as f32)
    }

    /// 获取内存使用情况
    fn get_memory_info(&self) -> Result<(u64, u64, u64, f32)> {
        self.refresh();
        let system = self
            .system
            .lock()
            .map_err(|_| anyhow::anyhow!("Failed to lock system"))?;

        let total = system.total_memory();
        let used = system.used_memory();
        let available = system.available_memory();
        let usage_percent = if total > 0 {
            (used as f32 / total as f32) * 100.0
        } else {
            0.0
        };

        Ok((total, used, available, usage_percent))
    }

    /// 获取磁盘信息
    fn get_disk_info(&self) -> Result<Vec<DiskInfo>> {
        use std::process::Command;
        let mut disks = Vec::new();

        #[cfg(target_os = "macos")]
        {
            // 使用 df 命令获取磁盘信息
            if let Ok(output) = Command::new("df").args(&["-h"]).output() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                for (i, line) in output_str.lines().enumerate() {
                    if i == 0 {
                        continue;
                    } // 跳过标题行

                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 6 {
                        let filesystem = parts[0].to_string();
                        let total_str = parts[1];
                        let used_str = parts[2];
                        let available_str = parts[3];
                        let mount_point = parts.last().unwrap_or(&"").to_string();

                        // 跳过特殊文件系统
                        if filesystem.starts_with("/dev/")
                            && mount_point != "/"
                            && !mount_point.starts_with("/Volumes")
                        {
                            continue;
                        }

                        let total_space = Self::parse_disk_size(total_str);
                        let mut used_space = Self::parse_disk_size(used_str);
                        let available_space = Self::parse_disk_size(available_str);

                        // macOS APFS 卷修正：使用 total - available 作为 used
                        // 因为 df 输出的 used 可能只包含该卷独占空间，不包含共享容器中其他卷的空间
                        if total_space > available_space {
                             used_space = total_space - available_space;
                        }

                        let usage_percent = if total_space > 0 {
                            (used_space as f32 / total_space as f32) * 100.0
                        } else {
                            0.0
                        };

                        disks.push(DiskInfo {
                            name: filesystem.clone(),
                            mount_point,
                            total_space,
                            available_space,
                            used_space,
                            usage_percent,
                            file_system: "Unknown".to_string(),
                        });
                    }
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Ok(output) = Command::new("df")
                .args(&["-h", "--output=source,fstype,size,used,avail,pcent,target"])
                .output()
            {
                let output_str = String::from_utf8_lossy(&output.stdout);
                for (i, line) in output_str.lines().enumerate() {
                    if i == 0 {
                        continue;
                    } // 跳过标题行

                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 7 {
                        let filesystem = parts[0].to_string();
                        let file_system = parts[1].to_string();
                        let total_str = parts[2];
                        let used_str = parts[3];
                        let available_str = parts[4];
                        let mount_point = parts[6].to_string();

                        let total_space = Self::parse_disk_size(total_str);
                        let used_space = Self::parse_disk_size(used_str);
                        let available_space = Self::parse_disk_size(available_str);

                        let usage_percent = if total_space > 0 {
                            (used_space as f32 / total_space as f32) * 100.0
                        } else {
                            0.0
                        };

                        disks.push(DiskInfo {
                            name: filesystem,
                            mount_point,
                            total_space,
                            available_space,
                            used_space,
                            usage_percent,
                            file_system,
                        });
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = Command::new("wmic")
                .args(&[
                    "logicaldisk",
                    "get",
                    "size,freespace,caption,filesystem",
                    "/format:csv",
                ])
                .output()
            {
                let output_str = String::from_utf8_lossy(&output.stdout);
                for (i, line) in output_str.lines().enumerate() {
                    if i <= 1 {
                        continue;
                    } // 跳过标题行

                    let parts: Vec<&str> = line.split(',').collect();
                    if parts.len() >= 5 {
                        let caption = parts[1].trim();
                        let file_system = parts[2].trim();
                        let free_space: u64 = parts[3].trim().parse().unwrap_or(0);
                        let total_space: u64 = parts[4].trim().parse().unwrap_or(0);
                        let used_space = total_space.saturating_sub(free_space);

                        let usage_percent = if total_space > 0 {
                            (used_space as f32 / total_space as f32) * 100.0
                        } else {
                            0.0
                        };

                        disks.push(DiskInfo {
                            name: caption.to_string(),
                            mount_point: caption.to_string(),
                            total_space,
                            available_space: free_space,
                            used_space,
                            usage_percent,
                            file_system: file_system.to_string(),
                        });
                    }
                }
            }
        }

        Ok(disks)
    }

    /// 获取网络接口信息
    fn get_network_interfaces(&self) -> Result<Vec<NetworkInterface>> {
        use std::process::Command;
        let mut interfaces = Vec::new();

        #[cfg(target_os = "macos")]
        {
            if let Ok(output) = Command::new("netstat").args(&["-i", "-b"]).output() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                for (i, line) in output_str.lines().enumerate() {
                    if i == 0 {
                        continue;
                    } // 跳过标题行

                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 10 {
                        let name = parts[0].to_string();

                        // 跳过回环接口和无效接口
                        if name == "lo0" || name.contains("*") {
                            continue;
                        }

                        let bytes_received: u64 = parts[6].parse().unwrap_or(0);
                        let bytes_transmitted: u64 = parts[9].parse().unwrap_or(0);
                        let packets_received: u64 = parts[4].parse().unwrap_or(0);
                        let packets_transmitted: u64 = parts[7].parse().unwrap_or(0);
                        let errors_on_received: u64 = parts[5].parse().unwrap_or(0);
                        let errors_on_transmitted: u64 = parts[8].parse().unwrap_or(0);

                        interfaces.push(NetworkInterface {
                            name,
                            bytes_received,
                            bytes_transmitted,
                            packets_received,
                            packets_transmitted,
                            errors_on_received,
                            errors_on_transmitted,
                        });
                    }
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Ok(output) = std::fs::read_to_string("/proc/net/dev") {
                for (i, line) in output.lines().enumerate() {
                    if i < 2 {
                        continue;
                    } // 跳过前两行

                    if let Some(colon_pos) = line.find(':') {
                        let name = line[..colon_pos].trim().to_string();
                        let stats = &line[colon_pos + 1..];
                        let parts: Vec<&str> = stats.split_whitespace().collect();

                        if parts.len() >= 16 {
                            let bytes_received: u64 = parts[0].parse().unwrap_or(0);
                            let packets_received: u64 = parts[1].parse().unwrap_or(0);
                            let errors_on_received: u64 = parts[2].parse().unwrap_or(0);
                            let bytes_transmitted: u64 = parts[8].parse().unwrap_or(0);
                            let packets_transmitted: u64 = parts[9].parse().unwrap_or(0);
                            let errors_on_transmitted: u64 = parts[10].parse().unwrap_or(0);

                            interfaces.push(NetworkInterface {
                                name,
                                bytes_received,
                                bytes_transmitted,
                                packets_received,
                                packets_transmitted,
                                errors_on_received,
                                errors_on_transmitted,
                            });
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            // Windows 可以使用 WMI 查询网络接口统计信息
            if let Ok(output) = Command::new("wmic")
                .args(&["path", "Win32_PerfRawData_Tcpip_NetworkInterface", "get", "Name,BytesReceivedPerSec,BytesSentPerSec,PacketsReceivedPerSec,PacketsSentPerSec", "/format:csv"])
                .output()
            {
                let output_str = String::from_utf8_lossy(&output.stdout);
                for (i, line) in output_str.lines().enumerate() {
                    if i <= 1 { continue; } // 跳过标题行
                    
                    let parts: Vec<&str> = line.split(',').collect();
                    if parts.len() >= 6 {
                        let name = parts[5].trim().to_string();
                        if name.is_empty() || name.contains("Loopback") {
                            continue;
                        }
                        
                        let bytes_received: u64 = parts[1].trim().parse().unwrap_or(0);
                        let bytes_transmitted: u64 = parts[2].trim().parse().unwrap_or(0);
                        let packets_received: u64 = parts[3].trim().parse().unwrap_or(0);
                        let packets_transmitted: u64 = parts[4].trim().parse().unwrap_or(0);
                        
                        interfaces.push(NetworkInterface {
                            name,
                            bytes_received,
                            bytes_transmitted,
                            packets_received,
                            packets_transmitted,
                            errors_on_received: 0,
                            errors_on_transmitted: 0,
                        });
                    }
                }
            }
        }

        Ok(interfaces)
    }

    /// 解析磁盘大小字符串 (如 "1.5G", "512M" 等) 转换为字节数
    fn parse_disk_size(size_str: &str) -> u64 {
        if size_str.is_empty() || size_str == "-" {
            return 0;
        }

        let size_str = size_str.to_uppercase();
        // 移除可能存在的 'I' (macOS df -h 输出 Gi, Mi 等) 和 'B'
        let size_str_clean = size_str.trim_end_matches('I').trim_end_matches('B');

        let (number_part, unit) = if size_str_clean.ends_with("T") {
            (size_str_clean.trim_end_matches("T"), 1024_u64.pow(4))
        } else if size_str_clean.ends_with("P") {
            (size_str_clean.trim_end_matches("P"), 1024_u64.pow(5))
        } else if size_str_clean.ends_with("G") {
            (size_str_clean.trim_end_matches("G"), 1024_u64.pow(3))
        } else if size_str_clean.ends_with("M") {
            (size_str_clean.trim_end_matches("M"), 1024_u64.pow(2))
        } else if size_str_clean.ends_with("K") {
            (size_str_clean.trim_end_matches("K"), 1024)
        } else {
            (size_str_clean, 1)
        };

        if let Ok(number) = number_part.parse::<f64>() {
            (number * unit as f64) as u64
        } else {
            0
        }
    }

    /// 获取 IP 地址列表
    fn get_ip_addresses(&self) -> Result<Vec<String>> {
        use std::process::Command;

        let mut ip_addresses = Vec::new();

        // 使用系统命令获取 IP 地址
        #[cfg(target_os = "macos")]
        {
            if let Ok(output) = Command::new("ifconfig").output() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                for line in output_str.lines() {
                    let line = line.trim();
                    if line.starts_with("inet ") {
                        if let Some(ip_part) = line.split_whitespace().nth(1) {
                            if let Ok(ip) = ip_part.parse::<IpAddr>() {
                                match ip {
                                    IpAddr::V4(ipv4) => {
                                        if !ipv4.is_loopback() && !ipv4.is_private() {
                                            ip_addresses.push(ip.to_string());
                                        } else if ipv4.is_private() {
                                            ip_addresses.push(format!("{} (private)", ip));
                                        }
                                    }
                                    IpAddr::V6(ipv6) => {
                                        if !ipv6.is_loopback() {
                                            ip_addresses.push(ip.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Ok(output) = Command::new("ip").args(&["addr", "show"]).output() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                for line in output_str.lines() {
                    let line = line.trim();
                    if line.contains("inet ") {
                        if let Some(ip_part) = line.split_whitespace().nth(1) {
                            if let Some(ip_str) = ip_part.split('/').next() {
                                if let Ok(ip) = ip_str.parse::<IpAddr>() {
                                    match ip {
                                        IpAddr::V4(ipv4) => {
                                            if !ipv4.is_loopback() {
                                                ip_addresses.push(ip.to_string());
                                            }
                                        }
                                        IpAddr::V6(ipv6) => {
                                            if !ipv6.is_loopback() {
                                                ip_addresses.push(ip.to_string());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = Command::new("ipconfig").output() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                for line in output_str.lines() {
                    let line = line.trim();
                    if line.contains("IPv4") || line.contains("IPv6") {
                        if let Some(colon_pos) = line.find(':') {
                            let ip_str = line[colon_pos + 1..].trim();
                            if let Ok(ip) = ip_str.parse::<IpAddr>() {
                                match ip {
                                    IpAddr::V4(ipv4) => {
                                        if !ipv4.is_loopback() {
                                            ip_addresses.push(ip.to_string());
                                        }
                                    }
                                    IpAddr::V6(ipv6) => {
                                        if !ipv6.is_loopback() {
                                            ip_addresses.push(ip.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 如果没有找到 IP 地址，返回本地回环地址
        if ip_addresses.is_empty() {
            ip_addresses.push("127.0.0.1".to_string());
        }

        Ok(ip_addresses)
    }

    /// 获取网络统计信息
    fn get_network_stats(&self) -> Result<NetworkStats> {
        let interfaces = self.get_network_interfaces()?;

        let total_bytes_received = interfaces.iter().map(|i| i.bytes_received).sum();
        let total_bytes_transmitted = interfaces.iter().map(|i| i.bytes_transmitted).sum();
        let total_packets_received = interfaces.iter().map(|i| i.packets_received).sum();
        let total_packets_transmitted = interfaces.iter().map(|i| i.packets_transmitted).sum();

        Ok(NetworkStats {
            total_bytes_received,
            total_bytes_transmitted,
            total_packets_received,
            total_packets_transmitted,
            interfaces,
        })
    }

    /// 获取系统运行时间（秒）
    fn get_uptime(&self) -> Result<u64> {
        Ok(System::uptime())
    }

    /// 获取操作系统信息
    fn get_os_info(&self) -> Result<(String, String, String)> {
        let os_name = System::name().unwrap_or_else(|| "Unknown".to_string());
        let os_version = System::os_version().unwrap_or_else(|| "Unknown".to_string());
        let hostname = System::host_name().unwrap_or_else(|| "Unknown".to_string());

        Ok((os_name, os_version, hostname))
    }

    /// 格式化字节大小为人类可读格式
    fn format_bytes(bytes: u64) -> String {
        const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
        const THRESHOLD: f64 = 1024.0;

        if bytes == 0 {
            return "0 B".to_string();
        }

        let size = bytes as f64;
        let exp = (size.ln() / THRESHOLD.ln()).floor() as usize;
        let exp = exp.min(UNITS.len() - 1);

        let value = size / THRESHOLD.powi(exp as i32);

        if exp == 0 {
            format!("{} {}", bytes, UNITS[exp])
        } else {
            format!("{:.2} {}", value, UNITS[exp])
        }
    }

    /// 格式化运行时间为人类可读格式
    fn format_uptime(seconds: u64) -> String {
        let days = seconds / 86400;
        let hours = (seconds % 86400) / 3600;
        let minutes = (seconds % 3600) / 60;
        let secs = seconds % 60;

        if days > 0 {
            format!("{}天 {}小时 {}分钟 {}秒", days, hours, minutes, secs)
        } else if hours > 0 {
            format!("{}小时 {}分钟 {}秒", hours, minutes, secs)
        } else if minutes > 0 {
            format!("{}分钟 {}秒", minutes, secs)
        } else {
            format!("{}秒", secs)
        }
    }
}
