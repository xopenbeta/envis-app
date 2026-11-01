import { ServiceData } from "@/types/index";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'
import { IPCResult } from "@/types/ipc";

export const ipcGetApacheConfig = ipcLogFunc('获取 Apache 配置', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{
  content: string
  path: string
}>> => {
    return invokeCommand(`get_apache_config`, { environmentId, serviceData })
})

export const ipcValidateApacheConfig = ipcLogFunc('校验 Apache 配置', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{
  valid: boolean
  stdout: string
  stderr: string
}>> => {
    return invokeCommand(`validate_apache_config`, { environmentId, serviceData })
})
