import { ServiceData } from '@/types'
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '@/utils/logger'
import { IPCResult } from '@/types/ipc'
import { CAConfig, Certificate } from '@/types/service'

/**
 * 检查 CA 是否已初始化
 */
export const ipcCheckCAInitialized = ipcLogFunc(
    '检查 CA 是否已初始化',
    async (environmentId: string): Promise<IPCResult<{ initialized: boolean }>> => {
        return invokeCommand('check_ca_initialized', { environmentId })
    }
)

/**
 * 初始化 CA
 */
export const ipcInitializeCA = ipcLogFunc(
    '初始化 CA',
    async (
        environmentId: string,
        serviceData: ServiceData,
        caConfig: CAConfig
    ): Promise<IPCResult<{
        caCertPath: string
        caKeyPath: string
        commonName: string
        organization: string
        validityDays: number
    }>> => {
        return invokeCommand('initialize_ca', {
            environmentId,
            serviceData,
            commonName: caConfig.commonName,
            organization: caConfig.organization,
            organizationalUnit: caConfig.organizationalUnit,
            country: caConfig.country,
            state: caConfig.state,
            locality: caConfig.locality,
            validityDays: caConfig.validityDays,
        })
    }
)

/**
 * 获取 CA 信息
 */
export const ipcGetCAInfo = ipcLogFunc(
    '获取 CA 信息',
    async (
        environmentId: string,
        serviceData: ServiceData
    ): Promise<IPCResult<{
        initialized: boolean
        caCertPath?: string
        caKeyPath?: string
        issuer?: string
        subject?: string
        validFrom?: string
        validTo?: string
        serialNumber?: string
    }>> => {
        return invokeCommand('get_ca_info', { environmentId, serviceData })
    }
)

/**
 * 签发证书
 */
export const ipcIssueCertificate = ipcLogFunc(
    '签发证书',
    async (
        environmentId: string,
        serviceData: ServiceData,
        domain: string,
        subjectAltNames?: string[],
        validityDays: number = 365
    ): Promise<IPCResult<{ certificate: Certificate }>> => {
        return invokeCommand('issue_certificate', {
            environmentId,
            serviceData,
            domain,
            subjectAltNames,
            validityDays,
        })
    }
)

/**
 * 列出所有证书
 */
export const ipcListCertificates = ipcLogFunc(
    '列出所有证书',
    async (
        environmentId: string,
        serviceData: ServiceData
    ): Promise<IPCResult<{ certificates: Certificate[] }>> => {
        return invokeCommand('list_certificates', { environmentId, serviceData })
    }
)

/**
 * 删除证书
 */
export const ipcDeleteCertificate = ipcLogFunc(
    '删除证书',
    async (
        environmentId: string,
        serviceData: ServiceData,
        domain: string
    ): Promise<IPCResult<{}>> => {
        return invokeCommand('delete_certificate', { environmentId, serviceData, domain })
    }
)

/**
 * 导出 CA 证书
 */
export const ipcExportCACertificate = ipcLogFunc(
    '导出 CA 证书',
    async (
        environmentId: string,
        serviceData: ServiceData
    ): Promise<IPCResult<{ caCertPath: string }>> => {
        return invokeCommand('export_ca_certificate', { environmentId, serviceData })
    }
)

/**
 * 检查 CA 证书是否已安装到系统
 */
export const ipcCheckCAInstalled = ipcLogFunc(
    '检查 CA 证书是否已安装到系统',
    async (environmentId: string): Promise<IPCResult<{ installed: boolean; certPath?: string }>> => {
        return invokeCommand('check_ca_installed', { environmentId })
    }
)
