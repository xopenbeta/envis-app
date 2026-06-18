import { IPCResult } from "@/types/ipc"
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../utils/logger'
import { closeTooManyLogs } from "@/utils/const"

export const ipcGetSystemInfo = ipcLogFunc('获取系统信息', async (): Promise<IPCResult<{
    cpu_usage: number,
    cpu_count: number,
    cpu_brand: string,
    memory_total: number,
    memory_used: number,
    memory_available: number,
    memory_usage_percent: number,
    disks: Array<{
        name: string,
        mount_point: string,
        total_space: number,
        available_space: number,
        used_space: number,
        usage_percent: number,
        file_system: string,
    }>,
    network_interfaces: Array<{
        name: string,
        bytes_received: number,
        bytes_transmitted: number,
        packets_received: number,
        packets_transmitted: number,
        errors_on_received: number,
        errors_on_transmitted: number,
    }>,
    ip_addresses: string[],
    uptime: number,
    os_name: string,
    hostname: string,
}>> => {
    return invokeCommand('get_system_info')
}, closeTooManyLogs)

export const ipcOpenTerminal = ipcLogFunc('打开终端', async (): Promise<IPCResult> => {
    return invokeCommand('open_terminal')
})

export const ipcToggleDevTools = ipcLogFunc('切换开发者工具', async (): Promise<IPCResult> => {
    return invokeCommand('toggle_dev_tools');
})

export const ipcQuitApp = ipcLogFunc('退出应用程序', async (): Promise<IPCResult> => {
    return invokeCommand('quit_app');
})

export const ipcOpenSystemEnvSettings = ipcLogFunc('打开系统环境变量设置', async (): Promise<IPCResult> => {
    return invokeCommand('open_system_env_settings');
})
