import { ServiceData, ServiceType } from "@/types/index"
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../utils/logger'
import { IPCResult } from "@/types/ipc";

export const ipcGetEnvAllServDatas = ipcLogFunc('获取环境所有服务数据', async (environmentId: string): Promise<IPCResult<{ serviceDatas: ServiceData[] }>> => {
    return invokeCommand('get_environment_all_service_datas', { environmentId });
})

export const ipcGetServiceData = ipcLogFunc('获取单个服务数据', async (environmentId: string, serviceId: string): Promise<IPCResult<{ serviceData: ServiceData }>> => {
    return invokeCommand('get_service_data', { environmentId, serviceId });
})

export const ipcCreateServiceData = ipcLogFunc('创建服务数据', async (
    environmentId: string,
    serviceType: ServiceType, 
    version: string
): Promise<IPCResult<{ serviceData: ServiceData }>> => {
    return invokeCommand('create_service_data', {  
        environmentId, 
        request: { type: serviceType, version } 
    });
})

export const ipcUpdateServiceData = ipcLogFunc('保存服务数据', async (environmentId: string, request: { id: string } & Partial<ServiceData>): Promise<IPCResult<undefined>> => {
    return invokeCommand('update_service_data', {  environmentId, request });
})

export const ipcDeleteServiceData = ipcLogFunc('删除服务数据', async (environmentId: string, serviceId: string): Promise<IPCResult<undefined>> => {
    return invokeCommand('delete_service_data', { environmentId, serviceId });
})

export const ipcActivateServiceData = ipcLogFunc('激活服务数据', async (environmentId: string, serviceData: ServiceData, password?: string): Promise<IPCResult<undefined>> => {
    return invokeCommand('active_service_data', { environmentId, serviceData, password })
})

export const ipcDeactivateServiceData = ipcLogFunc('停用服务数据', async (environmentId: string, serviceData: ServiceData, password?: string): Promise<IPCResult<undefined>> => {
    return invokeCommand('deactive_service_data', { environmentId, serviceData, password })
})

export const ipcStartServiceData = ipcLogFunc('启动服务数据', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<undefined>> => {
    return invokeCommand(`start_${serviceData.type}_service`, { environmentId, serviceData });
})

export const ipcStoppedServiceData = ipcLogFunc('停止服务数据', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<undefined>> => {
    return invokeCommand(`stop_${serviceData.type}_service`, { environmentId, serviceData })
})

export const ipcRestartServiceData = ipcLogFunc('重启服务数据', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<undefined>> => {
    return invokeCommand(`restart_${serviceData.type}_service`, { environmentId, serviceData });
})
