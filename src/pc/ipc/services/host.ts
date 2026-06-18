import { HostEntry } from "@/types/index";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'
import { IPCResult } from "@/types/ipc";

export const ipcGetHosts = ipcLogFunc('获取 hosts 列表', async (): Promise<IPCResult> => {
    return invokeCommand(`get_hosts`, {})
})

export const ipcAddHost = ipcLogFunc('添加 host 条目', async (
    entry: HostEntry,
    password: string
): Promise<IPCResult> => {
    return invokeCommand(`add_host`, { entry, password })
})

export const ipcUpdateHost = ipcLogFunc('更新 host 条目', async (
    oldEntry: HostEntry,
    newEntry: HostEntry,
    password: string
): Promise<IPCResult> => {
    return invokeCommand(`update_host`, { oldEntry, newEntry, password })
})

export const ipcDeleteHost = ipcLogFunc('删除 host 条目', async (
    ip: string,
    hostname: string,
    password: string
): Promise<IPCResult> => {
    return invokeCommand(`delete_host`, { ip, hostname, password })
})

export const ipcToggleHost = ipcLogFunc('切换 host 启用状态', async (
    ip: string,
    hostname: string,
    password: string
): Promise<IPCResult> => {
    return invokeCommand(`toggle_host`, { ip, hostname, password })
})

export const ipcClearHosts = ipcLogFunc('清空所有 hosts', async (password: string): Promise<IPCResult> => {
    return invokeCommand(`clear_hosts`, { password })
})

export const ipcOpenHostsFile = ipcLogFunc('打开 hosts 文件所在文件夹', async (): Promise<IPCResult> => {
    return invokeCommand(`open_hosts_file`, {})
})
