import { useAtom } from 'jotai'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { environmentsAtom, selectedEnvironmentIdAtom } from '../../../store/environment'
import { Bot } from 'lucide-react'
import { selectedServiceDataIdAtom } from '../../../store/service'
import { ServiceData } from '@/types/index'
import { Button } from '@/components/ui/button'
import { isAIPanelOpenAtom } from "@/store";
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { SystemMonitor, useSystemMonitorData } from '@/pages/system-monitor'
import pkg from '../../../../package.json';
import { AppFooter } from '@/pages/app-footer'

interface ServiceResourceInfo {
  serviceId: string
  cpu: number
  memory: number
  disk: number
}

export function ServicesDashboard() {
  const { t } = useTranslation()
  const [environments] = useAtom(environmentsAtom)
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)
  const [selectedServiceId, setSelectedServiceId] = useAtom(selectedServiceDataIdAtom)
  const [, setIsAIPanelOpen] = useAtom(isAIPanelOpenAtom)
  const { selectedServiceDatas } = useEnvironmentServiceData();
  const systemInfo = useSystemMonitorData()
  const [serviceResources, setServiceResources] = useState<ServiceResourceInfo[]>([])
  const [copiedIp, setCopiedIp] = useState(false)

  // 当前环境信息
  const selectedEnvironment = environments.find(env => env.id === selectedEnvironmentId)

  const services: ServiceData[] = selectedServiceDatas || []
  const runningServices: ServiceData[] = []
  const stoppedServices: ServiceData[] = []
  const errorServices: ServiceData[] = []

  // 复制IP地址
  const copyIpAddress = async () => {
    if (systemInfo?.network.ip) {
      await navigator.clipboard.writeText(systemInfo.network.ip)
      setCopiedIp(true)
      setTimeout(() => setCopiedIp(false), 2000)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500'
      case 'stopped':
        return 'bg-gray-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'running':
        return 'default'
      case 'stopped':
        return 'secondary'
      case 'error':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br backdrop-blur-xl overflow-y-auto">
      {/* Header */}
      <div className="p-1 border-b border-divider">
        <div className="flex items-center justify-between ml-2">
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-foreground">{selectedEnvironment?.name ?? t('dashboard.unknown_env')}</h3>
            <p className="text-xs text-muted-foreground">{t('dashboard.env_id')}{selectedEnvironment?.id}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsAIPanelOpen(isAIPanelOpen => !isAIPanelOpen)}
              className={"h-7 w-7 p-0 mr-1 hover:bg-content2"}
              title={t('dashboard.ai_assistant')}
            >
              <Bot className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 bg-gradient-to-br from-background/50 to-content1/30 backdrop-blur-xl">

        {/* System Monitor */}
        <SystemMonitor systemInfo={systemInfo} />

      </div>

      {/* Footer Status Bar */}
      <AppFooter isShowConsoleBtn={true} onConsoleBtnClick={() => { /* Add your console button click handler here */ }} />
    </div>
  )
}
