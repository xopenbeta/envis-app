import { ServiceData } from "@/types/index";
import { IPCResult } from "@/types/ipc";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'

export const ipcGetMariadbVersions = ipcLogFunc('获取 MariaDB 版本列表', async (): Promise<IPCResult> => {
    return invokeCommand('get_mariadb_versions')
})

export const ipcDownloadMariadb = ipcLogFunc('下载 MariaDB', async (version: string): Promise<IPCResult> => {
    return invokeCommand('download_mariadb', { version })
})

export const ipcCancelMariadbDownload = ipcLogFunc('取消 MariaDB 下载', async (version: string): Promise<IPCResult> => {
    return invokeCommand('cancel_mariadb_download', { version })
})

export const ipcActivateMariadbService = ipcLogFunc('激活 MariaDB 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('activate_mariadb_service', { environmentId, serviceData })
})

export const ipcDeactivateMariadbService = ipcLogFunc('停用 MariaDB 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('deactivate_mariadb_service', { environmentId, serviceData })
})

export const ipcCheckMariadbInstalled = ipcLogFunc('检查 MariaDB 是否已安装', async (version: string): Promise<IPCResult> => {
    return invokeCommand('check_mariadb_installed', { version })
})

export const ipcStartMariadbService = ipcLogFunc('启动 MariaDB 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('start_mariadb_service', { environmentId, serviceData })
})

export const ipcStopMariadbService = ipcLogFunc('停止 MariaDB 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('stop_mariadb_service', { environmentId, serviceData })
})

export const ipcRestartMariadbService = ipcLogFunc('重启 MariaDB 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('restart_mariadb_service', { environmentId, serviceData })
})

export const ipcGetMariadbConfig = ipcLogFunc('获取 MariaDB 配置', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('get_mariadb_config', { environmentId, serviceData })
})

export const ipcSetMariadbDataPath = ipcLogFunc('设置 MariaDB 数据目录', async (environmentId: string, serviceData: ServiceData, dataPath: string): Promise<IPCResult> => {
    return invokeCommand('set_mariadb_data_path', { environmentId, serviceData, dataPath })
})

export const ipcSetMariadbLogPath = ipcLogFunc('设置 MariaDB 日志目录', async (environmentId: string, serviceData: ServiceData, logPath: string): Promise<IPCResult> => {
    return invokeCommand('set_mariadb_log_path', { environmentId, serviceData, logPath })
})

export const ipcSetMariadbPort = ipcLogFunc('设置 MariaDB 端口', async (environmentId: string, serviceData: ServiceData, port: number): Promise<IPCResult> => {
    return invokeCommand('set_mariadb_port', { environmentId, serviceData, port })
})

export const ipcGetMariadbServiceStatus = ipcLogFunc('获取 MariaDB 服务状态', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('get_mariadb_service_status', { environmentId, serviceData })
})

export const ipcGetMariadbDownloadProgress = ipcLogFunc('获取 MariaDB 下载进度', async (version: string): Promise<IPCResult> => {
    return invokeCommand('get_mariadb_download_progress', { version })
})

export const ipcInitializeMariadb = ipcLogFunc('初始化 MariaDB', async (
    environmentId: string,
    serviceData: ServiceData,
    rootPassword: string,
    port?: string,
    bindAddress?: string,
    reset?: boolean
): Promise<IPCResult<{
    configPath: string;
    dataPath: string;
    logPath: string;
    rootPassword: string;
    port: string;
    bindAddress: string;
}>> => {
    return invokeCommand('initialize_mariadb', { environmentId, serviceData, rootPassword, port, bindAddress, reset })
})

export const ipcCheckMariadbInitialized = ipcLogFunc('检查 MariaDB 是否已初始化', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ initialized: boolean }>> => {
    return invokeCommand('check_mariadb_initialized', { environmentId, serviceData })
})

export const ipcListMariadbDatabases = ipcLogFunc('列出 MariaDB 数据库', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ databases: string[] }>> => {
    return invokeCommand('list_mariadb_databases', { environmentId, serviceData })
})

export const ipcCreateMariadbDatabase = ipcLogFunc('创建 MariaDB 数据库', async (environmentId: string, serviceData: ServiceData, databaseName: string): Promise<IPCResult<{ database: string }>> => {
    return invokeCommand('create_mariadb_database', { environmentId, serviceData, databaseName })
})

export const ipcListMariadbTables = ipcLogFunc('列出 MariaDB 表', async (environmentId: string, serviceData: ServiceData, databaseName: string): Promise<IPCResult<{ tables: string[] }>> => {
    return invokeCommand('list_mariadb_tables', { environmentId, serviceData, databaseName })
})

export const ipcOpenMariadbClient = ipcLogFunc('打开 MariaDB 客户端', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ connectionString: string }>> => {
    return invokeCommand('open_mariadb_client', { environmentId, serviceData })
})
