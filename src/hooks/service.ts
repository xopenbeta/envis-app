import { ipcDeleteService, ipcGetAllInstalledServices, ipcGetServiceDownloadProgress, ipcGetServiceSize, ipcGetServiceVersions } from "../ipc/service";
import { ServiceType } from "@/types/index";
import { ipcCheckServiceInstalled, ipcDownloadService, ipcCancelServiceDownload } from "../ipc/service";
import { toast } from "sonner";

export function useService() {

    async function getAllInstalledServices() {
        const ipcRes = await ipcGetAllInstalledServices()
        return ipcRes;
    }

    async function getServiceSize(serviceType: string, version: string) {
        const res = await ipcGetServiceSize(serviceType, version);
        return res;
    }

    async function deleteService(serviceType: string, version: string) {
        return ipcDeleteService(serviceType, version);
    }

    async function checkServiceInstalled(serviceType: ServiceType, version: string) {
        const ipcRes = await ipcCheckServiceInstalled(serviceType, version);
        return ipcRes;
    }

    async function getServiceVersions(serviceType: string) {
        const ipcRes = await ipcGetServiceVersions(serviceType);
        return ipcRes;
    }

    async function downloadService(serviceType: string, version: string) {
        const res = await ipcDownloadService(serviceType, version);
        return res;
    }

    async function cancelServiceDownload(serviceType: string, version: string) {
        const res = await ipcCancelServiceDownload(serviceType, version);
        return res;
    }

    async function getServiceDownloadProgress(serviceType: string, version: string) {
        const res = await ipcGetServiceDownloadProgress(serviceType, version);
        return res;
    }

    return {
        checkServiceInstalled,
        downloadService,
        cancelServiceDownload,
        getAllInstalledServices,
        getServiceSize,
        deleteService,
        getServiceVersions,
        getServiceDownloadProgress
    }
}
