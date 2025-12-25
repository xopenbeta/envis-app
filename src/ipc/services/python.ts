import { ServiceData } from "@/types/index";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'
import { IPCResult } from "@/types/ipc";

export const ipcGetPipConfig = ipcLogFunc('获取 pip 配置', async (): Promise<IPCResult<{
  indexUrl: string
  trustedHost: string
}>> => {
    return invokeCommand(`get_python_pip_config`)
})

export const ipcSetPipIndexUrl = ipcLogFunc('设置 pip 镜像源', async (environmentId: string, serviceData: ServiceData, indexUrl: string): Promise<IPCResult> => {
    return invokeCommand(`set_pip_index_url`, { environmentId, serviceData, indexUrl })
})

export const ipcSetPipTrustedHost = ipcLogFunc('设置 pip 信任主机', async (environmentId: string, serviceData: ServiceData, trustedHost: string): Promise<IPCResult> => {
    return invokeCommand(`set_pip_trusted_host`, { environmentId, serviceData, trustedHost })
})
