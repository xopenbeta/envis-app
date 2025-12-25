import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from 'sonner'
import {
    Activity,
    Power,
    PowerOff,
    RefreshCw,
    FolderOpen,
    Save,
    Info,
    AlertTriangle,
    Settings,
    FileText,
    Server,
    Globe,
    Cpu,
    Play,
    Square,
    RotateCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ServiceData, ServiceDataStatus, ServiceStatus } from '@/types/index'
import { useState, useEffect, useMemo } from 'react'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { useFileOperations } from '@/hooks/file-operations'
import { useNginxService } from '@/hooks/services/nginx'

interface NginxConfigViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

interface NginxParsedConfig {
    workerProcesses?: string;
    servers: Array<{
        listen: string[];
        serverName: string[];
        root?: string;
    }>;
}

export function NginxConfigView({
    selectedEnvironmentId,
    serviceData,
}: NginxConfigViewProps) {
    const { openFolderInFinder } = useFileOperations()
    const {
        updateServiceData,
        startServiceData,
        stopServiceData,
        restartServiceData,
        getServiceStatus,
    } = useEnvironmentServiceData()
    const { getNginxConfig } = useNginxService()

    const isServiceActive = [ServiceDataStatus.Active].includes(serviceData.status)
    const configPath = useMemo(() => {
        return serviceData.metadata?.['NGINX_CONF'] || ''
    }, [serviceData.metadata])

    const [editingConfigPath, setEditingConfigPath] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    
    // 服务状态相关
    const [serviceStatus, setServiceStatus] = useState<ServiceStatus>(ServiceStatus.Unknown)
    const [isStarting, setIsStarting] = useState(false)
    const [isStopping, setIsStopping] = useState(false)
    const [isRestarting, setIsRestarting] = useState(false)

    // 解析后的配置
    const [parsedConfig, setParsedConfig] = useState<NginxParsedConfig | null>(null)

    // 初始化编辑路径
    useEffect(() => {
        setEditingConfigPath(configPath)
    }, [configPath])

    // 轮询服务状态
    useEffect(() => {
        if (!isServiceActive) return

        const checkStatus = async () => {
            try {
                const result = await getServiceStatus(selectedEnvironmentId, serviceData)
                if (result.success && result.data) {
                    setServiceStatus(result.data.status);
                }
            } catch (error) {
                console.error('获取服务状态失败:', error)
            }
        }

        checkStatus()
        const interval = setInterval(checkStatus, 3000)
        return () => clearInterval(interval)
    }, [isServiceActive, selectedEnvironmentId, serviceData])

    // 加载并解析配置
    useEffect(() => {
        const loadConfig = async () => {
            if (!isServiceActive || !configPath) return
            
            try {
                const result = await getNginxConfig(selectedEnvironmentId, serviceData)
                if (result.success && result.data?.content) {
                    parseNginxConfig(result.data.content)
                }
            } catch (error) {
                console.error('加载 Nginx 配置失败:', error)
            }
        }
        
        loadConfig()
    }, [isServiceActive, configPath, selectedEnvironmentId, serviceData])

    // 简单的 Nginx 配置解析
    const parseNginxConfig = (content: string) => {
        const config: NginxParsedConfig = {
            servers: []
        }

        // 提取 worker_processes
        const workerMatch = content.match(/worker_processes\s+(\d+|auto);/)
        if (workerMatch) {
            config.workerProcesses = workerMatch[1]
        }

        // 提取 server 块 (非常简化的解析，不支持嵌套大括号的完美匹配，但对标准格式有效)
        // 这里使用一个简单的状态机或正则来提取 server 块
        // 为了简化，我们只查找 server { ... } 结构
        
        // 移除注释
        const cleanContent = content.replace(/#.*$/gm, '')
        
        // 查找所有 server 块
        const serverBlocks: string[] = []
        let braceCount = 0
        let inServerBlock = false
        let currentBlock = ''
        
        const tokens = cleanContent.split(/({|})/)
        
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i]
            
            if (token.includes('server') && !inServerBlock && braceCount === 1) { // http block level usually
                 // This is a very rough heuristic. Better to use regex to find "server {" start
            }
        }

        // 使用正则匹配 server 块内容 (简化版)
        const serverRegex = /server\s*{([^}]*)}/g
        let match
        // 注意：这个正则无法处理嵌套的大括号，仅适用于简单配置
        // 对于更复杂的配置，可能需要更强大的解析器
        // 这里尝试匹配 listen 和 server_name
        
        // 既然正则难以处理嵌套，我们尝试直接在全文搜索 listen 和 server_name，
        // 或者假设标准缩进/格式。
        // 更好的方法是：只提取关键信息用于展示，不必完美解析结构。
        
        // 提取所有 listen 指令
        const listenMatches = [...cleanContent.matchAll(/listen\s+([^;]+);/g)]
        // 提取所有 server_name 指令
        const serverNameMatches = [...cleanContent.matchAll(/server_name\s+([^;]+);/g)]
        
        // 简单组合展示
        if (listenMatches.length > 0) {
            // 尝试将它们组合成 server 对象
            // 这里简化处理：每个 listen 视为一个 server 入口
            listenMatches.forEach((match, index) => {
                config.servers.push({
                    listen: [match[1].trim()],
                    serverName: serverNameMatches[index] ? [serverNameMatches[index][1].trim()] : ['localhost']
                })
            })
        } else {
             // 如果没找到 listen，可能在 include 文件中，或者默认 80
             config.servers.push({
                 listen: ['80 (Default)'],
                 serverName: ['localhost']
             })
        }

        setParsedConfig(config)
    }

    const handleOpenNginxFolder = async () => {
        try {
            if (configPath) {
                await openFolderInFinder(configPath)
            }
        } catch (error) {
            console.error('打开 Nginx 目录失败:', error)
            toast.error('打开目录失败')
        }
    }

    const handleSetConfigPath = async () => {
        try {
            setIsLoading(true)
            const newMetadata = { ...(serviceData.metadata || {}) }
            newMetadata['NGINX_CONF'] = editingConfigPath

            const updated = await updateServiceData(serviceData.id, { metadata: newMetadata })
            if (updated) {
                toast.success('配置文件路径设置成功')
            } else {
                toast.error('配置文件路径设置失败')
            }
        } catch (error) {
            console.error('设置配置文件路径失败:', error)
            toast.error('配置文件路径设置失败')
        } finally {
            setIsLoading(false)
        }
    }

    // 启动服务
    const handleStartService = async () => {
        try {
            setIsStarting(true)
            const res = await startServiceData(selectedEnvironmentId, serviceData)
            if (res && (res as any).success) {
                toast.success('Nginx 服务启动成功')
                const result = await getServiceStatus(selectedEnvironmentId, serviceData)
                if (result.success && result.data) {
                    setServiceStatus(result.data.status);
                }
            } else {
                toast.error((res as any)?.message || '启动失败')
            }
        } catch (error) {
            console.error('启动 Nginx 服务失败:', error)
            toast.error('启动失败')
        } finally {
            setIsStarting(false)
        }
    }

    // 停止服务
    const handleStopService = async () => {
        try {
            setIsStopping(true)
            const res = await stopServiceData(selectedEnvironmentId, serviceData)
            if (res && (res as any).success) {
                toast.success('Nginx 服务停止成功')
                const result = await getServiceStatus(selectedEnvironmentId, serviceData)
                if (result.success && result.data) {
                    setServiceStatus(result.data.status);
                }
            } else {
                toast.error((res as any)?.message || '停止失败')
            }
        } catch (error) {
            console.error('停止 Nginx 服务失败:', error)
            toast.error('停止失败')
        } finally {
            setIsStopping(false)
        }
    }

    // 重启服务
    const handleRestartService = async () => {
        try {
            setIsRestarting(true)
            const res = await restartServiceData(selectedEnvironmentId, serviceData)
            if (res && (res as any).success) {
                toast.success('Nginx 服务重启成功')
                const result = await getServiceStatus(selectedEnvironmentId, serviceData)
                if (result.success && result.data) {
                    setServiceStatus(result.data.status);
                }
            } else {
                toast.error((res as any)?.message || '重启失败')
            }
        } catch (error) {
            console.error('重启 Nginx 服务失败:', error)
            toast.error('重启失败')
        } finally {
            setIsRestarting(false)
        }
    }

    return (
        <div className="w-full space-y-4">
            {/* Nginx 状态 */}
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        服务控制
                    </Label>
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            serviceStatus === ServiceStatus.Running ? "bg-green-500" : 
                            serviceStatus === ServiceStatus.Stopped ? "bg-red-500" : "bg-gray-300"
                        )} />
                        <span className="text-xs font-normal text-muted-foreground">
                            {serviceStatus === ServiceStatus.Running ? '运行中' : 
                             serviceStatus === ServiceStatus.Stopped ? '已停止' : '未知状态'}
                        </span>
                    </div>
                </div>

                {/* 服务控制按钮 */}
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
                            启动
                        </Button>
                        <Button 
                            size="sm" 
                            variant="outline" 
                            className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                            onClick={handleStopService}
                            disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
                        >
                            <PowerOff className="h-3.5 w-3.5 text-red-600" />
                            停止
                        </Button>
                        <Button 
                            size="sm" 
                            variant="outline" 
                            className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                            onClick={handleRestartService}
                            disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
                        >
                            <RotateCw className={cn("h-3.5 w-3.5 text-blue-600", isRestarting && "animate-spin")} />
                            重启
                        </Button>
                    </div>
                )}
            </div>

            {/* 配置管理 */}
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                {isServiceActive ? (
                    <div className="space-y-4">
                        {/* 配置文件路径 */}
                        <div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                            配置文件
                                            <Info className="h-3 w-3 text-muted-foreground" />
                                        </Label>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="text-xs">nginx.conf 文件的路径</div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <div className="flex items-center gap-2 mt-1">
                                <Input
                                    value={editingConfigPath}
                                    onChange={(e) => setEditingConfigPath(e.target.value)}
                                    placeholder="Nginx 配置文件路径"
                                    disabled={isLoading}
                                    className="flex-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSetConfigPath}
                                    disabled={isLoading || !editingConfigPath || editingConfigPath === configPath}
                                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                    title="保存"
                                >
                                    <Save className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleOpenNginxFolder}
                                    disabled={!configPath}
                                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                    title="打开目录"
                                >
                                    <FolderOpen className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>

                        {/* 解析后的配置展示 */}
                        {parsedConfig && (
                            <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-white/10">
                                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">配置概览</Label>
                                
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Server className="h-3 w-3" />
                                        Server Blocks
                                    </div>
                                    {parsedConfig.servers.length > 0 ? (
                                        <div className="space-y-2">
                                            {parsedConfig.servers.map((server, idx) => (
                                                <div key={idx} className="bg-white dark:bg-white/5 p-2 rounded border border-gray-200 dark:border-white/10 text-xs space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">Listen:</span>
                                                        <span className="font-mono">{server.listen.join(', ')}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">Server Name:</span>
                                                        <span className="font-mono">{server.serverName.join(', ')}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted-foreground text-center py-2">
                                            未检测到 Server 配置
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
                        <Settings className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">服务未激活</p>
                        <p className="text-xs">请先激活 Nginx 服务</p>
                    </div>
                )}
            </div>
        </div>
    )
}

