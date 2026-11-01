import { ServiceData } from "@/types/index";
import {
    ipcGetApacheConfig,
    ipcValidateApacheConfig,
} from "../../ipc/services/apache";

export function useApacheService() {
    async function getApacheConfig(environmentId: string, serviceData: ServiceData) {
        const ipcRes = await ipcGetApacheConfig(environmentId, serviceData);
        console.log(`[hooks/apache] getApacheConfig IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function validateApacheConfig(environmentId: string, serviceData: ServiceData) {
        const ipcRes = await ipcValidateApacheConfig(environmentId, serviceData);
        console.log(`[hooks/apache] validateApacheConfig IPC 响应:`, ipcRes);
        return ipcRes;
    }

    return {
        getApacheConfig,
        validateApacheConfig,
    }
}
