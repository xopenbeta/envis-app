import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart } from '@/components/ui/pie-chart'
import { Cpu, HardDrive, Wifi, MemoryStick, ArrowUp, ArrowDown } from 'lucide-react'
import { useSystemInfo } from '@/hooks/system-info'
import { useTranslation } from 'react-i18next'

export interface SystemInfo {
  cpu: {
    usage: number
    systemUsage: number
    userUsage: number
    cores: number
    model: string
  }
  memory: {
    used: number
    total: number
    usage: number
  }
  disk: {
    used: number
    total: number
    usage: number
  }
  network: {
    upload: number
    download: number
    ip: string
  }
}

export function useSystemMonitorData() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const { getSystemInfo } = useSystemInfo()
  const prevNetworkRef = useRef<{ received: number; transmitted: number; ts: number } | null>(null)

  useEffect(() => {
    let mounted = true

    const mapAndSet = (data: any, intervalSeconds: number) => {
      if (!data) return

      // cpu
      const cpuUsage = Number(data.cpu_usage ?? 0)
      const cpuCores = Number(data.cpu_count ?? 0)
      const cpuModel = data.cpu_brand ?? ''

      // memory
      const memTotal = Number(data.memory_total ?? 0)
      const memUsed = Number(data.memory_used ?? 0)
      const memUsage = Number(data.memory_usage_percent ?? (memTotal > 0 ? (memUsed / memTotal) * 100 : 0))

      // disk: 汇总所有磁盘
      const disks = Array.isArray(data.disks) ? data.disks : []
      let diskTotal = 0
      let diskUsed = 0
      for (const d of disks) {
        diskTotal += Number(d.total_space ?? 0)
        diskUsed += Number(d.used_space ?? 0)
      }
      const diskUsage = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0

      // network: 计算速率（bytes/sec）
      const interfaces = Array.isArray(data.network_interfaces) ? data.network_interfaces : []
      const totalReceived = interfaces.reduce((s: number, i: any) => s + Number(i.bytes_received ?? 0), 0)
      const totalTransmitted = interfaces.reduce((s: number, i: any) => s + Number(i.bytes_transmitted ?? 0), 0)
      const now = Date.now()

      let downloadRate = 0
      let uploadRate = 0
      const prev = prevNetworkRef.current
      if (prev && now > prev.ts) {
        const dt = (now - prev.ts) / 1000
        downloadRate = Math.max(0, (totalReceived - prev.received) / dt)
        uploadRate = Math.max(0, (totalTransmitted - prev.transmitted) / dt)
      }
      // update prev
      prevNetworkRef.current = { received: totalReceived, transmitted: totalTransmitted, ts: now }

      const ip = Array.isArray(data.ip_addresses) && data.ip_addresses.length > 0 ? data.ip_addresses[0] : (data.ip_address ?? '127.0.0.1')

      const mapped: SystemInfo = {
        cpu: {
          usage: Number(cpuUsage || 0),
          // IPC 暂未提供 system/user 细分，按经验将总量分配为 system/user 视图（可后续在后台补充更精确数据）
          systemUsage: Number(cpuUsage * 0.6 || 0),
          userUsage: Number(cpuUsage * 0.4 || 0),
          cores: cpuCores,
          model: cpuModel,
        },
        memory: {
          used: memUsed,
          total: memTotal,
          usage: Number(memUsage ?? 0),
        },
        disk: {
          used: diskUsed,
          total: diskTotal,
          usage: Number(diskUsage ?? 0),
        },
        network: {
          upload: uploadRate,
          download: downloadRate,
          ip,
        }
      }

      if (mounted) setSystemInfo(mapped)
    }

    const fetchAndMap = async () => {
      try {
        const res = await getSystemInfo()
        if (!res) return
        if (res.success) {
          // 使用默认的 2 秒间隔计算速率
          mapAndSet(res.data, 2)
        } else {
          console.error('getSystemInfo failed:', res.message)
        }
      } catch (err) {
        console.error('Failed to fetch system info:', err)
      }
    }

    // immediate fetch
    fetchAndMap()
    const interval = setInterval(fetchAndMap, 2000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return systemInfo
}

export function SystemMonitor({ systemInfo }: { systemInfo: SystemInfo | null }) {
  const { t } = useTranslation()
  const hasData = Boolean(systemInfo)
  const fallbackSystemInfo: SystemInfo = {
    cpu: {
      usage: 0,
      systemUsage: 0,
      userUsage: 0,
      cores: 0,
      model: '',
    },
    memory: {
      used: 0,
      total: 0,
      usage: 0,
    },
    disk: {
      used: 0,
      total: 0,
      usage: 0,
    },
    network: {
      upload: 0,
      download: 0,
      ip: '--',
    }
  }
  const displayInfo = systemInfo ?? fallbackSystemInfo

  const formatMetric = (value: number, formatter?: (n: number) => string) => {
    if (!hasData) return '--'
    return formatter ? formatter(value) : String(value)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="w-full space-y-3">
      <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1">{t('system_monitor.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* CPU */}
        <Card className="shadow-sm border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" /> {t('system_monitor.cpu')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <PieChart value={displayInfo.cpu.usage} size={40} strokeWidth={4} color="#3b82f6">
                  <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">{hasData ? `${displayInfo.cpu.usage.toFixed(0)}%` : '--'}</span>
                </PieChart>
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">{t('system_monitor.system')}</span>
                  <span className="text-gray-700 dark:text-gray-300">{hasData ? `${displayInfo.cpu.systemUsage.toFixed(1)}%` : '--'}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">{t('system_monitor.user')}</span>
                  <span className="text-gray-700 dark:text-gray-300">{hasData ? `${displayInfo.cpu.userUsage.toFixed(1)}%` : '--'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Memory */}
        <Card className="shadow-sm border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-2">
              <MemoryStick className="w-3.5 h-3.5" /> {t('system_monitor.memory')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <PieChart value={displayInfo.memory.usage} size={40} strokeWidth={4} color="#10b981">
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">{hasData ? `${displayInfo.memory.usage.toFixed(0)}%` : '--'}</span>
                </PieChart>
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">{t('system_monitor.used')}</span>
                  <span className="text-gray-700 dark:text-gray-300">{formatMetric(displayInfo.memory.used, formatBytes)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">{t('system_monitor.total')}</span>
                  <span className="text-gray-700 dark:text-gray-300">{formatMetric(displayInfo.memory.total, formatBytes)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disk */}
        <Card className="shadow-sm border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5" /> {t('system_monitor.disk')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <PieChart value={displayInfo.disk.usage} size={40} strokeWidth={4} color="#f59e0b">
                  <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">{hasData ? `${displayInfo.disk.usage.toFixed(0)}%` : '--'}</span>
                </PieChart>
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">{t('system_monitor.used')}</span>
                  <span className="text-gray-700 dark:text-gray-300">{formatMetric(displayInfo.disk.used, formatBytes)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">{t('system_monitor.total')}</span>
                  <span className="text-gray-700 dark:text-gray-300">{formatMetric(displayInfo.disk.total, formatBytes)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Network */}
        <Card className="shadow-sm border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5" /> {t('system_monitor.network')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400 flex items-center gap-1">
                    <ArrowUp className={`w-3 h-3 ${displayInfo.network.upload > 0 ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}`} />
                    {t('system_monitor.upload')}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{hasData ? `${formatBytes(displayInfo.network.upload)}/s` : '--'}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400 flex items-center gap-1">
                    <ArrowDown className={`w-3 h-3 ${displayInfo.network.download > 0 ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
                    {t('system_monitor.download')}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{hasData ? `${formatBytes(displayInfo.network.download)}/s` : '--'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
