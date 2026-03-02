import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
import {
    Coffee,
    AlertTriangle,
    Package,
    RefreshCw,
    FolderOpen,
    ExternalLink,
    CheckCircle2,
    ChevronDown
} from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useTranslation } from 'react-i18next'
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
        initializeMaven,
        getMavenDownloadProgress,
        setMavenLocalRepository,
    } = useJavaService()
    const { updateServiceData, selectedServiceDatas } = useEnvironmentServiceData()

    const [javaHome, setJavaHomeState] = useState('')
    const [javaOpts, setJavaOptsState] = useState('')
    const [mavenHome, setMavenHomeState] = useState('')
    const [mavenRepository, setMavenRepositoryState] = useState('')
    const [gradleHome, setGradleHomeState] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isMavenChecking, setIsMavenChecking] = useState(false)
    const [isMavenInstalled, setIsMavenInstalled] = useState(false)
    const [isMavenDownloading, setIsMavenDownloading] = useState(false)
    const [isMavenInitializing, setIsMavenInitializing] = useState(false)
    const [mavenDownloadProgress, setMavenDownloadProgress] = useState(0)
    const [mavenDownloadStatus, setMavenDownloadStatus] = useState('')
    const [mavenLocalRepo, setMavenLocalRepoState] = useState('')
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
        setMavenLocalRepoState((serviceData.metadata?.MAVEN_LOCAL_REPO || '').trim())
        checkMavenInstallState()

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

    return (
        <>
            <div className="w-full p-3 space-y-3">

                <div className="w-full p-3 space-y-6 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                    {/* JAVA_HOME 配置 */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {t('java_service.java_home_label')}
                            </Label>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 mb-2">
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
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('java_service.java_opts_label')}</Label>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 mb-2">
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
                                        <span className="text-muted-foreground">{t('java_service.java_vendor')}:</span>
                                        <span className="font-medium">{javaInfo.vendor}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('java_service.java_runtime')}:</span>
                                        <span className="font-medium text-xs break-all">{javaInfo.runtime}</span>
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
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )}

                </div>

                {/* Maven 配置卡片 */}
                <div className="w-full p-3 space-y-6 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                    {!isMavenChecking && !isMavenInstalled && (
                        <Alert variant="destructive" className="mb-3">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle className="text-xs">{t('java_service.maven_not_installed_title')}</AlertTitle>
                            <AlertDescription>
                                <div className="mt-2 space-y-2">
                                    <p className="text-xs">{t('java_service.maven_not_installed_desc')}</p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleDownloadMaven}
                                            disabled={!isServiceDataActive || isMavenDownloading || isLoading}
                                            className="h-7 text-xs shadow-none"
                                        >
                                            {isMavenDownloading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                                            {isMavenDownloading ? t('java_service.maven_downloading') : t('java_service.maven_download')}
                                        </Button>
                                        {!!mavenDownloadStatus && (
                                            <span className="text-[11px] text-muted-foreground">
                                                {t('java_service.maven_download_status')}: {mavenDownloadStatus}
                                            </span>
                                        )}
                                    </div>
                                    {isMavenDownloading && (
                                        <div className="space-y-1">
                                            <Progress value={mavenDownloadProgress} className="h-2" />
                                            <div className="text-[11px] text-muted-foreground text-right">
                                                {Math.round(mavenDownloadProgress)}%
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                {t('java_service.maven_home_label')}
                            </Label>
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

                        {!mavenHome.trim() && (
                            <div className="mt-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleInitializeMaven}
                                    disabled={!isServiceDataActive || !isMavenInstalled || isMavenInitializing || isLoading}
                                    className="h-7 text-xs shadow-none"
                                >
                                    {isMavenInitializing ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                                    {isMavenInitializing ? t('java_service.maven_initializing') : t('java_service.maven_initialize')}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                {t('java_service.maven_repo_label')}
                            </Label>
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

                        <div className="flex flex-wrap gap-2 items-center mt-3">
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
                            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                {t('java_service.maven_local_repo_label')}
                            </Label>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 mb-2">
                            {t('java_service.maven_local_repo_desc')}
                        </p>
                        <div className="flex items-center gap-2">
                            <Input
                                value={mavenLocalRepo}
                                onChange={(e) => setMavenLocalRepoState(e.target.value)}
                                placeholder={t('java_service.maven_local_repo_placeholder')}
                                disabled={!isServiceDataActive || !isMavenInstalled}
                                className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetMavenLocalRepository(mavenLocalRepo)}
                                disabled={!mavenLocalRepo || isLoading || !isServiceDataActive || !isMavenInstalled}
                                className="h-8 text-xs shadow-none shrink-0"
                            >
                                {isLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                                {t('java_service.apply')}
                            </Button>
                        </div>
                    </div>

                </div>

                {/* Gradle 配置卡片 */}
                <div className="w-full p-3 space-y-6 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <Package className="h-3.5 w-3.5" />
                                {t('java_service.gradle_home_label')}
                            </Label>
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
                </div>

            </div>

        </>
    )
}
