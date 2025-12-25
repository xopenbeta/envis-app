import { SystemSettings } from "@/types/index"
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../utils/logger'
import { IPCResult } from "@/types/ipc"

export const ipcGetSystemSettings = ipcLogFunc('获取系统设置', async (): Promise<IPCResult<{appConfig: SystemSettings}>> => {
    return invokeCommand('get_app_config')
})

export const ipcUpdateSystemSettings = ipcLogFunc('更新系统设置', async (systemSettings: SystemSettings): Promise<IPCResult> => {
    return invokeCommand('set_app_config', { appConfig: systemSettings })
})

export const ipcOpenAppConfigFolder = ipcLogFunc('打开应用配置文件夹', async (): Promise<IPCResult> => {
    return invokeCommand('open_app_config_folder')
})
