import { ServiceData } from "@/types/index";
import { 
    ipcCheckJavaInstalled,
    ipcCheckMavenInstalled,
    ipcGetJavaVersions,
    ipcDownloadJava,
    ipcCancelDownloadJava,
    ipcGetJavaDownloadProgress,
    ipcInitializeMaven,
    ipcGetMavenDownloadProgress,
    ipcGetJavaInfo,
    ipcSetJavaHome,
    ipcSetJavaOpts,
    ipcSetMavenHome,
    ipcSetGradleHome
} from "../../ipc/services/java";

export function useJavaService() {
    async function checkJavaInstalled(version: string) {
        const ipcRes = await ipcCheckJavaInstalled(version);
        console.log(`[hooks/java] checkJavaInstalled IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function checkMavenInstalled(version: string) {
        const ipcRes = await ipcCheckMavenInstalled(version);
        console.log(`[hooks/java] checkMavenInstalled IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function getJavaVersions() {
        const ipcRes = await ipcGetJavaVersions();
        console.log(`[hooks/java] getJavaVersions IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function downloadJava(version: string, installMaven: boolean = false) {
        const ipcRes = await ipcDownloadJava(version, installMaven);
        console.log(`[hooks/java] downloadJava IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function cancelDownloadJava(version: string) {
        const ipcRes = await ipcCancelDownloadJava(version);
        console.log(`[hooks/java] cancelDownloadJava IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function getJavaDownloadProgress(version: string) {
        const ipcRes = await ipcGetJavaDownloadProgress(version);
        console.log(`[hooks/java] getJavaDownloadProgress IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function initializeMaven(environmentId: string, serviceData: ServiceData) {
        const ipcRes = await ipcInitializeMaven(environmentId, serviceData);
        console.log(`[hooks/java] initializeMaven IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function getMavenDownloadProgress(version: string) {
        const ipcRes = await ipcGetMavenDownloadProgress(version);
        console.log(`[hooks/java] getMavenDownloadProgress IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function getJavaInfo(serviceData: ServiceData) {
        const ipcRes = await ipcGetJavaInfo(serviceData);
        console.log(`[hooks/java] getJavaInfo IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function setJavaHome(environmentId: string, serviceData: ServiceData, javaHome: string) {
        const ipcRes = await ipcSetJavaHome(environmentId, serviceData, javaHome);
        console.log(`[hooks/java] setJavaHome IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function setJavaOpts(environmentId: string, serviceData: ServiceData, javaOpts: string) {
        const ipcRes = await ipcSetJavaOpts(environmentId, serviceData, javaOpts);
        console.log(`[hooks/java] setJavaOpts IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function setMavenHome(environmentId: string, serviceData: ServiceData, mavenHome: string) {
        const ipcRes = await ipcSetMavenHome(environmentId, serviceData, mavenHome);
        console.log(`[hooks/java] setMavenHome IPC 响应:`, ipcRes);
        return ipcRes;
    }

    async function setGradleHome(environmentId: string, serviceData: ServiceData, gradleHome: string) {
        const ipcRes = await ipcSetGradleHome(environmentId, serviceData, gradleHome);
        console.log(`[hooks/java] setGradleHome IPC 响应:`, ipcRes);
        return ipcRes;
    }

    return {
        checkJavaInstalled,
        checkMavenInstalled,
        getJavaVersions,
        downloadJava,
        cancelDownloadJava,
        getJavaDownloadProgress,
        initializeMaven,
        getMavenDownloadProgress,
        getJavaInfo,
        setJavaHome,
        setJavaOpts,
        setMavenHome,
        setGradleHome
    }
}
