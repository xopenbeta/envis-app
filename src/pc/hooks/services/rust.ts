import { ServiceData } from "@/types/index";
import {
    ipcCheckRustInstalled,
    ipcGetRustVersions,
    ipcDownloadRust,
    ipcCancelDownloadRust,
    ipcGetRustDownloadProgress,
    ipcGetRustInfo,
    ipcSetCargoHome,
} from "../../ipc/services/rust";

export function useRustService() {
    async function checkRustInstalled(version: string) {
        const ipcRes = await ipcCheckRustInstalled(version);
        console.log(`[hooks/rust] checkRustInstalled IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function getRustVersions() {
        const ipcRes = await ipcGetRustVersions();
        console.log(`[hooks/rust] getRustVersions IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function downloadRust(version: string) {
        const ipcRes = await ipcDownloadRust(version);
        console.log(`[hooks/rust] downloadRust IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function cancelDownloadRust(version: string) {
        const ipcRes = await ipcCancelDownloadRust(version);
        console.log(`[hooks/rust] cancelDownloadRust IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function getRustDownloadProgress(version: string) {
        const ipcRes = await ipcGetRustDownloadProgress(version);
        console.log(`[hooks/rust] getRustDownloadProgress IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function getRustInfo(serviceData: ServiceData) {
        const ipcRes = await ipcGetRustInfo(serviceData);
        console.log(`[hooks/rust] getRustInfo IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function setCargoHome(environmentId: string, serviceData: ServiceData, cargoHome: string) {
        const ipcRes = await ipcSetCargoHome(environmentId, serviceData, cargoHome);
        console.log(`[hooks/rust] setCargoHome IPC 响应:`, ipcRes);
        return ipcRes;
    }

    return {
        checkRustInstalled,
        getRustVersions,
        downloadRust,
        cancelDownloadRust,
        getRustDownloadProgress,
        getRustInfo,
        setCargoHome,
    };
}
