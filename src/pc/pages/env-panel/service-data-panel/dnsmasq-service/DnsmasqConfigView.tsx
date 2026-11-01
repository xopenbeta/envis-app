import { useState, useEffect, useMemo } from 'react'
import { ServiceData, ServiceDataStatus, ServiceStatus } from '@/types/index'
import { useEnvironmentServiceData, useServiceData } from '@/hooks/env-serv-data'
import { useFileOperations } from '@/hooks/file-operations'
import { useDnsmasqService } from '@/hooks/services/dnsmasq'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FolderOpen, Play, Square, RotateCw, Save, FileText, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useServiceDataStatus, useServiceStatus } from '@/hooks/useStatus'
import { Trans, useTranslation } from 'react-i18next'

interface DnsmasqConfigViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

export function DnsmasqConfigView({
    selectedEnvironmentId,
    serviceData,
}: DnsmasqConfigViewProps) {
    const { t } = useTranslation()
    const { openFolderInFinder } = useFileOperations()
    const {
        startServiceData,
        stopServiceData,
        restartServiceData,
    } = useServiceData()
    const {
        updateServiceData,
        selectedServiceDatas,
    } = useEnvironmentServiceData()
    const { getDnsmasqConfig } = useDnsmasqService()

    const { serviceDataStatus } = useServiceDataStatus(selectedEnvironmentId, serviceData.id, { enabled: true })
    const isServiceActive = serviceDataStatus === ServiceDataStatus.Active
    const isMacOS = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
    const configPath = useMemo(() => {
        return serviceData.metadata?.['DNSMASQ_CONF'] || ''
    }, [serviceData.metadata])

    const [editingConfigPath, setEditingConfigPath] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    
    const { status: serviceStatus } = useServiceStatus(selectedEnvironmentId, serviceData, {
        enabled: isServiceActive,
        interval: 3000,
    })
    const [isStarting, setIsStarting] = useState(false)
    const [isStopping, setIsStopping] = useState(false)
    const [isRestarting, setIsRestarting] = useState(false)

    // 配置文件内容
    const [configContent, setConfigContent] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    // 初始化编辑路径
    useEffect(() => {
        setEditingConfigPath(configPath)
    }, [configPath])

    // 加载配置
    useEffect(() => {
        const loadConfig = async () => {
            if (!isServiceActive) return
            
            try {
                setIsLoading(true)
                const res = await getDnsmasqConfig(selectedEnvironmentId, serviceData)
                if (res.success && res.data?.content) {
                    setConfigContent(res.data.content)
                    if (res.data.path && !configPath) {
                        setEditingConfigPath(res.data.path)
                    }
                }
            } catch (error) {
                console.error('加载配置失败:', error)
                toast.error(t('dnsmasq_service.load_config_failed'))
            } finally {
                setIsLoading(false)
            }
        }
        
        loadConfig()
    }, [isServiceActive, configPath, selectedEnvironmentId, serviceData])

    const handleOpenConfigFolder = async () => {
        const targetPath = configPath || editingConfigPath
        if (!targetPath) return
        try {
            // 打开配置文件所在的文件夹
            const folderPath = targetPath.substring(0, targetPath.lastIndexOf(targetPath.includes('\\') ? '\\' : '/'))
            await openFolderInFinder(folderPath)
        } catch (error) {
            toast.error(t('common.open_folder_failed'))
        }
    }

    const handleSetConfigPath = async () => {
        try {
            // 更新 metadata
            const newMetadata = { ...serviceData.metadata, DNSMASQ_CONF: editingConfigPath }
            const updatedServiceData = { ...serviceData, metadata: newMetadata }
            
            await updateServiceData({
                environmentId: selectedEnvironmentId,
                serviceId: serviceData.id,
                updates: updatedServiceData,
                serviceDatas: selectedServiceDatas,
            })
            toast.success(t('dnsmasq_service.config_path_updated'))
        } catch (error) {
            console.error('更新配置路径失败:', error)
            toast.error(t('dnsmasq_service.config_path_update_failed'))
        }
    }

    // 启动服务
    const handleStartService = async () => {
        try {
            setIsStarting(true)
            await startServiceData(selectedEnvironmentId, serviceData)
            toast.success(t('dnsmasq_service.start_success'))
            // 状态更新会通过轮询自动完成
        } catch (error) {
            console.error('启动服务失败:', error)
            toast.error(t('dnsmasq_service.start_failed'))
        } finally {
            setIsStarting(false)
        }
    }

    // 停止服务
    const handleStopService = async () => {
        try {
            setIsStopping(true)
            await stopServiceData(selectedEnvironmentId, serviceData)
            toast.success(t('dnsmasq_service.stop_success'))
        } catch (error) {
            console.error('停止服务失败:', error)
            toast.error(t('dnsmasq_service.stop_failed'))
        } finally {
            setIsStopping(false)
        }
    }

    // 重启服务
    const handleRestartService = async () => {
        try {
            setIsRestarting(true)
            await restartServiceData(selectedEnvironmentId, serviceData)
            toast.success(t('dnsmasq_service.restart_success'))
        } catch (error) {
            console.error('重启服务失败:', error)
            toast.error(t('dnsmasq_service.restart_failed'))
        } finally {
            setIsRestarting(false)
        }
    }

    return (
        <div className="w-full p-3 space-y-4">
            <Alert className="bg-warning/10 dark:bg-warning/10 border-warning/30 dark:border-warning/20 mb-4">
                <AlertTriangle className="h-4 w-4 text-warning dark:text-warning" />
                <AlertDescription className="text-warning dark:text-warning/90 text-xs mt-1.5 space-y-2">
                    {isMacOS && (
                        <p>
                            <Trans
                                i18nKey="dnsmasq_service.macos_resolver_hint"
                                components={[<span key="resolver" className="font-mono" />]}
                            />
                        </p>
                    )}
                </AlertDescription>
            </Alert>

            {/* 控制面板 */}
            <div className="p-3 rounded-xl border border-divider bg-content1">
                <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        {t('dnsmasq_service.service_control')}
                    </Label>
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            serviceStatus === ServiceStatus.Running ? " bg-success" : 
                            serviceStatus === ServiceStatus.Stopped ? " bg-danger" : " bg-content4"
                        )} />
                        <span className="text-xs font-normal text-muted-foreground">
                            {serviceStatus === ServiceStatus.Running ? t('dnsmasq_service.running') : 
                             serviceStatus === ServiceStatus.Stopped ? t('dnsmasq_service.stopped') : t('dnsmasq_service.unknown_status')}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-1 h-8 text-xs bg-content1 dark:bg-content1/40 border-divider"
                        onClick={handleStartService}
                        disabled={serviceStatus === ServiceStatus.Running || isStarting || isStopping || isRestarting}
                    >
                        <Play className="h-3.5 w-3.5 text-success" />
                        {t('dnsmasq_service.start')}
                    </Button>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-1 h-8 text-xs bg-content1 dark:bg-content1/40 border-divider"
                        onClick={handleStopService}
                        disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
                    >
                        <Square className="h-3.5 w-3.5 text-danger" />
                        {t('dnsmasq_service.stop')}
                    </Button>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-1 h-8 text-xs bg-content1 dark:bg-content1/40 border-divider"
                        onClick={handleRestartService}
                        disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
                    >
                        <RotateCw className={cn("h-3.5 w-3.5 text-focus", isRestarting && "animate-spin")} />
                        {t('dnsmasq_service.restart')}
                    </Button>
                </div>
            </div>

            {/* 配置路径设置 */}
            <div className="p-3 rounded-xl border border-divider bg-content1">
                <Label className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2">
                    {t('dnsmasq_service.config_file_settings')}
                </Label>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="config-path" className="text-xs text-muted-foreground font-normal">{t('dnsmasq_service.config_path_label')}</Label>
                        <div className="flex gap-2">
                            <Input 
                                id="config-path" 
                                value={editingConfigPath} 
                                onChange={(e) => setEditingConfigPath(e.target.value)}
                                placeholder={t('dnsmasq_service.config_path_placeholder')}
                                className="h-8 text-xs bg-content2 border-divider"
                            />
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={handleOpenConfigFolder} 
                                aria-label={t('dnsmasq_service.open_folder_title')}
                                title={t('dnsmasq_service.open_folder_title')}
                                className="h-8 w-8 bg-content1 dark:bg-content1/40 border-divider"
                            >
                                <FolderOpen className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button 
                            size="sm" 
                            onClick={handleSetConfigPath} 
                            disabled={editingConfigPath === configPath}
                            className="h-8 text-xs"
                        >
                            {t('dnsmasq_service.update_path')}
                        </Button>
                    </div>
                </div>
            </div>

        </div>
    )
}
