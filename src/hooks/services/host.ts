import { HostEntry } from "@/types/index";
import { 
    ipcGetHosts, 
    ipcAddHost, 
    ipcUpdateHost, 
    ipcDeleteHost, 
    ipcToggleHost,
    ipcClearHosts,
    ipcOpenHostsFile
} from "../../ipc/services/host";

export function useHostService() {
    // 获取所有 host 条目
    async function getHosts() {
        const res = await ipcGetHosts();
        console.log(`[hooks/host] getHosts IPC 响应:`, res);
        return res;
    }

    // 添加 host 条目
    async function addHost(entry: HostEntry, password: string) {
        const res = await ipcAddHost(entry, password);
        console.log(`[hooks/host] addHost IPC 响应:`, res);
        return res;
    }

    // 更新 host 条目
    async function updateHost(oldEntry: HostEntry, newEntry: HostEntry, password: string) {
        const res = await ipcUpdateHost(oldEntry, newEntry, password);
        console.log(`[hooks/host] updateHost IPC 响应:`, res);
        return res;
    }

    // 删除 host 条目
    async function deleteHost(ip: string, hostname: string, password: string) {
        const res = await ipcDeleteHost(ip, hostname, password);
        console.log(`[hooks/host] deleteHost IPC 响应:`, res);
        return res;
    }

    // 切换 host 启用状态
    async function toggleHost(ip: string, hostname: string, password: string) {
        const res = await ipcToggleHost(ip, hostname, password);
        console.log(`[hooks/host] toggleHost IPC 响应:`, res);
        return res;
    }

    // 清空所有 host 条目
    async function clearHosts(password: string) {
        const res = await ipcClearHosts(password);
        console.log(`[hooks/host] clearHosts IPC 响应:`, res);
        return res;
    }

    // 打开 hosts 文件所在文件夹
    async function openHostsFile() {
        const res = await ipcOpenHostsFile();
        console.log(`[hooks/host] openHostsFile IPC 响应:`, res);
        return res;
    }

    return {
        getHosts,
        addHost,
        updateHost,
        deleteHost,
        toggleHost,
        clearHosts,
        openHostsFile,
    }
}
