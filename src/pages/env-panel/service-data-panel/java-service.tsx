import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
import {
    Coffee,
    Info,
    AlertTriangle,
    Package,
    RefreshCw,
    FolderOpen,
    ExternalLink,
    CheckCircle2
} from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
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
    const { getJavaInfo, setJavaHome, setJavaOpts, setMavenHome, setGradleHome } = useJavaService()
    const { updateServiceData } = useEnvironmentServiceData()
    
    const [javaHome, setJavaHomeState] = useState('')
    const [javaOpts, setJavaOptsState] = useState('')
    const [mavenHome, setMavenHomeState] = useState('')
    const [gradleHome, setGradleHomeState] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [javaInfo, setJavaInfo] = useState<{
        version: string
        vendor: string
        runtime: string
        vm: string
        home: string
    } | null>(null)

    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active

    useEffect(() => {
        setJavaHomeState(serviceData.metadata?.JAVA_HOME || '')
        setJavaOptsState(serviceData.metadata?.JAVA_OPTS || '')
        setMavenHomeState(serviceData.metadata?.MAVEN_HOME || '')
        setGradleHomeState(serviceData.metadata?.GRADLE_HOME || '')
        
        if (isServiceDataActive) {
            loadJavaInfo()
        }
    }, [serviceData, isServiceDataActive])

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

    const handleSetJavaHome = async (path: string) => {
        try {
            setIsLoading(true)
            const res = await setJavaHome(selectedEnvironmentId, serviceData, path)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['JAVA_HOME'] = path
                await updateServiceData(serviceData.id, {
                    metadata: newMetadata
                })
                setJavaHomeState(path)
                toast.success('JAVA_HOME 设置成功')
            } else {
                toast.error('JAVA_HOME 设置失败')
            }
        } catch (error) {
            console.error('设置 JAVA_HOME 异常:', error)
            toast.error('设置 JAVA_HOME 失败')
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
                await updateServiceData(serviceData.id, {
                    metadata: newMetadata
                })
                setJavaOptsState(opts)
                toast.success('JAVA_OPTS 设置成功')
            } else {
                toast.error('JAVA_OPTS 设置失败')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleSetMavenHome = async (path: string) => {
        try {
            setIsLoading(true)
            const res = await setMavenHome(selectedEnvironmentId, serviceData, path)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['MAVEN_HOME'] = path
                await updateServiceData(serviceData.id, {
                    metadata: newMetadata
                })
                setMavenHomeState(path)
                toast.success('MAVEN_HOME 设置成功')
            } else {
                toast.error('MAVEN_HOME 设置失败')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleSetGradleHome = async (path: string) => {
        try {
            setIsLoading(true)
            const res = await setGradleHome(selectedEnvironmentId, serviceData, path)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['GRADLE_HOME'] = path
                await updateServiceData(serviceData.id, {
                    metadata: newMetadata
                })
                setGradleHomeState(path)
                toast.success('GRADLE_HOME 设置成功')
            } else {
                toast.error('GRADLE_HOME 设置失败')
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full p-3 space-y-3">
            {/* 激活提示 */}
            {!isServiceDataActive && (
                <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-500/10">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertTitle className="text-orange-700 dark:text-orange-400">
                        服务未激活
                    </AlertTitle>
                    <AlertDescription className="text-orange-600 dark:text-orange-300">
                        请在左侧服务列表中激活此 Java 版本，才能使用相关功能。
                    </AlertDescription>
                </Alert>
            )}

            <div className="w-full p-3 space-y-6 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                {/* Java 版本信息 */}
                {javaInfo && isServiceDataActive && (
                    <div>
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            版本信息
                        </Label>
                        <div className="space-y-2 text-xs p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Java 版本:</span>
                                <span className="font-medium">{javaInfo.version}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">供应商:</span>
                                <span className="font-medium">{javaInfo.vendor}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">运行时:</span>
                                <span className="font-medium text-xs break-all">{javaInfo.runtime}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">安装路径:</span>
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
                    </div>
                )}

                {/* JAVA_HOME 配置 */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            JAVA_HOME
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs text-xs">
                                            Java 安装目录的路径，激活服务时会自动设置
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </Label>
                    </div>
                    <Input
                        value={javaHome}
                        onChange={(e) => setJavaHomeState(e.target.value)}
                        placeholder="/path/to/java/home"
                        disabled={!isServiceDataActive}
                        className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetJavaHome(javaHome)}
                        disabled={!javaHome || isLoading || !isServiceDataActive}
                        className="h-7 text-xs shadow-none mt-2"
                    >
                        {isLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                        应用配置
                    </Button>
                </div>

                {/* JAVA_OPTS 配置 */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            JAVA_OPTS
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs text-xs">
                                            JVM 运行参数，例如: -Xmx1024m -Xms512m
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </Label>
                    </div>
                    <Input
                        value={javaOpts}
                        onChange={(e) => setJavaOptsState(e.target.value)}
                        placeholder="-Xmx1024m -Xms512m"
                        disabled={!isServiceDataActive}
                        className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetJavaOpts(javaOpts)}
                        disabled={isLoading || !isServiceDataActive}
                        className="h-7 text-xs shadow-none mt-2"
                    >
                        {isLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                        应用配置
                    </Button>
                </div>

                {/* Maven 配置 */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            MAVEN_HOME (可选)
                        </Label>
                    </div>
                    <Input
                        value={mavenHome}
                        onChange={(e) => setMavenHomeState(e.target.value)}
                        placeholder="/path/to/maven"
                        disabled={!isServiceDataActive}
                        className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetMavenHome(mavenHome)}
                        disabled={!mavenHome || isLoading || !isServiceDataActive}
                        className="h-7 text-xs shadow-none mt-2"
                    >
                        {isLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                        应用配置
                    </Button>
                </div>

                {/* Gradle 配置 */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            GRADLE_HOME (可选)
                        </Label>
                    </div>
                    <Input
                        value={gradleHome}
                        onChange={(e) => setGradleHomeState(e.target.value)}
                        placeholder="/path/to/gradle"
                        disabled={!isServiceDataActive}
                        className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetGradleHome(gradleHome)}
                        disabled={!gradleHome || isLoading || !isServiceDataActive}
                        className="h-7 text-xs shadow-none mt-2"
                    >
                        {isLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                        应用配置
                    </Button>
                </div>
            </div>

            {/* 环境变量预览 */}
            {isServiceDataActive && (
                <div className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        环境变量
                    </Label>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                            <span className="text-xs text-muted-foreground">JAVA_HOME</span>
                            <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate max-w-[200px]">
                                {javaHome || '未设置'}
                            </code>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                            <span className="text-xs text-muted-foreground">PATH</span>
                            <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                $JAVA_HOME/bin
                            </code>
                        </div>
                        {javaOpts && (
                            <div className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                                <span className="text-xs text-muted-foreground">JAVA_OPTS</span>
                                <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate max-w-[200px]">
                                    {javaOpts}
                                </code>
                            </div>
                        )}
                        {mavenHome && (
                            <div className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                                <span className="text-xs text-muted-foreground">MAVEN_HOME</span>
                                <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate max-w-[200px]">
                                    {mavenHome}
                                </code>
                            </div>
                        )}
                        {gradleHome && (
                            <div className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                                <span className="text-xs text-muted-foreground">GRADLE_HOME</span>
                                <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate max-w-[200px]">
                                    {gradleHome}
                                </code>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 有用的链接 */}
            {isServiceDataActive && (
                <div className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        有用的链接
                    </Label>
                    <div className="space-y-2">
                        <a 
                            href="https://docs.oracle.com/javase/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                            <ExternalLink className="h-3 w-3" />
                            Java 官方文档
                        </a>
                        <a 
                            href="https://adoptium.net/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                            <ExternalLink className="h-3 w-3" />
                            Adoptium (OpenJDK)
                        </a>
                        <a 
                            href="https://maven.apache.org/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                            <ExternalLink className="h-3 w-3" />
                            Apache Maven
                        </a>
                        <a 
                            href="https://gradle.org/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                            <ExternalLink className="h-3 w-3" />
                            Gradle
                        </a>
                    </div>
                </div>
            )}
        </div>
    )
}
