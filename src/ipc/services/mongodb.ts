import { ServiceData } from '@/types'
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '@/utils/logger'
import { IPCResult } from '@/types/ipc'
import { listen, UnlistenFn } from '@tauri-apps/api/event'

export const ipcGetMongoConfig = ipcLogFunc('获取 MongoDB 配置', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ content: string }>> => {
    return invokeCommand('get_mongodb_config', { environmentId, serviceData })
})

export const ipcOpenMongoDBCompass = ipcLogFunc('打开 MongoDB Compass', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ connectionString: string }>> => {
    return invokeCommand('open_mongodb_compass', { environmentId, serviceData })
})

export const ipcOpenMongoDBShell = ipcLogFunc('打开 Mongo Shell', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ connectionString: string }>> => {
    return invokeCommand('open_mongodb_shell', { environmentId, serviceData })
})

export const ipcInitializeMongoDB = ipcLogFunc('初始化 MongoDB', async (
    environmentId: string,
    serviceData: ServiceData,
    adminUsername: string,
    adminPassword: string,
    port?: string,
    bindIp?: string,
    enableReplicaSet?: boolean,
    reset?: boolean
): Promise<IPCResult<{
    configPath: string;
    dataPath: string;
    logPath: string;
    keyfilePath: string;
    adminUsername: string;
    adminPassword: string;
    port: string;
    bindIp: string;
    replicaSetInitialized: boolean
}>> => {
    return invokeCommand('initialize_mongodb', { environmentId, serviceData, adminUsername, adminPassword, port, bindIp, enableReplicaSet, reset })
})

export const ipcCheckMongoDBInitialized = ipcLogFunc('检查 MongoDB 是否已初始化', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ initialized: boolean }>> => {
    return invokeCommand('check_mongodb_initialized', { environmentId, serviceData })
})

export const ipcListMongoDBDatabases = ipcLogFunc('列出 MongoDB 数据库', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ databases: Array<{ name: string, sizeOnDisk: number, empty: boolean }> }>> => {
    return invokeCommand('list_mongodb_databases', { environmentId, serviceData })
})

export const ipcListMongoDBCollections = ipcLogFunc('列出 MongoDB 集合', async (environmentId: string, serviceData: ServiceData, databaseName: string): Promise<IPCResult<{ collections: string[] }>> => {
    return invokeCommand('list_mongodb_collections', { environmentId, serviceData, databaseName })
})

export const ipcCreateMongoDBDatabase = ipcLogFunc('创建 MongoDB 数据库', async (environmentId: string, serviceData: ServiceData, databaseName: string): Promise<IPCResult<{ database: string }>> => {
    return invokeCommand('create_mongodb_database', { environmentId, serviceData, databaseName })
})

export const ipcCreateMongoDBUser = ipcLogFunc('创建 MongoDB 用户', async (
    environmentId: string,
    serviceData: ServiceData,
    username: string,
    password: string,
    databases: string[],
    roles: string[]
): Promise<IPCResult<{ username: string; databases: string[]; roles: string[] }>> => {
    return invokeCommand('create_mongodb_user', { environmentId, serviceData, username, password, databases, roles })
})

export const ipcListMongoDBUsers = ipcLogFunc('列出 MongoDB 用户', async (
    environmentId: string,
    serviceData: ServiceData
): Promise<IPCResult<{
    users: Array<{
        _id: string;
        user: string;
        db: string;
        roles: Array<{ role: string; db: string }>;
    }>
}>> => {
    return invokeCommand('list_mongodb_users', { environmentId, serviceData })
})

export const ipcUpdateMongoDBUserRoles = ipcLogFunc('更新 MongoDB 用户权限', async (
    environmentId: string,
    serviceData: ServiceData,
    username: string,
    databases: string[],
    roles: string[]
): Promise<IPCResult<{ username: string; databases: string[]; roles: string[] }>> => {
    return invokeCommand('update_mongodb_user_roles', { environmentId, serviceData, username, databases, roles })
})

export const ipcDeleteMongoDBUser = ipcLogFunc('删除 MongoDB 用户', async (
    environmentId: string,
    serviceData: ServiceData,
    username: string
): Promise<IPCResult<{ username: string }>> => {
    return invokeCommand('delete_mongodb_user', { environmentId, serviceData, username })
})

/**
 * 监听 MongoDB 初始化进度事件
 */
export async function ipcListenMongoDBInitProgress(
    callback: (payload: { step: string; message: string }) => void
): Promise<UnlistenFn> {
    return await listen<{ step: string; message: string }>('mongodb-init-progress', (event) => {
        console.log('收到 MongoDB 初始化进度:', event.payload);
        callback(event.payload);
    });
}

