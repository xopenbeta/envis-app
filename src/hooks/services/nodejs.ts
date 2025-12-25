import { ServiceData } from "@/types/index";
import { ipcCheckPackageManagers, ipcGetNpmConfig, ipcSetNpmConfigPrefix, ipcSetNpmRegistry } from "../../ipc/services/nodejs";

export function useNodejsService() {
    async function setNpmRegistry(environmentId: string, serviceData: ServiceData, registry: string) {
        const ipcRes = await ipcSetNpmRegistry(environmentId, serviceData, registry);
        console.log(`[hooks/nodejs] setManagerRegistry IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function setConfigPrefix(environmentId: string, serviceData: ServiceData, configPrefix: string) {
        const ipcRes = await ipcSetNpmConfigPrefix(environmentId, serviceData, configPrefix);
        console.log(`[hooks/nodejs] setManagerConfigPrefix IPC 响应:`, ipcRes);
        return ipcRes;
    }

    return {
        setNpmRegistry,
        setConfigPrefix
    }
}
