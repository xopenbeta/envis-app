import {
    ipcGetSystemInfo,
    ipcToggleDevTools,
    ipcOpenTerminal,
    ipcQuitApp,
    ipcOpenSystemEnvSettings
} from "../ipc/system-info";
import type { IPCResult } from '@/types/ipc'

export function useSystemInfo() {
    const getSystemInfo = async (): Promise<IPCResult<any>> => {
        const res = await ipcGetSystemInfo();

        // ipcGetSystemInfo 已经通过 ipcLogFunc 包装并返回 IPCResult
        // 但是若后端直接返回了原始 SystemInfo 对象（没有 success 字段），则做兼容处理
        if (res && typeof res === 'object' && 'success' in res) {
            return res as IPCResult<any>
        }

        // 兼容：后端直接返回数据对象
        if (res) {
            return { success: true, data: res } as IPCResult<any>
        }

        return { success: false, message: 'Empty response from ipcGetSystemInfo' }
    }

    const openTerminal = async () => {
        const res = await ipcOpenTerminal();
        if (res.success) {
            return res.data;
        } else {
            throw new Error(res.message || 'Failed to open terminal');
        }
    }

    const toggleDevTools = async () => {
        const res = await ipcToggleDevTools();
        return res;
    }

    const quitApp = async () => {
        const res = await ipcQuitApp();
        return res;
    }

    const openSystemEnvSettings = async () => {
        const res = await ipcOpenSystemEnvSettings();
        return res;
    }
    
    return {
        getSystemInfo,
        openTerminal,
        toggleDevTools,
        quitApp,
        openSystemEnvSettings
    }
}
