import { ServiceData } from "@/types/index";
import {
    ipcCheckCAInitialized,
    ipcInitializeCA,
    ipcGetCAInfo,
    ipcIssueCertificate,
    ipcListCertificates,
    ipcDeleteCertificate,
    ipcExportCACertificate,
    ipcCheckCAInstalled,
} from "../../ipc/services/ssl";
import { CAConfig } from "@/types/service";

/**
 * SSL 证书服务 Hook
 */
export function useSSLService() {
    /**
     * 检查 CA 是否已初始化
     */
    async function checkCAInitialized(environmentId: string) {
        const result = await ipcCheckCAInitialized(environmentId);
        console.log('[hooks/ssl] checkCAInitialized 响应:', result);
        return result;
    }

    /**
     * 初始化 CA
     */
    async function initializeCA(
        environmentId: string,
        serviceData: ServiceData,
        caConfig: CAConfig
    ) {
        const result = await ipcInitializeCA(environmentId, serviceData, caConfig);
        console.log('[hooks/ssl] initializeCA 响应:', result);
        return result;
    }

    /**
     * 获取 CA 信息
     */
    async function getCAInfo(environmentId: string, serviceData: ServiceData) {
        const result = await ipcGetCAInfo(environmentId, serviceData);
        console.log('[hooks/ssl] getCAInfo 响应:', result);
        return result;
    }

    /**
     * 签发证书
     */
    async function issueCertificate(
        environmentId: string,
        serviceData: ServiceData,
        domain: string,
        subjectAltNames?: string[],
        validityDays: number = 365
    ) {
        const result = await ipcIssueCertificate(
            environmentId,
            serviceData,
            domain,
            subjectAltNames,
            validityDays
        );
        console.log('[hooks/ssl] issueCertificate 响应:', result);
        return result;
    }

    /**
     * 列出所有证书
     */
    async function listCertificates(environmentId: string, serviceData: ServiceData) {
        const result = await ipcListCertificates(environmentId, serviceData);
        console.log('[hooks/ssl] listCertificates 响应:', result);
        return result;
    }

    /**
     * 删除证书
     */
    async function deleteCertificate(
        environmentId: string,
        serviceData: ServiceData,
        domain: string
    ) {
        const result = await ipcDeleteCertificate(environmentId, serviceData, domain);
        console.log('[hooks/ssl] deleteCertificate 响应:', result);
        return result;
    }

    /**
     * 导出 CA 证书
     */
    async function exportCACertificate(environmentId: string, serviceData: ServiceData) {
        const result = await ipcExportCACertificate(environmentId, serviceData);
        console.log('[hooks/ssl] exportCACertificate 响应:', result);
        return result;
    }

    /**
     * 检查 CA 证书是否已安装到系统
     */
    async function checkCAInstalled(environmentId: string) {
        const result = await ipcCheckCAInstalled(environmentId);
        console.log('[hooks/ssl] checkCAInstalled 响应:', result);
        return result;
    }

    return {
        checkCAInitialized,
        initializeCA,
        getCAInfo,
        issueCertificate,
        listCertificates,
        deleteCertificate,
        exportCACertificate,
        checkCAInstalled,
    };
}
