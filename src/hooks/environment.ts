import { Environment, EnvironmentStatus } from "@/types/index"
import { useAtom } from "jotai"
import { useMemo } from "react"
import { ipcActivateEnvironment, ipcActivateEnvironmentAndServices, ipcCreateEnvironment, ipcDeactivateEnvironment, ipcDeactivateEnvironmentAndServices, ipcDeleteEnvironment, ipcSaveEnvironment } from "../ipc/environment"
import { environmentsAtom, selectedEnvironmentIdAtom } from "../store/environment"
import { selectedServiceDataIdAtom } from "../store/service"
import { sortEnvironments } from "../utils/sort"
import { useAppSettings } from "./appSettings"

export function useEnvironment() {
  const [environments, setEnvironments] = useAtom(environmentsAtom)
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)
  const [, setSelectedServiceDataId] = useAtom(selectedServiceDataIdAtom)
  const { updateSystemSettings, systemSettings } = useAppSettings()

  const activeEnvironment = useMemo(() => {
    return environments.find(env => env.status === EnvironmentStatus.Active) || null
  }, [environments])

  const selectedEnvironment = useMemo(() => {
    return environments.find(env => env.id === selectedEnvironmentId) || null
  }, [environments, selectedEnvironmentId])

  const createEnvironment = async (name: string, description?: string) => {
    // 调用主线程创建环境，ID生成和Sort计算等逻辑移至后端
    const res = await ipcCreateEnvironment(name, description);
    
    if (res.success && res.data?.environment) {
      const newEnvironment = res.data.environment;
      // UI 逻辑：更新列表并排序
      const updatedEnvironments = sortEnvironments([newEnvironment, ...environments]);
      setEnvironments(updatedEnvironments);
      
      setSelectedEnvironmentId(newEnvironment.id);
      setSelectedServiceDataId(''); // 清空选中服务数据
      
      // UI 逻辑：如果当前没有任何激活环境，则自动激活新创建的环境（比较方便，删除该逻辑也没事）
      // if (!activeEnvironment) {
      //   await activateEnvironment(newEnvironment);
      // }
    }
    return res;
  }

  const updateEnvironment = async (environmentId: string, updates: Partial<Environment>) => {
    const updatedEnvironments = environments.map(env =>
      env.id === environmentId
        ? { ...env, ...updates, updatedAt: new Date().toISOString() }
        : env
    )

    // 找到更新后的环境并保存到文件系统
    const updatedEnvironment = updatedEnvironments.find(env => env.id === environmentId)
    if (updatedEnvironment) {
      const ipcRes = await ipcSaveEnvironment(updatedEnvironment)
      if (ipcRes.success) {
        setEnvironments(updatedEnvironments)
      }
      return ipcRes;
    }
  }

  const deleteEnvironment = async (environment: Environment) => {
    const updatedEnvironments = environments.filter(env => env.id !== environment.id)
    const ipcRes = await ipcDeleteEnvironment(environment)
    if (ipcRes.success) {
      setEnvironments(updatedEnvironments)
      // 如果删除的是当前选中的环境，清空选中状态
      if (selectedEnvironmentId && selectedEnvironmentId === environment.id) {
        setSelectedEnvironmentId('')
        setSelectedServiceDataId('') // 清空选中服务数据
      }
    }
    return ipcRes;
  }

  const selectEnvironment = async (environment: Environment | null) => {
    setSelectedEnvironmentId(environment ? environment.id : '')
    setSelectedServiceDataId('') // 清空选中服务数据，这样就有机会显示环境面板
  }

  // 非常简单的激活环境，只有设置环境，没有激活服务数据
  // 要求提前已经将其他环境停用，因此业务不能直接使用
  const activateEnvironment = async (environment: Environment) => {
    const ipcRes = await ipcActivateEnvironment(environment)
    if (ipcRes.success) {
      // 使用函数式更新，避免闭包拿到旧的 environments
      setEnvironments(prev => prev.map(env => {
        if (env.id === environment.id) {
          return ipcRes.data?.env || { ...env, status: EnvironmentStatus.Active };
        }
        return env;
      }))
      // 并不能直接选中环境，因为选中环境必须要加载服务数据
    }
    return ipcRes;
  }

  const activateEnvironmentAndServices = async (environment: Environment, password?: string) => {
    const ipcRes = await ipcActivateEnvironmentAndServices(environment, password)
    if (ipcRes.success) {
      setEnvironments(prev => prev.map(env => {
        if (env.id === environment.id) {
          return ipcRes.data?.env || { ...env, status: EnvironmentStatus.Active };
        }
        return env;
      }))
    }
    return ipcRes;
  }

  const deactivateEnvironment = async (environment: Environment) => {
    const ipcRes = await ipcDeactivateEnvironment(environment)
    if (ipcRes.success) {
      // 使用函数式更新，避免闭包拿到旧的 environments
      setEnvironments(prev => prev.map(env => {
        if (env.id === environment.id) {
          return ipcRes.data?.env || { ...env, status: EnvironmentStatus.Inactive };
        }
        return env;
      }))
      if (selectedEnvironmentId && selectedEnvironmentId === environment.id) {
        // 这里不能清空选中环境
        // 这里用不着清空serviceDatas
        // 如果停用的是当前选中的环境，需要清空选中服务数据
        setSelectedServiceDataId('')
      }
    } else {
      console.error('停用环境失败:', ipcRes.message)
    }
    return ipcRes;
  }

  const deactivateEnvironmentAndServices = async (environment: Environment, password?: string) => {
    const ipcRes = await ipcDeactivateEnvironmentAndServices(environment, password)
    if (ipcRes.success) {
      setEnvironments(prev => prev.map(env => {
        if (env.id === environment.id) {
          return ipcRes.data?.env || { ...env, status: EnvironmentStatus.Inactive };
        }
        return env;
      }))
      if (selectedEnvironmentId && selectedEnvironmentId === environment.id) {
        setSelectedServiceDataId('')
      }
    } else {
      console.error('停用环境及服务失败:', ipcRes.message)
    }
    return ipcRes;
  }

  const updateEnvironmentsOrder = async (environments: Environment[]) => {
    // 修改sort属性
    const updatedEnvironments = environments.map((env, index) => ({
      ...env,
      sort: index
    }))
    // 更新状态
    setEnvironments(updatedEnvironments)
    // 保存到文件系统
    for (const environment of updatedEnvironments) {
      const ipcRes = await ipcSaveEnvironment(environment)
      if (!ipcRes.success) {
        console.error(`保存环境 ${environment.name} 失败:`, ipcRes.message)
      }
    }
  }

  return {
    activeEnvironment,
    selectedEnvironment,
    deleteEnvironment,
    updateEnvironment,
    createEnvironment,
    activateEnvironment,
    activateEnvironmentAndServices,
    deactivateEnvironment,
    deactivateEnvironmentAndServices,
    updateEnvironmentsOrder,
    selectEnvironment,
  }
}
