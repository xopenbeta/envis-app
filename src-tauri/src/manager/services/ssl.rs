use crate::manager::app_config_manager::AppConfigManager;
use crate::manager::env_serv_data_manager::ServiceDataResult;
use crate::types::ServiceData;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, OnceLock};

/// CA 配置信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CAConfig {
    pub common_name: String,
    pub organization: String,
    pub organizational_unit: Option<String>,
    pub country: String,
    pub state: String,
    pub locality: String,
    pub validity_days: i32,
}

/// 证书信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Certificate {
    pub id: String,
    pub domain: String,
    pub common_name: String,
    pub subject_alt_names: Option<Vec<String>>,
    pub issuer: String,
    pub valid_from: String,
    pub valid_to: String,
    pub serial_number: String,
    pub created_at: String,
    pub cert_path: String,
    pub key_path: String,
    pub formats: CertificateFormats,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CertificateFormats {
    pub pem: Option<String>,
    pub crt: Option<String>,
    pub key: Option<String>,
    pub pfx: Option<String>,
    pub jks: Option<String>,
}

/// 全局 SSL 服务管理器单例
static GLOBAL_SSL_SERVICE: OnceLock<Arc<SslService>> = OnceLock::new();

/// SSL 证书服务管理器
pub struct SslService {}

impl SslService {
    /// 获取全局 SSL 服务管理器单例
    pub fn global() -> Arc<SslService> {
        GLOBAL_SSL_SERVICE
            .get_or_init(|| Arc::new(Self::new()))
            .clone()
    }

    fn new() -> Self {
        Self {}
    }

    /// 获取 CA 目录（全局，在 services 文件夹下）
    fn get_ca_folder(&self) -> PathBuf {
        let app_config_manager = AppConfigManager::global();
        let app_config_manager = app_config_manager.lock().unwrap();
        let services_folder = app_config_manager.get_services_folder();
        PathBuf::from(services_folder)
            .join("ssl")
            .join("v1.0.0")
            .join("ca")
    }

    /// 获取证书目录（按环境存储，在 envs 文件夹下）
    fn get_certs_folder(&self, environment_id: &str) -> PathBuf {
        let app_config_manager = AppConfigManager::global();
        let app_config_manager = app_config_manager.lock().unwrap();
        let envs_folder = app_config_manager.get_envs_folder();
        PathBuf::from(envs_folder)
            .join(environment_id)
            .join("ssl")
            .join("v1.0.0")
            .join("certs")
    }

    /// 检查 CA 是否已初始化
    pub fn is_ca_initialized(&self, _environment_id: &str) -> bool {
        let ca_folder = self.get_ca_folder();
        let ca_cert = ca_folder.join("ca.crt");
        let ca_key = ca_folder.join("ca.key");
        ca_cert.exists() && ca_key.exists()
    }

