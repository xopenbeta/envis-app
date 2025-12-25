import { ServiceData } from "@/types/index";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'
import { IPCResult } from "@/types/ipc";

export const ipcGetDnsmasqConfig = ipcLogFunc('获取 Dnsmasq 配置', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{
  content: string
  path?: string
}>> => {
    return invokeCommand(`get_dnsmasq_config`, { environmentId, serviceData })
})
