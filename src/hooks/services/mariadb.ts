import { ServiceData } from "@/types/index";
import { 
    ipcGetMariadbConfig,
    ipcSetMariadbDataPath,
    ipcSetMariadbLogPath,
    ipcSetMariadbPort,
    ipcGetMariadbServiceStatus,
    ipcStartMariadbService,
    ipcStopMariadbService,
    ipcRestartMariadbService,
    ipcInitializeMariadb,
    ipcCheckMariadbInitialized,
    ipcListMariadbDatabases,
    ipcCreateMariadbDatabase,
    ipcListMariadbTables,
    ipcOpenMariadbClient,
} from "../../ipc/services/mariadb";

// MariaDB 配置接口
export interface MariaDBConfig {
    configPath: string
    dataPath: string
    logPath: string
    port: number
    bindIp: string
    isRunning: boolean
}

/**
 * 获取 MariaDB 配置信息
 */
export async function getMariadbConfig(environmentId: string, serviceData: ServiceData): Promise<{
    success: boolean
    message: string
    config?: MariaDBConfig
}> {
    const res = { success: false, message: '获取 MariaDB 配置失败' };
    
    try {
        const ipcRes = await ipcGetMariadbConfig(environmentId, serviceData);
        if (ipcRes.success) {
            const config: MariaDBConfig = {
                configPath: ipcRes.data?.configPath || '',
                dataPath: ipcRes.data?.dataPath || '',
                logPath: ipcRes.data?.logPath || '',
                port: ipcRes.data?.port || 3306,
                bindIp: ipcRes.data?.bindIp || 'localhost',
                isRunning: ipcRes.data?.isRunning || false
            };
            
            return {
                success: true,
                message: '获取 MariaDB 配置成功',
                config
            };
        } else {
            res.message = ipcRes.message || '获取 MariaDB 配置失败';
        }
    } catch (error) {
        res.message = `获取 MariaDB 配置失败: ${error}`;
    }
    
    return res;
}

/**
 * 设置 MariaDB 数据目录
 */
export async function setMariadbDataPath(
    environmentId: string, 
    serviceData: ServiceData, 
    dataPath: string
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '设置 MariaDB 数据目录失败' };
    
    try {
        const ipcRes = await ipcSetMariadbDataPath(environmentId, serviceData, dataPath);
        if (ipcRes.success) {
            res.success = true;
            res.message = '设置 MariaDB 数据目录成功';
        } else {
            res.message = ipcRes.message || '设置 MariaDB 数据目录失败';
        }
    } catch (error) {
        res.message = `设置 MariaDB 数据目录失败: ${error}`;
    }
    
    return res;
}

/**
 * 设置 MariaDB 日志目录
 */
export async function setMariadbLogPath(
    environmentId: string, 
    serviceData: ServiceData, 
    logPath: string
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '设置 MariaDB 日志目录失败' };
    
    try {
        const ipcRes = await ipcSetMariadbLogPath(environmentId, serviceData, logPath);
        if (ipcRes.success) {
            res.success = true;
            res.message = '设置 MariaDB 日志目录成功';
        } else {
            res.message = ipcRes.message || '设置 MariaDB 日志目录失败';
        }
    } catch (error) {
        res.message = `设置 MariaDB 日志目录失败: ${error}`;
    }
    
    return res;
}

/**
 * 设置 MariaDB 端口
 */
export async function setMariadbPort(
    environmentId: string, 
    serviceData: ServiceData, 
    port: number
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '设置 MariaDB 端口失败' };
    
    try {
        const ipcRes = await ipcSetMariadbPort(environmentId, serviceData, port);
        if (ipcRes.success) {
            res.success = true;
            res.message = '设置 MariaDB 端口成功';
        } else {
            res.message = ipcRes.message || '设置 MariaDB 端口失败';
        }
    } catch (error) {
        res.message = `设置 MariaDB 端口失败: ${error}`;
    }
    
    return res;
}

/**
 * 获取 MariaDB 服务状态
 */
