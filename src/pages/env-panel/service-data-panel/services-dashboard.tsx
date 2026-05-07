import { useAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { environmentsAtom, selectedEnvironmentIdAtom } from '../../../store/environment'
import { Bot, Play, Code2, FolderOpen, Terminal } from 'lucide-react'
import { ServiceData, ServiceDataStatus, ServiceType } from '@/types/index'
import { Button } from '@/components/ui/button'
import { isAIPanelOpenAtom } from "@/store";
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { SystemMonitor, useSystemMonitorData } from '@/pages/system-monitor'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useService } from '@/hooks/service'
import { ProcessStatData } from '@/ipc/service'
import { ipcExecuteCustomServiceAlias, ipcOpenProjectInVSCode, ipcOpenFolderInFinder, ipcOpenTerminalInFolder } from '@/ipc/services/custom'
import { toast } from 'sonner'

// 服务类型 → 负责监控的进程名列表
function getServiceProcessNames(type: ServiceType): string[] {
  switch (type) {
    case ServiceType.Nginx: return ['nginx']
    case ServiceType.Mongodb: return ['mongod']
    case ServiceType.Redis: return ['redis-server']
    case ServiceType.Mariadb: return ['mariadbd', 'mysqld_safe']
    case ServiceType.Mysql: return ['mysqld']
    case ServiceType.Postgresql: return ['postgres']
    case ServiceType.Dnsmasq: return ['dnsmasq']
    default: return []
  }
}

