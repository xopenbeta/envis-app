import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Database, FolderOpen, Power, PowerOff, RefreshCw, RotateCw, FileText, Settings, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DownloadStatus, NeedDownloadServices, ServiceData, ServiceDataStatus, ServiceStatus } from '@/types/index'
import { RedisConfig, RedisMetadata } from '@/types/service'
import { useMemo, useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { selectedEnvironmentIdAtom } from '@/store/environment'
import { useRedis } from '@/hooks/services/redis'
import { useEnvironmentServiceData, useServiceData } from '@/hooks/env-serv-data'
import { useFileOperations } from '@/hooks/file-operations'
import { ipcOpenSelectDialog } from '@/ipc/file-operations'
import { useServiceDataStatus, useServiceDownloadStatus, useServiceStatus } from '@/hooks/useStatus'

interface RedisServiceProps {
  serviceData: ServiceData
}

export function RedisService({ serviceData }: RedisServiceProps) {
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)
  const { openFolderInFinder } = useFileOperations()
  const { t } = useTranslation()
  const { initializeRedis, checkRedisInitialized, getRedisConfig, openRedisClient } = useRedis()
  const { startServiceData, stopServiceData, restartServiceData } = useServiceData()
  const { updateServiceData, selectedServiceDatas } = useEnvironmentServiceData()

  const metadata = (serviceData.metadata || {}) as RedisMetadata

  const [isInitialized, setIsInitialized] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)

  const { serviceDataStatus } = useServiceDataStatus(selectedEnvironmentId, serviceData.id, {
    enabled: true,
    interval: 500,
  })

  const isServiceActive = serviceDataStatus === ServiceDataStatus.Active

  const { status: serviceStatus, refresh: refreshServiceStatus } = useServiceStatus(selectedEnvironmentId, serviceData, {
    enabled: isServiceActive && Boolean(isInitialized),
    interval: 500,
  })

  const { downloadStatus } = useServiceDownloadStatus(serviceData.type, serviceData.version, {
    enabled: NeedDownloadServices.includes(serviceData.type),
    interval: 500,
  })

  const isInstalled = !NeedDownloadServices.includes(serviceData.type) || downloadStatus === DownloadStatus.Installed

  const [showInitDialog, setShowInitDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [runtimeConfig, setRuntimeConfig] = useState<RedisConfig>({
    configPath: metadata.REDIS_CONFIG || '',
    dataPath: '',
    logPath: '',
    port: 6379,
    bindIp: '127.0.0.1',
    password: '',
    rdbEnabled: false,
    aofEnabled: false,
  })
  const [dialogData, setDialogData] = useState({
    password: '',
    port: '6379',
    bindIp: '127.0.0.1',
    rdbEnabled: false,
    aofEnabled: false,
  })

  const configPath = useMemo(() => metadata.REDIS_CONFIG || '', [metadata.REDIS_CONFIG])
  const [editConfigPath, setEditConfigPath] = useState(metadata.REDIS_CONFIG || '')

  // 判断初始化
  useEffect(() => {
    refreshInitStatus()
  }, [selectedEnvironmentId, serviceData.id])

  const refreshConfigPaths = async (effectiveServiceData: ServiceData = serviceData) => {
    try {
      const result = await getRedisConfig(selectedEnvironmentId, effectiveServiceData)
      if (result.success && result.data) {
        const configData = result.data
        setRuntimeConfig(configData)
        setEditConfigPath(configData.configPath || '')
        setDialogData(prev => ({
          ...prev,
          password: configData.password || '',
          port: String(configData.port),
          bindIp: configData.bindIp,
          rdbEnabled: configData.rdbEnabled,
          aofEnabled: configData.aofEnabled,
        }))
      }
    } catch (error) {
      console.error('获取 Redis 配置路径失败:', error)
    }
  }

  const handleBrowseConfigFile = async () => {
    const result = await ipcOpenSelectDialog()
    if (result.success && result.data) {
      setEditConfigPath(result.data as string)
    }
  }

  const handleSaveConfigPath = async () => {
    if (!editConfigPath) return
    try {
      const updatedServiceData = await persistRedisMetadata({ REDIS_CONFIG: editConfigPath })
      await refreshConfigPaths(updatedServiceData)
      toast.success(t('redis_service.config_path_set_success'))
    } catch (error) {
      toast.error(t('redis_service.config_path_set_failed', { message: String(error) }))
    }
  }

  const refreshInitStatus = async (effectiveServiceData: ServiceData = serviceData) => {
    try {
      const result = await checkRedisInitialized(selectedEnvironmentId, effectiveServiceData)
      if (result.success && result.data) {
        setIsInitialized(result.data.initialized)
        if (result.data.initialized) {
          await refreshConfigPaths(effectiveServiceData)
        }
        return
      }

      console.error('检查 Redis 初始化状态失败:', result.message)
      setIsInitialized(false)
      setRuntimeConfig(prev => ({
        ...prev,
        dataPath: '',
        logPath: '',
        port: 6379,
        bindIp: '127.0.0.1',
        rdbEnabled: false,
        aofEnabled: false,
      }))
    } catch (error) {
      console.error('检查 Redis 初始化状态失败:', error)
      setIsInitialized(false)
      setRuntimeConfig(prev => ({
        ...prev,
        dataPath: '',
        logPath: '',
        port: 6379,
        bindIp: '127.0.0.1',
        rdbEnabled: false,
        aofEnabled: false,
      }))
    }
  }

  const persistRedisMetadata = async (patch: RedisMetadata): Promise<ServiceData> => {
    const newMetadata: RedisMetadata = { ...(serviceData.metadata || {}), ...patch }
    const updated = await updateServiceData({
      environmentId: selectedEnvironmentId,
      serviceId: serviceData.id,
      updates: { metadata: newMetadata },
      serviceDatas: selectedServiceDatas,
    })
    return updated ?? { ...serviceData, metadata: newMetadata }
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
        dialogData.rdbEnabled,
        dialogData.aofEnabled,
        reset,
      )

      if (!result.success || !result.data) {
        toast.error(result.message || t('redis_service.init_failed'))
        return
      }

      const updatedServiceData = await persistRedisMetadata({
        REDIS_CONFIG: result.data.configPath,
        REDIS_PASSWORD: result.data.password,
      })

      toast.success(reset ? t('redis_service.reset_success') : t('redis_service.init_success'))
      setShowInitDialog(false)
      setShowResetDialog(false)
      await refreshInitStatus(updatedServiceData)
    } catch (error) {
      toast.error(t('redis_service.init_error', { message: String(error) }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleStart = async () => {
    try {
      setIsStarting(true)
      const res = await startServiceData(selectedEnvironmentId, serviceData)
      console.log('启动 Redis 结果:', res)
      if (res?.success) {
        toast.success(t('redis_service.start_success'))
      } else {
        toast.error(res?.message || t('redis_service.start_failed'))
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
        toast.success(t('redis_service.stop_success'))
      } else {
        toast.error(res?.message || t('redis_service.stop_failed'))
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
        toast.success(t('redis_service.restart_success'))
      } else {
        toast.error(res?.message || t('redis_service.restart_failed'))
      }
    } finally {
      setIsRestarting(false)
    }
  }

  // 检测初始化模块
  const InitRedisCard = () => {
    if (!isInstalled) return null;
    return (
      <>
        {isInitialized === null ? (
          <div className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              {t('redis_service.checking_init')}
            </div>
          </div>
        ) : !isInitialized ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {t('redis_service.not_initialized_title')}
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  {t('redis_service.not_initialized_desc')}
                </p>
              </div>
            </div>
            <div className="flex">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowInitDialog(true)}
                disabled={!isServiceActive || !isServiceActive || !isInstalled || isLoading}
                className="h-7 text-xs shadow-none bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white"
              >
                {t('redis_service.init_now')}
              </Button>
            </div>
          </div>
        ) : (
          null
        )}
      </>
    )
  }

  return (
    <div className="w-full p-3 space-y-3">

      <InitRedisCard />

      <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
        <div className="flex items-center justify-between mb-2">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
            <Database className="h-3.5 w-3.5" />
            {t('redis_service.service_control')}
          </Label>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              serviceStatus === ServiceStatus.Running ? "bg-green-500" :
                serviceStatus === ServiceStatus.Stopped ? "bg-red-500" : "bg-gray-300"
            )} />
            <span className="text-xs text-muted-foreground">
              {serviceStatus === ServiceStatus.Running ? t('redis_service.running') : serviceStatus === ServiceStatus.Stopped ? t('redis_service.stopped') : t('redis_service.unknown_status')}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="shadow-none" variant="outline" onClick={handleStart} disabled={!isServiceActive || !isServiceActive || !isInstalled || !isInitialized || serviceStatus === ServiceStatus.Running || isStarting || isStopping || isRestarting}>
            {isStarting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5 text-green-600" />}
            &nbsp;{t('redis_service.start')}
          </Button>
          <Button size="sm" className="shadow-none" variant="outline" onClick={handleStop} disabled={!isServiceActive || !isServiceActive || !isInstalled || serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}>
            <PowerOff className="h-3.5 w-3.5 text-red-600" />
            &nbsp;{t('redis_service.stop')}
          </Button>
          <Button size="sm" className="shadow-none" variant="outline" onClick={handleRestart} disabled={!isServiceActive || !isServiceActive || !isInstalled || serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}>
            <RotateCw className={cn("h-3.5 w-3.5 text-blue-600", isRestarting && "animate-spin")} />
            &nbsp;{t('redis_service.restart')}
          </Button>
        </div>
      </div>

      <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] space-y-3">
        <div className="grid grid-cols-1 gap-3 text-xs">
          <div>
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('redis_service.config_file_label')}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={editConfigPath}
                onChange={(e) => setEditConfigPath(e.target.value)}
                className="flex-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                placeholder={t('redis_service.config_path_placeholder')}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                onClick={handleBrowseConfigFile}
                title={t('redis_service.select_file_title')}
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                onClick={() => editConfigPath && openFolderInFinder(editConfigPath)}
                disabled={!editConfigPath}
                title={t('redis_service.open_dir_title')}
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
              {editConfigPath !== (runtimeConfig.configPath || configPath) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 shadow-none text-xs text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-950/20"
                  onClick={handleSaveConfigPath}
                  title={t('redis_service.save_title')}
                >
                  {t('common.save')}
                </Button>
              )}
            </div>
          </div>
          <div className="pt-2 border-t border-gray-200 dark:border-white/10 space-y-3">
            <div>
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('redis_service.log_file_label')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={runtimeConfig.logPath}
                  disabled
                  className="flex-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  onClick={() => runtimeConfig.logPath && openFolderInFinder(runtimeConfig.logPath)}
                  disabled={!runtimeConfig.logPath}
                  title={t('redis_service.open_dir_title')}
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('redis_service.data_dir_label')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={runtimeConfig.dataPath}
                  disabled
                  className="flex-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  onClick={() => runtimeConfig.dataPath && openFolderInFinder(runtimeConfig.dataPath)}
                  disabled={!runtimeConfig.dataPath}
                  title={t('redis_service.open_dir_title')}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('redis_service.bind_address_label')}</Label>
                <div className="mt-1">
                  <Input
                    value={runtimeConfig.bindIp}
                    disabled
                    className="h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('redis_service.port_label')}</Label>
                <div className="mt-1">
                  <Input
                    value={String(runtimeConfig.port)}
                    disabled
                    className="h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('redis_service.management_tools')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  size="sm"
                  className="shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const result = await openRedisClient(selectedEnvironmentId, serviceData)
                      if (result.success) {
                        toast.success(t('redis_service.client_opened'))
                      } else {
                        toast.error(result.message || t('redis_service.client_open_failed'))
                      }
                    } catch (error) {
                      toast.error(t('redis_service.client_open_failed_msg', { message: String(error) }))
                    }
                  }}
                  disabled={!isServiceActive || !isInstalled || serviceStatus !== ServiceStatus.Running}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  Redis CLI
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] space-y-3">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('redis_service.other_operations')}</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 shadow-none"
            variant="ghost"
            onClick={() => setShowResetDialog(true)}
            disabled={!isServiceActive || !isServiceActive || !isInstalled || isLoading || isInitialized !== true || serviceStatus === ServiceStatus.Running}
          >
            {t('redis_service.reset_init')}
          </Button>
        </div>
      </div>

      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('redis_service.init_title')}</DialogTitle>
            <DialogDescription>
              {t('redis_service.init_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('redis_service.port_label')}</Label>
              <Input value={dialogData.port} onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))} placeholder="6379" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('redis_service.bind_address_label')}</Label>
              <Input value={dialogData.bindIp} onChange={(e) => setDialogData(prev => ({ ...prev, bindIp: e.target.value }))} placeholder="127.0.0.1" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('redis_service.password_label')}</Label>
              <Input value={dialogData.password} onChange={(e) => setDialogData(prev => ({ ...prev, password: e.target.value }))} placeholder={t('redis_service.password_placeholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('redis_service.persistence_label')}</Label>
              <div className="space-y-2 rounded-md border border-border/60 p-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={dialogData.rdbEnabled}
                    onCheckedChange={(checked) => setDialogData(prev => ({ ...prev, rdbEnabled: checked === true }))}
                  />
                  <span>{t('redis_service.enable_rdb')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={dialogData.aofEnabled}
                    onCheckedChange={(checked) => setDialogData(prev => ({ ...prev, aofEnabled: checked === true }))}
                  />
                  <span>{t('redis_service.enable_aof')}</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => handleInitialize(false)} disabled={isLoading}>{isLoading ? t('redis_service.processing') : t('redis_service.confirm_init')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('redis_service.reset_title')}</DialogTitle>
            <DialogDescription>
              {t('redis_service.reset_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('redis_service.port_label')}</Label>
              <Input value={dialogData.port} onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('redis_service.bind_address_label')}</Label>
              <Input value={dialogData.bindIp} onChange={(e) => setDialogData(prev => ({ ...prev, bindIp: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('redis_service.password_label')}</Label>
              <Input value={dialogData.password} onChange={(e) => setDialogData(prev => ({ ...prev, password: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('redis_service.persistence_label')}</Label>
              <div className="space-y-2 rounded-md border border-border/60 p-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={dialogData.rdbEnabled}
                    onCheckedChange={(checked) => setDialogData(prev => ({ ...prev, rdbEnabled: checked === true }))}
                  />
                  <span>{t('redis_service.enable_rdb')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={dialogData.aofEnabled}
                    onCheckedChange={(checked) => setDialogData(prev => ({ ...prev, aofEnabled: checked === true }))}
                  />
                  <span>{t('redis_service.enable_aof')}</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => handleInitialize(true)} disabled={isLoading}>{isLoading ? t('redis_service.processing') : t('redis_service.confirm_reset')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
