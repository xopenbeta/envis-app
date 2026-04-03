import { ServiceData } from "@/types/index";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'
import { IPCResult } from "@/types/ipc";

export const ipcGetRedisConfig = ipcLogFunc('获取 Redis 配置', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{
  configPath: string
  dataPath: string
  logPath: string
  port: number
  bindIp: string
  password: string
  content: string
  isRunning: boolean
}>> => {
    return invokeCommand('get_redis_config', { environmentId, serviceData })
})

export const ipcInitializeRedis = ipcLogFunc('初始化 Redis', async (
    environmentId: string,
    serviceData: ServiceData,
    password?: string,
    port?: string,
    bindIp?: string,
    reset?: boolean,
): Promise<IPCResult<{
    configPath: string
    dataPath: string
    logPath: string
    password: string
    port: string
    bindIp: string
}>> => {
    return invokeCommand('initialize_redis', { environmentId, serviceData, password, port, bindIp, reset })
})

export const ipcCheckRedisInitialized = ipcLogFunc('检查 Redis 是否已初始化', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ initialized: boolean }>> => {
    return invokeCommand('check_redis_initialized', { environmentId, serviceData })
})
