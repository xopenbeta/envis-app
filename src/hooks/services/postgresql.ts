import { ServiceData } from "@/types/index";
import { 
    ipcGetPostgresqlConfig,
    ipcSetPostgresqlDataPath,
    ipcSetPostgresqlPort,
    ipcGetPostgresqlServiceStatus,
    ipcStartPostgresqlService,
    ipcStopPostgresqlService,
    ipcRestartPostgresqlService
} from "../../ipc/services/postgresql";

// PostgreSQL 配置接口
export interface PostgreSQLConfig {
    dataPath: string
    port: number
    isRunning: boolean
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
                dataPath: ipcRes.data?.dataPath || '',
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

export function usePostgresqlService() {
    return {
        getPostgresqlConfig,
        setPostgresqlDataPath,
        setPostgresqlPort,
        getPostgresqlServiceStatus,
        startPostgresqlService,
        stopPostgresqlService,
        restartPostgresqlService
    }
}
