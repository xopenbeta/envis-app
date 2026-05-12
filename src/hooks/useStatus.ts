import { useEffect, useRef, useState } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  DownloadStatus,
  EnvironmentStatus,
  NeedDownloadServices,
  ServiceData,
  ServiceDataStatus,
  ServiceStatus,
  ServiceType,
} from '@/types/index'
import { useEnvironmentServiceData, useServiceData } from './env-serv-data'
import { useService } from './service'
import { useEnvironment } from './environment'
import { setImmediateInterval } from '@/utils/patch'

interface PollingOptions {
  enabled?: boolean
  /** @deprecated 事件驱动模式下忽略此参数，保留以兼容已有调用方 */
  interval?: number
  /** @deprecated 事件驱动模式下忽略此参数，保留以兼容已有调用方 */
  immediate?: number
}

const DEFAULT_INTERVAL = 500

export function useEnvironmentStatus(
  environmentId: string,
  options: PollingOptions = {}
) {
  const { getEnvironment } = useEnvironment()
  const enabled = options.enabled ?? true
  const [status, setStatus] = useState<EnvironmentStatus>(EnvironmentStatus.Inactive)
  const isRefreshingRef = useRef(false)

  const refresh = async () => {
    if (!enabled || isRefreshingRef.current) return
    isRefreshingRef.current = true
    try {
      const result = await getEnvironment(environmentId)
      if (result.success && result.data?.environment) {
        setStatus(result.data.environment.status)
      }
    } catch (error) {
      console.error('获取环境状态失败:', error)
    } finally {
      isRefreshingRef.current = false
    }
  }

  useEffect(() => {
    if (!enabled) {
      setStatus(EnvironmentStatus.Inactive)
      return
    }

    // 初始化时立即拉取一次当前状态
    void refresh()

    // 监听 Rust 推送的环境状态变化事件
    let cancelled = false
    let unlistenFn: UnlistenFn | undefined
    void listen<{ environmentId: string }>('status:environment', (event) => {
      if (event.payload.environmentId === environmentId) {
        void refresh()
      }
    }).then((fn) => {
      if (cancelled) fn()
      else unlistenFn = fn
    })

    return () => {
      cancelled = true
      unlistenFn?.()
    }
  }, [enabled, environmentId])

  return {
    status,
    refresh,
  }
}

export function useServiceStatus(
  environmentId: string,
  serviceData: ServiceData,
  options: PollingOptions = {}
) {
  const { getServiceStatus } = useEnvironmentServiceData()
  const enabled = options.enabled ?? true
  const [status, setStatus] = useState<ServiceStatus>(ServiceStatus.Unknown)
  const isRefreshingRef = useRef(false)

  const refresh = async () => {
    if (!enabled || isRefreshingRef.current) return
    isRefreshingRef.current = true
    try {
      const result = await getServiceStatus(environmentId, serviceData)
      if (result.success && result.data) {
        setStatus(result.data.status)
      }
    } catch (error) {
      console.error('获取服务程序状态失败:', error)
    } finally {
      isRefreshingRef.current = false
    }
  }

  useEffect(() => {
    if (!enabled) {
      setStatus(ServiceStatus.Unknown)
      return
    }

    // 初始化时立即拉取一次当前状态
    void refresh()

    // 监听 Rust 推送的服务运行状态变化事件
    let cancelled = false
    let unlistenFn: UnlistenFn | undefined
    void listen<{ environmentId: string; serviceId: string }>('status:service', (event) => {
      if (
        event.payload.environmentId === environmentId &&
        event.payload.serviceId === serviceData.id
      ) {
        void refresh()
      }
    }).then((fn) => {
      if (cancelled) fn()
      else unlistenFn = fn
    })

    return () => {
      cancelled = true
      unlistenFn?.()
    }
  }, [enabled, environmentId, serviceData.id, serviceData.version, serviceData.type])

  return {
    status,
    refresh,
  }
}

export function useServiceDataStatus(
  environmentId: string,
  serviceId: string,
  options: PollingOptions = {}
) {
  const { getServiceData } = useServiceData()
  const enabled = options.enabled ?? true
  const [serviceDataStatus, setServiceDataStatus] = useState<ServiceDataStatus>(ServiceDataStatus.Unknown)
  const isRefreshingRef = useRef(false)

  const refresh = async () => {
    if (!enabled || isRefreshingRef.current) return
    isRefreshingRef.current = true
    try {
      const result = await getServiceData(environmentId, serviceId)
      if (result.success && result.data?.serviceData) {
        setServiceDataStatus(result.data.serviceData.status)
      }
    } catch (error) {
      console.error('获取服务激活状态失败:', error)
    } finally {
      isRefreshingRef.current = false
    }
  }

  useEffect(() => {
    if (!enabled) {
      setServiceDataStatus(ServiceDataStatus.Unknown)
      return
    }

    // 初始化时立即拉取一次当前状态
    void refresh()

    // 监听 Rust 推送的服务数据激活状态变化事件
    let cancelled = false
    let unlistenFn: UnlistenFn | undefined
    void listen<{ environmentId: string; serviceId: string }>('status:service-data', (event) => {
      if (
        event.payload.environmentId === environmentId &&
        event.payload.serviceId === serviceId
      ) {
        void refresh()
      }
    }).then((fn) => {
      if (cancelled) fn()
      else unlistenFn = fn
    })

    return () => {
      cancelled = true
      unlistenFn?.()
    }
  }, [enabled, environmentId, serviceId])

  return {
    serviceDataStatus,
    setServiceDataStatus,
    refresh,
  }
}

export function useServiceDownloadStatus(
  serviceType: ServiceType,
  version: string,
  options: PollingOptions = {}
) {
  const { checkServiceInstalled, getServiceDownloadProgress } = useService()
  const enabled = options.enabled ?? true
  const interval = typeof options.interval === 'number' ? options.interval : DEFAULT_INTERVAL
  const immediate = options.immediate ?? true
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>(DownloadStatus.Unknown)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const isRefreshingRef = useRef(false)

  const refresh = async () => {
    if (!enabled || isRefreshingRef.current) return
    isRefreshingRef.current = true

    if (!NeedDownloadServices.includes(serviceType)) {
      setDownloadStatus(DownloadStatus.Installed)
      setDownloadProgress(100)
      isRefreshingRef.current = false
      return
    }

    try {
      let nextStatus = DownloadStatus.Unknown
      let nextProgress = 0

      const downloadRes = await getServiceDownloadProgress(serviceType, version)
      if (downloadRes.success && downloadRes.data?.task) {
        nextStatus = downloadRes.data.task.status
        nextProgress = downloadRes.data.task.progress
      } else {
        const installRes = await checkServiceInstalled(serviceType, version)
        if (installRes.success && installRes.data) {
          nextStatus = installRes.data.installed ? DownloadStatus.Installed : DownloadStatus.NotInstalled
          nextProgress = installRes.data.installed ? 100 : 0
        }
      }

      setDownloadStatus(nextStatus)
      setDownloadProgress(nextProgress)
    } catch (error) {
      console.error('轮询服务下载状态失败:', error)
    } finally {
      isRefreshingRef.current = false
    }
  }

  useEffect(() => {
    if (!enabled) {
      setDownloadStatus(DownloadStatus.Unknown)
      setDownloadProgress(0)
      return
    }

    const timer = immediate
      ? setImmediateInterval(() => {
          void refresh()
        }, interval)
      : setInterval(() => {
          void refresh()
        }, interval)

    return () => clearInterval(timer)
  }, [enabled, interval, immediate, serviceType, version])

  return {
    downloadStatus,
    downloadProgress,
    refresh,
  }
}

