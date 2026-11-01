import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
    FolderOpen,
    Info,
    Power,
    PowerOff,
    RefreshCw,
    RotateCw,
    Save,
    ScrollText,
    Server,
    Settings,
    ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ServiceData, ServiceDataStatus, ServiceStatus } from '@/types/index'
import { useState, useEffect, useMemo } from 'react'
import { useEnvironmentServiceData, useServiceData } from '@/hooks/env-serv-data'
import { useFileOperations } from '@/hooks/file-operations'
import { useApacheService } from '@/hooks/services/apache'
import { useServiceDataStatus, useServiceStatus } from '@/hooks/useStatus'

interface ApacheConfigViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

interface ApacheVirtualHost {
    address: string
    serverName?: string
    documentRoot?: string
}

interface ApacheParsedConfig {
    listenPorts: string[]
    serverName?: string
    documentRoot?: string
    errorLog?: string
    loadModuleCount: number
    virtualHosts: ApacheVirtualHost[]
}

/**
 * 简单的 httpd.conf 解析：只提取面板需要展示的关键信息。
 * 注释行会被忽略，`Include` 引入的子配置不展开（面板展示主配置即可）。
 */
function parseApacheConfig(content: string): ApacheParsedConfig {
    const lines = content.split(/\r?\n/)
    const activeLines = lines.filter(line => !line.trimStart().startsWith('#'))
    const activeContent = activeLines.join('\n')

    const listenPorts = [...activeContent.matchAll(/^\s*Listen\s+([^\r\n#]+)/gim)]
        .map(match => match[1].trim())
        .filter(Boolean)

    const serverNameMatch = activeContent.match(/^\s*ServerName\s+([^\s#]+)/im)
    const documentRootMatch = activeContent.match(/^\s*DocumentRoot\s+"?([^"\r\n#]+)"?/im)
    const errorLogMatch = activeContent.match(/^\s*ErrorLog\s+"?([^"\r\n#]+)"?/im)
    const loadModuleCount = (activeContent.match(/^\s*LoadModule\s+/gim) ?? []).length

    const virtualHosts: ApacheVirtualHost[] = []
    const virtualHostRegex = /<VirtualHost\s+([^>]+)>([\s\S]*?)<\/VirtualHost>/gi
    let virtualHostMatch: RegExpExecArray | null
    while ((virtualHostMatch = virtualHostRegex.exec(content)) !== null) {
        const [, address, body] = virtualHostMatch
        const nameMatch = body.match(/^\s*ServerName\s+([^\s#]+)/im)
        const rootMatch = body.match(/^\s*DocumentRoot\s+"?([^"\r\n#]+)"?/im)
        virtualHosts.push({
            address: address.trim(),
            serverName: nameMatch?.[1]?.trim(),
            documentRoot: rootMatch?.[1]?.trim(),
        })
    }

    return {
        listenPorts,
        serverName: serverNameMatch?.[1]?.trim(),
        documentRoot: documentRootMatch?.[1]?.trim(),
        errorLog: errorLogMatch?.[1]?.trim(),
        loadModuleCount,
        virtualHosts,
    }
}

export function ApacheConfigView({
    selectedEnvironmentId,
    serviceData,
}: ApacheConfigViewProps) {
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
    const { getApacheConfig, validateApacheConfig } = useApacheService()

    const configPath = useMemo(() => {
        return serviceData.metadata?.['APACHE_CONF'] || ''
    }, [serviceData.metadata])

    const [editingConfigPath, setEditingConfigPath] = useState<string>('')
    const [isSaving, setIsSaving] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [validationError, setValidationError] = useState('')
    const [parsedConfig, setParsedConfig] = useState<ApacheParsedConfig | null>(null)

    const { serviceDataStatus } = useServiceDataStatus(selectedEnvironmentId, serviceData.id, {
        enabled: true,
        interval: 500,
    })
    const isServiceActive = serviceDataStatus === ServiceDataStatus.Active

    const { status: serviceStatus } = useServiceStatus(selectedEnvironmentId, serviceData, {
        enabled: isServiceActive,
        interval: 2000,
    })

    const [isStarting, setIsStarting] = useState(false)
    const [isStopping, setIsStopping] = useState(false)
    const [isRestarting, setIsRestarting] = useState(false)

    useEffect(() => {
        setEditingConfigPath(configPath)
    }, [configPath])

    useEffect(() => {
        const loadConfig = async () => {
            if (!isServiceActive || !configPath) return
            try {
                const result = await getApacheConfig(selectedEnvironmentId, serviceData)
                if (result.success && result.data?.content) {
                    setParsedConfig(parseApacheConfig(result.data.content))
                }
            } catch (error) {
                console.error('加载 Apache 配置失败:', error)
            }
        }

        void loadConfig()
    }, [isServiceActive, configPath, selectedEnvironmentId, serviceData])

    const handleSetConfigPath = async () => {
        try {
            setIsSaving(true)
            const newMetadata = { ...(serviceData.metadata || {}) }
            newMetadata['APACHE_CONF'] = editingConfigPath

            const updated = await updateServiceData({
                environmentId: selectedEnvironmentId,
                serviceId: serviceData.id,
                updates: { metadata: newMetadata },
                serviceDatas: selectedServiceDatas,
            })
            if (updated) {
                toast.success(t('apache_service.config_path_set_success'))
            } else {
                toast.error(t('apache_service.config_path_set_failed'))
            }
        } catch (error) {
            console.error('设置 Apache 配置文件路径失败:', error)
            toast.error(t('apache_service.config_path_set_failed'))
        } finally {
            setIsSaving(false)
        }
    }

    const handleOpenConfigFolder = async () => {
        try {
            if (configPath) {
                await openFolderInFinder(configPath)
            }
        } catch (error) {
            console.error('打开 Apache 目录失败:', error)
            toast.error(t('apache_service.open_dir_failed'))
        }
    }

    const handleValidateConfig = async () => {
        try {
            setIsValidating(true)
            setValidationError('')
            const result = await validateApacheConfig(selectedEnvironmentId, serviceData)
            const detail = result.data
            if (result.success && detail?.valid) {
                toast.success(t('apache_service.validate_ok'))
                if (detail?.stdout) {
                    console.log('[apache] httpd -t stdout:', detail.stdout)
                }
            } else {
                const message = (detail?.stderr || result.message || '').trim()
                setValidationError(message || t('apache_service.validate_failed'))
                toast.error(t('apache_service.validate_failed'))
            }
        } catch (error) {
            console.error('校验 Apache 配置失败:', error)
            setValidationError(String(error))
            toast.error(t('apache_service.validate_failed'))
        } finally {
            setIsValidating(false)
        }
    }

    const handleStartService = async () => {
        try {
            setIsStarting(true)
            setValidationError('')
            const res = await startServiceData(selectedEnvironmentId, serviceData)
            if (res && (res as { success?: boolean }).success) {
                toast.success(t('apache_service.start_success'))
            } else {
                const message = (res as { message?: string })?.message
                setValidationError(message || '')
                toast.error(message || t('apache_service.start_failed'))
            }
        } catch (error) {
            console.error('启动 Apache 服务失败:', error)
            toast.error(t('apache_service.start_failed'))
        } finally {
            setIsStarting(false)
        }
    }

    const handleStopService = async () => {
        try {
            setIsStopping(true)
            const res = await stopServiceData(selectedEnvironmentId, serviceData)
            if (res && (res as { success?: boolean }).success) {
                toast.success(t('apache_service.stop_success'))
            } else {
                toast.error((res as { message?: string })?.message || t('apache_service.stop_failed'))
            }
        } catch (error) {
            console.error('停止 Apache 服务失败:', error)
            toast.error(t('apache_service.stop_failed'))
        } finally {
            setIsStopping(false)
        }
    }

    const handleRestartService = async () => {
        try {
            setIsRestarting(true)
            setValidationError('')
            const res = await restartServiceData(selectedEnvironmentId, serviceData)
            if (res && (res as { success?: boolean }).success) {
                toast.success(t('apache_service.restart_success'))
            } else {
                toast.error((res as { message?: string })?.message || t('apache_service.restart_failed'))
            }
        } catch (error) {
            console.error('重启 Apache 服务失败:', error)
            toast.error(t('apache_service.restart_failed'))
        } finally {
            setIsRestarting(false)
        }
    }

    const statusText = serviceStatus === ServiceStatus.Running
        ? t('apache_service.running')
        : serviceStatus === ServiceStatus.Stopped
            ? t('apache_service.stopped')
            : t('apache_service.unknown_status')

    return (
        <div className="w-full p-3 space-y-3">
            {/* 服务控制 */}
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        {t('apache_service.service_control')}
                    </Label>
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            serviceStatus === ServiceStatus.Running ? "bg-green-500" :
                            serviceStatus === ServiceStatus.Stopped ? "bg-red-500" : "bg-gray-300"
                        )} />
                        <span className="text-xs font-normal text-muted-foreground">{statusText}</span>
                    </div>
                </div>

                {isServiceActive && (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                            onClick={handleStartService}
                            disabled={serviceStatus === ServiceStatus.Running || isStarting || isStopping || isRestarting}
                        >
                            {isStarting ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Power className="h-3.5 w-3.5 text-green-600" />
                            )}
                            {t('apache_service.start')}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                            onClick={handleStopService}
                            disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
                        >
                            <PowerOff className="h-3.5 w-3.5 text-red-600" />
                            {t('apache_service.stop')}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                            onClick={handleRestartService}
                            disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
                        >
                            <RotateCw className={cn("h-3.5 w-3.5 text-blue-600", isRestarting && "animate-spin")} />
                            {t('apache_service.restart')}
                        </Button>
                    </div>
                )}
            </div>

            {/* 配置管理 */}
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                {isServiceActive ? (
                    <div className="space-y-4">
                        <div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                            {t('apache_service.config_file_label')}
                                            <Info className="h-3 w-3 text-muted-foreground" />
                                        </Label>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="text-xs">{t('apache_service.config_file_tooltip')}</div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <div className="flex items-center gap-2 mt-1">
                                <Input
                                    value={editingConfigPath}
                                    onChange={(e) => setEditingConfigPath(e.target.value)}
                                    placeholder={t('apache_service.config_path_placeholder')}
                                    disabled={isSaving}
                                    className="flex-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSetConfigPath}
                                    disabled={isSaving || !editingConfigPath || editingConfigPath === configPath}
                                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                    title={t('apache_service.save_title')}
                                >
                                    <Save className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleOpenConfigFolder}
                                    disabled={!configPath}
                                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                    title={t('apache_service.open_dir_title')}
                                >
                                    <FolderOpen className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleValidateConfig}
                                    disabled={isValidating}
                                    className="h-8 gap-1 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                    title={t('apache_service.validate')}
                                >
                                    {isValidating ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                    )}
                                    {isValidating ? t('apache_service.validating') : t('apache_service.validate')}
                                </Button>
                            </div>

                            {validationError && (
                                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-2 text-[11px] leading-5 text-red-700 dark:text-red-300">
                                    {validationError}
                                </pre>
                            )}
                        </div>

                        {parsedConfig && (
                            <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-white/10">
                                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {t('apache_service.config_overview')}
                                </Label>

                                <div className="grid grid-cols-1 gap-2">
                                    <div className="space-y-1">
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Server className="h-3 w-3" />
                                            {t('apache_service.listen_ports')}
                                        </div>
                                        <div className="bg-white dark:bg-white/5 p-2 rounded border border-gray-200 dark:border-white/10 text-xs font-mono">
                                            {parsedConfig.listenPorts.length > 0
                                                ? parsedConfig.listenPorts.join(', ')
                                                : '--'}
                                        </div>
                                    </div>

                                    {(parsedConfig.serverName || parsedConfig.documentRoot) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <div className="text-xs text-muted-foreground">{t('apache_service.server_name')}</div>
                                                <div className="bg-white dark:bg-white/5 p-2 rounded border border-gray-200 dark:border-white/10 text-xs font-mono break-all">
                                                    {parsedConfig.serverName || '--'}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-xs text-muted-foreground">{t('apache_service.document_root')}</div>
                                                <div className="bg-white dark:bg-white/5 p-2 rounded border border-gray-200 dark:border-white/10 text-xs font-mono break-all">
                                                    {parsedConfig.documentRoot || '--'}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {parsedConfig.errorLog && (
                                        <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <ScrollText className="h-3 w-3" />
                                                {t('apache_service.error_log')}
                                            </div>
                                            <div className="bg-white dark:bg-white/5 p-2 rounded border border-gray-200 dark:border-white/10 text-xs font-mono break-all">
                                                {parsedConfig.errorLog}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground">{t('apache_service.loaded_modules')}</div>
                                            <div className="bg-white dark:bg-white/5 p-2 rounded border border-gray-200 dark:border-white/10 text-xs font-mono">
                                                {parsedConfig.loadModuleCount}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground">{t('apache_service.virtual_hosts')}</div>
                                            <div className="bg-white dark:bg-white/5 p-2 rounded border border-gray-200 dark:border-white/10 text-xs font-mono">
                                                {parsedConfig.virtualHosts.length}
                                            </div>
                                        </div>
                                    </div>

                                    {parsedConfig.virtualHosts.length > 0 && (
                                        <div className="space-y-2">
                                            {parsedConfig.virtualHosts.map((host, index) => (
                                                <div
                                                    key={`${host.address}-${index}`}
                                                    className="bg-white dark:bg-white/5 p-2 rounded border border-gray-200 dark:border-white/10 text-xs space-y-1"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-muted-foreground">VirtualHost</span>
                                                        <span className="font-mono">{host.address}</span>
                                                    </div>
                                                    {host.serverName && (
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-muted-foreground">ServerName</span>
                                                            <span className="font-mono">{host.serverName}</span>
                                                        </div>
                                                    )}
                                                    {host.documentRoot && (
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-muted-foreground">DocumentRoot</span>
                                                            <span className="font-mono break-all text-right">{host.documentRoot}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
                        <Settings className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('apache_service.service_not_active')}</p>
                        <p className="text-xs">{t('apache_service.service_not_active_hint')}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
