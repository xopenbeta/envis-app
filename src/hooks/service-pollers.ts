import { useEffect, useState } from 'react'
import {
  DownloadStatus,
  NeedDownloadServices,
  ServiceData,
  ServiceDataStatus,
  ServiceStatus,
  ServiceType,
} from '@/types/index'
import { useEnvironmentServiceData, useServiceData } from './env-serv-data'
import { useService } from './service'
import { setImmediateInterval } from '@/utils/patch'

interface PollingOptions {
  enabled?: boolean
  interval?: number
  immediate?: boolean
}

const DEFAULT_INTERVAL = 500

export function useServiceProcessStatus(
  environmentId: string,
  serviceData: ServiceData,
  options: PollingOptions = {}
) {
  const { getServiceStatus } = useEnvironmentServiceData()
  const enabled = options.enabled ?? true
  const interval = options.interval ?? DEFAULT_INTERVAL
  const immediate = options.immediate ?? true
  const [status, setStatus] = useState<ServiceStatus>(ServiceStatus.Unknown)

  const refresh = async () => {
    if (!enabled) return
    try {
      const result = await getServiceStatus(environmentId, serviceData)
      if (result.success && result.data) {
        setStatus(result.data.status)
      }
    } catch (error) {
      console.error('轮询服务程序状态失败:', error)
    }
  }

  useEffect(() => {
    if (!enabled) {
      setStatus(ServiceStatus.Unknown)
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
  }, [enabled, interval, immediate, environmentId, serviceData.id, serviceData.version, serviceData.type])

  return {
    status,
    refresh,
  }
}

export function useServiceActivationStatus(
  environmentId: string,
  serviceId: string,
  options: PollingOptions = {}
) {
  const { getServiceData } = useServiceData()
  const enabled = options.enabled ?? true
  const interval = options.interval ?? DEFAULT_INTERVAL
  const immediate = options.immediate ?? true
  const [activationStatus, setActivationStatus] = useState<ServiceDataStatus>(ServiceDataStatus.Unknown)

  const refresh = async () => {
    if (!enabled) return
    try {
      const result = await getServiceData(environmentId, serviceId)
      if (result.success && result.data?.serviceData) {
        setActivationStatus(result.data.serviceData.status)
      }
    } catch (error) {
      console.error('轮询服务激活状态失败:', error)
    }
  }

  useEffect(() => {
    if (!enabled) {
      setActivationStatus(ServiceDataStatus.Unknown)
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
  }, [enabled, interval, immediate, environmentId, serviceId])

  return {
    activationStatus,
    setActivationStatus,
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
  const interval = options.interval ?? DEFAULT_INTERVAL
  const immediate = options.immediate ?? true
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>(DownloadStatus.Unknown)
  const [downloadProgress, setDownloadProgress] = useState(0)

  const refresh = async () => {
    if (!enabled) return

    if (!NeedDownloadServices.includes(serviceType)) {
      setDownloadStatus(DownloadStatus.Installed)
      setDownloadProgress(100)
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
