import { ServiceData } from "@/types/index";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'
import { IPCResult } from "@/types/ipc";

export const ipcCheckPackageManagers = ipcLogFunc('检查包管理器', async (version: string): Promise<IPCResult<{ packageManagers: {
  npm: boolean
  yarn: boolean
  cnpm: boolean
  pnpm: boolean
} }>> => {
    return invokeCommand('check_nodejs_package_managers', { version })
})

export const ipcGetNpmConfig = ipcLogFunc('获取包管理器配置', async (manager: string): Promise<IPCResult<{
  registry: string
  configPrefix: string
}>> => {
    return invokeCommand(`get_nodejs_manager_config`, { manager })
})

export const ipcSetNpmRegistry = ipcLogFunc('设置包管理器镜像源', async (environmentId: string, serviceData: ServiceData, registry: string): Promise<IPCResult> => {
  return invokeCommand(`set_npm_registry`, { environmentId, serviceData, registry })
})

export const ipcSetNpmConfigPrefix = ipcLogFunc('设置包管理器前缀', async (environmentId: string, serviceData: ServiceData, configPrefix: string): Promise<IPCResult> => {
  return invokeCommand(`set_npm_config_prefix`, { environmentId, serviceData, configPrefix })
})

export const ipcGetGlobalNpmPackages = ipcLogFunc('获取全局 npm 包', async (serviceData: ServiceData): Promise<IPCResult<{ packages: Array<{ name: string, version: string }> }>> => {
  return invokeCommand(`get_global_npm_packages`, { serviceData })
})
