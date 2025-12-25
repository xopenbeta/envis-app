export interface MongoDBConfig {
    bindIp?: string              // 绑定 IP
    port?: number                // 端口
    dataPath?: string            // 数据目录
    logPath?: string             // 日志文件路径
    errorLogPath?: string        // 错误日志文件路径
    parseError?: string          // 解析错误信息
}

export interface MongoDBMetadata {
    "MONGODB_CONFIG"?: string
    "MONGODB_KEYFILE_PATH"?: string
    "MONGODB_ADMIN_USERNAME"?: string
    "MONGODB_ADMIN_PASSWORD"?: string
}

// SSL 证书格式
export enum CertificateFormat {
    PEM = 'pem',           // PEM 格式 (Nginx, Apache)
    CRT_KEY = 'crt_key',   // CRT + KEY 分离格式
    PFX = 'pfx',           // PFX/P12 格式 (IIS, Windows)
    JKS = 'jks',           // Java KeyStore (Tomcat, Java)
}

// CA 配置信息
export interface CAConfig {
    commonName: string          // CA 名称
    organization: string        // 组织名称
    organizationalUnit?: string // 组织单位
    country: string             // 国家代码 (e.g., CN, US)
    state: string               // 州/省
    locality: string            // 城市
    validityDays: number        // 有效期天数
}

// 证书信息
export interface Certificate {
    id: string                   // 证书唯一标识
    domain: string               // 域名
    commonName: string           // 通用名称
    subjectAltNames?: string[]   // SAN (Subject Alternative Names)
    issuer: string               // 颁发者
    validFrom: string            // 生效时间
    validTo: string              // 过期时间
    serialNumber: string         // 序列号
    createdAt: string            // 创建时间
    certPath: string             // 证书文件路径
    keyPath: string              // 私钥文件路径
    formats: {                   // 各种格式的证书路径
        pem?: string
        crt?: string
        key?: string
        pfx?: string
        jks?: string
    }
}

// SSL 元数据
export interface SSLMetadata {
    "SSL_CA_INITIALIZED"?: boolean       // CA 是否已初始化
    "SSL_CA_CERT_PATH"?: string          // CA 证书路径
    "SSL_CA_KEY_PATH"?: string           // CA 私钥路径
    "SSL_CA_COMMON_NAME"?: string        // CA 通用名称
    "SSL_CA_ORGANIZATION"?: string       // CA 组织名称
    "SSL_CA_VALIDITY_DAYS"?: number      // CA 有效期
    "SSL_CERTIFICATES"?: Certificate[]   // 已签发的证书列表
}
