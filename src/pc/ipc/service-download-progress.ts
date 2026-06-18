import { invokeCommand } from '@/lib/tauri-api'
import { ServiceDownloadProgress, ServiceType } from '@/types/index'
import { ipcLogFunc } from '../utils/logger'
import { IPCResult } from '@/types/ipc'

export const getServiceDownloadProgressIpc = ipcLogFunc('获取所有服务下载进度', async (): Promise<IPCResult<ServiceDownloadProgress[]>> => {
  return invokeCommand('get_service_download_progress')
})

export const ipcDownloadService = ipcLogFunc('下载服务', async (serviceType: ServiceType, version: string): Promise<IPCResult> => {
  return await invokeCommand(`download_${serviceType}`, { version })
})

export const ipcCancelServiceDownload = ipcLogFunc('取消服务下载', async (serviceType: ServiceType, version: string): Promise<IPCResult> => {
  return await invokeCommand(`cancel_${serviceType}_download`, { version })
})
