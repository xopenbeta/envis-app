import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronDown } from 'lucide-react'

import { serviceCategories, ServiceData, ServiceType, EnvironmentStatus, ProxyMode } from '@/types/index'
import { useAtom } from 'jotai'
import {
    CheckCircle,
    Download,
    Globe,
    Plus
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSettings } from '@/hooks/appSettings'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { useService } from '@/hooks/service'
import {
    selectedEnvironmentIdAtom,
} from '@/store/environment'
import { shouldDownloadServiceAtom } from '@/store/service'
import { useEnvironmentStatus } from '@/hooks/useStatus'

export function AddServiceMenu({ buttonType = "icon" }: {
    buttonType?: "icon" | "button";
}) {
    const { t } = useTranslation()
    const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)
    const [, setShouldDownloadService] = useAtom(shouldDownloadServiceAtom)
    const { status: selectedEnvStatus } = useEnvironmentStatus(selectedEnvironmentId || '')
    const { systemSettings, updateSystemSettings } = useSettings()
    const { createServiceData, activateServiceData, selectedServiceDatas } = useEnvironmentServiceData()
    const { getServiceVersions, checkServiceInstalled, downloadService } = useService()

    // 服务版本信息的统一状态管理
    const [serviceVersions, setServiceVersions] = useState<Record<ServiceType, {
        isLoading: boolean;
        availableVersions: Array<{
            version: string;
            isDownloaded: boolean;
        }>;
    }>>({
        [ServiceType.Nodejs]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Nginx]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Redis]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Mongodb]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Mariadb]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Mysql]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Postgresql]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Python]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Custom]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Host]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.SSL]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Dnsmasq]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Java]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Rust]: {
            isLoading: false,
            availableVersions: [],
        },
        [ServiceType.Nasm]: {
            isLoading: false,
            availableVersions: [],
        },
    })

    // 用于下载时的服务数据缓存，包含对话框状态
    const [downloadingServiceDialogData, setDownloadingServiceDialogData] = useState<{
        serviceType: ServiceType;
        version: string;
        serviceData: ServiceData;
        dialogOpen: boolean;
    } | null>(null)

    const [installMavenWithJava, setInstallMavenWithJava] = useState(false)
    const [downloadProxyMode, setDownloadProxyMode] = useState<ProxyMode>('none')
    const [downloadProxyUrl, setDownloadProxyUrl] = useState('')
    // 高级选项展开状态
    const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false)

    useEffect(() => {
        if (!downloadingServiceDialogData?.dialogOpen) {
            return
        }

        setDownloadProxyMode(systemSettings?.proxyMode || 'none')
        setDownloadProxyUrl(systemSettings?.proxyUrl || '')
    }, [downloadingServiceDialogData?.dialogOpen, systemSettings])

    if (!selectedEnvironmentId) return null

    const refreshLoadedDownloadStatuses = async () => {
        const loadedServiceTypes = Object.entries(serviceVersions).filter(([, versionState]) => versionState.availableVersions.length > 0)

        if (loadedServiceTypes.length === 0) {
            return
        }

        await Promise.all(
            loadedServiceTypes.map(async ([serviceType, versionState]) => {
                const nextVersions = await Promise.all(
                    versionState.availableVersions.map(async (versionInfo) => {
                        try {
                            const checkResult = await checkServiceInstalled(serviceType as ServiceType, versionInfo.version)

                            return {
                                ...versionInfo,
                                isDownloaded: Boolean(checkResult.success && checkResult.data?.installed)
                            }
                        } catch (error) {
                            console.error(`[refreshLoadedDownloadStatuses] ${serviceType} ${versionInfo.version} 状态刷新异常:`, error)
                            return versionInfo
                        }
                    })
                )

                setServiceVersions(prev => ({
                    ...prev,
                    [serviceType]: {
                        ...prev[serviceType as ServiceType],
                        availableVersions: nextVersions,
                    }
                }))
            })
        )
    }

    // 获取服务版本列表
    const fetchVersions = async (serviceType: ServiceType) => {
        console.log(`[fetchVersions] 开始获取 ${serviceType} 版本列表`)
        setServiceVersions(prev => ({ 
            ...prev, 
            [serviceType]: { ...prev[serviceType], isLoading: true }
        }))
        
        try {
            // 调用主进程API获取服务版本
            const serviceVersionsRes = await getServiceVersions(serviceType)
            console.log(`[fetchVersions] ${serviceType} 版本获取结果:`, serviceVersionsRes)
            
            if (serviceVersionsRes.success && serviceVersionsRes.data?.versions) {
                const versions = serviceVersionsRes.data.versions.map((v: any) => v.version)
                console.log(`[fetchVersions] ${serviceType} 解析后的版本列表:`, versions)
                
                const availableVersions: Array<{ version: string; isDownloaded: boolean }> = [];
                for (const version of versions) {
                    const checkResult = await checkServiceInstalled(serviceType, version)
                    availableVersions.push({
                        version,
                        isDownloaded: Boolean(checkResult.success && checkResult.data?.installed)
                    })
                }
                
                console.log(`[fetchVersions] ${serviceType} 最终版本列表:`, availableVersions)
                setServiceVersions(prev => ({ 
                    ...prev, 
                    [serviceType]: { ...prev[serviceType], availableVersions }
                }))
            } else {
                console.error(`[fetchVersions] ${serviceType} 版本获取失败:`, serviceVersionsRes.message || '未知错误')
                toast.error(`获取 ${serviceType} 版本列表失败: ${serviceVersionsRes.message || '未知错误'}`)
            }
        } catch (error) {
            console.error(`[fetchVersions] ${serviceType} 版本获取异常:`, error)
            toast.error(`获取 ${serviceType} 版本列表异常: ${error}`)
        } finally {
            setServiceVersions(prev => ({ 
                ...prev, 
                [serviceType]: { ...prev[serviceType], isLoading: false }
            }))
        }
    }

    // 创建新服务
    const onCreateServiceDataBtnClick = async (serviceType: ServiceType, version: string) => {
        const newServiceData = await createServiceData({
            environmentId: selectedEnvironmentId,
            serviceType,
            version,
            serviceDatas: selectedServiceDatas,
        })
        if (newServiceData) {
            // 自定义服务不需要下载，直接创建
            if (serviceType === ServiceType.Custom) {
                return
            }

            // 检查是否已下载
            const versionInfo = serviceVersions[serviceType].availableVersions.find(v => v.version === version)
            const isDownloaded = versionInfo?.isDownloaded || false
            if (isDownloaded) {
                // 已下载，尝试激活服务
                // 如果当前激活的环境就是所创建服务的环境
                if (selectedEnvStatus === EnvironmentStatus.Active) {
                    await activateServiceData(selectedEnvironmentId, newServiceData, '')
                }
            } else {
                // 显示下载确认对话框
                setDownloadingServiceDialogData({
                    serviceType,
                    version,
                    serviceData: newServiceData,
                    dialogOpen: true
                })
            }
        } else {
            toast.error(`创建 ${serviceType} 服务失败`)
        }
    }

    // 创建自定义服务
    const onCreateCustomServiceBtnClick = async () => {
        await createServiceData({
            environmentId: selectedEnvironmentId,
            serviceType: ServiceType.Custom,
            version: '1.0.0',
            serviceDatas: selectedServiceDatas,
        })
    }

    // 创建 Host 服务
    const onCreateHostServiceBtnClick = async () => {
        await createServiceData({
            environmentId: selectedEnvironmentId,
            serviceType: ServiceType.Host,
            version: '1.0.0',
            serviceDatas: selectedServiceDatas,
        })
    }

    // 创建 SSL 服务
    const onCreateSSLServiceBtnClick = async () => {
        await createServiceData({
            environmentId: selectedEnvironmentId,
            serviceType: ServiceType.SSL,
            version: '1.0.0',
            serviceDatas: selectedServiceDatas,
        })
    }

    // 创建 Nginx 服务（使用系统安装，无需选择版本）
    const onCreateNginxServiceBtnClick = async () => {
        // 以 system 作为占位版本标识
        await createServiceData({
            environmentId: selectedEnvironmentId,
            serviceType: ServiceType.Nginx,
            version: 'system',
            serviceDatas: selectedServiceDatas,
        })
    }

    // 处理下载确认
    const handleDownloadConfirm = async () => {
        if (!downloadingServiceDialogData) return
        const trimmedProxyUrl = downloadProxyUrl.trim()
        if (downloadProxyMode === 'http' && !/^https?:\/\//i.test(trimmedProxyUrl)) {
            toast.error(t('settings.invalid_http_proxy'))
            return
        }
        if (downloadProxyMode === 'socks5' && !/^socks5:\/\//i.test(trimmedProxyUrl)) {
            toast.error(t('settings.invalid_socks5_proxy'))
            return
        }
        if ((downloadProxyMode === 'http' || downloadProxyMode === 'socks5') && trimmedProxyUrl.length === 0) {
            toast.error(t('settings.proxy_url_required'))
            return
        }

        await updateSystemSettings({
            proxyMode: downloadProxyMode,
            proxyUrl: downloadProxyMode === 'http' || downloadProxyMode === 'socks5' ? trimmedProxyUrl : '',
        })

        const downloadOptions = downloadingServiceDialogData.serviceType === ServiceType.Java
            ? { installMaven: installMavenWithJava }
            : {}

        downloadService(
            downloadingServiceDialogData.serviceType,
            downloadingServiceDialogData.version,
            'prebuilt',
            downloadOptions
        )
        setTimeout(() => {
            setShouldDownloadService({ ...downloadingServiceDialogData.serviceData })
        }, 300); // 确保状态更新后再设置
        setDownloadingServiceDialogData(null)
        // 重置高级选项
        setInstallMavenWithJava(false)
        setDownloadProxyMode(systemSettings?.proxyMode || 'none')
        setDownloadProxyUrl(systemSettings?.proxyUrl || '')
        setAdvancedOptionsOpen(false)
    }

    // 处理下载取消
    const handleDownloadCancel = async () => {
        if (!downloadingServiceDialogData) return
        setDownloadingServiceDialogData(null)
        // 重置高级选项
        setInstallMavenWithJava(false)
        setDownloadProxyMode(systemSettings?.proxyMode || 'none')
        setDownloadProxyUrl(systemSettings?.proxyUrl || '')
        setAdvancedOptionsOpen(false)
    }

    const getServiceName = (name: string) => {
        return ['custom', 'host', 'ssl'].includes(name) ? t(`add_service.services.${name}`) : name
    }

    const showAdvancedOptions = Boolean(downloadingServiceDialogData)

    return (
        <>
            {/* 新增服务三级下拉菜单 */}
            <DropdownMenu onOpenChange={(open) => {
                if (open) {
                    void refreshLoadedDownloadStatuses()
                }
            }}>
                <DropdownMenuTrigger asChild>
                    {buttonType === "icon" ? <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 hover:bg-content2"
                        title={t('add_service.add_service')}
                    >
                        <Plus className="h-4 w-4" />
                    </Button> : <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 text-xs shadow-none"
                    >
                        {t('add_service.create_first')}
                    </Button>}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    {/* 编程语言，数据库，服务器等服务类型 */}
                    {Object.entries(serviceCategories).map(([categoryName, services]) => (
                        <DropdownMenuSub key={categoryName}>
                            <DropdownMenuSubTrigger className="flex items-center">
                                <span>{t(`add_service.categories.${categoryName}`)}</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-48">
                                {/* 服务类型 */}
                                {Object.entries(services).map(([serviceType, serviceName]) => (
                                    <DropdownMenuSub key={serviceType}>
                                        {serviceType === 'custom' ? (
                                            // 自定义服务直接点击创建，不需要版本选择
                                            <DropdownMenuItem
                                                onClick={onCreateCustomServiceBtnClick}
                                                className="flex items-center"
                                            >
                                                <span>{getServiceName(serviceName)}</span>
                                            </DropdownMenuItem>
                                        ) : serviceType === 'host' ? (
                                            // Host 服务直接点击创建，不需要版本选择
                                            <DropdownMenuItem
                                                onClick={onCreateHostServiceBtnClick}
                                                className="flex items-center"
                                            >
                                                <span>{getServiceName(serviceName)}</span>
                                            </DropdownMenuItem>
                                        ) : serviceType === 'ssl' ? (
                                            // SSL 服务直接点击创建，不需要版本选择
                                            <DropdownMenuItem
                                                onClick={onCreateSSLServiceBtnClick}
                                                className="flex items-center"
                                            >
                                                <span>{getServiceName(serviceName)}</span>
                                            </DropdownMenuItem>
                                        ) : (
                                            <>
                                                <DropdownMenuSubTrigger
                                                    className="flex items-center"
                                                    onMouseEnter={() => {
                                                        // 当鼠标悬停时自动加载版本
                                                        if (serviceVersions[serviceType as ServiceType].availableVersions.length === 0 && !serviceVersions[serviceType as ServiceType].isLoading) {
                                                            fetchVersions(serviceType as ServiceType)
                                                        }
                                                    }}
                                                >
                                                    <span>{getServiceName(serviceName)}</span>
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent className="w-48 max-h-[400px] overflow-y-auto">
                                                    {/* 服务版本列表 */}
                                                    {serviceVersions[serviceType as ServiceType].isLoading ? (
                                                        <DropdownMenuItem disabled>
                                                            <span className="text-xs">{t('common.loading')}</span>
                                                        </DropdownMenuItem>
                                                    ) : serviceVersions[serviceType as ServiceType].availableVersions.length > 0 ? (
                                                        serviceVersions[serviceType as ServiceType].availableVersions.map((versionInfo) => (
                                                            <DropdownMenuItem
                                                                key={versionInfo.version}
                                                                onClick={() => onCreateServiceDataBtnClick(serviceType as ServiceType, versionInfo.version)}
                                                                className="text-xs"
                                                            >
                                                                <div className="flex items-center justify-between w-full">
                                                                    <span>{versionInfo.version}</span>
                                                                    {
                                                                        versionInfo.isDownloaded ? (
                                                                            <CheckCircle className="h-3 w-3 text-success ml-2 flex-shrink-0" />
                                                                        ) : <Download className="h-3 w-3 ml-2 flex-shrink-0" />
                                                                    }
                                                                </div>
                                                            </DropdownMenuItem>
                                                        ))
                                                    ) : (
                                                        <DropdownMenuItem disabled className="text-xs">
                                                            <span>{t('add_service.no_versions')}</span>
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuSubContent>
                                            </>
                                        )}
                                    </DropdownMenuSub>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Download Confirmation Dialog */}
            <AlertDialog 
                open={!!downloadingServiceDialogData?.dialogOpen} 
                onOpenChange={(open) => {
                    if (!open) {
                        setDownloadingServiceDialogData(null)
                        setInstallMavenWithJava(false)
                        setDownloadProxyMode(systemSettings?.proxyMode || 'none')
                        setDownloadProxyUrl(systemSettings?.proxyUrl || '')
                        setAdvancedOptionsOpen(false)
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('add_service.download_confirm_title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {downloadingServiceDialogData && (
                                <>
                                    {t('add_service.download_confirm_desc', { serviceType: downloadingServiceDialogData.serviceType, version: downloadingServiceDialogData.version })}
                                    <br />
                                    {t('add_service.download_confirm_ask')}
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    
                    {showAdvancedOptions && (
                        <div className="py-2">
                            <Collapsible open={advancedOptionsOpen} onOpenChange={setAdvancedOptionsOpen}>
                                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline">
                                    <ChevronDown className={`h-4 w-4 transition-transform ${advancedOptionsOpen ? 'rotate-180' : ''}`} />
                                    {t('add_service.advanced_options')}
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-3 space-y-3">
                                    <div className="space-y-3 rounded-md border border-border p-3">
                                        <div className="flex items-center gap-2">
                                            <Globe className="h-4 w-4 text-primary" />
                                            <h3 className="text-sm font-medium">{t('settings.proxy_settings')}</h3>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="downloadProxyMode">{t('settings.proxy_mode')}</Label>
                                            <Select value={downloadProxyMode} onValueChange={(value: ProxyMode) => setDownloadProxyMode(value)}>
                                                <SelectTrigger id="downloadProxyMode" className="shadow-none bg-content2 dark:bg-content3">
                                                    <SelectValue placeholder={t('settings.select_proxy_mode')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">{t('settings.proxy_none')}</SelectItem>
                                                    <SelectItem value="http">{t('settings.proxy_http')}</SelectItem>
                                                    <SelectItem value="socks5">{t('settings.proxy_socks5')}</SelectItem>
                                                    <SelectItem value="system">{t('settings.proxy_system')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">{t('settings.proxy_mode_desc')}</p>
                                        </div>

                                        {(downloadProxyMode === 'http' || downloadProxyMode === 'socks5') && (
                                            <div className="space-y-2">
                                                <Label htmlFor="downloadProxyUrl">{t('settings.proxy_url')}</Label>
                                                <Input
                                                    id="downloadProxyUrl"
                                                    value={downloadProxyUrl}
                                                    onChange={(e) => setDownloadProxyUrl(e.target.value)}
                                                    placeholder={downloadProxyMode === 'http' ? 'http://127.0.0.1:7890' : 'socks5://127.0.0.1:1080'}
                                                    className="shadow-none bg-content2 dark:bg-content3"
                                                />
                                                <p className="text-xs text-muted-foreground">{t('settings.proxy_url_desc')}</p>
                                            </div>
                                        )}

                                        {downloadProxyMode === 'system' && (
                                            <p className="text-xs text-muted-foreground">{t('settings.proxy_system_desc')}</p>
                                        )}
                                    </div>

                                    {downloadingServiceDialogData?.serviceType === ServiceType.Java && (
                                        <div className="flex items-start space-x-2 border-t border-border pt-2">
                                            <Checkbox
                                                id="install_maven_with_java"
                                                checked={installMavenWithJava}
                                                onCheckedChange={(checked) => setInstallMavenWithJava(checked === true)}
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <Label htmlFor="install_maven_with_java" className="cursor-pointer font-normal">
                                                    同时下载 Maven（默认关闭）
                                                </Label>
                                                <p className="text-xs text-muted-foreground">
                                                    启用后会在下载 Java 时并行下载当前版本推荐的 Maven
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel className='shadow-none' onClick={handleDownloadCancel}>
                            {t('add_service.skip_download')}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleDownloadConfirm}>
                            {t('add_service.download_install')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