export async function getMariadbServiceStatus(
    environmentId: string, 
    serviceData: ServiceData
): Promise<{
    success: boolean
    message: string
    isRunning?: boolean
    status?: string
}> {
    const res = { success: false, message: '获取 MariaDB 服务状态失败' };
    
    try {
        const ipcRes = await ipcGetMariadbServiceStatus(environmentId, serviceData);
        if (ipcRes.success) {
            return {
                success: true,
                message: '获取 MariaDB 服务状态成功',
                isRunning: ipcRes.data?.isRunning || false,
                status: ipcRes.data?.status || 'unknown'
            };
        } else {
            res.message = ipcRes.message || '获取 MariaDB 服务状态失败';
        }
    } catch (error) {
        res.message = `获取 MariaDB 服务状态失败: ${error}`;
    }
    
    return res;
}

/**
 * 启动 MariaDB 服务
 */
export async function startMariadbService(
    environmentId: string, 
    serviceData: ServiceData
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '启动 MariaDB 服务失败' };
    
    try {
        const ipcRes = await ipcStartMariadbService(environmentId, serviceData);
        if (ipcRes.success) {
            res.success = true;
            res.message = 'MariaDB 服务启动成功';
        } else {
            res.message = ipcRes.message || '启动 MariaDB 服务失败';
        }
    } catch (error) {
        res.message = `启动 MariaDB 服务失败: ${error}`;
    }
    
    return res;
}

/**
 * 停止 MariaDB 服务
 */
export async function stopMariadbService(
    environmentId: string, 
    serviceData: ServiceData
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '停止 MariaDB 服务失败' };
    
    try {
        const ipcRes = await ipcStopMariadbService(environmentId, serviceData);
        if (ipcRes.success) {
            res.success = true;
            res.message = 'MariaDB 服务已停止';
        } else {
            res.message = ipcRes.message || '停止 MariaDB 服务失败';
        }
    } catch (error) {
        res.message = `停止 MariaDB 服务失败: ${error}`;
    }
    
    return res;
}

/**
 * 重启 MariaDB 服务
 */
export async function restartMariadbService(
    environmentId: string, 
    serviceData: ServiceData
): Promise<{ success: boolean; message: string }> {
    const res = { success: false, message: '重启 MariaDB 服务失败' };
    
    try {
        const ipcRes = await ipcRestartMariadbService(environmentId, serviceData);
        if (ipcRes.success) {
            res.success = true;
            res.message = 'MariaDB 服务重启成功';
        } else {
            res.message = ipcRes.message || '重启 MariaDB 服务失败';
        }
    } catch (error) {
        res.message = `重启 MariaDB 服务失败: ${error}`;
    }
    
    return res;
}

/**
 * 初始化 MariaDB
 */
export async function initializeMariadb(
    environmentId: string,
    serviceData: ServiceData,
    rootPassword: string,
    port?: string,
    bindAddress?: string,
    reset?: boolean
) {
    return ipcInitializeMariadb(environmentId, serviceData, rootPassword, port, bindAddress, reset);
}

/**
 * 检查 MariaDB 是否已初始化
 */
export async function checkMariadbInitialized(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcCheckMariadbInitialized(environmentId, serviceData);
}

/**
 * 列出所有数据库
 */
export async function listMariadbDatabases(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcListMariadbDatabases(environmentId, serviceData);
}

/**
 * 创建数据库
 */
export async function createMariadbDatabase(
    environmentId: string,
    serviceData: ServiceData,
    databaseName: string
) {
    return ipcCreateMariadbDatabase(environmentId, serviceData, databaseName);
}

/**
 * 列出指定数据库的所有表
 */
export async function listMariadbTables(
    environmentId: string,
    serviceData: ServiceData,
    databaseName: string
) {
    return ipcListMariadbTables(environmentId, serviceData, databaseName);
}

/**
 * 打开 MariaDB 客户端
 */
export async function openMariadbClient(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcOpenMariadbClient(environmentId, serviceData);
}
