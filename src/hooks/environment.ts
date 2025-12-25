import { Environment, EnvironmentStatus } from "@/types/index"
import { useAtom } from "jotai"
import { useMemo } from "react"
import { ipcActivateEnvironment, ipcCreateEnvironment, ipcDeactivateEnvironment, ipcDeleteEnvironment, ipcSaveEnvironment } from "../ipc/environment"
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

    const id = `${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}env`;
    const timestamp = new Date().toISOString();
    // 计算新环境的 sort 值，确保排在最后
    const maxSort = environments.reduce((max, env) => Math.max(max, env.sort ?? 0), 0);
    const environment: Environment = {
      id,
      name,
      status: EnvironmentStatus.Inactive,
      sort: maxSort + 1,
      metadata: description ? { description } : {},
      serviceDatas: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const res = await ipcCreateEnvironment(environment);
    if (res.success && res.data?.environment) {
      const newEnvironment = res.data.environment;
      const updatedEnvironments = sortEnvironments([newEnvironment, ...environments]);
      setEnvironments(updatedEnvironments);
      setSelectedEnvironmentId(newEnvironment.id);
      setSelectedServiceDataId(''); // 清空选中服务数据
      // 如果当前没有任何激活环境，则自动激活新创建的环境，不用考虑是否成功失败
      if (!activeEnvironment) {
        await activateEnvironment(newEnvironment);
      }
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

  // 非常简单的激活环境
  // 只有设置环境，没有激活服务数据
  // 要求提前已经将其他环境停用，因此业务不能直接使用
  const activateEnvironment = async (environment: Environment) => {
    const ipcRes = await ipcActivateEnvironment(environment)
    if (ipcRes.success) {
      // 使用函数式更新，避免闭包拿到旧的 environments
      setEnvironments(prev => prev.map(env => ({
        ...env,
        status: (env.id === environment.id ? EnvironmentStatus.Active : env.status)
      })))
      // 并不能直接选中环境，因为选中环境必须要加载服务数据
    }
    return ipcRes;
  }

  const deactivateEnvironment = async (environment: Environment) => {
    const ipcRes = await ipcDeactivateEnvironment(environment)
    if (ipcRes.success) {
      // 使用函数式更新，避免闭包拿到旧的 environments
      setEnvironments(prev => prev.map(env => ({
        ...env,
        status: (env.id === environment.id ? EnvironmentStatus.Inactive : env.status)
      })))
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
    deactivateEnvironment,
    updateEnvironmentsOrder,
    selectEnvironment,
  }
}
