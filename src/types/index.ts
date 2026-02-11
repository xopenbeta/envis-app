import { AISettings } from "./ai";

export type AppTheme = 'light' | 'dark' | 'system';

export type AppSettings = {
  theme: AppTheme,
  language: string,
  ai: AISettings,
}

export type SystemSettings = {
  envisFolder: string // envis 主文件夹路径
  autoStartAppOnLogin: boolean // 是否开机自启
  autoActivateLastUsedEnvironmentOnAppStart: boolean // 是否在APP启动时自动激活上次使用的环境
  deactivateOtherEnvironmentsOnActivate: boolean // 激活环境时是否自动停用其他环境
  lastUsedEnvironmentId?: string // 兼容字段：最后使用的环境ID（单个）
  lastUsedEnvironmentIds?: string[] // 支持多个最后使用的环境ID，按激活先后排序
  stopAllServicesOnExit: boolean // 是否在退出时停止所有服务
  terminalTool?: string // 终端工具选择
  showEnvironmentNameOnTerminalOpen?: boolean // 打开终端时显示环境名称
  showServiceInfoOnTerminalOpen?: boolean // 打开终端时显示服务信息
}

export enum EnvironmentStatus {
  Unknown = "unknown",
  Active = "active",
  Inactive = "inactive",
}

export enum ServiceStatus {
  Unknown = "unknown",
  Error = "error",
  Running = "running",
  Stopped = "stopped",
}

export enum DownloadStatus {
  Unknown = "unknown",
  NotInstalled = "notinstalled",
  Pending = "pending",
  Downloading = "downloading",
  Downloaded = "downloaded",
  Installing = "installing",
  Installed = "installed",
  Failed = "failed",
  Cancelled = "cancelled",
}

export enum ServiceDataStatus {
  Unknown = "unknown",
  Active = "active",
  Inactive = "inactive",
}

export enum ServiceType {
  Mongodb = "mongodb",
  Mariadb = "mariadb",
  Mysql = "mysql",
  Postgresql = "postgresql",
  Nginx = "nginx",
  Nodejs = "nodejs",
  Python = "python",
  Java = "java",
  Custom = "custom",
  Host = "host",
  SSL = "ssl",
  Dnsmasq = "dnsmasq",
}

// 服务类型标签
export const serviceTypeNames: Record<ServiceType, string> = {
  [ServiceType.Nodejs]: 'Node.js',
  [ServiceType.Nginx]: 'Nginx',
  [ServiceType.Mongodb]: 'MongoDB',
  [ServiceType.Mariadb]: 'MariaDB',
  [ServiceType.Mysql]: 'MySQL',
  [ServiceType.Postgresql]: 'PostgreSQL',
  [ServiceType.Python]: 'Python',
  [ServiceType.Java]: 'Java',
  [ServiceType.Custom]: '自定义服务',
  [ServiceType.Host]: 'Hosts 管理',
  [ServiceType.SSL]: 'SSL 证书',
  [ServiceType.Dnsmasq]: 'Dnsmasq',
}

// 服务分类配置
export const serviceCategories = {
  'custom': {
    custom: 'custom',
    host: 'host',
    ssl: 'ssl',
  },
  'languages': {
    nodejs: 'Node.js',
    python: 'Python',
    java: 'Java',
    // go: 'Go',
    // php: 'PHP'
  },
  'databases': {
    mysql: 'MySQL',
    mariadb: 'MariaDB',
    mongodb: 'MongoDB',
    postgresql: 'PostgreSQL',
    // redis: 'Redis'
  },
  'servers': {
    nginx: 'Nginx',
    dnsmasq: 'Dnsmasq',
  },
}
// 一般用这个
export const NeedDownloadServices: ServiceType[] = [
  ServiceType.Nodejs,
  ServiceType.Nginx,
  ServiceType.Mongodb,
  ServiceType.Mariadb,
  ServiceType.Mysql,
  ServiceType.Postgresql,
  ServiceType.Python,
  ServiceType.Java,
  ServiceType.Dnsmasq,
];

export const NoNeedDownloadServices: ServiceType[] = [
  ServiceType.Custom,
  ServiceType.Host,
  ServiceType.SSL,
];
// 一般用这个
export const CanRunServices: ServiceType[] = [
  ServiceType.Nginx,
  ServiceType.Mongodb,
  ServiceType.Mariadb,
  ServiceType.Mysql,
  ServiceType.Postgresql,
  ServiceType.Dnsmasq,
];

export const CannotRunServices: ServiceType[] = [
  ServiceType.Nodejs,
  ServiceType.Python,
  ServiceType.Java,
  ServiceType.Custom,
  ServiceType.Host,
  ServiceType.SSL,
];

export const NoNeedVersionServices: ServiceType[] = [
  ServiceType.Host,
  ServiceType.SSL,
  ServiceType.Custom,
]

export type Environment = {
  id: string
  name: string
  status: EnvironmentStatus
  sort?: number
  metadata?: Record<string, any>
  serviceDatas: ServiceData[]
  createdAt: string
  updatedAt: string
}

export interface ServiceData {
  id: string
  name: string
  type: ServiceType
  version: string
  status: ServiceDataStatus
  sort?: number
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export type Service = {
  type: ServiceType
  version: string
  size?: number
  sizeFormatted?: string
}

export interface ServiceDownloadProgress {
  serviceType: ServiceType
  version: string
  progress: number
  downloadedSize: number
  totalSize: number
  status: DownloadStatus
  errorMessage?: string
}

// Host 条目类型
export interface HostEntry {
  id: string
  ip: string
  hostname: string
  comment?: string
  enabled: boolean
}
