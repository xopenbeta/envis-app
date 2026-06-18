import { ServiceData } from "@/types/index";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'
import { IPCResult } from "@/types/ipc";

export const ipcGetNginxConfig = ipcLogFunc('获取 Nginx 配置', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{
  content: string
}>> => {
    return invokeCommand(`get_nginx_config`, { environmentId, serviceData })
})
