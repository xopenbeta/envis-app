import { ServiceData } from "@/types/index";
import { ipcCheckPackageManagers, ipcCheckVersionManagers, ipcGetNpmConfig, ipcSetNpmConfigPrefix, ipcSetNpmRegistry, ipcGetGlobalNpmPackages, ipcInstallGlobalNpmPackage, ipcSetPnpmHome } from "../../ipc/services/nodejs";

export function useNodejsService() {
    async function checkVersionManagers() {
        const ipcRes = await ipcCheckVersionManagers();
        console.log(`[hooks/nodejs] checkVersionManagers IPC 响应:`, ipcRes);
        return ipcRes;
    }

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

    async function setPnpmHome(environmentId: string, serviceData: ServiceData, pnpmHome: string) {
        const ipcRes = await ipcSetPnpmHome(environmentId, serviceData, pnpmHome);
        console.log(`[hooks/nodejs] setPnpmHome IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function getGlobalPackages(serviceData: ServiceData) {
        const ipcRes = await ipcGetGlobalNpmPackages(serviceData);
        console.log(`[hooks/nodejs] getGlobalPackages IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function installGlobalPackage(serviceData: ServiceData, packageName: string) {
        const ipcRes = await ipcInstallGlobalNpmPackage(serviceData, packageName);
        console.log(`[hooks/nodejs] installGlobalPackage IPC 响应:`, ipcRes);
        return ipcRes;
    }

    return {
        checkVersionManagers,
        setNpmRegistry,
        setConfigPrefix,
        setPnpmHome,
        getGlobalPackages,
        installGlobalPackage
    }
}
