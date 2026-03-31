import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
import {
    Coffee,
    Package,
    RefreshCw,
    FolderOpen,
    ExternalLink,
    CheckCircle2,
    ChevronDown,
    Info
} from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useFileOperations } from "@/hooks/file-operations"
import { useJavaService } from "@/hooks/services/java"
import { useEnvironmentServiceData } from "@/hooks/env-serv-data"

interface JavaServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function JavaService({ serviceData, selectedEnvironment }: JavaServiceProps) {
    return (
        <JavaServiceCard serviceData={serviceData} selectedEnvironmentId={selectedEnvironment.id} />
    )
}

interface JavaServiceCardProps {
    serviceData: ServiceData
    selectedEnvironmentId: string
}

function JavaServiceCard({ serviceData, selectedEnvironmentId }: JavaServiceCardProps) {
    const { t } = useTranslation()
    const { openFolderInFinder } = useFileOperations()
    const {
        checkMavenInstalled,
        getJavaInfo,
        setJavaOpts,
        setMavenHome,
        setGradleHome,
        setGradleUserHome,
        initializeMaven,
        getMavenDownloadProgress,
        setMavenLocalRepository,
        checkGradleInstalled,
        initializeGradle,
        getGradleDownloadProgress,
    } = useJavaService()
    const { updateServiceData, selectedServiceDatas } = useEnvironmentServiceData()

    const [javaHome, setJavaHomeState] = useState('')
    const [javaOpts, setJavaOptsState] = useState('')
    const [mavenHome, setMavenHomeState] = useState('')
    const [mavenRepository, setMavenRepositoryState] = useState('')
    const [gradleHome, setGradleHomeState] = useState('')
    const [gradleUserHome, setGradleUserHomeState] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isMavenChecking, setIsMavenChecking] = useState(false)
    const [isMavenInstalled, setIsMavenInstalled] = useState(false)
    const [isMavenDownloading, setIsMavenDownloading] = useState(false)
    const [isMavenInitializing, setIsMavenInitializing] = useState(false)
    const [mavenDownloadProgress, setMavenDownloadProgress] = useState(0)
    const [mavenDownloadStatus, setMavenDownloadStatus] = useState('')
    const [mavenLocalRepo, setMavenLocalRepoState] = useState('')
    const [isGradleChecking, setIsGradleChecking] = useState(false)
    const [isGradleInstalled, setIsGradleInstalled] = useState(false)
    const [isGradleDownloading, setIsGradleDownloading] = useState(false)
    const [isGradleInitializing, setIsGradleInitializing] = useState(false)
    const [gradleDownloadProgress, setGradleDownloadProgress] = useState(0)
    const [gradleDownloadStatus, setGradleDownloadStatus] = useState('')
    const [isJavaInfoExpanded, setIsJavaInfoExpanded] = useState(false)
    const [javaInfo, setJavaInfo] = useState<{
        version: string
        vendor: string
        runtime: string
        vm: string
        home: string
    } | null>(null)

    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active

    useEffect(() => {
        const metadataMavenHome = (serviceData.metadata?.MAVEN_HOME || '').trim()

        setJavaHomeState(serviceData.metadata?.JAVA_HOME || '')
        setJavaOptsState(serviceData.metadata?.JAVA_OPTS || '')
        setMavenHomeState(metadataMavenHome)
        setMavenRepositoryState((serviceData.metadata?.MAVEN_REPO_URL || 'https://repo.maven.apache.org/maven2').trim())
        setGradleHomeState(serviceData.metadata?.GRADLE_HOME || '')
        setGradleUserHomeState((serviceData.metadata?.GRADLE_USER_HOME || '').trim())
        setMavenLocalRepoState((serviceData.metadata?.MAVEN_LOCAL_REPO || '').trim())
        checkMavenInstallState()
        checkGradleInstallState()

        if (isServiceDataActive) {
            loadJavaInfo()
        } else {
            setJavaInfo(null)
        }
    }, [serviceData, isServiceDataActive])

    useEffect(() => {
        if (!isMavenDownloading) {
            return
        }

        const timer = setInterval(async () => {
            try {
                const res = await getMavenDownloadProgress(serviceData.version)
                const task = (res as any)?.data?.task
                const status = String(task?.status || '')
                const progress = Number(task?.progress || 0)

                if (!task) {
                    return
                }

                setMavenDownloadStatus(status)
                setMavenDownloadProgress(Number.isNaN(progress) ? 0 : Math.max(0, Math.min(100, progress)))

                if (status === 'installed') {
                    setIsMavenDownloading(false)
                    setIsMavenInstalled(true)
                    setMavenDownloadProgress(100)
                    toast.success(t('java_service.maven_download_complete'))
                } else if (status === 'failed' || status === 'cancelled') {
                    setIsMavenDownloading(false)
                    setIsMavenInstalled(false)
                    toast.error(task?.error_message || t('java_service.maven_download_failed'))
                }
            } catch (error) {
                console.error('获取 Maven 下载进度失败:', error)
            }
        }, 1200)

        return () => clearInterval(timer)
    }, [isMavenDownloading, serviceData.version])

    useEffect(() => {
        if (!isGradleDownloading) {
            return
        }

        const timer = setInterval(async () => {
            try {
                const res = await getGradleDownloadProgress(serviceData.version)
                const task = (res as any)?.data?.task
                const status = String(task?.status || '')
                const progress = Number(task?.progress || 0)

                if (!task) {
                    return
                }

                setGradleDownloadStatus(status)
                setGradleDownloadProgress(Number.isNaN(progress) ? 0 : Math.max(0, Math.min(100, progress)))

                if (status === 'installed') {
                    setIsGradleDownloading(false)
                    setIsGradleInstalled(true)
                    setGradleDownloadProgress(100)
                    try {
                        const checkRes = await checkGradleInstalled(serviceData.version)
                        const gradleHomePath = (checkRes as any)?.data?.home as string | undefined
                        if (gradleHomePath) {
                            await applyGradleHome(gradleHomePath, false)
                        }
                    } catch (e) {
                        console.error('获取 Gradle home 失败:', e)
                    }
                    toast.success(t('java_service.gradle_download_complete'))
                } else if (status === 'failed' || status === 'cancelled') {
                    setIsGradleDownloading(false)
                    setIsGradleInstalled(false)
                    toast.error(task?.error_message || t('java_service.gradle_download_failed'))
                }
            } catch (error) {
                console.error('获取 Gradle 下载进度失败:', error)
            }
        }, 1200)

        return () => clearInterval(timer)
    }, [isGradleDownloading, serviceData.version])

    const loadJavaInfo = async () => {
        try {
            const res = await getJavaInfo(serviceData)
            if (res && (res as any).success && (res as any).data) {
                setJavaInfo((res as any).data)
            }
        } catch (error) {
            console.error('获取 Java 信息失败:', error)
        }
    }

    const checkMavenInstallState = async () => {
        try {
            setIsMavenChecking(true)
            const res = await checkMavenInstalled(serviceData.version)
            if (res && (res as any).success) {
                setIsMavenInstalled(Boolean((res as any)?.data?.installed))
            } else {
                setIsMavenInstalled(false)
            }
        } catch (error) {
            console.error('检查 Maven 安装状态失败:', error)
            setIsMavenInstalled(false)
        } finally {
            setIsMavenChecking(false)
        }
    }

    const applyMavenHome = async (path: string, showToastMessage = true) => {
        setIsLoading(true)
        try {
            const res = await setMavenHome(selectedEnvironmentId, serviceData, path)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['MAVEN_HOME'] = path
                await updateServiceData({
                    environmentId: selectedEnvironmentId,
                    serviceId: serviceData.id,
                    updates: { metadata: newMetadata },
                    serviceDatasSnapshot: selectedServiceDatas,
                })
                setMavenHomeState(path)
                if (showToastMessage) {
                    toast.success(t('java_service.maven_home_set_success'))
                }
                return true
            }

            if (showToastMessage) {
                toast.error(t('java_service.maven_home_set_failed'))
            }
            return false
        } catch (error) {
            console.error('设置 MAVEN_HOME 异常:', error)
            if (showToastMessage) {
                toast.error(t('java_service.maven_home_set_failed'))
            }
            return false
        } finally {
            setIsLoading(false)
        }
    }

    const handleSetJavaOpts = async (opts: string) => {
        try {
            setIsLoading(true)
            const res = await setJavaOpts(selectedEnvironmentId, serviceData, opts)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['JAVA_OPTS'] = opts
                await updateServiceData({
                    environmentId: selectedEnvironmentId,
                    serviceId: serviceData.id,
                    updates: { metadata: newMetadata },
                    serviceDatasSnapshot: selectedServiceDatas,
                })
                setJavaOptsState(opts)
                toast.success(t('java_service.java_opts_set_success'))
            } else {
                toast.error(t('java_service.java_opts_set_failed'))
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleSetMavenHome = async (path: string) => {
        await applyMavenHome(path)
    }

    const handleSetMavenRepository = async (repository: string) => {
        const value = repository.trim()
        if (!value) {
            toast.error(t('java_service.maven_repo_empty_error'))
            return
        }

        try {
            setIsLoading(true)
            const newMetadata = { ...(serviceData.metadata || {}) }
            newMetadata['MAVEN_REPO_URL'] = value
            await updateServiceData({
                environmentId: selectedEnvironmentId,
                serviceId: serviceData.id,
                updates: { metadata: newMetadata },
                serviceDatasSnapshot: selectedServiceDatas,
            })
            setMavenRepositoryState(value)
            toast.success(t('java_service.maven_repo_applied'))
        } catch (error) {
            console.error('设置 Maven 仓库配置失败:', error)
            toast.error(t('java_service.maven_repo_apply_failed'))
        } finally {
            setIsLoading(false)
        }
    }

    const handleDownloadMaven = async () => {
        if (!isServiceDataActive || isMavenDownloading) {
            return
        }

        try {
            setIsMavenDownloading(true)
            setMavenDownloadProgress(0)
            setMavenDownloadStatus('pending')

            const res = await initializeMaven(selectedEnvironmentId, serviceData)
            if (!res || !(res as any).success) {
                setIsMavenDownloading(false)
                setMavenDownloadStatus('failed')
                toast.error((res as any)?.message || t('java_service.maven_download_failed'))
                return
            }

            const task = (res as any)?.data?.task
            const mavenHomePath = ((res as any)?.data?.home || '') as string

            if (!task) {
                setIsMavenDownloading(false)
                setMavenDownloadStatus('installed')
                if (mavenHomePath) {
                    setIsMavenInstalled(true)
                    setMavenDownloadProgress(100)
                    toast.success(t('java_service.maven_download_complete'))
                }
            }
        } catch (error) {
            setIsMavenDownloading(false)
            setMavenDownloadStatus('failed')
            console.error('下载 Maven 异常:', error)
            toast.error(t('java_service.maven_download_failed'))
        }
    }

    const handleInitializeMaven = async () => {
        if (!isServiceDataActive || !isMavenInstalled || isMavenInitializing) {
            return
        }

        try {
            setIsMavenInitializing(true)
            const res = await initializeMaven(selectedEnvironmentId, serviceData)
            if (res && (res as any).success) {
                const mavenHomePath = (res as any)?.data?.home as string | undefined
                if (mavenHomePath) {
                    await applyMavenHome(mavenHomePath, false)
                    toast.success(t('java_service.maven_init_success'))
                } else {
                    toast.error(t('java_service.maven_init_failed_no_home'))
                }
            } else {
                toast.error((res as any)?.message || t('java_service.maven_init_failed'))
            }
        } catch (error) {
            console.error('初始化 Maven 异常:', error)
            toast.error(t('java_service.maven_init_failed'))
        } finally {
            setIsMavenInitializing(false)
        }
    }

    const handleSetGradleHome = async (path: string) => {
        try {
            setIsLoading(true)
            const res = await setGradleHome(selectedEnvironmentId, serviceData, path)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['GRADLE_HOME'] = path
                await updateServiceData({
                    environmentId: selectedEnvironmentId,
                    serviceId: serviceData.id,
                    updates: { metadata: newMetadata },
                    serviceDatasSnapshot: selectedServiceDatas,
                })
                setGradleHomeState(path)
                toast.success(t('java_service.gradle_home_set_success'))
            } else {
                toast.error(t('java_service.gradle_home_set_failed'))
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleSetGradleUserHome = async (path: string) => {
        try {
            setIsLoading(true)
            const res = await setGradleUserHome(selectedEnvironmentId, serviceData, path)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['GRADLE_USER_HOME'] = path
                await updateServiceData({
                    environmentId: selectedEnvironmentId,
                    serviceId: serviceData.id,
                    updates: { metadata: newMetadata },
                    serviceDatasSnapshot: selectedServiceDatas,
                })
                setGradleUserHomeState(path)
                toast.success(t('java_service.gradle_user_home_set_success'))
            } else {
                toast.error(t('java_service.gradle_user_home_set_failed'))
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleSetMavenLocalRepository = async (localRepo: string) => {
        const value = localRepo.trim()
        if (!value) {
            toast.error(t('java_service.maven_local_repo_empty_error'))
            return
        }

        try {
            setIsLoading(true)
            const res = await setMavenLocalRepository(selectedEnvironmentId, serviceData, value)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['MAVEN_LOCAL_REPO'] = value
                await updateServiceData({
                    environmentId: selectedEnvironmentId,
                    serviceId: serviceData.id,
                    updates: { metadata: newMetadata },
                    serviceDatasSnapshot: selectedServiceDatas,
                })
                setMavenLocalRepoState(value)
                toast.success(t('java_service.maven_local_repo_applied'))
            } else {
                toast.error(t('java_service.maven_local_repo_apply_failed'))
            }
        } catch (error) {
            console.error('设置 Maven 本地仓库路径失败:', error)
            toast.error(t('java_service.maven_local_repo_apply_failed'))
        } finally {
            setIsLoading(false)
        }
    }

    const checkGradleInstallState = async () => {
        try {
            setIsGradleChecking(true)
            const res = await checkGradleInstalled(serviceData.version)
            if (res && (res as any).success) {
                setIsGradleInstalled(Boolean((res as any)?.data?.installed))
            } else {
                setIsGradleInstalled(false)
            }
        } catch (error) {
            console.error('检查 Gradle 安装状态失败:', error)
            setIsGradleInstalled(false)
        } finally {
            setIsGradleChecking(false)
        }
    }

    const applyGradleHome = async (path: string, showToastMessage = true) => {
        setIsLoading(true)
        try {
            const res = await setGradleHome(selectedEnvironmentId, serviceData, path)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['GRADLE_HOME'] = path
                await updateServiceData({
                    environmentId: selectedEnvironmentId,
                    serviceId: serviceData.id,
                    updates: { metadata: newMetadata },
                    serviceDatasSnapshot: selectedServiceDatas,
                })
                setGradleHomeState(path)
                if (showToastMessage) {
                    toast.success(t('java_service.gradle_home_set_success'))
                }
                return true
            }

            if (showToastMessage) {
                toast.error(t('java_service.gradle_home_set_failed'))
            }
            return false
        } catch (error) {
            console.error('设置 GRADLE_HOME 异常:', error)
            if (showToastMessage) {
                toast.error(t('java_service.gradle_home_set_failed'))
            }
            return false
        } finally {
            setIsLoading(false)
        }
    }

    const handleDownloadGradle = async () => {
        if (!isServiceDataActive || isGradleDownloading) {
            return
        }

        try {
            setIsGradleDownloading(true)
            setGradleDownloadProgress(0)
            setGradleDownloadStatus('pending')

            const res = await initializeGradle(selectedEnvironmentId, serviceData)
            if (!res || !(res as any).success) {
                setIsGradleDownloading(false)
                setGradleDownloadStatus('failed')
                toast.error((res as any)?.message || t('java_service.gradle_download_failed'))
                return
            }

            const task = (res as any)?.data?.task
            const gradleHomePath = ((res as any)?.data?.home || '') as string

            if (!task) {
                setIsGradleDownloading(false)
                setGradleDownloadStatus('installed')
                if (gradleHomePath) {
                    setIsGradleInstalled(true)
                    setGradleDownloadProgress(100)
                    await applyGradleHome(gradleHomePath, false)
                    toast.success(t('java_service.gradle_download_complete'))
                }
            }
        } catch (error) {
            setIsGradleDownloading(false)
            setGradleDownloadStatus('failed')
            console.error('下载 Gradle 异常:', error)
            toast.error(t('java_service.gradle_download_failed'))
        }
    }

    const handleInitializeGradle = async () => {
        if (!isServiceDataActive || !isGradleInstalled || isGradleInitializing) {
            return
        }

        try {
            setIsGradleInitializing(true)
            const res = await initializeGradle(selectedEnvironmentId, serviceData)
            if (res && (res as any).success) {
                const gradleHomePath = (res as any)?.data?.home as string | undefined
                if (gradleHomePath) {
                    await applyGradleHome(gradleHomePath, false)
                    toast.success(t('java_service.gradle_init_success'))
                } else {
                    toast.error(t('java_service.gradle_init_failed_no_home'))
                }
            } else {
                toast.error((res as any)?.message || t('java_service.gradle_init_failed'))
            }
        } catch (error) {
            console.error('初始化 Gradle 异常:', error)
            toast.error(t('java_service.gradle_init_failed'))
        } finally {
            setIsGradleInitializing(false)
        }
    }

    return (
        <>
            <div className="w-full p-3 space-y-3">

                <div className="w-full p-3 space-y-4 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                    {/* JAVA_HOME 配置 */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {t('java_service.java_home_label')}
                            </Label>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-40 mb-2">
                            {t('java_service.java_home_desc')}
                        </p>
                        <Input
                            value={javaHome}
                            readOnly
                            placeholder="/path/to/java/home"
                            disabled
                            className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        />
                    </div>

                    {/* JAVA_OPTS 配置 */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('java_service.java_opts_label')}</Label>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                            {t('java_service.java_opts_desc')}
                        </p>
                        <div className="flex items-center gap-2">
                            <Input
                                value={javaOpts}
                                onChange={(e) => setJavaOptsState(e.target.value)}
                                placeholder={t('java_service.java_opts_placeholder')}
                                disabled={!isServiceDataActive}
                                className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetJavaOpts(javaOpts)}
                                disabled={isLoading || !isServiceDataActive}
                                className="h-8 text-xs shadow-none shrink-0"
                            >
                                {isLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                                {t('java_service.apply')}
                            </Button>
                        </div>
                    </div>

                    {/* Java 版本信息（折叠） */}
                    <div>
                        {javaInfo && isServiceDataActive && (
                            <Collapsible open={isJavaInfoExpanded} onOpenChange={setIsJavaInfoExpanded}>
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between mb-2 cursor-pointer">
                                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                            {t('java_service.java_version_info')}
                                        </Label>
                                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isJavaInfoExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="space-y-2 text-xs p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{t('java_service.java_version')}:</span>
                                            <span className="font-medium">{javaInfo.version}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{t('java_service.java_install_path')}:</span>
                                            <div className="flex items-center gap-1">
                                                <span className="font-medium text-xs truncate max-w-[200px]" title={javaInfo.home}>
                                                    {javaInfo.home}
                                                </span>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => openFolderInFinder(javaInfo.home)}
                                                    className="h-5 w-5 p-0"
                                                >
                                                    <FolderOpen className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col justify-between">
                                            <span className="text-muted-foreground">{t('java_service.java_vendor')}:</span>
                                            <span className="font-medium">{javaInfo.vendor}</span>
                                        </div>
                                        <div className="flex flex-col justify-between">
                                            <span className="text-muted-foreground">{t('java_service.java_runtime')}:</span>
                                            <span className="font-medium text-xs break-all">{javaInfo.runtime}</span>
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}
                    </div>

                </div>

                {/* Maven 配置卡片 */}
                {isMavenChecking ? (
                    <div className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            {t('java_service.maven_checking')}
                        </div>
                    </div>
                ) : !isMavenInstalled ? (
                    <div className="rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10 p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="flex-1 space-y-1">
                                <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                                    {t('java_service.maven_not_installed_title')}
                                </p>
                                <p className="text-[11px] text-orange-700 dark:text-orange-400 leading-relaxed">
                                    {t('java_service.maven_not_installed_desc')}
                                </p>
                            </div>
                        </div>
                        <div className="flex">
                            <Button
                                size="sm"
                                onClick={handleDownloadMaven}
                                disabled={!isServiceDataActive || isMavenDownloading || isLoading}
                                className="h-7 text-xs shadow-none bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white"
                            >
                                {isMavenDownloading ? t('java_service.maven_downloading') : t('java_service.maven_download')}
                            </Button>
                            {!!mavenDownloadStatus && (
                                <p className="text-[10px] text-orange-600 dark:text-orange-400">
                                    {t('java_service.maven_download_status')}: {mavenDownloadStatus}
                                </p>
                            )}
                            {isMavenDownloading && (
                                <div className="space-y-1">
                                    <Progress value={mavenDownloadProgress} className="h-1.5" />
                                    <div className="text-[10px] text-orange-600 dark:text-orange-400 text-right">
                                        {Math.round(mavenDownloadProgress)}%
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : !mavenHome.trim() ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="flex-1 space-y-1">
                                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                    {t('java_service.maven_not_initialized_title')}
                                </p>
                                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                                    {t('java_service.maven_not_initialized_desc')}
                                </p>
                            </div>
                        </div>
                        <div className="flex">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleInitializeMaven}
                                disabled={!isServiceDataActive || isMavenInitializing || isLoading}
                                className="h-7 text-xs shadow-none bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white"
                            >
                                {isMavenInitializing ? <RefreshCw className="h-3 w-3 animate-spin mr-1.5" /> : <Package className="h-3 w-3 mr-1.5" />}
                                {isMavenInitializing ? t('java_service.maven_initializing') : t('java_service.maven_initialize')}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                        <div className="space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    {t('java_service.maven_home_label')}
                                                    <Info className="h-3 w-3 text-muted-foreground" />
                                                </Label>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="text-xs font-mono">MAVEN_HOME | M2_HOME</div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 mb-2">
                                    {t('java_service.maven_home_desc')}
                                </p>

                                <Input
                                    value={mavenHome}
                                    readOnly
                                    placeholder={t('java_service.maven_home_placeholder')}
                                    disabled
                                    className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    {t('java_service.maven_repo_label')}
                                                    <Info className="h-3 w-3 text-muted-foreground" />
                                                </Label>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="text-xs font-mono">MAVEN_REPO_URL</div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 mb-2">
                                    {t('java_service.maven_repo_desc')}
                                </p>

                                <div className="flex items-center gap-2">
                                    <Input
                                        value={mavenRepository}
                                        onChange={(e) => setMavenRepositoryState(e.target.value)}
                                        placeholder={t('java_service.maven_repo_placeholder')}
                                        disabled={!isServiceDataActive}
                                        className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSetMavenRepository(mavenRepository)}
                                        disabled={!mavenRepository || isLoading || !isServiceDataActive}
                                        className="h-8 text-xs shadow-none shrink-0"
                                    >
                                        {isLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                                        {t('java_service.apply')}
                                    </Button>
                                </div>

                                <div className="flex flex-wrap gap-2 items-center mt-2">
                                    <Label className="block text-[10px] text-gray-500 uppercase tracking-wider">{t('java_service.maven_repo_quick_set')}</Label>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSetMavenRepository('https://repo.maven.apache.org/maven2')}
                                        disabled={isLoading || !isServiceDataActive}
                                        className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                    >
                                        {t('java_service.maven_repo_official')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSetMavenRepository('https://maven.aliyun.com/repository/public')}
                                        disabled={isLoading || !isServiceDataActive}
                                        className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                    >
                                        {t('java_service.maven_repo_aliyun')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSetMavenRepository('https://mirrors.tuna.tsinghua.edu.cn/maven/')}
                                        disabled={isLoading || !isServiceDataActive}
                                        className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                    >
                                        {t('java_service.maven_repo_tsinghua')}
                                    </Button>
                                </div>
                            </div>

                            {/* Maven 本地仓库 */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    {t('java_service.maven_local_repo_label')}
                                                    <Info className="h-3 w-3 text-muted-foreground" />
                                                </Label>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="text-xs font-mono">MAVEN_LOCAL_REPO</div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 mb-2">
                                    {t('java_service.maven_local_repo_desc')}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={mavenLocalRepo}
                                        onChange={(e) => setMavenLocalRepoState(e.target.value)}
                                        placeholder={t('java_service.maven_local_repo_placeholder')}
                                        disabled={!isServiceDataActive}
                                        className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSetMavenLocalRepository(mavenLocalRepo)}
                                        disabled={!mavenLocalRepo || isLoading || !isServiceDataActive}
                                        className="h-8 text-xs shadow-none shrink-0"
                                    >
                                        {isLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                                        {t('java_service.apply')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Gradle 配置卡片 */}
                {isGradleChecking ? (
                    <div className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            {t('java_service.gradle_checking')}
                        </div>
                    </div>
                ) : !isGradleInstalled ? (
                    <div className="rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10 p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="flex-1 space-y-1">
                                <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                                    {t('java_service.gradle_not_installed_title')}
                                </p>
                                <p className="text-[11px] text-orange-700 dark:text-orange-400 leading-relaxed">
                                    {t('java_service.gradle_not_installed_desc')}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Button
                                size="sm"
                                onClick={handleDownloadGradle}
                                disabled={!isServiceDataActive || isGradleDownloading || isLoading}
                                className="h-7 text-xs shadow-none bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white"
                            >
                                {isGradleDownloading ? t('java_service.gradle_downloading') : t('java_service.gradle_download')}
                            </Button>
                            {!!gradleDownloadStatus && (
                                <p className="text-[10px] text-orange-600 dark:text-orange-400">
                                    {t('java_service.gradle_download_status')}: {gradleDownloadStatus}
                                </p>
                            )}
                            {isGradleDownloading && (
                                <div className="space-y-1">
                                    <Progress value={gradleDownloadProgress} className="h-1.5" />
                                    <div className="text-[10px] text-orange-600 dark:text-orange-400 text-right">
                                        {Math.round(gradleDownloadProgress)}%
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                        <div className="space-y-4">

                            {/* GRADLE_HOME */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    {t('java_service.gradle_home_label')}
                                                    <Info className="h-3 w-3 text-muted-foreground" />
                                                </Label>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="text-xs font-mono">GRADLE_HOME</div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 mb-2">
                                    {t('java_service.gradle_home_desc')}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={gradleHome}
                                        onChange={(e) => setGradleHomeState(e.target.value)}
                                        placeholder={t('java_service.gradle_home_placeholder')}
                                        disabled={!isServiceDataActive}
                                        className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSetGradleHome(gradleHome)}
                                        disabled={!gradleHome || isLoading || !isServiceDataActive}
                                        className="h-8 text-xs shadow-none shrink-0"
                                    >
                                        {isLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                                        {t('java_service.apply')}
                                    </Button>
                                </div>
                            </div>

                            {/* 远程仓库提示 */}
                            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 px-3 py-2.5 text-[11px] text-yellow-800 dark:text-yellow-400 leading-relaxed">
                                {t('java_service.gradle_repo_tip')}
                            </div>

                            {/* GRADLE_USER_HOME */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    {t('java_service.gradle_user_home_label')}
                                                    <Info className="h-3 w-3 text-muted-foreground" />
                                                </Label>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="text-xs font-mono">GRADLE_USER_HOME</div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 mb-2">
                                    {t('java_service.gradle_user_home_desc')}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={gradleUserHome}
                                        onChange={(e) => setGradleUserHomeState(e.target.value)}
                                        placeholder={t('java_service.gradle_user_home_placeholder')}
                                        disabled={!isServiceDataActive}
                                        className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSetGradleUserHome(gradleUserHome)}
                                        disabled={!gradleUserHome || isLoading || !isServiceDataActive}
                                        className="h-8 text-xs shadow-none shrink-0"
                                    >
                                        {isLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                                        {t('java_service.apply')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>

        </>
    )
}
