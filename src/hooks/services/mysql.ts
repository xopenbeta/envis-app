import { ServiceData } from "@/types/index";
import { 
    ipcGetMysqlConfig,
    ipcSetMysqlDataPath,
    ipcSetMysqlLogPath,
    ipcSetMysqlPort,
    ipcGetMysqlServiceStatus,
    ipcStartMysqlService,
    ipcStopMysqlService,
    ipcRestartMysqlService,
    ipcInitializeMysql,
    ipcCheckMysqlInitialized,
    ipcListMysqlDatabases,
    ipcCreateMysqlDatabase,
    ipcListMysqlTables,
    ipcOpenMysqlClient,
} from "../../ipc/services/mysql";

// MySQL 配置接口
export interface MySQLConfig {
    configPath: string
    dataPath: string
    logPath: string
    port: number
    bindIp: string
    isRunning: boolean
}

/**
 * 获取 MySQL 配置信息
 */
export async function getMysqlConfig(environmentId: string, serviceData: ServiceData): Promise<{
    success: boolean
    message: string
    config?: MySQLConfig
}> {
    const res = { success: false, message: '获取 MySQL 配置失败' };
    
    try {
        const ipcRes = await ipcGetMysqlConfig(environmentId, serviceData);
        if (ipcRes.success) {
            const config: MySQLConfig = {
                configPath: ipcRes.data?.configPath || '',
                dataPath: ipcRes.data?.dataPath || '',
                logPath: ipcRes.data?.logPath || '',
                port: ipcRes.data?.port || 3306,
                bindIp: ipcRes.data?.bindIp || 'localhost',
                isRunning: ipcRes.data?.isRunning || false
            };
            
            return {
                success: true,
                message: '获取 MySQL 配置成功',
                config
            };
        } else {
            res.message = ipcRes.message || '获取 MySQL 配置失败';
        }
    } catch (error) {
        res.message = `获取 MySQL 配置失败: ${error}`;
    }
    
    return res;
}

/**
 * 设置 MySQL 数据目录
 */
export async function setMysqlDataPath(
    environmentId: string, 
    serviceData: ServiceData, 
    dataPath: string
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '设置 MySQL 数据目录失败' };
    
    try {
        const ipcRes = await ipcSetMysqlDataPath(environmentId, serviceData, dataPath);
        if (ipcRes.success) {
            res.success = true;
            res.message = '设置 MySQL 数据目录成功';
        } else {
            res.message = ipcRes.message || '设置 MySQL 数据目录失败';
        }
    } catch (error) {
        res.message = `设置 MySQL 数据目录失败: ${error}`;
    }
    
    return res;
}

/**
 * 设置 MySQL 日志目录
 */
export async function setMysqlLogPath(
    environmentId: string, 
    serviceData: ServiceData, 
    logPath: string
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '设置 MySQL 日志目录失败' };
    
    try {
        const ipcRes = await ipcSetMysqlLogPath(environmentId, serviceData, logPath);
        if (ipcRes.success) {
            res.success = true;
            res.message = '设置 MySQL 日志目录成功';
        } else {
            res.message = ipcRes.message || '设置 MySQL 日志目录失败';
        }
    } catch (error) {
        res.message = `设置 MySQL 日志目录失败: ${error}`;
    }
    
    return res;
}

/**
 * 设置 MySQL 端口
 */
export async function setMysqlPort(
    environmentId: string, 
    serviceData: ServiceData, 
    port: number
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '设置 MySQL 端口失败' };
    
    try {
        const ipcRes = await ipcSetMysqlPort(environmentId, serviceData, port);
        if (ipcRes.success) {
            res.success = true;
            res.message = '设置 MySQL 端口成功';
        } else {
            res.message = ipcRes.message || '设置 MySQL 端口失败';
        }
    } catch (error) {
        res.message = `设置 MySQL 端口失败: ${error}`;
    }
    
    return res;
}

