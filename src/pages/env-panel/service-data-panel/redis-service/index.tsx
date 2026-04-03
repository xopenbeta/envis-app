import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from 'sonner'
import { Database, FolderOpen, Power, PowerOff, RefreshCw, RotateCw, FileText, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ServiceData, ServiceDataStatus, ServiceStatus } from '@/types/index'
import { RedisMetadata } from '@/types/service'
import { useEffect, useMemo, useState } from 'react'
import { useAtom } from 'jotai'
import { selectedEnvironmentIdAtom } from '@/store/environment'
import { useRedis } from '@/hooks/services/redis'
import { useEnvironmentServiceData, useServiceData } from '@/hooks/env-serv-data'
import { useFileOperations } from '@/hooks/file-operations'

interface RedisServiceProps {
  serviceData: ServiceData
}

export function RedisService({ serviceData }: RedisServiceProps) {
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)
  const { openFolderInFinder } = useFileOperations()
  const { initializeRedis, checkRedisInitialized, getRedisConfig } = useRedis()
  const { startServiceData, stopServiceData, restartServiceData } = useServiceData()
  const { getServiceStatus, updateServiceData, selectedServiceDatas } = useEnvironmentServiceData()

  const isServiceActive = serviceData.status === ServiceDataStatus.Active
  const metadata = (serviceData.metadata || {}) as RedisMetadata

  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>(ServiceStatus.Unknown)
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)

  const [showInitDialog, setShowInitDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [dialogData, setDialogData] = useState({
    password: metadata.REDIS_PASSWORD || '',
    port: String(metadata.REDIS_PORT || 6379),
    bindIp: metadata.REDIS_BIND_IP || '127.0.0.1',
  })

  const configPath = useMemo(() => metadata.REDIS_CONFIG || '', [metadata.REDIS_CONFIG])
  const dataPath = useMemo(() => metadata.REDIS_DATA || '', [metadata.REDIS_DATA])
  const logPath = useMemo(() => metadata.REDIS_LOG || '', [metadata.REDIS_LOG])

  useEffect(() => {
    setDialogData({
      password: metadata.REDIS_PASSWORD || '',
      port: String(metadata.REDIS_PORT || 6379),
      bindIp: metadata.REDIS_BIND_IP || '127.0.0.1',
    })
  }, [metadata.REDIS_PASSWORD, metadata.REDIS_PORT, metadata.REDIS_BIND_IP])

  useEffect(() => {
    if (!isServiceActive) {
      setServiceStatus(ServiceStatus.Unknown)
      setIsInitialized(null)
      return
    }

    const refreshBaseState = async () => {
      await Promise.all([refreshInitStatus(), refreshServiceStatus()])
    }

    refreshBaseState()
    const timer = setInterval(refreshServiceStatus, 2000)
    return () => clearInterval(timer)
  }, [isServiceActive, selectedEnvironmentId, serviceData.id])

  const refreshInitStatus = async () => {
    try {
      const result = await checkRedisInitialized(selectedEnvironmentId, serviceData)
      if (result.success && result.data) {
        setIsInitialized(result.data.initialized)
      }
    } catch (error) {
      console.error('检查 Redis 初始化状态失败:', error)
    }
  }

  const refreshServiceStatus = async () => {
    try {
      const result = await getServiceStatus(selectedEnvironmentId, serviceData)
      if (result.success && result.data?.status) {
        setServiceStatus(result.data.status)
      }
    } catch (error) {
      console.error('获取 Redis 服务状态失败:', error)
    }
  }

  const persistRedisMetadata = async (patch: RedisMetadata) => {
    const newMetadata: RedisMetadata = { ...(serviceData.metadata || {}), ...patch }
    await updateServiceData({
      environmentId: selectedEnvironmentId,
      serviceId: serviceData.id,
      updates: { metadata: newMetadata },
      serviceDatasSnapshot: selectedServiceDatas,
    })
  }

  const handleInitialize = async (reset: boolean) => {
    if (!isServiceActive) return
    try {
      setIsLoading(true)
      const result = await initializeRedis(
        selectedEnvironmentId,
        serviceData,
        dialogData.password || undefined,
        dialogData.port || undefined,
        dialogData.bindIp || undefined,
        reset,
      )

      if (!result.success || !result.data) {
        toast.error(result.message || '初始化 Redis 失败')
        return
      }

      await persistRedisMetadata({
        REDIS_CONFIG: result.data.configPath,
        REDIS_DATA: result.data.dataPath,
        REDIS_LOG: result.data.logPath,
        REDIS_PORT: Number(result.data.port),
        REDIS_BIND_IP: result.data.bindIp,
        REDIS_PASSWORD: result.data.password,
      })

      toast.success(reset ? 'Redis 重置并初始化成功' : 'Redis 初始化成功')
      setShowInitDialog(false)
      setShowResetDialog(false)
      await refreshInitStatus()

      const configRes = await getRedisConfig(selectedEnvironmentId, serviceData)
      if (configRes.success && configRes.data) {
        await persistRedisMetadata({
          REDIS_CONFIG: configRes.data.configPath,
          REDIS_DATA: configRes.data.dataPath,
          REDIS_LOG: configRes.data.logPath,
          REDIS_PORT: Number(configRes.data.port),
          REDIS_BIND_IP: configRes.data.bindIp,
          REDIS_PASSWORD: configRes.data.password,
        })
      }
    } catch (error) {
      toast.error('初始化 Redis 失败: ' + error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStart = async () => {
    try {
      setIsStarting(true)
      const res = await startServiceData(selectedEnvironmentId, serviceData)
      if (res?.success) {
        toast.success('Redis 启动成功')
        await refreshServiceStatus()
      } else {
        toast.error(res?.message || 'Redis 启动失败')
      }
    } finally {
      setIsStarting(false)
    }
  }

  const handleStop = async () => {
    try {
      setIsStopping(true)
      const res = await stopServiceData(selectedEnvironmentId, serviceData)
      if (res?.success) {
        toast.success('Redis 停止成功')
        await refreshServiceStatus()
      } else {
        toast.error(res?.message || 'Redis 停止失败')
      }
    } finally {
      setIsStopping(false)
    }
  }

  const handleRestart = async () => {
    try {
      setIsRestarting(true)
      const res = await restartServiceData(selectedEnvironmentId, serviceData)
      if (res?.success) {
        toast.success('Redis 重启成功')
        await refreshServiceStatus()
      } else {
        toast.error(res?.message || 'Redis 重启失败')
      }
    } finally {
      setIsRestarting(false)
    }
  }

  return (
    <div className="w-full p-3 space-y-4">
      {isInitialized === null ? (
        <div className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Redis 初始化状态检测中...
          </div>
        </div>
      ) : !isInitialized ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-1">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Redis 尚未初始化
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                请先完成 Redis 初始化，初始化后可使用运行控制与运行信息设置。
              </p>
            </div>
          </div>
          <div className="flex">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowInitDialog(true)}
              disabled={!isServiceActive || isLoading}
              className="h-7 text-xs shadow-none bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white"
            >
              初始化 Redis
            </Button>
          </div>
        </div>
      ) : (
        null
      )}

      {isServiceActive && isInitialized ? (
        <>
          <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                <Database className="h-3.5 w-3.5" />
                Redis 状态
              </Label>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  serviceStatus === ServiceStatus.Running ? "bg-green-500" :
                  serviceStatus === ServiceStatus.Stopped ? "bg-red-500" : "bg-gray-300"
                )} />
                <span className="text-xs text-muted-foreground">
                  {serviceStatus === ServiceStatus.Running ? '运行中' : serviceStatus === ServiceStatus.Stopped ? '已停止' : '未知'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="shadow-none" variant="outline" onClick={handleStart} disabled={!isServiceActive || !isInitialized || serviceStatus === ServiceStatus.Running || isStarting || isStopping || isRestarting}>
                {isStarting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5 text-green-600" />}
                启动
              </Button>
              <Button size="sm" className="shadow-none" variant="outline" onClick={handleStop} disabled={!isServiceActive || serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}>
                <PowerOff className="h-3.5 w-3.5 text-red-600" />
                停止
              </Button>
              <Button size="sm" className="shadow-none" variant="outline" onClick={handleRestart} disabled={!isServiceActive || serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}>
                <RotateCw className={cn("h-3.5 w-3.5 text-blue-600", isRestarting && "animate-spin")} />
                重启
              </Button>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] space-y-3">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">运行信息</Label>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span>端口</span>
                <span className="font-mono">{metadata.REDIS_PORT || 6379}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>绑定地址</span>
                <span className="font-mono">{metadata.REDIS_BIND_IP || '127.0.0.1'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>配置文件</span>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => configPath && openFolderInFinder(configPath)} disabled={!configPath}>
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>日志文件</span>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => logPath && openFolderInFinder(logPath)} disabled={!logPath}>
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>数据目录</span>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => dataPath && openFolderInFinder(dataPath)} disabled={!dataPath}>
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] space-y-3">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">其他操作</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="shadow-none"
                variant="outline"
                onClick={() => setShowResetDialog(true)}
                disabled={!isServiceActive || isLoading || isInitialized !== true || serviceStatus === ServiceStatus.Running}
              >
                重置初始化
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
          <Settings className="h-6 w-6 mx-auto mb-2 opacity-50" />
          {!isServiceActive ? (
            <>
              <p className="text-sm">服务未激活，无法显示 Redis 设置信息</p>
              <p className="text-xs">请先激活 Redis 服务</p>
            </>
          ) : isInitialized === null ? (
            <>
              <p className="text-sm">Redis 初始化状态检测中</p>
              <p className="text-xs">请稍候后刷新当前状态</p>
            </>
          ) : (
            <>
              <p className="text-sm">Redis 尚未初始化</p>
              <p className="text-xs">请先完成初始化</p>
            </>
          )}
        </div>
      )}

      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>初始化 Redis</DialogTitle>
            <DialogDescription>
              将创建 redis.conf、数据目录和日志目录。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>端口</Label>
              <Input value={dialogData.port} onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))} placeholder="6379" />
            </div>
            <div className="space-y-1.5">
              <Label>绑定地址</Label>
              <Input value={dialogData.bindIp} onChange={(e) => setDialogData(prev => ({ ...prev, bindIp: e.target.value }))} placeholder="127.0.0.1" />
            </div>
            <div className="space-y-1.5">
              <Label>密码（可选）</Label>
              <Input value={dialogData.password} onChange={(e) => setDialogData(prev => ({ ...prev, password: e.target.value }))} placeholder="留空表示不启用 requirepass" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitDialog(false)}>取消</Button>
            <Button onClick={() => handleInitialize(false)} disabled={isLoading}>{isLoading ? '处理中...' : '确认初始化'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置 Redis 初始化</DialogTitle>
            <DialogDescription>
              将清空当前 Redis 初始化目录并重建配置。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>端口</Label>
              <Input value={dialogData.port} onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>绑定地址</Label>
              <Input value={dialogData.bindIp} onChange={(e) => setDialogData(prev => ({ ...prev, bindIp: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>密码（可选）</Label>
              <Input value={dialogData.password} onChange={(e) => setDialogData(prev => ({ ...prev, password: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>取消</Button>
            <Button variant="destructive" onClick={() => handleInitialize(true)} disabled={isLoading}>{isLoading ? '处理中...' : '确认重置'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
