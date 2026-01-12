import { Service, DownloadStatus, ServiceStatus, ServiceData } from "@/types/index"
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../utils/logger'
import { IPCResult } from "@/types/ipc"
import { closeTooManyLogs } from "@/utils/const"

export interface DownloadTask {
    id: string
    total_size: number
    downloaded_size: number
} 

export const ipcGetAllInstalledServices = ipcLogFunc('获取所有已安装服务', async (): Promise<IPCResult<{services: Service[]}>> => {
    return invokeCommand('get_all_installed_services')
})

export const ipcGetServiceVersions = ipcLogFunc('获取服务版本列表', async (serviceType: string): Promise<IPCResult<{versions: Array<{version: string; date?: string; lts?: boolean}>}>> => {
    return invokeCommand(`get_${serviceType}_versions`)
})

export const ipcCheckServiceInstalled = ipcLogFunc('检查服务是否已安装', async (serviceType: string, version: string): Promise<IPCResult<{installed: boolean}>> => {
    return invokeCommand(`check_${serviceType}_installed`, { version })
}, closeTooManyLogs)

export const ipcGetServiceSize = ipcLogFunc('获取服务大小', async (serviceType: string, version: string): Promise<IPCResult<{
    size: number
    sizeFormatted: string
}>> => {
    return invokeCommand('get_service_size', { serviceType, version })
})

export const ipcDownloadService = ipcLogFunc('下载服务', async (serviceType: string, version: string, buildMethod: 'prebuilt' | 'from_source' = 'prebuilt'): Promise<IPCResult<{task: DownloadTask}>> => {
    return invokeCommand(`download_${serviceType}`, { version, buildMethod })
})

export const ipcCancelServiceDownload = ipcLogFunc('取消服务下载', async (serviceType: string, version: string): Promise<IPCResult<undefined>> => {
    return invokeCommand(`cancel_download_${serviceType}`, { version })
})

export const ipcGetServiceDownloadProgress = ipcLogFunc('获取服务下载进度', async (serviceType: string, version: string): Promise<IPCResult<{task?: {
    id: string
    total_size: number
    downloaded_size: number
    status: DownloadStatus
    progress: number
}}>> => {
    return invokeCommand(`get_${serviceType}_download_progress`, { version })
}, closeTooManyLogs)

export const ipcDeleteService = ipcLogFunc('删除服务', async (serviceType: string, version: string): Promise<IPCResult<undefined>> => {
    return invokeCommand('delete_service', { serviceType, version })
})

export const ipcGetServiceStatus = ipcLogFunc('获取服务状态', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{
    status: ServiceStatus
}>> => {
    return invokeCommand(`get_${serviceData.type}_service_status`, { environmentId, serviceData })
}, true)
