import { ServiceData } from "@/types/index";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'
import { IPCResult } from "@/types/ipc";

export const ipcUpdateCustomServicePaths = ipcLogFunc('更新自定义服务路径配置', async (
    environmentId: string,
    serviceData: ServiceData,
    oldPaths: string[],
    paths: string[]
): Promise<IPCResult> => {
    return invokeCommand(`update_custom_service_paths`, { environmentId, serviceData, oldPaths, paths })
})

export const ipcUpdateCustomServiceEnvVars = ipcLogFunc('更新自定义服务环境变量配置', async (
    environmentId: string,
    serviceData: ServiceData,
    oldEnvVars: Record<string, string>,
    envVars: Record<string, string>
): Promise<IPCResult> => {
    return invokeCommand(`update_custom_service_env_vars`, { environmentId, serviceData, oldEnvVars, envVars })
})

export const ipcUpdateCustomServiceAliases = ipcLogFunc('更新自定义服务 Alias 配置', async (
    environmentId: string,
    serviceData: ServiceData,
    oldAliases: Record<string, string>,
    aliases: Record<string, string>
): Promise<IPCResult> => {
    return invokeCommand(`update_custom_service_aliases`, { environmentId, serviceData, oldAliases, aliases })
})

export const ipcExecuteCustomServiceAlias = ipcLogFunc('执行自定义服务 Alias 命令', async (
    aliasName: string,
    command: string
): Promise<IPCResult> => {
    return invokeCommand(`execute_custom_service_alias`, { aliasName, command })
})