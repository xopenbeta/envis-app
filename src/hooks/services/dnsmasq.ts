import { ServiceData } from "@/types/index";
import { 
    ipcGetDnsmasqConfig,
} from "../../ipc/services/dnsmasq";

export function useDnsmasqService() {
    async function getDnsmasqConfig(environmentId: string, serviceData: ServiceData) {
        const ipcRes = await ipcGetDnsmasqConfig(environmentId, serviceData);
        console.log(`[hooks/dnsmasq] getDnsmasqConfig IPC 响应:`, ipcRes);
        return ipcRes;
    }

    return {
        getDnsmasqConfig,
    }
}
