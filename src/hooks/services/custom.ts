import { ServiceData } from "@/types/index";
import { ipcUpdateCustomServicePaths, ipcUpdateCustomServiceEnvVars, ipcUpdateCustomServiceAliases } from "../../ipc/services/custom";
import { useEnvironmentServiceData } from "../env-serv-data";

export function useCustomService() {
    const { updateServiceData, selectedServiceDatas } = useEnvironmentServiceData();

    // 仅负责通过 IPC 更新后端（磁盘 / Shell），不直接修改前端 store
    async function updateCustomServicePaths(
        environmentId: string,
        serviceData: ServiceData,
        paths: string[]
    ) {
        const oldPaths: string[] = (serviceData.metadata && Array.isArray(serviceData.metadata.paths)) ? serviceData.metadata.paths : []
        const ipcRes = await ipcUpdateCustomServicePaths(environmentId, serviceData, oldPaths, paths);
        console.log(`[hooks/custom] updateCustomServicePaths IPC 响应:`, ipcRes);
        return ipcRes;
    }

    // 仅负责通过 IPC 更新后端（磁盘 / Shell），不直接修改前端 store
    async function updateCustomServiceEnvVars(
        environmentId: string,
        serviceData: ServiceData,
        envVars: Record<string, string>
    ) {
        const oldEnvVars: Record<string, string> = (serviceData.metadata && serviceData.metadata.envVars) ? serviceData.metadata.envVars : {}
        const ipcRes = await ipcUpdateCustomServiceEnvVars(environmentId, serviceData, oldEnvVars, envVars);
        console.log(`[hooks/custom] updateCustomServiceEnvVars IPC 响应:`, ipcRes);
        return ipcRes;
    }

    // 仅负责通过 IPC 更新后端（磁盘 / Shell），不直接修改前端 store
    async function updateCustomServiceAliases(
        environmentId: string,
        serviceData: ServiceData,
        aliases: Record<string, string>
    ) {
        const oldAliases: Record<string, string> = (serviceData.metadata && serviceData.metadata.aliases) ? serviceData.metadata.aliases : {}
        const ipcRes = await ipcUpdateCustomServiceAliases(environmentId, serviceData, oldAliases, aliases);
        console.log(`[hooks/custom] updateCustomServiceAliases IPC 响应:`, ipcRes);
        return ipcRes;
    }

    // 单独函数：将 metadata 应用到前端 store（单一职责），组件在 IPC 成功后可调用此函数
    async function applyServiceMetadata(environmentId: string, serviceId: string, metadata: Record<string, any>) {
        try {
            await updateServiceData({
                environmentId,
                serviceId,
                updates: { metadata },
                serviceDatasSnapshot: selectedServiceDatas,
            });
            return { success: true };
        } catch (err) {
            console.error('[hooks/custom] applyServiceMetadata 失败:', err);
            return { success: false, message: String(err) };
        }
    }

    return {
        updateCustomServicePaths,
        updateCustomServiceEnvVars,
        updateCustomServiceAliases,
        applyServiceMetadata,
    }
}