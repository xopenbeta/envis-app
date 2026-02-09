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

export const ipcSetPython3AsPython = ipcLogFunc('设置 python3 别名为 python', async (environmentId: string, serviceData: ServiceData, enable: boolean): Promise<IPCResult> => {
    return invokeCommand(`set_python3_as_python`, { environmentId, serviceData, enable })
})

export const ipcCheckPythonVenvSupport = ipcLogFunc('检查 venv 支持', async (version: string): Promise<IPCResult<{ supported: boolean }>> => {
    return invokeCommand(`check_python_venv_support`, { version })
})

export const ipcGetPythonVenvs = ipcLogFunc('获取 venv 列表', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ venvs: string[], venvsDir: string }>> => {
    return invokeCommand(`get_python_venvs`, { environmentId, serviceData })
})

export const ipcCreatePythonVenv = ipcLogFunc('创建 venv', async (environmentId: string, serviceData: ServiceData, venvName: string): Promise<IPCResult> => {
    return invokeCommand(`create_python_venv`, { environmentId, serviceData, venvName })
})

export const ipcRemovePythonVenv = ipcLogFunc('删除 venv', async (environmentId: string, serviceData: ServiceData, venvName: string): Promise<IPCResult> => {
    return invokeCommand(`remove_python_venv`, { environmentId, serviceData, venvName })
})
