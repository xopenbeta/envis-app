import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
import {
    Hexagon,
    Info,
    AlertTriangle,
    Package,
    RefreshCw,
    Plus
} from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useNodejsService } from '@/hooks/services/nodejs'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from 'react-i18next';

interface NodeServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function NodeService({ serviceData, selectedEnvironment }: NodeServiceProps) {
    return (
        <NodeServiceCard serviceData={serviceData} selectedEnvironmentId={selectedEnvironment.id} />
    )
}

interface NodeServiceCardProps {
    serviceData: ServiceData
    selectedEnvironmentId: string
}

function NodeServiceCard({ serviceData, selectedEnvironmentId }: NodeServiceCardProps) {
    const { t } = useTranslation()
    const { setNpmRegistry, setConfigPrefix, getGlobalPackages, installGlobalPackage } = useNodejsService()
    const { updateServiceData } = useEnvironmentServiceData()
    const [registry, setRegistry] = useState('')
    const [prefix, setPrefix] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [globalPackages, setGlobalPackages] = useState<Array<{ name: string, version: string }>>([])
    const [isLoadingPackages, setIsLoadingPackages] = useState(false)
    const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false)
    const [packageToInstall, setPackageToInstall] = useState('')
    const [isInstalling, setIsInstalling] = useState(false)

    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active;

    useEffect(() => {
        setRegistry(serviceData.metadata?.NPM_CONFIG_REGISTRY || '')
        setPrefix(serviceData.metadata?.NPM_CONFIG_PREFIX || '')

        // 如果服务激活，自动加载全局包列表
        if (isServiceDataActive) {
            loadGlobalPackages()
        }
    }, [serviceData])

    const loadGlobalPackages = async () => {
        try {
            setIsLoadingPackages(true)
            const res = await getGlobalPackages(serviceData)
            if (res && (res as any).success) {
                setGlobalPackages((res as any).data?.packages || [])
            } else {
                console.error('获取全局包列表失败:', res)
            }
        } catch (error) {
            console.error('获取全局包列表异常:', error)
        } finally {
            setIsLoadingPackages(false)
        }
    }

    const handleInstallPackage = async () => {
        if (!packageToInstall.trim()) {
            toast.error(t('node_service.enter_package_name'))
            return
        }

        try {
            setIsInstalling(true)
            const res = await installGlobalPackage(serviceData, packageToInstall.trim())
            if (res && (res as any).success) {
                toast.success(t('node_service.install_success'))
                setIsInstallDialogOpen(false)
                setPackageToInstall('')
                // 重新加载全局包列表
                await loadGlobalPackages()
            } else {
                toast.error(t('node_service.install_failed', { message: (res as any).message || t('common.unknown_error') }))
            }
        } catch (error) {
            console.error('安装全局包异常:', error)
            toast.error(t('node_service.install_failed_generic'))
        } finally {
            setIsInstalling(false)
        }
    }

    const applyRegistry = async (val: string) => {
        try {
            setIsLoading(true)
            const res = await setNpmRegistry(selectedEnvironmentId, serviceData, val)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['NPM_CONFIG_REGISTRY'] = val
                await updateServiceData(serviceData.id, {
                    metadata: newMetadata
                })
                setRegistry(val)
                toast.success(t('node_service.registry_set_success'))
            } else {
                toast.error(t('node_service.registry_set_failed'))
            }
        } finally {
            setIsLoading(false)
        }
    }

    const applyPrefix = async (val: string) => {
        try {
            setIsLoading(true)
            const res = await setConfigPrefix(selectedEnvironmentId, serviceData, val)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['NPM_CONFIG_PREFIX'] = val
                await updateServiceData(serviceData.id, {
                    metadata: newMetadata
                })
                setPrefix(val)
                toast.success(t('node_service.prefix_set_success'))
            } else {
                toast.error(t('node_service.prefix_set_failed'))
            }
        } finally {
            setIsLoading(false)
        }
    }

    const versionNum = parseInt(serviceData.version.replace('v', '').split('.')[0]);
    const showLegacyMacWarning = !isNaN(versionNum) && versionNum <= 14 && navigator.userAgent.includes("Mac");

    return (<>
        <div className="w-full p-3 space-y-3">
            {showLegacyMacWarning && (
                <Alert className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/20">
                    <AlertTitle className="text-yellow-800 dark:text-yellow-500 text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                        {t('node_service.macos_silicon_warning_title')}
                    </AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-600/90 text-xs mt-1.5 space-y-2">
                        <p>
                            {t('node_service.macos_silicon_warning_desc_1')}
                        </p>
                        <p>
                            {t('node_service.macos_silicon_warning_desc_2')}
                        </p>
                    </AlertDescription>
                </Alert>
            )}

            <div className="w-full p-3 space-y-6 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                {/* Registry Configuration */}
                <div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {t('node_service.registry_url')}
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                </Label>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs space-y-1">
                                    <div>{t('node_service.registry_current')}</div>
                                    <div>{t('node_service.registry_set')}</div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <div className="flex items-center space-x-2 mt-2">
                        <Input
                            value={registry}
                            onChange={(e) => setRegistry(e.target.value)}
                            placeholder={t('node_service.registry_url')}
                            disabled={isLoading || !isServiceDataActive}
                            className="flex-1 h-8 text-xs bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyRegistry(registry)}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            {t('node_service.apply')}
                        </Button>
                    </div>

                    {/* Quick Registry Options */}
                    <div className="flex flex-wrap gap-2 items-center mt-3">
                        <Label className="block text-[10px] text-gray-500 uppercase tracking-wider">{t('node_service.quick_set')}</Label>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyRegistry('https://registry.npmjs.org/')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            {t('node_service.official')}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyRegistry('https://registry.npmmirror.com/')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            {t('node_service.taobao')}
                        </Button>
                    </div>
                </div>

                {/* Prefix Configuration */}
                <div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {t('node_service.config_prefix')}
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                </Label>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs space-y-1">
                                    <div>{t('node_service.prefix_current')}</div>
                                    <div>{t('node_service.prefix_set')}</div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 mb-2">
                        {t('node_service.prefix_tooltip')}
                    </p>
                    <div className="flex items-center space-x-2">
                        <Input
                            value={prefix}
                            onChange={(e) => setPrefix(e.target.value)}
                            placeholder={t('node_service.prefix_placeholder')}
                            disabled={isLoading || !isServiceDataActive}
                            className="flex-1 h-8 text-xs bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyPrefix(prefix)}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            {t('node_service.apply')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Global npm Packages */}
            <div className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {t('node_service.global_packages')}
                        </Label>
                        {isServiceDataActive && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                ({globalPackages.length})
                            </span>
                        )}
                    </div>
                    {isServiceDataActive && (
                        <div className="flex items-center gap-1">
                            <Dialog open={isInstallDialogOpen} onOpenChange={setIsInstallDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={isLoadingPackages}
                                        className="h-6 px-2 text-[10px]"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>{t('node_service.install_global_package')}</DialogTitle>
                                        <DialogDescription>
                                            {t('node_service.install_global_package_desc')}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex items-center space-x-2 py-4">
                                        <Input
                                            value={packageToInstall}
                                            onChange={(e) => setPackageToInstall(e.target.value)}
                                            placeholder={t('node_service.package_placeholder')}
                                            disabled={isInstalling}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !isInstalling) {
                                                    handleInstallPackage()
                                                }
                                            }}
                                            className="flex-1"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setIsInstallDialogOpen(false)}
                                            disabled={isInstalling}
                                        >
                                            {t('node_service.cancel')}
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={handleInstallPackage}
                                            disabled={isInstalling}
                                        >
                                            {isInstalling ? t('node_service.installing') : t('node_service.install')}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={loadGlobalPackages}
                                disabled={isLoadingPackages}
                                className="h-6 px-2 text-[10px]"
                            >
                                <RefreshCw className={`h-3 w-3 ${isLoadingPackages ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    )}
                </div>

                {!isServiceDataActive ? (
                    <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
                        <Package className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('node_service.service_inactive', { defaultValue: '服务未激活' })}</p>
                        <p className="text-xs">{t('node_service.activate_to_view_packages', { defaultValue: '请先激活服务以查看全局包' })}</p>
                    </div>
                ) : (
                    isLoadingPackages ? (
                        <div className="flex items-center justify-center py-8 text-xs text-gray-500">
                            {t('node_service.loading_packages')}
                        </div>
                    ) : globalPackages.length === 0 ? (
                        <div className="flex items-center justify-center py-8 text-xs text-gray-500">
                            {t('node_service.no_packages')}
                        </div>
                    ) : (
                        <div className="max-h-60 overflow-y-auto">
                            <div className="flex flex-wrap gap-2 p-1">
                                {globalPackages.map((pkg, index) => (
                                    <Badge
                                        key={index}
                                        variant="outline"
                                        className="font-mono font-normal cursor-pointer"
                                        onClick={() => {
                                            navigator.clipboard.writeText(pkg.name)
                                            toast.success(t('common.copied', { defaultValue: '已复制到剪贴板' }))
                                        }}
                                    >
                                        {pkg.name}
                                        {/* <span className="ml-1 opacity-50">v{pkg.version}</span> */}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    </>)
}
