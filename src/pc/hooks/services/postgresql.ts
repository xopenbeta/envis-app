import { ServiceData } from "@/types/index";
import { 
    ipcGetPostgresqlConfig,
    ipcSetPostgresqlDataPath,
    ipcSetPostgresqlLogPath,
    ipcSetPostgresqlPort,
    ipcGetPostgresqlServiceStatus,
    ipcStartPostgresqlService,
    ipcStopPostgresqlService,
    ipcRestartPostgresqlService,
    ipcInitializePostgresql,
    ipcCheckPostgresqlInitialized,
    ipcListPostgresqlDatabases,
    ipcCreatePostgresqlDatabase,
    ipcListPostgresqlTables,
    ipcOpenPostgresqlClient,
    ipcListPostgresqlRoles,
    ipcCreatePostgresqlRole,
    ipcDeletePostgresqlRole,
    ipcUpdatePostgresqlRoleGrants,
} from "../../ipc/services/postgresql";

// PostgreSQL 配置接口
export interface PostgreSQLConfig {
    configPath?: string
    dataPath: string
    logPath?: string
    bindIp?: string
    port: number
    isRunning: boolean
}

export interface PostgreSQLGrant {
    database: string
    privilege: 'SELECT' | 'ALL PRIVILEGES'
}

export interface PostgreSQLRole {
    roleName: string
    grants: PostgreSQLGrant[]
}

/**
 * 获取 PostgreSQL 配置信息
 */
export async function getPostgresqlConfig(environmentId: string, serviceData: ServiceData): Promise<{
    success: boolean
    message: string
    config?: PostgreSQLConfig
}> {
    const res = { success: false, message: '获取 PostgreSQL 配置失败' };
    
    try {
        const ipcRes = await ipcGetPostgresqlConfig(environmentId, serviceData);
        if (ipcRes.success) {
            const config: PostgreSQLConfig = {
                configPath: ipcRes.data?.configPath || '',
                dataPath: ipcRes.data?.dataPath || '',
                logPath: ipcRes.data?.logPath || '',
                bindIp: ipcRes.data?.bindIp || '127.0.0.1',
                port: ipcRes.data?.port || 5432,
                isRunning: ipcRes.data?.isRunning || false
            };
            
            return {
                success: true,
                message: '获取 PostgreSQL 配置成功',
                config
            };
        } else {
            return {
                success: false,
                message: ipcRes.message || '获取 PostgreSQL 配置失败'
            };
        }
    } catch (error) {
        console.error('获取 PostgreSQL 配置失败:', error);
        return res;
    }
}

/**
 * 设置 PostgreSQL 数据目录
 */
export async function setPostgresqlDataPath(
    environmentId: string,
    serviceData: ServiceData,
    dataPath: string
): Promise<{ success: boolean; message: string }> {
    try {
        const ipcRes = await ipcSetPostgresqlDataPath(environmentId, serviceData, dataPath);
        return {
            success: ipcRes.success,
            message: ipcRes.message || (ipcRes.success ? '设置成功' : '设置失败')
        };
    } catch (error) {
        console.error('设置 PostgreSQL 数据目录失败:', error);
        return {
            success: false,
            message: '设置失败'
        };
    }
}

/**
 * 设置 PostgreSQL 日志路径
 */
export async function setPostgresqlLogPath(
    environmentId: string,
    serviceData: ServiceData,
    logPath: string
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '设置 PostgreSQL 日志路径失败' };

    try {
        const ipcRes = await ipcSetPostgresqlLogPath(environmentId, serviceData, logPath);
        if (ipcRes.success) {
            res.success = true;
            res.message = '设置 PostgreSQL 日志路径成功';
        } else {
            res.message = ipcRes.message || '设置 PostgreSQL 日志路径失败';
        }
    } catch (error) {
        res.message = `设置 PostgreSQL 日志路径失败: ${error}`;
    }

    return res;
}

/**
 * 设置 PostgreSQL 端口
 */
export async function setPostgresqlPort(
    environmentId: string,
    serviceData: ServiceData,
    port: number
): Promise<{ success: boolean; message: string }> {
    try {
        const ipcRes = await ipcSetPostgresqlPort(environmentId, serviceData, port);
        return {
            success: ipcRes.success,
            message: ipcRes.message || (ipcRes.success ? '设置成功' : '设置失败')
        };
    } catch (error) {
        console.error('设置 PostgreSQL 端口失败:', error);
        return {
            success: false,
            message: '设置失败'
        };
    }
}

/**
 * 获取 PostgreSQL 服务状态
 */
export async function getPostgresqlServiceStatus(
    environmentId: string,
    serviceData: ServiceData
): Promise<{ success: boolean; isRunning: boolean; message: string }> {
    try {
        const ipcRes = await ipcGetPostgresqlServiceStatus(environmentId, serviceData);
        return {
            success: ipcRes.success,
            isRunning: ipcRes.data?.isRunning || false,
            message: ipcRes.message || ''
        };
    } catch (error) {
        console.error('获取 PostgreSQL 服务状态失败:', error);
        return {
            success: false,
            isRunning: false,
            message: '获取状态失败'
        };
    }
}

