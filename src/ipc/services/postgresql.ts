import { ServiceData } from "@/types/index";
import { IPCResult } from "@/types/ipc";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'

export const ipcGetPostgresqlVersions = ipcLogFunc('获取 PostgreSQL 版本列表', async (): Promise<IPCResult> => {
    return invokeCommand('get_postgresql_versions')
})

export const ipcDownloadPostgresql = ipcLogFunc('下载 PostgreSQL', async (version: string): Promise<IPCResult> => {
    return invokeCommand('download_postgresql', { version })
})

export const ipcCancelPostgresqlDownload = ipcLogFunc('取消 PostgreSQL 下载', async (version: string): Promise<IPCResult> => {
    return invokeCommand('cancel_postgresql_download', { version })
})

export const ipcCheckPostgresqlInstalled = ipcLogFunc('检查 PostgreSQL 是否已安装', async (version: string): Promise<IPCResult> => {
    return invokeCommand('check_postgresql_installed', { version })
})

export const ipcGetPostgresqlDownloadProgress = ipcLogFunc('获取 PostgreSQL 下载进度', async (version: string): Promise<IPCResult> => {
    return invokeCommand('get_postgresql_download_progress', { version })
})

export const ipcStartPostgresqlService = ipcLogFunc('启动 PostgreSQL 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('start_postgresql_service', { environmentId, serviceData })
})

export const ipcStopPostgresqlService = ipcLogFunc('停止 PostgreSQL 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('stop_postgresql_service', { environmentId, serviceData })
})

export const ipcRestartPostgresqlService = ipcLogFunc('重启 PostgreSQL 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('restart_postgresql_service', { environmentId, serviceData })
})

export const ipcGetPostgresqlConfig = ipcLogFunc('获取 PostgreSQL 配置', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('get_postgresql_config', { environmentId, serviceData })
})

export const ipcSetPostgresqlDataPath = ipcLogFunc('设置 PostgreSQL 数据目录', async (environmentId: string, serviceData: ServiceData, dataPath: string): Promise<IPCResult> => {
    return invokeCommand('set_postgresql_data_path', { environmentId, serviceData, dataPath })
})

export const ipcSetPostgresqlPort = ipcLogFunc('设置 PostgreSQL 端口', async (environmentId: string, serviceData: ServiceData, port: number): Promise<IPCResult> => {
    return invokeCommand('set_postgresql_port', { environmentId, serviceData, port })
})

export const ipcGetPostgresqlServiceStatus = ipcLogFunc('获取 PostgreSQL 服务状态', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('get_postgresql_service_status', { environmentId, serviceData })
})

export const ipcInitializePostgresql = ipcLogFunc('初始化 PostgreSQL', async (
    environmentId: string,
    serviceData: ServiceData,
    superPassword: string,
    port?: string,
    bindAddress?: string,
    reset?: boolean
): Promise<IPCResult<{
    configPath: string;
    dataPath: string;
    logPath: string;
    superPassword: string;
    port: string;
    bindAddress: string;
}>> => {
    return invokeCommand('initialize_postgresql', { environmentId, serviceData, superPassword, port, bindAddress, reset })
})

export const ipcCheckPostgresqlInitialized = ipcLogFunc('检查 PostgreSQL 是否已初始化', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ initialized: boolean }>> => {
    return invokeCommand('check_postgresql_initialized', { environmentId, serviceData })
})

export const ipcListPostgresqlDatabases = ipcLogFunc('列出 PostgreSQL 数据库', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ databases: string[] }>> => {
    return invokeCommand('list_postgresql_databases', { environmentId, serviceData })
})

export const ipcCreatePostgresqlDatabase = ipcLogFunc('创建 PostgreSQL 数据库', async (environmentId: string, serviceData: ServiceData, databaseName: string): Promise<IPCResult<{ database: string }>> => {
    return invokeCommand('create_postgresql_database', { environmentId, serviceData, databaseName })
})

export const ipcListPostgresqlTables = ipcLogFunc('列出 PostgreSQL 表', async (environmentId: string, serviceData: ServiceData, databaseName: string): Promise<IPCResult<{ tables: string[] }>> => {
    return invokeCommand('list_postgresql_tables', { environmentId, serviceData, databaseName })
})

export const ipcOpenPostgresqlClient = ipcLogFunc('打开 PostgreSQL 客户端', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ port: string }>> => {
    return invokeCommand('open_postgresql_client', { environmentId, serviceData })
})

export const ipcListPostgresqlRoles = ipcLogFunc('列出 PostgreSQL 角色', async (
    environmentId: string,
    serviceData: ServiceData
): Promise<IPCResult<{
    roles: Array<{
        roleName: string
        grants: Array<{ database: string; privilege: string }>
    }>
}>> => {
    return invokeCommand('list_postgresql_roles', { environmentId, serviceData })
})

export const ipcCreatePostgresqlRole = ipcLogFunc('创建 PostgreSQL 角色', async (
    environmentId: string,
    serviceData: ServiceData,
    roleName: string,
    password: string,
    grants: Array<{ database: string; privilege: string }>
): Promise<IPCResult<{ roleName: string }>> => {
    return invokeCommand('create_postgresql_role', { environmentId, serviceData, roleName, password, grants })
})

export const ipcDeletePostgresqlRole = ipcLogFunc('删除 PostgreSQL 角色', async (
    environmentId: string,
    serviceData: ServiceData,
    roleName: string
): Promise<IPCResult<{ roleName: string }>> => {
    return invokeCommand('delete_postgresql_role', { environmentId, serviceData, roleName })
})

export const ipcUpdatePostgresqlRoleGrants = ipcLogFunc('更新 PostgreSQL 角色权限', async (
    environmentId: string,
    serviceData: ServiceData,
    roleName: string,
    grants: Array<{ database: string; privilege: string }>
): Promise<IPCResult<{ roleName: string }>> => {
    return invokeCommand('update_postgresql_role_grants', { environmentId, serviceData, roleName, grants })
})
