import { AppSettings, CanRunServices, CannotRunServices, Environment, EnvironmentStatus, NeedDownloadServices, ServiceData, ServiceDataStatus, ServiceStatus, ServiceType, SystemSettings, serviceTypeNames } from "@/types/index"
import { useAtom } from "jotai"
import { toast } from 'sonner'
import { ipcActivateServiceData, ipcCreateServiceData, ipcDeactivateServiceData, ipcDeleteServiceData, ipcGetEnvAllServDatas, ipcGetServiceData, ipcRestartServiceData, ipcUpdateServiceData, ipcStartServiceData, ipcStoppedServiceData } from "../ipc/env-serv-data"
import { ipcGetAllEnvironments } from "../ipc/environment"
import { isAppLoadingAtom } from "../store/appSettings"
import { environmentsAtom, selectedEnvironmentIdAtom, selectedServiceDatasAtom, selectedServiceDataIdAtom, envActivationEventAtom } from "../store/environment"
import { useAppSettings } from "./appSettings"
import { useEnvironment } from "./environment"
import { useService } from "./service"
import { ipcGetServiceStatus } from "@/ipc/service"
import { useEffect } from "react"

export function useServiceData() {

    const getAllServiceDatas = async (environmentId: string) => {
        const ipcRes = await ipcGetEnvAllServDatas(environmentId);
        return ipcRes;
    }

    const getServiceData = async (environmentId: string, serviceId: string) => {
        const ipcRes = await ipcGetServiceData(environmentId, serviceId);
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

    return {
        getAllServiceDatas,
        getServiceData,
        isServiceDataHasStatus,
        startServiceData,
        stopServiceData,
        restartServiceData,
    }
}

export function useEnvironmentServiceData() {
    const [, setIsAppLoading] = useAtom(isAppLoadingAtom)
    const [environments, setEnvironments] = useAtom(environmentsAtom)
    const [selectedEnvironmentId, setSelectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)
    const [selectedServiceDatas, setSelectedServiceDatas] = useAtom(selectedServiceDatasAtom)
    const [selectedServiceDataId, setSelectedServiceDataId] = useAtom(selectedServiceDataIdAtom)
    const [, setEnvActivationEvent] = useAtom(envActivationEventAtom)
    const { activateEnvironmentAndServices, deactivateEnvironmentAndServices } = useEnvironment();
    const { getAllServiceDatas } = useServiceData();
    const { checkServiceInstalled } = useService();
    const { updateSystemSettings, systemSettings } = useAppSettings();
    const selectedServiceData = selectedServiceDatas.find(serviceData => serviceData.id === selectedServiceDataId)
    const getSudoPassword = () => sessionStorage.getItem('envis_sudo_password') || undefined

    const getLastUsedEnvironmentIds = (settings?: SystemSettings | null): string[] => {
        let lastUsedEnvironmentIds: string[] = [];
        if (settings && settings.lastUsedEnvironmentIds && settings.lastUsedEnvironmentIds.length > 0) {
            lastUsedEnvironmentIds = settings.lastUsedEnvironmentIds.filter(id => !!id);
        }
        return lastUsedEnvironmentIds;
    };

    const setLastUsedEnvironmentIds = async (ids: string[], settings?: SystemSettings | null) => {
        const effectiveSettings = settings;
        if (!effectiveSettings) {
            console.warn('系统设置未初始化，无法保存最后使用的环境记录');
            return;
        }
        await updateSystemSettings({
            lastUsedEnvironmentIds: ids,
        });
    };

    const createServiceData = async ({
        environmentId,
        serviceType,
        version,
        serviceDatasSnapshot,
    }: {
        environmentId: string
        serviceType: ServiceType
        version: string
        serviceDatasSnapshot: ServiceData[]
    }) => {
        const effectiveServiceDatas = serviceDatasSnapshot

        if (serviceType !== ServiceType.Custom) {
            if (!!effectiveServiceDatas && effectiveServiceDatas.some(serviceData => serviceData.type === serviceType)) {
                toast.error(`当前环境已存在 ${serviceTypeNames[serviceType]} 服务，每个环境只能有一个同类型服务（自定义服务除外）`)
                return null
            }
        }

        const result = await ipcCreateServiceData(environmentId, serviceType, version)
        if (result.success && result.data?.serviceData) {
            const newServiceData = result.data.serviceData
            setSelectedServiceDatas([newServiceData, ...effectiveServiceDatas])
            setSelectedServiceDataId(newServiceData.id) // 设置新添加的服务为选中状态
            return newServiceData
        } else {
            console.error('创建服务失败:', result.message)
            toast.error('创建服务失败: ' + result.message)
            return null
        }
    }

    const updateServiceData = async ({
        environmentId,
        serviceId,
        updates,
        serviceDatasSnapshot,
    }: {
        environmentId: string
        serviceId: string
        updates: Partial<ServiceData>
        serviceDatasSnapshot: ServiceData[]
    }) => {
        const effectiveServiceDatas = serviceDatasSnapshot
        if (!effectiveServiceDatas) {
            console.error('没有选中的服务，无法更新')
            return
        }

        const serviceIndex = effectiveServiceDatas.findIndex(service => service.id === serviceId)
        if (serviceIndex === -1) {
            console.error('未找到要更新的服务')
            return
        }

        const updatedServiceData: ServiceData = {
            ...effectiveServiceDatas[serviceIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        }

        const result = await ipcUpdateServiceData(environmentId, { id: serviceId, ...updates })
        if (result.success) {
            const updatedServiceDatas = [...effectiveServiceDatas]
            updatedServiceDatas[serviceIndex] = updatedServiceData
            setSelectedServiceDatas(updatedServiceDatas)
            setSelectedServiceDataId(updatedServiceData.id)
        }
        return updatedServiceData;
    }

    const deleteServiceData = async ({
        environmentId,
        serviceData,
        serviceDatasSnapshot,
        selectedServiceDataIdSnapshot,
    }: {
        environmentId: string
        serviceData: ServiceData
        serviceDatasSnapshot: ServiceData[]
        selectedServiceDataIdSnapshot?: string
    }) => {
        const effectiveServiceDatas = serviceDatasSnapshot
        const effectiveSelectedServiceDataId = selectedServiceDataIdSnapshot

        if (!effectiveServiceDatas) {
            console.error('没有选中的服务，无法删除')
            return
        }

        const serviceIndex = effectiveServiceDatas.findIndex(service => service.id === serviceData.id)
        if (serviceIndex === -1) {
            console.error('未找到要删除的服务')
            return
        }

        const ipcRes = await ipcDeleteServiceData(environmentId, serviceData.id)
        if (ipcRes.success) {
            const updatedServices = effectiveServiceDatas.filter(service => service.id !== serviceData.id)
            setSelectedServiceDatas(updatedServices)
            // 如果删除的是当前选中的服务，清空选中状态
            if (effectiveSelectedServiceDataId && effectiveSelectedServiceDataId === serviceData.id) {
                setSelectedServiceDataId('')
            }
        }
    }

    async function updateServicesOrder({
        environmentId,
        newServiceDatas,
    }: {
        environmentId: string
        newServiceDatas: ServiceData[]
    }) {
        setSelectedServiceDatas(newServiceDatas)
        // 保存到文件系统
        for (const serviceData of newServiceDatas) {
            // 更新每个服务的排序
            await ipcUpdateServiceData(environmentId, { id: serviceData.id, sort: serviceData.sort ?? 0 });
        }
    }

    // 激活服务数据，这里没有直接更新界面，因为可能不是当前选中的环境的服务数据
    async function activateServiceData(environmentId: string, serviceData: ServiceData) {
        // 渲染层先检查服务是否已安装，只有已安装的服务才会尝试激活
        if (NeedDownloadServices.includes(serviceData.type)) {
            const checkRes = await checkServiceInstalled(serviceData.type, serviceData.version);
            if (!checkRes || !checkRes.success || !checkRes.data || !checkRes.data.installed) {
                console.warn('尝试激活未安装的服务，已跳过:', serviceData.type, serviceData.version);
                return { success: false, message: '服务未安装', data: null };
            }
        }

        const effectivePassword = getSudoPassword();
        const ipcRes = await ipcActivateServiceData(environmentId, serviceData, effectivePassword);
        if (ipcRes.success) {
            console.log('激活服务成功:', serviceData.type, serviceData.id);
            // UI会通过轮询从文件中读取最新状态，不需要在这里更新
        } else {
            console.error('激活服务失败:', ipcRes.message);
        }
        return ipcRes;
    }

    async function deactivateServiceData(environmentId: string, serviceData: ServiceData) {
        const effectivePassword = getSudoPassword();

        const ipcRes = await ipcDeactivateServiceData(environmentId, serviceData, effectivePassword);
        if (ipcRes.success) {
            console.log('停用服务成功:', serviceData.type, serviceData.id);
            // UI会通过轮询从文件中读取最新状态，不需要在这里更新
        } else {
            console.error('停用服务失败:', ipcRes.message);
        }
        return ipcRes;
    }

    async function getServiceStatus(environmentId: string, serviceData: ServiceData) {
        return ipcGetServiceStatus(environmentId, serviceData);
    }

    const initEnvironments = async () => {
        console.log('【init】初始化环境和服务数据...')
        const loadedEnvironmentsRes = await ipcGetAllEnvironments()
        console.log('【init】获取环境:', loadedEnvironmentsRes);
        if (loadedEnvironmentsRes.success && loadedEnvironmentsRes.data?.environments) {
            const environments: Environment[] = loadedEnvironmentsRes.data.environments
            setEnvironments(environments)
            console.log('【init】初始化环境列表:', environments)
        }
        console.log('【init】初始化环境数据完成')
        return environments;
    }

    async function activateEnvAndServDatas(environment: Environment, currentSelectedEnvironmentId?: string) {
        const effectivePassword = getSudoPassword();
        // 激活环境，后端现在负责在激活环境时激活所有关联服务
        const activeEnvRes = await activateEnvironmentAndServices(environment, effectivePassword)
        if (activeEnvRes.success) {
            if (currentSelectedEnvironmentId === environment.id) {
                const serviceDatasRes = await getAllServiceDatas(environment.id)
                if (serviceDatasRes.success && serviceDatasRes.data?.serviceDatas) {
                    setSelectedServiceDatas(serviceDatasRes.data.serviceDatas)
                }
            }
            // 触发事件通知所有 service-data-item 更新状态
            setEnvActivationEvent(Date.now())
        } else {
            console.error(`激活环境失败: ${activeEnvRes.message}`)
        }
        return activeEnvRes;
    }

    async function deactivateEnvAndServDatas(environment: Environment, currentSelectedEnvironmentId?: string) {
        const effectivePassword = getSudoPassword();
        // 停用环境，后端现在负责在停用环境时停用所有关联服务
        const deactiveEnvRes = await deactivateEnvironmentAndServices(environment, effectivePassword)
        if (deactiveEnvRes.success) {
            if (currentSelectedEnvironmentId === environment.id) {
                const serviceDatasRes = await getAllServiceDatas(environment.id)
                if (serviceDatasRes.success && serviceDatasRes.data?.serviceDatas) {
                    setSelectedServiceDatas(serviceDatasRes.data.serviceDatas)
                }
            }
            // 触发事件通知所有 service-data-item 更新状态
            setEnvActivationEvent(Date.now())
        } else {
            console.error(`停用环境失败: ${deactiveEnvRes.message}`)
        }
        return deactiveEnvRes;
    }

    async function deactivateAllEnvAndServDatas(environments: Environment[]) {
        for (const environment of environments) {
            if (environment.status === EnvironmentStatus.Active) {
                await deactivateEnvAndServDatas(environment)
            }
        }
        // 更新UI中所有环境状态为停用
        const newEnvironments = environments.map(env => ({
            ...env,
            status: EnvironmentStatus.Inactive
        }))
        setEnvironments(newEnvironments)
    }

    async function deactivateOtherActiveEnvironments(environmentList: Environment[], currentEnvironmentId: string, currentSelectedEnvironmentId?: string) {
        for (const environment of environmentList) {
            if (environment.id !== currentEnvironmentId && environment.status === EnvironmentStatus.Active) {
                await deactivateEnvAndServDatas(environment, currentSelectedEnvironmentId)
            }
        }
    }

    // 启动时自动启动上次使用的环境
    const autoStartEnvironment = async (systemSettings: SystemSettings, environments: Environment[]) => {
        // 检查是否启用了自动启动上次环境功能
        if (systemSettings.autoActivateLastUsedEnvironmentOnAppStart) {
            console.log('【init】启用自动启动上次环境功能')
            const lastUsedEnvironmentIds = getLastUsedEnvironmentIds(systemSettings)
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

    const switchEnvAndServDatas = async (environment: Environment | null) => {
        const newEnvId = environment ? environment.id : '';
        setSelectedEnvironmentId(newEnvId)
        if (newEnvId) {
            const serviceDatasRes = await getAllServiceDatas(newEnvId)
            if (serviceDatasRes.success && serviceDatasRes.data?.serviceDatas) {
                setSelectedServiceDatas(serviceDatasRes.data.serviceDatas)
            } else {
                setSelectedServiceDatas([])
            }
        } else {
            // 放在分支里，防止 无数据view 闪现
            setSelectedServiceDataId('')
            setSelectedServiceDatas([])
        }
    }

    async function switchEnvAndServDatasWithActive({
        environment,
        environmentsSnapshot,
        systemSettingsSnapshot,
    }: {
        environment: Environment
        environmentsSnapshot: Environment[]
        systemSettingsSnapshot?: SystemSettings | null
    }) {
        let loadingTimer = null;
        let isActiveFinish = false;
        const currentSelectedEnvironmentId = environment.id;
        // 300ms后才显示loading，防止loading闪烁
        loadingTimer = setTimeout(() => {
            if (!isActiveFinish) {
                setIsAppLoading(true);
            }
        }, 300);

        await switchEnvAndServDatas(environment);

        const currentLastUsedIds = getLastUsedEnvironmentIds(systemSettingsSnapshot ?? systemSettings)
        let nextLastUsedIds = [...currentLastUsedIds]

        if (environment.status === EnvironmentStatus.Active) {
            await deactivateEnvAndServDatas(environment, currentSelectedEnvironmentId)
            console.log('停用环境:', environment.name)
            nextLastUsedIds = currentLastUsedIds.filter(id => id !== environment.id)
        } else {
            const shouldDeactivateOthers = (systemSettingsSnapshot ?? systemSettings)?.deactivateOtherEnvironmentsOnActivate ?? true;
            if (shouldDeactivateOthers) {
                await deactivateOtherActiveEnvironments(environmentsSnapshot, environment.id, currentSelectedEnvironmentId)
                nextLastUsedIds = [environment.id]
            } else {
                const filtered = currentLastUsedIds.filter(id => id !== environment.id)
                nextLastUsedIds = [...filtered, environment.id]
            }
            await activateEnvAndServDatas(environment, currentSelectedEnvironmentId)
            console.log('激活环境:', environment.name)
        }

        await setLastUsedEnvironmentIds(nextLastUsedIds, systemSettingsSnapshot ?? systemSettings)

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
        switchEnvAndServDatas,
        switchEnvAndServDatasWithActive,
        deactivateAllEnvAndServDatas,
        autoStartEnvironment,
        getServiceStatus,
    }
}
