import { ServiceData } from "@/types/index";
import { ipcGetPipConfig, ipcSetPipIndexUrl, ipcSetPipTrustedHost, ipcSetPython3AsPython } from "../../ipc/services/python";

export function usePythonService() {
    async function getPipConfig() {
        const ipcRes = await ipcGetPipConfig();
        console.log(`[hooks/python] getPipConfig IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function setPipIndexUrl(environmentId: string, serviceData: ServiceData, indexUrl: string) {
        const ipcRes = await ipcSetPipIndexUrl(environmentId, serviceData, indexUrl);
        console.log(`[hooks/python] setPipIndexUrl IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function setPipTrustedHost(environmentId: string, serviceData: ServiceData, trustedHost: string) {
        const ipcRes = await ipcSetPipTrustedHost(environmentId, serviceData, trustedHost);
        console.log(`[hooks/python] setPipTrustedHost IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function setPython3AsPython(environmentId: string, serviceData: ServiceData, enable: boolean) {
        const ipcRes = await ipcSetPython3AsPython(environmentId, serviceData, enable);
        console.log(`[hooks/python] setPython3AsPython IPC 响应:`, ipcRes);
        return ipcRes;
    }

    return {
        getPipConfig,
        setPipIndexUrl,
        setPipTrustedHost,
        setPython3AsPython
    }
}
