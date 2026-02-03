import { AppSettings, CanRunServices, CannotRunServices, Environment, EnvironmentStatus, NeedDownloadServices, ServiceData, ServiceDataStatus, ServiceStatus, ServiceType, SystemSettings, serviceTypeNames } from "@/types/index"
import { useAtom } from "jotai"
import { toast } from 'sonner'
import { ipcActivateServiceData, ipcCreateServiceData, ipcDeactivateServiceData, ipcDeleteServiceData, ipcGetEnvAllServDatas, ipcRestartServiceData, ipcUpdateServiceData, ipcStartServiceData, ipcStoppedServiceData } from "../ipc/env-serv-data"
import { ipcGetAllEnvironments } from "../ipc/environment"
import { isAppLoadingAtom } from "../store/appSettings"
import { environmentsAtom, selectedEnvironmentIdAtom } from "../store/environment"
import { selectedServiceDataIdAtom } from "../store/service"
import { useAppSettings } from "./appSettings"
import { useEnvironment } from "./environment"
import { useService } from "./service"
import { ipcGetServiceStatus } from "@/ipc/service"

export function useServiceData() {

    const getAllServiceDatas = async (environmentId: string) => {
        const ipcRes = await ipcGetEnvAllServDatas(environmentId);
        return ipcRes;
    }

    const isServiceDataHasStatus = (serviceDataType: ServiceType) => {
        if (CannotRunServices.includes(serviceDataType)) {
            return false;
        }
        if (CanRunServices.includes(serviceDataType)) {
            return true;
        }
        return false;
    }

    return {
        getAllServiceDatas,
        isServiceDataHasStatus,
    }
}

