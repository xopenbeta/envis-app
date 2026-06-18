import { ServiceData } from "@/types/index";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'
import { IPCResult } from "@/types/ipc";

export const ipcCheckRustInstalled = ipcLogFunc('检查 Rust 是否已安装', async (version: string): Promise<IPCResult<{ installed: boolean }>> => {
    return invokeCommand('check_rust_installed', { version })
})

export const ipcGetRustVersions = ipcLogFunc('获取 Rust 版本列表', async (): Promise<IPCResult<{
    versions: Array<{
        version: string
        releaseDate: string
    }>
}>> => {
    return invokeCommand('get_rust_versions')
})

export const ipcDownloadRust = ipcLogFunc('下载 Rust', async (version: string): Promise<IPCResult<{ task: any }>> => {
    return invokeCommand('download_rust', { version })
})

export const ipcCancelDownloadRust = ipcLogFunc('取消下载 Rust', async (version: string): Promise<IPCResult<{ cancelled: boolean }>> => {
    return invokeCommand('cancel_download_rust', { version })
})

export const ipcGetRustDownloadProgress = ipcLogFunc('获取 Rust 下载进度', async (version: string): Promise<IPCResult<{ task: any }>> => {
    return invokeCommand('get_rust_download_progress', { version })
})

export const ipcGetRustInfo = ipcLogFunc('获取 Rust 信息', async (serviceData: ServiceData): Promise<IPCResult<{
    rustcVersion: string
    cargoVersion: string
    rustHome: string
    cargoHome?: string
}>> => {
    return invokeCommand('get_rust_info', { serviceData })
})

export const ipcSetCargoHome = ipcLogFunc('设置 CARGO_HOME', async (environmentId: string, serviceData: ServiceData, cargoHome: string): Promise<IPCResult> => {
    return invokeCommand('set_cargo_home', { environmentId, serviceData, cargoHome })
})