/**
 * 获取 MySQL 服务状态
 */
export async function getMysqlServiceStatus(
    environmentId: string, 
    serviceData: ServiceData
): Promise<{
    success: boolean
    message: string
    isRunning?: boolean
    status?: string
}> {
    const res = { success: false, message: '获取 MySQL 服务状态失败' };
    
    try {
        const ipcRes = await ipcGetMysqlServiceStatus(environmentId, serviceData);
        if (ipcRes.success) {
            return {
                success: true,
                message: '获取 MySQL 服务状态成功',
                isRunning: ipcRes.data?.isRunning || false,
                status: ipcRes.data?.status || 'unknown'
            };
        } else {
            res.message = ipcRes.message || '获取 MySQL 服务状态失败';
        }
    } catch (error) {
        res.message = `获取 MySQL 服务状态失败: ${error}`;
    }
    
    return res;
}

/**
 * 启动 MySQL 服务
 */
export async function startMysqlService(
    environmentId: string, 
    serviceData: ServiceData
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '启动 MySQL 服务失败' };
    
    try {
        const ipcRes = await ipcStartMysqlService(environmentId, serviceData);
        if (ipcRes.success) {
            res.success = true;
            res.message = 'MySQL 服务启动成功';
        } else {
            res.message = ipcRes.message || '启动 MySQL 服务失败';
        }
    } catch (error) {
        res.message = `启动 MySQL 服务失败: ${error}`;
    }
    
    return res;
}

/**
 * 停止 MySQL 服务
 */
export async function stopMysqlService(
    environmentId: string, 
    serviceData: ServiceData
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '停止 MySQL 服务失败' };
    
    try {
        const ipcRes = await ipcStopMysqlService(environmentId, serviceData);
        if (ipcRes.success) {
            res.success = true;
            res.message = 'MySQL 服务停止成功';
        } else {
            res.message = ipcRes.message || '停止 MySQL 服务失败';
        }
    } catch (error) {
        res.message = `停止 MySQL 服务失败: ${error}`;
    }
    
    return res;
}

/**
 * 重启 MySQL 服务
 */
export async function restartMysqlService(
    environmentId: string, 
    serviceData: ServiceData
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '重启 MySQL 服务失败' };
    
    try {
        const ipcRes = await ipcRestartMysqlService(environmentId, serviceData);
        if (ipcRes.success) {
            res.success = true;
            res.message = 'MySQL 服务重启成功';
        } else {
            res.message = ipcRes.message || '重启 MySQL 服务失败';
        }
    } catch (error) {
        res.message = `重启 MySQL 服务失败: ${error}`;
    }
    
    return res;
}

/**
 * 初始化 MySQL
 */
export async function initializeMysql(
    environmentId: string,
    serviceData: ServiceData,
    rootPassword: string,
    port?: string,
    bindAddress?: string,
    reset?: boolean
) {
    return ipcInitializeMysql(environmentId, serviceData, rootPassword, port, bindAddress, reset);
}

/**
 * 检查 MySQL 是否已初始化
 */
export async function checkMysqlInitialized(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcCheckMysqlInitialized(environmentId, serviceData);
}

/**
 * 列出所有数据库
 */
export async function listMysqlDatabases(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcListMysqlDatabases(environmentId, serviceData);
}

/**
 * 创建数据库
 */
export async function createMysqlDatabase(
    environmentId: string,
    serviceData: ServiceData,
    databaseName: string
) {
    return ipcCreateMysqlDatabase(environmentId, serviceData, databaseName);
}

/**
 * 列出指定数据库的所有表
 */
export async function listMysqlTables(
    environmentId: string,
    serviceData: ServiceData,
    databaseName: string
) {
    return ipcListMysqlTables(environmentId, serviceData, databaseName);
}

/**
 * 打开 MySQL 客户端
 */
export async function openMysqlClient(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcOpenMysqlClient(environmentId, serviceData);
}