export function useEnvironmentServiceData() {
    const [, setIsAppLoading] = useAtom(isAppLoadingAtom)
    const [environments, setEnvironments] = useAtom(environmentsAtom)
    const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)
    const [selectedServiceDataId, setSelectedServiceDataId] = useAtom(selectedServiceDataIdAtom)
    const { activateEnvironmentAndServices, deactivateEnvironmentAndServices, selectEnvironment } = useEnvironment();
    const { getAllServiceDatas } = useServiceData();
    const { checkServiceInstalled } = useService();
    const { updateSystemSettings, systemSettings } = useAppSettings();
    const selectedServiceDatas = environments.find(env => env.id === selectedEnvironmentId)?.serviceDatas || null;
    const selectedServiceData = (selectedServiceDatas || []).find(serviceData => serviceData.id === selectedServiceDataId)

    const deriveLastUsedEnvironmentIds = (settings?: SystemSettings | null): string[] => {
        if (!settings) {
            return [];
        }
        if (settings.lastUsedEnvironmentIds && settings.lastUsedEnvironmentIds.length > 0) {
            return settings.lastUsedEnvironmentIds.filter(id => !!id);
        }
        return settings.lastUsedEnvironmentId ? [settings.lastUsedEnvironmentId] : [];
    };

    const areIdListsEqual = (source: string[], target: string[]) => (
        source.length === target.length && source.every((id, index) => id === target[index])
    );

    const persistLastUsedEnvironmentIds = async (ids: string[]) => {
        if (!systemSettings) {
            console.warn('系统设置未初始化，无法保存最后使用的环境记录');
            return;
        }
        const sanitized = Array.from(new Set(ids.filter(id => !!id)));
        const currentIds = deriveLastUsedEnvironmentIds(systemSettings);
        if (areIdListsEqual(sanitized, currentIds)) {
            return;
        }
        const latestId = sanitized[sanitized.length - 1];
        await updateSystemSettings({
            lastUsedEnvironmentIds: sanitized,
            lastUsedEnvironmentId: latestId,
        });
    };

    // 激活环境服务不在这里，应该在添加服务后激活，单一职责原则
    const createServiceData = async (serviceType: ServiceType, version: string) => {
        if (!selectedEnvironmentId) {
            toast.error('没有选中的环境，无法添加服务')
            return null
        }

        if (serviceType !== ServiceType.Custom) {
            if (!!selectedServiceDatas && selectedServiceDatas.some(serviceData => serviceData.type === serviceType)) {
                toast.error(`当前环境已存在 ${serviceTypeNames[serviceType]} 服务，每个环境只能有一个同类型服务`)
                return null
            }
        }

        const result = await ipcCreateServiceData(selectedEnvironmentId, serviceType, version)
        if (result.success && result.data?.serviceData) {
            const newServiceData = result.data.serviceData
            setEnvironments(prevEnvs =>
                prevEnvs.map(env =>
                    env.id === selectedEnvironmentId
                        ? { ...env, serviceDatas: [...(env.serviceDatas || []), newServiceData] }
                        : env
                )
            )
            setSelectedServiceDataId(newServiceData.id) // 设置新添加的服务为选中状态
            return newServiceData
        } else {
            console.error('创建服务失败:', result.message)
            toast.error('创建服务失败: ' + result.message)
            return null
        }
    }

    const updateServiceData = async (serviceId: string, updates: Partial<ServiceData>) => {
        if (!selectedEnvironmentId) {
            console.error('没有选中的环境，无法更新服务')
            return
        }

        if (!selectedServiceDatas) {
            console.error('没有选中的服务，无法更新')
            return
        }

        const serviceDatas = selectedServiceDatas
        const serviceIndex = serviceDatas.findIndex(service => service.id === serviceId)
        if (serviceIndex === -1) {
            console.error('未找到要更新的服务')
            return
        }

        const updatedServiceData: ServiceData = {
            ...serviceDatas[serviceIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        }

        const result = await ipcUpdateServiceData(selectedEnvironmentId, { id: serviceId, ...updates })
        if (result.success) {
            const updatedServiceDatas = [...serviceDatas]
            updatedServiceDatas[serviceIndex] = updatedServiceData
            setEnvironments(prevEnvs =>
                prevEnvs.map(env =>
                    env.id === selectedEnvironmentId
                        ? { ...env, serviceDatas: updatedServiceDatas }
                        : env
                )
            )
            // 这是干嘛的。。。
            setSelectedServiceDataId(updatedServiceData.id)
        }
        return updatedServiceData;
    }

    const deleteServiceData = async (serviceData: ServiceData) => {
        if (!selectedEnvironmentId) {
            console.error('没有选中的环境，无法删除服务')
            return
        }

        if (!selectedServiceDatas) {
            console.error('没有选中的服务，无法删除')
            return
        }

        const serviceDatas = selectedServiceDatas
        const serviceIndex = serviceDatas.findIndex(service => service.id === serviceData.id)
        if (serviceIndex === -1) {
            console.error('未找到要删除的服务')
            return
        }

        const ipcRes = await ipcDeleteServiceData(selectedEnvironmentId, serviceData.id)
        if (ipcRes.success) {
            const updatedServices = serviceDatas.filter(service => service.id !== serviceData.id)
            setEnvironments(prevEnvs =>
                prevEnvs.map(env =>
                    env.id === selectedEnvironmentId
                        ? { ...env, serviceDatas: updatedServices }
                        : env
                )
            )
            // 如果删除的是当前选中的服务，清空选中状态
            if (selectedServiceDataId && selectedServiceDataId === serviceData.id) {
                setSelectedServiceDataId('')
            }
        }
    }

    async function updateServicesOrder(serviceDatas: ServiceData[]) {
        setEnvironments(prevEnvs =>
            prevEnvs.map(env =>
                env.id === selectedEnvironmentId
                    ? { ...env, serviceDatas: serviceDatas }
                    : env
            )
        )
        // 保存到文件系统
        for (const serviceData of serviceDatas) {
            // 更新每个服务的排序
            await updateServiceData(serviceData.id, { sort: serviceData.sort ?? 0 });
        }
    }

    // 激活服务数据，这里没有直接更新界面，因为可能不是当前选中的环境的服务数据
    async function activateServiceData(environmentId: string, serviceData: ServiceData, password?: string) {
        // 渲染层先检查服务是否已安装，只有已安装的服务才会尝试激活
        if (NeedDownloadServices.includes(serviceData.type)) {
            const checkRes = await checkServiceInstalled(serviceData.type, serviceData.version);
            if (!checkRes || !checkRes.success || !checkRes.data || !checkRes.data.installed) {
                console.warn('尝试激活未安装的服务，已跳过:', serviceData.type, serviceData.version);
                return { success: false, message: '服务未安装', data: null };
            }
        }

        const effectivePassword = password || (serviceData.type === ServiceType.Host ? sessionStorage.getItem('envis_sudo_password') || undefined : undefined);

        const ipcRes = await ipcActivateServiceData(environmentId, serviceData, effectivePassword);
        if (ipcRes.success) {
            console.log('激活服务成功:', serviceData.type, serviceData.id);
            // 更新 environment 里的 servData 的 status
            setEnvironments(prevEnvs => prevEnvs.map(env => {
                if (env.id !== environmentId) return env;
                return {
                    ...env,
                    serviceDatas: env.serviceDatas?.map(sd =>
                        sd.id === serviceData.id
                            ? { ...sd, status: ServiceDataStatus.Active }
                            : sd
                    )
                };
            }));
        }
        return ipcRes;
    }

    async function deactivateServiceData(environmentId: string, serviceData: ServiceData, password?: string) {
        const effectivePassword = password || (serviceData.type === ServiceType.Host ? sessionStorage.getItem('envis_sudo_password') || undefined : undefined);

        const ipcRes = await ipcDeactivateServiceData(environmentId, serviceData, effectivePassword);
        if (ipcRes.success) {
            console.log('停用服务成功:', serviceData.type, serviceData.id);
            // 更新 environment 里的 servData 的 status
            setEnvironments(prevEnvs => prevEnvs.map(env => {
                if (env.id !== environmentId) return env;
                return {
                    ...env,
                    serviceDatas: env.serviceDatas?.map(sd =>
                        sd.id === serviceData.id
                            ? { ...sd, status: ServiceDataStatus.Inactive }
                            : sd
                    )
                };
            }));
        } else {
            console.error('停用服务失败:', ipcRes.message);
        }
        return ipcRes;
    }

    // 启动服务数据，没办法放到service里，因为还要用到不少数据
    async function startServiceData(environmentId: string, serviceData: ServiceData) {
        return ipcStartServiceData(environmentId, serviceData);
    }

    async function stopServiceData(environmentId: string, serviceData: ServiceData) {
        return ipcStoppedServiceData(environmentId, serviceData);
    }

    async function restartServiceData(environmentId: string, serviceData: ServiceData) {
        return ipcRestartServiceData(environmentId, serviceData);
    }

    // 实在没有办法
    async function getServiceStatus(environmentId: string, serviceData: ServiceData) {
        return ipcGetServiceStatus(environmentId, serviceData);
    }

    const initEnvironments = async (appSettings: AppSettings, systemSettings: SystemSettings) => {
        console.log('【init】初始化环境和服务数据...')
        const loadedEnvironmentsRes = await ipcGetAllEnvironments()
        console.log('【init】获取环境:', loadedEnvironmentsRes);
        if (loadedEnvironmentsRes.success && loadedEnvironmentsRes.data?.environments) {
            // 初始化环境
            const environments: Environment[] = loadedEnvironmentsRes.data.environments
            // 初始化环境里的服务
            for (const env of environments) {
                const serviceDatasRes = await getAllServiceDatas(env.id);
                if (serviceDatasRes.success && serviceDatasRes.data?.serviceDatas) {
                    env.serviceDatas = serviceDatasRes.data.serviceDatas;
                } else {
                    env.serviceDatas = [];
                }
            }
            setEnvironments(environments)
            console.log('【init】初始化环境和服务数据，环境列表:', environments)
            // 首先尝试关闭所有环境
            await deactivateAllEnvAndServDatas(environments)
            console.log('【init】所有环境和服务已停用')
            // 尝试自动启动上次使用的环境
            if (appSettings && systemSettings) {
                await autoStartEnvironment(systemSettings, environments)
            }
            console.log('【init】自动启动上次使用的环境完成')
        }
        console.log('【init】初始化环境和服务数据完成:', environments)
    }

    async function activateEnvAndServDatas(environment: Environment, password?: string) {
        const effectivePassword = password || sessionStorage.getItem('envis_sudo_password') || undefined;
        // 激活环境
        const activeEnvRes = await activateEnvironmentAndServices(environment, effectivePassword)
        if (!activeEnvRes.success) {
            console.error(`激活环境失败: ${activeEnvRes.message}`)
        }
        // 后端现在负责在激活环境时激活所有关联服务
        return activeEnvRes;
    }

    async function deactivateEnvAndServDatas(environment: Environment, password?: string) {
        const effectivePassword = password || sessionStorage.getItem('envis_sudo_password') || undefined;
        // 停用环境
        const deactiveEnvRes = await deactivateEnvironmentAndServices(environment, effectivePassword)
        if (!deactiveEnvRes.success) {
            console.error(`停用环境失败: ${deactiveEnvRes.message}`)
            return deactiveEnvRes;
        }

        // 后端现在负责在停用环境时停用所有关联服务
        return deactiveEnvRes;
    }

    async function deactivateAllEnvAndServDatas(environments: Environment[]) {
        for (const environment of environments) {
            if (environment.status === EnvironmentStatus.Active) {
                await deactivateEnvAndServDatas(environment)
            }
        }
        const newEnvironments = environments.map(env => ({
            ...env,
            status: EnvironmentStatus.Inactive // 停用所有环境
        }))
        setEnvironments(newEnvironments)
    }

    async function deactivateOtherActiveEnvironments(currentEnvironmentId?: string) {
        const snapshot = [...environments]
        for (const environment of snapshot) {
            if (environment.id !== currentEnvironmentId && environment.status === EnvironmentStatus.Active) {
                await deactivateEnvAndServDatas(environment)
            }
        }
    }

    // 启动时自动启动上次使用的环境
    const autoStartEnvironment = async (systemSettings: SystemSettings, environments: Environment[]) => {
        // 检查是否启用了自动启动上次环境功能
        if (systemSettings.autoActivateLastUsedEnvironmentOnAppStart) {
            console.log('【init】启用自动启动上次环境功能')
            const lastUsedEnvironmentIds = deriveLastUsedEnvironmentIds(systemSettings)
            if (lastUsedEnvironmentIds.length === 0) {
                console.log('【init】未找到可自动启动的历史环境记录')
                return
            }

            for (const envId of lastUsedEnvironmentIds) {
                const targetEnvironment = environments.find(env => env.id === envId)
                if (targetEnvironment) {
                    console.log(`【init】自动启动上次使用的环境: ${targetEnvironment.name}`)
                    await activateEnvAndServDatas(targetEnvironment)
                    console.log(`【init】历史环境 ${targetEnvironment.name} 启动完成`)
                } else {
                    console.warn(`【init】历史环境 ${envId} 不存在，已跳过自动启动`)
                }
            }
        }
    }

    async function switchEnvAndServDatasActive(environment: Environment) {
        let loadingTimer = null;
        let isActiveFinish = false;
        // 300ms后才显示loading，防止loading闪烁
        loadingTimer = setTimeout(() => {
            if (!isActiveFinish) {
                setIsAppLoading(true);
            }
        }, 300);

        const shouldDeactivateOthers = systemSettings?.deactivateOtherEnvironmentsOnActivate ?? true;

        const currentLastUsedIds = deriveLastUsedEnvironmentIds(systemSettings)
        let nextLastUsedIds = [...currentLastUsedIds]

        if (environment.status === EnvironmentStatus.Active) {
            await deactivateEnvAndServDatas(environment)
            console.log('停用环境:', environment.name)
            nextLastUsedIds = currentLastUsedIds.filter(id => id !== environment.id)
        } else {
            if (shouldDeactivateOthers) {
                await deactivateOtherActiveEnvironments(environment.id)
                nextLastUsedIds = [environment.id]
            }
            await activateEnvAndServDatas(environment)
            console.log('激活环境:', environment.name)
            if (!shouldDeactivateOthers) {
                const filtered = currentLastUsedIds.filter(id => id !== environment.id)
                nextLastUsedIds = [...filtered, environment.id]
            }
        }

        await persistLastUsedEnvironmentIds(nextLastUsedIds)

        isActiveFinish = true;
        if (loadingTimer) {
            clearTimeout(loadingTimer);
        }
        setIsAppLoading(false);
    }

    return {
        selectedServiceDatas,
        selectedServiceData,
        createServiceData,
        updateServiceData,
        deleteServiceData,
        updateServicesOrder,
        activateServiceData,
        deactivateServiceData,
        initEnvironments,
        switchEnvAndServDatasActive,
        autoStartEnvironment,
        startServiceData,
        stopServiceData,
        restartServiceData,
        getServiceStatus,
    }
}
