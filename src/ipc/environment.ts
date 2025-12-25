import { Environment } from "@/types/index"
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../utils/logger'
import { IPCResult } from "@/types/ipc"

export const ipcGetAllEnvironments = ipcLogFunc('获取所有环境', async (): Promise<IPCResult<{ environments: Environment[] }>> => {
    return invokeCommand('get_all_environments')
})

export const ipcCreateEnvironment = ipcLogFunc('创建环境', async (environment: Environment): Promise<IPCResult<{ environment: Environment }>> => {
    return invokeCommand('create_environment', { environment })
})

export const ipcSaveEnvironment = ipcLogFunc('保存环境', async (environment: Environment): Promise<IPCResult<{ env: Environment }>> => {
    return invokeCommand('save_environment', { environment })
})

export const ipcDeleteEnvironment = ipcLogFunc('删除环境', async (environment: Environment): Promise<IPCResult<undefined>> => {
    return invokeCommand('delete_environment', { environment })
})

export const ipcEnvironmentExists = ipcLogFunc('环境是否存在', async (environment: Environment): Promise<IPCResult<{ exists: boolean }>> => {
    return invokeCommand('is_environment_exists', { environment })
})

export const ipcActivateEnvironment = ipcLogFunc('激活环境', async (environment: Environment): Promise<IPCResult<{ env: Environment }>> => {
    return invokeCommand('activate_environment', { environment })
})

export const ipcDeactivateEnvironment = ipcLogFunc('停用环境', async (environment: Environment): Promise<IPCResult<{ env: Environment }>> => {
    return invokeCommand('deactivate_environment', { environment })
})