/**
 * 启动 PostgreSQL 服务
 */
export async function startPostgresqlService(
    environmentId: string,
    serviceData: ServiceData
): Promise<{ success: boolean; message: string }> {
    try {
        const ipcRes = await ipcStartPostgresqlService(environmentId, serviceData);
        return {
            success: ipcRes.success,
            message: ipcRes.message || (ipcRes.success ? '启动成功' : '启动失败')
        };
    } catch (error) {
        console.error('启动 PostgreSQL 服务失败:', error);
        return {
            success: false,
            message: '启动失败'
        };
    }
}

/**
 * 停止 PostgreSQL 服务
 */
export async function stopPostgresqlService(
    environmentId: string,
    serviceData: ServiceData
): Promise<{ success: boolean; message: string }> {
    try {
        const ipcRes = await ipcStopPostgresqlService(environmentId, serviceData);
        return {
            success: ipcRes.success,
            message: ipcRes.message || (ipcRes.success ? '停止成功' : '停止失败')
        };
    } catch (error) {
        console.error('停止 PostgreSQL 服务失败:', error);
        return {
            success: false,
            message: '停止失败'
        };
    }
}

/**
 * 重启 PostgreSQL 服务
 */
export async function restartPostgresqlService(
    environmentId: string,
    serviceData: ServiceData
): Promise<{ success: boolean; message: string }> {
    try {
        const ipcRes = await ipcRestartPostgresqlService(environmentId, serviceData);
        return {
            success: ipcRes.success,
            message: ipcRes.message || (ipcRes.success ? '重启成功' : '重启失败')
        };
    } catch (error) {
        console.error('重启 PostgreSQL 服务失败:', error);
        return {
            success: false,
            message: '重启失败'
        };
    }
}

/**
 * 初始化 PostgreSQL
 */
export async function initializePostgresql(
    environmentId: string,
    serviceData: ServiceData,
    superPassword: string,
    port?: string,
    bindAddress?: string,
    reset?: boolean
) {
    return ipcInitializePostgresql(environmentId, serviceData, superPassword, port, bindAddress, reset);
}

/**
 * 检查 PostgreSQL 是否已初始化
 */
export async function checkPostgresqlInitialized(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcCheckPostgresqlInitialized(environmentId, serviceData);
}

/**
 * 列出 PostgreSQL 数据库
 */
export async function listPostgresqlDatabases(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcListPostgresqlDatabases(environmentId, serviceData);
}

/**
 * 创建 PostgreSQL 数据库
 */
export async function createPostgresqlDatabase(
    environmentId: string,
    serviceData: ServiceData,
    databaseName: string
) {
    return ipcCreatePostgresqlDatabase(environmentId, serviceData, databaseName);
}

/**
 * 列出 PostgreSQL 数据库表
 */
export async function listPostgresqlTables(
    environmentId: string,
    serviceData: ServiceData,
    databaseName: string
) {
    return ipcListPostgresqlTables(environmentId, serviceData, databaseName);
}

/**
 * 打开 PostgreSQL 客户端
 */
export async function openPostgresqlClient(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcOpenPostgresqlClient(environmentId, serviceData);
}

/**
 * 列出 PostgreSQL 角色
 */
export async function listPostgresqlRoles(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcListPostgresqlRoles(environmentId, serviceData);
}

/**
 * 创建 PostgreSQL 角色
 */
export async function createPostgresqlRole(
    environmentId: string,
    serviceData: ServiceData,
    roleName: string,
    password: string,
    grants: PostgreSQLGrant[]
) {
    return ipcCreatePostgresqlRole(environmentId, serviceData, roleName, password, grants);
}

/**
 * 删除 PostgreSQL 角色
 */
export async function deletePostgresqlRole(
    environmentId: string,
    serviceData: ServiceData,
    roleName: string
) {
    return ipcDeletePostgresqlRole(environmentId, serviceData, roleName);
}

/**
 * 更新 PostgreSQL 角色权限
 */
export async function updatePostgresqlRoleGrants(
    environmentId: string,
    serviceData: ServiceData,
    roleName: string,
    grants: PostgreSQLGrant[]
) {
    return ipcUpdatePostgresqlRoleGrants(environmentId, serviceData, roleName, grants);
}

export function usePostgresqlService() {
    return {
        getPostgresqlConfig,
        setPostgresqlDataPath,
        setPostgresqlLogPath,
        setPostgresqlPort,
        getPostgresqlServiceStatus,
        startPostgresqlService,
        stopPostgresqlService,
        restartPostgresqlService,
        initializePostgresql,
        checkPostgresqlInitialized,
        listPostgresqlDatabases,
        createPostgresqlDatabase,
        listPostgresqlTables,
        openPostgresqlClient,
        listPostgresqlRoles,
        createPostgresqlRole,
        deletePostgresqlRole,
        updatePostgresqlRoleGrants,
    }
}