function useServiceProcessStats(services: ServiceData[]) {
  const [stats, setStats] = useState<ProcessStatData[]>([])
  const { getServicesProcessStats } = useService()

  const activeTypes = services
    .filter(s => s.status === ServiceDataStatus.Active)
    .map(s => s.type as ServiceType)
  const typesKey = [...new Set(activeTypes)].sort().join(',')

  useEffect(() => {
    if (!typesKey) {
      setStats([])
      return
    }

    const serviceTypes = typesKey.split(',') as ServiceType[]
    let mounted = true

    const fetchStats = async () => {
      try {
        const res = await getServicesProcessStats(serviceTypes)
        if (res?.success && Array.isArray(res.data) && mounted) {
          setStats(res.data)
        }
      } catch {
        // 静默忽略轮询错误
      }
    }

    fetchStats()
    const timer = setInterval(fetchStats, 2000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [typesKey])

  return stats
}

export function ServicesDashboard() {
  const { t } = useTranslation()
  const [environments] = useAtom(environmentsAtom)
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)
  const [, setIsAIPanelOpen] = useAtom(isAIPanelOpenAtom)
  const { selectedServiceDatas } = useEnvironmentServiceData()
  const systemInfo = useSystemMonitorData()

  const selectedEnvironment = environments.find(env => env.id === selectedEnvironmentId)
  const services: ServiceData[] = selectedServiceDatas || []
  const processStats = useServiceProcessStats(services)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatsForService = (serviceType: ServiceType): ProcessStatData | null => {
    const names = getServiceProcessNames(serviceType)
    if (names.length === 0) return null
    const matching = processStats.filter(s => names.includes(s.processName))
    if (matching.length === 0) return null
    return matching.reduce((acc, s) => ({
      processName: acc.processName,
      cpuUsage: acc.cpuUsage + s.cpuUsage,
      memoryBytes: acc.memoryBytes + s.memoryBytes,
      diskReadBytes: acc.diskReadBytes + s.diskReadBytes,
      diskWriteBytes: acc.diskWriteBytes + s.diskWriteBytes,
      pidCount: acc.pidCount + s.pidCount,
    }))
  }

  // 提取所有自定义服务的快捷目录
  const customServiceDirectories = services
    .filter(s => s.type === ServiceType.Custom && s.metadata?.autoChdirPath)
    .map(s => ({
      serviceId: s.id,
      serviceName: s.name,
      path: (s.metadata?.autoChdirPath as string) || ''
    }))

  // 提取所有自定义服务的 aliases
  const customServiceAliases = services
    .filter(s => s.type === ServiceType.Custom && s.metadata?.aliases)
    .flatMap(s => {
      const aliases = s.metadata?.aliases as Record<string, string> || {}
      return Object.entries(aliases).map(([name, command]) => ({
        serviceName: s.name,
        aliasName: name,
        command
      }))
    })

  // 执行 alias 命令
  const executeAlias = async (aliasName: string, command: string) => {
    try {
      toast.info(`正在执行命令: ${command}`)
      const result = await ipcExecuteCustomServiceAlias(aliasName, command)

      if (result.success) {
        const data = result.data as { stdout?: string; stderr?: string; exitCode?: number }
        toast.success(`命令执行成功 (${aliasName})`, {
          description: data.stdout ? data.stdout.substring(0, 200) : '执行完成'
        })
      } else {
        const data = result.data as { stdout?: string; stderr?: string; exitCode?: number }
        toast.error(`命令执行失败 (${aliasName})`, {
          description: data?.stderr || result.message || '未知错误'
        })
      }
    } catch (error) {
      console.error('执行命令失败:', error)
      toast.error('执行命令失败', {
        description: String(error)
      })
    }
  }

  // 用 VSCode 打开项目目录
  const handleOpenVSCode = async (path: string, serviceName: string) => {
    try {
      await ipcOpenProjectInVSCode(path, selectedEnvironmentId)
      toast.success(`正在用 VSCode 打开 "${serviceName}"...`)
    } catch (error) {
      console.error('打开 VSCode 失败:', error)
      toast.error('打开 VSCode 失败')
    }
  }

  // 打开文件夹
  const handleOpenFolder = async (path: string, serviceName: string) => {
    try {
      await ipcOpenFolderInFinder(path)
      toast.success(`正在打开 "${serviceName}" 文件夹...`)
    } catch (error) {
      console.error('打开文件夹失败:', error)
      toast.error('打开文件夹失败')
    }
  }

  // 打开终端
  const handleOpenTerminal = async (path: string, serviceName: string) => {
    try {
      await ipcOpenTerminalInFolder(path)
      toast.success(`正在终端中打开 "${serviceName}"...`)
    } catch (error) {
      console.error('打开终端失败:', error)
      toast.error('打开终端失败')
    }
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br backdrop-blur-xl overflow-y-auto">
      {/* Header */}
      <div className="p-2 border-b border-divider">
        <div className="flex items-center justify-between ml-2">
          <div className="flex flex-col">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="text-sm font-semibold text-foreground cursor-default hover:underline underline-offset-4">
                    {selectedEnvironment?.name ?? t('dashboard.unknown_env')}
                  </h3>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{t('dashboard.env_id')}{selectedEnvironment?.id ?? '--'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4 bg-gradient-to-br from-background/50 to-content1/30 backdrop-blur-xl">

        {/* System Monitor */}
        <SystemMonitor systemInfo={systemInfo} />

        {/* Custom Service Aliases and Directories */}
        {(customServiceDirectories.length > 0 || customServiceAliases.length > 0) && (
          <TooltipProvider>
            <div className="w-full space-y-3">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1">快捷指令</h2>

              {customServiceDirectories.length > 0 && (
                <div className="space-y-2.5">
                  {customServiceDirectories.map((dir) => (
                    <div
                      key={`${dir.serviceId}-directory`}
                      className="group relative rounded-lg shadow-sm border border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] transition-all duration-200"
                    >
                      <div className="flex items-center justify-between p-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-foreground truncate">
                            Project
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {dir.path}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenVSCode(dir.path, dir.serviceName)}
                                className="h-7 w-7 rounded-md bg-blue-500/10 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-400/30 transition-all duration-200"
                              >
                                <Code2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>用 VSCode 打开</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenFolder(dir.path, dir.serviceName)}
                                className="h-7 w-7 rounded-md bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-400/30 transition-all duration-200"
                              >
                                <FolderOpen className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>打开文件夹</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenTerminal(dir.path, dir.serviceName)}
                                className="h-7 w-7 rounded-md bg-purple-500/10 hover:bg-purple-500/20 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-400/30 transition-all duration-200"
                              >
                                <Terminal className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>打开终端</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {customServiceAliases.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {customServiceAliases.map((alias, index) => (
                    <div
                      key={`${alias.serviceName}-${alias.aliasName}-${index}`}
                      className="group relative rounded-lg shadow-sm border border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 p-3 cursor-help">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-foreground truncate">
                            {alias.aliasName}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {alias.command}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            executeAlias(alias.aliasName, alias.command)
                          }}
                          className="h-7 w-7 flex-shrink-0 rounded-md bg-green-500/10 hover:bg-green-500/20 dark:bg-green-500/20 dark:hover:bg-green-500/30 text-green-700 dark:text-green-400 border border-green-200/50 dark:border-green-400/30 transition-all duration-200"
                          title={t('alias.execute', '执行命令')}
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TooltipProvider>
        )}

        {/* Service Resource Monitor */}
        {services.length > 0 && (
          <div className="w-full space-y-3">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1">
              {t('resource_monitor.title')}
            </h2>
            <div className="rounded-lg border border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/5">
                    <th className="py-2 px-3 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                      {t('resource_monitor.col_service')}
                    </th>
                    <th className="py-2 px-3 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider w-16">
                      {t('resource_monitor.col_version')}
                    </th>
                    <th className="py-2 px-3 text-right text-[10px] font-medium text-gray-400 uppercase tracking-wider w-16">
                      {t('resource_monitor.col_cpu')}
                    </th>
                    <th className="py-2 px-3 text-right text-[10px] font-medium text-gray-400 uppercase tracking-wider w-20">
                      {t('resource_monitor.col_memory')}
                    </th>
                    <th className="py-2 px-3 text-right text-[10px] font-medium text-gray-400 uppercase tracking-wider w-28">
                      {t('resource_monitor.col_disk')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service, index) => {
                    const stat = getStatsForService(service.type as ServiceType)
                    const isRunning = stat !== null && stat.pidCount > 0
                    const hasProcess = getServiceProcessNames(service.type as ServiceType).length > 0

                    return (
                      <tr
                        key={service.id}
                        className={`${index > 0 ? 'border-t border-gray-200 dark:border-white/5' : ''} hover:bg-gray-100/50 dark:hover:bg-white/[0.02] transition-colors`}
                      >
                        {/* 服务名 */}
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-foreground truncate">{service.name}</span>
                        </td>
                        {/* 版本 */}
                        <td className="py-2.5 px-3 text-left w-16">
                          <span className="text-gray-400 text-[10px] flex-shrink-0">{service.version}</span>
                        </td>
                        {/* CPU */}
                        <td className="py-2.5 px-3 text-right w-16">
                          {isRunning ? (
                            <span className="text-gray-700 dark:text-gray-300 font-mono text-[10px]">
                              {stat!.cpuUsage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-[10px]">
                              {hasProcess ? t('resource_monitor.not_running') : '--'}
                            </span>
                          )}
                        </td>
                        {/* 内存 */}
                        <td className="py-2.5 px-3 text-right w-20">
                          {isRunning ? (
                            <span className="text-gray-700 dark:text-gray-300 font-mono text-[10px]">
                              {formatBytes(stat!.memoryBytes)}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-[10px]">--</span>
                          )}
                        </td>
                        {/* 磁盘 I/O */}
                        <td className="py-2.5 px-3 text-right w-28">
                          {isRunning ? (
                            <div className="text-[10px] flex justify-end items-center gap-1 text-gray-500 whitespace-nowrap">
                              <span className="text-gray-400">R</span>
                              <span className="font-mono text-gray-700 dark:text-gray-300">
                                {formatBytes(stat!.diskReadBytes)}/s
                              </span>
                              <span className="text-gray-400">W</span>
                              <span className="font-mono text-gray-700 dark:text-gray-300">
                                {formatBytes(stat!.diskWriteBytes)}/s
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-[10px]">--</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

