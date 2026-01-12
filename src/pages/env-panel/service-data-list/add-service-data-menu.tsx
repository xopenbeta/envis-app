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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { ChevronDown } from 'lucide-react'

import { serviceCategories, ServiceData, ServiceType, serviceTypeNames } from '@/types/index'
import { useAtom } from 'jotai'
import {
    CheckCircle,
    Download,
    Plus
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useEnvironmentServiceData, useServiceData } from '@/hooks/env-serv-data'
import { useService } from '@/hooks/service'
import {
    selectedEnvironmentIdAtom,
} from '@/store/environment'
import { shouldDownloadServiceAtom } from '@/store/service'
import { useEnvironment } from '@/hooks/environment'

export function AddServiceMenu({ buttonType = "icon" }: {
    buttonType?: "icon" | "button";
}) {
    const { t } = useTranslation()
    const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)
    const [shouldDownloadService, setShouldDownloadService] = useAtom(shouldDownloadServiceAtom)
    const { activeEnvironment } = useEnvironment()
    const { createServiceData, activateServiceData } = useEnvironmentServiceData()
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
    })

    // 用于下载时的服务数据缓存，包含对话框状态
    const [downloadingServiceDialogData, setDownloadingServiceDialogData] = useState<{
        serviceType: ServiceType;
        version: string;
        serviceData: ServiceData;
        dialogOpen: boolean;
    } | null>(null)

    // 编译方式选择：prebuilt(预编译包) 或 from_source(从源码编译)
    const [buildMethod, setBuildMethod] = useState<'prebuilt' | 'from_source'>('prebuilt')
    // 高级选项展开状态
    const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false)

    if (!selectedEnvironmentId) return null

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
        const newServiceData = await createServiceData(serviceType, version)
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
                if (selectedEnvironmentId === activeEnvironment?.id) {
                    await activateServiceData(selectedEnvironmentId, newServiceData)
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
        }
    }

    // 创建自定义服务
    const onCreateCustomServiceBtnClick = async () => {
        await createServiceData(ServiceType.Custom, '1.0.0')
    }

    // 创建 Host 服务
    const onCreateHostServiceBtnClick = async () => {
        await createServiceData(ServiceType.Host, '1.0.0')
    }

    // 创建 SSL 服务
    const onCreateSSLServiceBtnClick = async () => {
        await createServiceData(ServiceType.SSL, '1.0.0')
    }

    // 创建 Nginx 服务（使用系统安装，无需选择版本）
    const onCreateNginxServiceBtnClick = async () => {
        // 以 system 作为占位版本标识
        await createServiceData(ServiceType.Nginx, 'system')
    }

    // 处理下载确认
    const handleDownloadConfirm = async () => {
        if (!downloadingServiceDialogData) return
        downloadService(downloadingServiceDialogData.serviceType, downloadingServiceDialogData.version, buildMethod)
        setTimeout(() => {
            setShouldDownloadService({ ...downloadingServiceDialogData.serviceData })
        }, 300); // 确保状态更新后再设置
        setDownloadingServiceDialogData(null)
        // 重置高级选项
        setBuildMethod('prebuilt')
        setAdvancedOptionsOpen(false)
    }

    // 处理下载取消
    const handleDownloadCancel = async () => {
        if (!downloadingServiceDialogData) return
        setDownloadingServiceDialogData(null)
        // 重置高级选项
        setBuildMethod('prebuilt')
        setAdvancedOptionsOpen(false)
    }

    const getServiceName = (name: string) => {
        return ['custom', 'host', 'ssl'].includes(name) ? t(`add_service.services.${name}`) : name
    }

    return (
        <>
            {/* 新增服务三级下拉菜单 */}
            <DropdownMenu>
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
                        setBuildMethod('prebuilt')
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
                    
                    {/* 高级选项 */}
                    <div className="py-2">
                        <Collapsible open={advancedOptionsOpen} onOpenChange={setAdvancedOptionsOpen}>
                            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline">
                                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOptionsOpen ? 'rotate-180' : ''}`} />
                                {t('add_service.advanced_options')}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 space-y-3">
                                <RadioGroup value={buildMethod} onValueChange={(value) => setBuildMethod(value as 'prebuilt' | 'from_source')}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="prebuilt" id="prebuilt" />
                                        <Label htmlFor="prebuilt" className="cursor-pointer font-normal">
                                            {t('add_service.use_prebuilt')}
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="from_source" id="from_source" />
                                        <Label htmlFor="from_source" className="cursor-pointer font-normal">
                                            {t('add_service.compile_from_source')}
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </CollapsibleContent>
                        </Collapsible>
                    </div>

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
