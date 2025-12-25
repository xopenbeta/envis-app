import { ServiceData } from "@/types/index";
import { 
    ipcGetNginxConfig,
} from "../../ipc/services/nginx";

export function useNginxService() {
    async function getNginxConfig(environmentId: string, serviceData: ServiceData) {
        const ipcRes = await ipcGetNginxConfig(environmentId, serviceData);
        console.log(`[hooks/nginx] getNginxConfig IPC 响应:`, ipcRes);
        return ipcRes;
    }

    return {
        getNginxConfig,
    }
}
