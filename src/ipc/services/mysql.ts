import { ServiceData } from "@/types/index";
import { IPCResult } from "@/types/ipc";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'

export const ipcGetMysqlVersions = ipcLogFunc('获取 MySQL 版本列表', async (): Promise<IPCResult> => {
    return invokeCommand('get_mysql_versions')
})

export const ipcDownloadMysql = ipcLogFunc('下载 MySQL', async (version: string): Promise<IPCResult> => {
    return invokeCommand('download_mysql', { version })
})

export const ipcCancelMysqlDownload = ipcLogFunc('取消 MySQL 下载', async (version: string): Promise<IPCResult> => {
    return invokeCommand('cancel_mysql_download', { version })
})

export const ipcCheckMysqlInstalled = ipcLogFunc('检查 MySQL 是否已安装', async (version: string): Promise<IPCResult> => {
    return invokeCommand('check_mysql_installed', { version })
})

export const ipcStartMysqlService = ipcLogFunc('启动 MySQL 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('start_mysql_service', { environmentId, serviceData })
})

export const ipcStopMysqlService = ipcLogFunc('停止 MySQL 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('stop_mysql_service', { environmentId, serviceData })
})

export const ipcRestartMysqlService = ipcLogFunc('重启 MySQL 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('restart_mysql_service', { environmentId, serviceData })
})

export const ipcGetMysqlConfig = ipcLogFunc('获取 MySQL 配置', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('get_mysql_config', { environmentId, serviceData })
})

export const ipcSetMysqlDataPath = ipcLogFunc('设置 MySQL 数据目录', async (environmentId: string, serviceData: ServiceData, dataPath: string): Promise<IPCResult> => {
    return invokeCommand('set_mysql_data_path', { environmentId, serviceData, dataPath })
})

export const ipcSetMysqlLogPath = ipcLogFunc('设置 MySQL 日志目录', async (environmentId: string, serviceData: ServiceData, logPath: string): Promise<IPCResult> => {
    return invokeCommand('set_mysql_log_path', { environmentId, serviceData, logPath })
})

export const ipcSetMysqlPort = ipcLogFunc('设置 MySQL 端口', async (environmentId: string, serviceData: ServiceData, port: number): Promise<IPCResult> => {
    return invokeCommand('set_mysql_port', { environmentId, serviceData, port })
})

export const ipcGetMysqlServiceStatus = ipcLogFunc('获取 MySQL 服务状态', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('get_mysql_service_status', { environmentId, serviceData })
})

export const ipcGetMysqlDownloadProgress = ipcLogFunc('获取 MySQL 下载进度', async (version: string): Promise<IPCResult> => {
    return invokeCommand('get_mysql_download_progress', { version })
})

export const ipcInitializeMysql = ipcLogFunc('初始化 MySQL', async (
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
    return invokeCommand('initialize_mysql', { environmentId, serviceData, rootPassword, port, bindAddress, reset })
})

export const ipcCheckMysqlInitialized = ipcLogFunc('检查 MySQL 是否已初始化', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ initialized: boolean }>> => {
    return invokeCommand('check_mysql_initialized', { environmentId, serviceData })
})

export const ipcListMysqlDatabases = ipcLogFunc('列出 MySQL 数据库', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ databases: string[] }>> => {
    return invokeCommand('list_mysql_databases', { environmentId, serviceData })
})

export const ipcCreateMysqlDatabase = ipcLogFunc('创建 MySQL 数据库', async (environmentId: string, serviceData: ServiceData, databaseName: string): Promise<IPCResult<{ database: string }>> => {
    return invokeCommand('create_mysql_database', { environmentId, serviceData, databaseName })
})

export const ipcListMysqlTables = ipcLogFunc('列出 MySQL 表', async (environmentId: string, serviceData: ServiceData, databaseName: string): Promise<IPCResult<{ tables: string[] }>> => {
    return invokeCommand('list_mysql_tables', { environmentId, serviceData, databaseName })
})

export const ipcOpenMysqlClient = ipcLogFunc('打开 MySQL 客户端', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ connectionString: string }>> => {
    return invokeCommand('open_mysql_client', { environmentId, serviceData })
})