    /// 初始化 CA（根证书颁发机构）
    pub fn initialize_ca(
        &self,
        environment_id: &str,
        _service_data: &ServiceData,
        ca_config: CAConfig,
    ) -> Result<ServiceDataResult> {
        log::info!("开始初始化 CA for environment: {}", environment_id);

        let ca_folder = self.get_ca_folder();
        std::fs::create_dir_all(&ca_folder)?;

        // 生成 CA 私钥
        let ca_key_path = ca_folder.join("ca.key");
        let output = Command::new("openssl")
            .args(&[
                "genrsa",
                "-out",
                ca_key_path.to_str().unwrap(),
                "4096",
            ])
            .output()?;

        if !output.status.success() {
            return Err(anyhow!(
                "生成 CA 私钥失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        // 创建 CA 配置文件
        let ca_config_path = ca_folder.join("ca.cnf");
        let ca_config_content = format!(
            r#"
[ req ]
default_bits       = 4096
distinguished_name = req_distinguished_name
x509_extensions    = v3_ca

[ req_distinguished_name ]
countryName                     = Country Name (2 letter code)
stateOrProvinceName             = State or Province Name
localityName                    = Locality Name
organizationName                = Organization Name
organizationalUnitName          = Organizational Unit Name
commonName                      = Common Name

[ v3_ca ]
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints       = critical, CA:true
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign

[ req_attributes ]
"#
        );
        std::fs::write(&ca_config_path, ca_config_content)?;

        // 生成自签名 CA 证书
        let ca_cert_path = ca_folder.join("ca.crt");
        let subject = format!(
            "/C={}/ST={}/L={}/O={}/CN={}",
            ca_config.country,
            ca_config.state,
            ca_config.locality,
            ca_config.organization,
            ca_config.common_name
        );

        let output = Command::new("openssl")
            .args(&[
                "req",
                "-new",
                "-x509",
                "-days",
                &ca_config.validity_days.to_string(),
                "-key",
                ca_key_path.to_str().unwrap(),
                "-out",
                ca_cert_path.to_str().unwrap(),
                "-subj",
                &subject,
                "-config",
                ca_config_path.to_str().unwrap(),
                "-extensions",
                "v3_ca",
            ])
            .output()?;

        if !output.status.success() {
            return Err(anyhow!(
                "生成 CA 证书失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        // 创建证书序列号文件
        let serial_file = ca_folder.join("serial");
        std::fs::write(&serial_file, "1000")?;

        // 创建证书索引文件
        let index_file = ca_folder.join("index.txt");
        std::fs::write(&index_file, "")?;

        log::info!("CA 初始化成功");

        let data = serde_json::json!({
            "caCertPath": ca_cert_path.to_str().unwrap(),
            "caKeyPath": ca_key_path.to_str().unwrap(),
            "commonName": ca_config.common_name,
            "organization": ca_config.organization,
            "validityDays": ca_config.validity_days,
        });

        Ok(ServiceDataResult {
            success: true,
            message: "CA 初始化成功".to_string(),
            data: Some(data),
        })
    }

    /// 签发新证书
    pub fn issue_certificate(
        &self,
        environment_id: &str,
        _service_data: &ServiceData,
        domain: String,
        subject_alt_names: Option<Vec<String>>,
        validity_days: i32,
    ) -> Result<ServiceDataResult> {
        log::info!("开始签发证书 for domain: {}", domain);

        // 检查 CA 是否已初始化
        if !self.is_ca_initialized(environment_id) {
            return Err(anyhow!("CA 未初始化，请先初始化 CA"));
        }

        let ca_folder = self.get_ca_folder();
        let certs_folder = self.get_certs_folder(environment_id);
        let cert_folder = certs_folder.join(&domain);
        std::fs::create_dir_all(&cert_folder)?;

        // 生成证书私钥
        let key_path = cert_folder.join("private.key");
        let output = Command::new("openssl")
            .args(&["genrsa", "-out", key_path.to_str().unwrap(), "2048"])
            .output()?;

        if !output.status.success() {
            return Err(anyhow!(
                "生成证书私钥失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        // 创建证书签名请求 (CSR)
        let csr_path = cert_folder.join("request.csr");
        let output = Command::new("openssl")
            .args(&[
                "req",
                "-new",
                "-key",
                key_path.to_str().unwrap(),
                "-out",
                csr_path.to_str().unwrap(),
                "-subj",
                &format!("/CN={}", domain),
            ])
            .output()?;

        if !output.status.success() {
            return Err(anyhow!(
                "生成 CSR 失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        // 创建扩展配置文件（用于 SAN）
        let ext_path = cert_folder.join("cert.ext");
        let mut san_entries = vec![format!("DNS:{}", domain)];
        if let Some(sans) = &subject_alt_names {
            for san in sans {
                san_entries.push(format!("DNS:{}", san));
            }
        }
        let ext_content = format!(
            r#"
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
{}
"#,
            san_entries
                .iter()
                .enumerate()
                .map(|(i, san)| format!("DNS.{} = {}", i + 1, san.trim_start_matches("DNS:")))
                .collect::<Vec<_>>()
                .join("\n")
        );
        std::fs::write(&ext_path, ext_content)?;

        // 使用 CA 签发证书
        let cert_path = cert_folder.join("certificate.crt");
        let ca_cert_path = ca_folder.join("ca.crt");
        let ca_key_path = ca_folder.join("ca.key");

        let output = Command::new("openssl")
            .args(&[
                "x509",
                "-req",
                "-in",
                csr_path.to_str().unwrap(),
                "-CA",
                ca_cert_path.to_str().unwrap(),
                "-CAkey",
                ca_key_path.to_str().unwrap(),
                "-CAcreateserial",
                "-out",
                cert_path.to_str().unwrap(),
                "-days",
                &validity_days.to_string(),
                "-extfile",
                ext_path.to_str().unwrap(),
            ])
            .output()?;

        if !output.status.success() {
            return Err(anyhow!(
                "签发证书失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        // 生成不同格式的证书
        let mut formats = CertificateFormats::default();

        // PEM 格式（合并证书和私钥）
        let pem_path = cert_folder.join("fullchain.pem");
        let cert_content = std::fs::read_to_string(&cert_path)?;
        let key_content = std::fs::read_to_string(&key_path)?;
        std::fs::write(&pem_path, format!("{}\n{}", cert_content, key_content))?;
        formats.pem = Some(pem_path.to_str().unwrap().to_string());

        // CRT + KEY 分离格式
        formats.crt = Some(cert_path.to_str().unwrap().to_string());
        formats.key = Some(key_path.to_str().unwrap().to_string());

        // PFX 格式（PKCS#12）
        let pfx_path = cert_folder.join("certificate.pfx");
        let output = Command::new("openssl")
            .args(&[
                "pkcs12",
                "-export",
                "-out",
                pfx_path.to_str().unwrap(),
                "-inkey",
                key_path.to_str().unwrap(),
                "-in",
                cert_path.to_str().unwrap(),
                "-certfile",
                ca_cert_path.to_str().unwrap(),
                "-passout",
                "pass:", // 空密码
            ])
            .output()?;

        if output.status.success() {
            formats.pfx = Some(pfx_path.to_str().unwrap().to_string());
        }

        // 获取证书详细信息
        let cert_info = self.get_certificate_info(&cert_path)?;

        let certificate = Certificate {
            id: uuid::Uuid::new_v4().to_string(),
            domain: domain.clone(),
            common_name: domain.clone(),
            subject_alt_names,
            issuer: cert_info.issuer,
            valid_from: cert_info.valid_from,
            valid_to: cert_info.valid_to,
            serial_number: cert_info.serial_number,
            created_at: chrono::Utc::now().to_rfc3339(),
            cert_path: cert_path.to_str().unwrap().to_string(),
            key_path: key_path.to_str().unwrap().to_string(),
            formats,
        };

        log::info!("证书签发成功: {}", domain);

        let data = serde_json::json!({
            "certificate": certificate,
        });

        Ok(ServiceDataResult {
            success: true,
            message: format!("证书签发成功: {}", domain),
            data: Some(data),
        })
    }

    /// 获取证书详细信息
    fn get_certificate_info(&self, cert_path: &PathBuf) -> Result<CertInfo> {
        let output = Command::new("openssl")
            .args(&[
                "x509",
                "-in",
                cert_path.to_str().unwrap(),
                "-noout",
                "-subject",
                "-issuer",
                "-startdate",
                "-enddate",
                "-serial",
            ])
            .output()?;

        if !output.status.success() {
            return Err(anyhow!("获取证书信息失败"));
        }

        let info_str = String::from_utf8_lossy(&output.stdout);
        let mut cert_info = CertInfo::default();

        for line in info_str.lines() {
            if line.starts_with("subject=") {
                cert_info.subject = line.trim_start_matches("subject=").trim().to_string();
            } else if line.starts_with("issuer=") {
                cert_info.issuer = line.trim_start_matches("issuer=").trim().to_string();
            } else if line.starts_with("notBefore=") {
                cert_info.valid_from = line.trim_start_matches("notBefore=").trim().to_string();
            } else if line.starts_with("notAfter=") {
                cert_info.valid_to = line.trim_start_matches("notAfter=").trim().to_string();
            } else if line.starts_with("serial=") {
                cert_info.serial_number = line.trim_start_matches("serial=").trim().to_string();
            }
        }

        Ok(cert_info)
    }

    /// 列出所有已签发的证书
    pub fn list_certificates(
        &self,
        environment_id: &str,
        _service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        let certs_folder = self.get_certs_folder(environment_id);

        if !certs_folder.exists() {
            return Ok(ServiceDataResult {
                success: true,
                message: "证书列表为空".to_string(),
                data: Some(serde_json::json!({ "certificates": [] })),
            });
        }

        let mut certificates = Vec::new();

        for entry in std::fs::read_dir(&certs_folder)? {
            let entry = entry?;
            let cert_folder = entry.path();

            if !cert_folder.is_dir() {
                continue;
            }

            let cert_path = cert_folder.join("certificate.crt");
            let key_path = cert_folder.join("private.key");

            if !cert_path.exists() || !key_path.exists() {
                continue;
            }

            // 读取证书信息
            let cert_info = self.get_certificate_info(&cert_path)?;
            let domain = entry.file_name().to_string_lossy().to_string();

            let mut formats = CertificateFormats::default();
            formats.crt = Some(cert_path.to_str().unwrap().to_string());
            formats.key = Some(key_path.to_str().unwrap().to_string());

            let pem_path = cert_folder.join("fullchain.pem");
            if pem_path.exists() {
                formats.pem = Some(pem_path.to_str().unwrap().to_string());
            }

            let pfx_path = cert_folder.join("certificate.pfx");
            if pfx_path.exists() {
                formats.pfx = Some(pfx_path.to_str().unwrap().to_string());
            }

            let certificate = Certificate {
                id: uuid::Uuid::new_v4().to_string(),
                domain: domain.clone(),
                common_name: domain.clone(),
                subject_alt_names: None,
                issuer: cert_info.issuer.clone(),
                valid_from: cert_info.valid_from.clone(),
                valid_to: cert_info.valid_to.clone(),
                serial_number: cert_info.serial_number.clone(),
                created_at: "".to_string(), // 从文件系统获取
                cert_path: cert_path.to_str().unwrap().to_string(),
                key_path: key_path.to_str().unwrap().to_string(),
                formats,
            };

            certificates.push(certificate);
        }

        let data = serde_json::json!({
            "certificates": certificates,
        });

        Ok(ServiceDataResult {
            success: true,
            message: format!("找到 {} 个证书", certificates.len()),
            data: Some(data),
        })
    }

    /// 删除证书
    pub fn delete_certificate(
        &self,
        environment_id: &str,
        _service_data: &ServiceData,
        domain: String,
    ) -> Result<ServiceDataResult> {
        let cert_folder = self.get_certs_folder(environment_id).join(&domain);

        if !cert_folder.exists() {
            return Err(anyhow!("证书不存在: {}", domain));
        }

        std::fs::remove_dir_all(&cert_folder)?;

        log::info!("证书已删除: {}", domain);

        Ok(ServiceDataResult {
            success: true,
            message: format!("证书已删除: {}", domain),
            data: None,
        })
    }

    /// 获取 CA 证书信息
    pub fn get_ca_info(
        &self,
        environment_id: &str,
        _service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        if !self.is_ca_initialized(environment_id) {
            return Ok(ServiceDataResult {
                success: false,
                message: "CA 未初始化".to_string(),
                data: Some(serde_json::json!({ "initialized": false })),
            });
        }

        let ca_folder = self.get_ca_folder();
        let ca_cert_path = ca_folder.join("ca.crt");
        let ca_key_path = ca_folder.join("ca.key");

        let cert_info = self.get_certificate_info(&ca_cert_path)?;

        let data = serde_json::json!({
            "initialized": true,
            "caCertPath": ca_cert_path.to_str().unwrap(),
            "caKeyPath": ca_key_path.to_str().unwrap(),
            "issuer": cert_info.issuer,
            "subject": cert_info.subject,
            "validFrom": cert_info.valid_from,
            "validTo": cert_info.valid_to,
            "serialNumber": cert_info.serial_number,
        });

        Ok(ServiceDataResult {
            success: true,
            message: "获取 CA 信息成功".to_string(),
            data: Some(data),
        })
    }

    /// 导出 CA 证书（用于系统信任）
    pub fn export_ca_certificate(
        &self,
        environment_id: &str,
        _service_data: &ServiceData,
    ) -> Result<ServiceDataResult> {
        if !self.is_ca_initialized(environment_id) {
            return Err(anyhow!("CA 未初始化"));
        }

        let ca_folder = self.get_ca_folder();
        let ca_cert_path = ca_folder.join("ca.crt");

        let data = serde_json::json!({
            "caCertPath": ca_cert_path.to_str().unwrap(),
        });

        Ok(ServiceDataResult {
            success: true,
            message: "CA 证书路径".to_string(),
            data: Some(data),
        })
    }

    /// 检查 CA 证书是否已安装到系统
    pub fn check_ca_installed(&self, _environment_id: &str) -> Result<ServiceDataResult> {
        let ca_folder = self.get_ca_folder();
        let ca_cert_path = ca_folder.join("ca.crt");

        if !ca_cert_path.exists() {
            return Ok(ServiceDataResult {
                success: false,
                message: "CA 证书不存在".to_string(),
                data: Some(serde_json::json!({
                    "installed": false,
                    "reason": "ca_not_initialized"
                })),
            });
        }
        
        // 根据操作系统检查 CA 是否已安装
        let installed = if cfg!(target_os = "macos") {
            self.check_ca_installed_macos(&ca_cert_path)?
        } else if cfg!(target_os = "windows") {
            self.check_ca_installed_windows(&ca_cert_path)?
        } else if cfg!(target_os = "linux") {
            self.check_ca_installed_linux(&ca_cert_path)?
        } else {
            false
        };

        Ok(ServiceDataResult {
            success: true,
            message: if installed { "CA 已安装到系统" } else { "CA 未安装到系统" }.to_string(),
            data: Some(serde_json::json!({
                "installed": installed,
                "certPath": ca_cert_path.to_str().unwrap(),
            })),
        })
    }

    /// 检查 CA 在 macOS 系统中是否已安装
    fn check_ca_installed_macos(&self, ca_cert_path: &PathBuf) -> Result<bool> {
        // 获取证书的 SHA-1 指纹
        let output = Command::new("openssl")
            .args(&[
                "x509",
                "-noout",
                "-fingerprint",
                "-sha1",
                "-in",
                ca_cert_path.to_str().unwrap(),
            ])
            .output()?;

        if !output.status.success() {
            return Ok(false);
        }

        let fingerprint = String::from_utf8_lossy(&output.stdout);
        // 提取指纹值，格式如: SHA1 Fingerprint=XX:XX:XX:...
        let fingerprint = fingerprint
            .split('=')
            .nth(1)
            .unwrap_or("")
            .trim()
            .replace(":", "");

        // 使用 security 命令查找证书
        let output = Command::new("security")
            .args(&[
                "find-certificate",
                "-a",
                "-Z",
                "/Library/Keychains/System.keychain",
            ])
            .output()?;

        if !output.status.success() {
            return Ok(false);
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        // 检查指纹是否存在于系统钥匙串中
        Ok(output_str.contains(&fingerprint))
    }

    /// 检查 CA 在 Windows 系统中是否已安装
    fn check_ca_installed_windows(&self, ca_cert_path: &PathBuf) -> Result<bool> {
        // 获取证书的 subject
        let output = Command::new("openssl")
            .args(&[
                "x509",
                "-noout",
                "-subject",
                "-in",
                ca_cert_path.to_str().unwrap(),
            ])
            .output()?;

        if !output.status.success() {
            return Ok(false);
        }

        let subject = String::from_utf8_lossy(&output.stdout);
        let subject = subject.trim().replace("subject=", "");

        // 使用 PowerShell 检查证书存储
        let ps_script = format!(
            r#"Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object {{ $_.Subject -like "*{}*" }}"#,
            subject
        );

        let output = Command::new("powershell")
            .args(&["-Command", &ps_script])
            .output()?;

        Ok(output.status.success() && !output.stdout.is_empty())
    }

    /// 检查 CA 在 Linux 系统中是否已安装
    fn check_ca_installed_linux(&self, ca_cert_path: &PathBuf) -> Result<bool> {
        // Linux 系统中 CA 证书通常安装在以下位置
        let ca_paths = vec![
            "/etc/ssl/certs",
            "/usr/local/share/ca-certificates",
            "/etc/pki/ca-trust/source/anchors",
        ];

        // 获取证书的 SHA-256 指纹
        let output = Command::new("openssl")
            .args(&[
                "x509",
                "-noout",
                "-fingerprint",
                "-sha256",
                "-in",
                ca_cert_path.to_str().unwrap(),
            ])
            .output()?;

        if !output.status.success() {
            return Ok(false);
        }

        let fingerprint = String::from_utf8_lossy(&output.stdout);
        let fingerprint = fingerprint
            .split('=')
            .nth(1)
            .unwrap_or("")
            .trim();

        // 检查每个 CA 目录
        for ca_path in ca_paths {
            let path = PathBuf::from(ca_path);
            if !path.exists() {
                continue;
            }

            // 遍历目录中的所有 .crt 和 .pem 文件
            if let Ok(entries) = std::fs::read_dir(&path) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    if let Some(ext) = entry_path.extension() {
                        if ext == "crt" || ext == "pem" {
                            if let Ok(output) = Command::new("openssl")
                                .args(&[
                                    "x509",
                                    "-noout",
                                    "-fingerprint",
                                    "-sha256",
                                    "-in",
                                    entry_path.to_str().unwrap(),
                                ])
                                .output()
                            {
                                let installed_fingerprint = String::from_utf8_lossy(&output.stdout);
                                if installed_fingerprint.contains(fingerprint) {
                                    return Ok(true);
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(false)
    }
}

#[derive(Debug, Default)]
struct CertInfo {
    subject: String,
    issuer: String,
    valid_from: String,
    valid_to: String,
    serial_number: String,
}
