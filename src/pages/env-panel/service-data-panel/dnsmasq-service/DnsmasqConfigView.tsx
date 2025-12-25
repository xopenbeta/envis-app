import { useState, useEffect, useMemo } from 'react'
import { ServiceData, ServiceDataStatus, ServiceStatus } from '@/types/index'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { useFileOperations } from '@/hooks/file-operations'
import { useDnsmasqService } from '@/hooks/services/dnsmasq'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FolderOpen, Play, Square, RotateCw, Save, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DnsmasqConfigViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

export function DnsmasqConfigView({
    selectedEnvironmentId,
    serviceData,
}: DnsmasqConfigViewProps) {
    const { openFolderInFinder } = useFileOperations()
    const {
        updateServiceData,
        startServiceData,
        stopServiceData,
        restartServiceData,
        getServiceStatus,
    } = useEnvironmentServiceData()
    const { getDnsmasqConfig } = useDnsmasqService()

    const isServiceActive = [ServiceDataStatus.Active].includes(serviceData.status)
    const configPath = useMemo(() => {
        return serviceData.metadata?.['DNSMASQ_CONF'] || ''
    }, [serviceData.metadata])

    const [editingConfigPath, setEditingConfigPath] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    
    // 服务状态相关
    const [serviceStatus, setServiceStatus] = useState<ServiceStatus>(ServiceStatus.Unknown)
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

    // 轮询服务状态
    useEffect(() => {
        if (!isServiceActive) return

        const checkStatus = async () => {
            try {
                const res = await getServiceStatus(selectedEnvironmentId, serviceData)
                if (res.success && res.data) {
                    setServiceStatus(res.data.status)
                }
            } catch (error) {
                console.error('获取服务状态失败:', error)
            }
        }

        checkStatus()
        const interval = setInterval(checkStatus, 3000)
        return () => clearInterval(interval)
    }, [isServiceActive, selectedEnvironmentId, serviceData])

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
                toast.error('加载配置文件失败')
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
            toast.error('打开文件夹失败')
        }
    }

    const handleSetConfigPath = async () => {
        try {
            // 更新 metadata
            const newMetadata = { ...serviceData.metadata, DNSMASQ_CONF: editingConfigPath }
            const updatedServiceData = { ...serviceData, metadata: newMetadata }
            
            await updateServiceData(serviceData.id, updatedServiceData)
            toast.success('配置文件路径已更新')
        } catch (error) {
            console.error('更新配置路径失败:', error)
            toast.error('更新配置路径失败')
        }
    }

    // 启动服务
    const handleStartService = async () => {
        try {
            setIsStarting(true)
            await startServiceData(selectedEnvironmentId, serviceData)
            toast.success('服务启动命令已发送')
            // 状态更新会通过轮询自动完成
        } catch (error) {
            console.error('启动服务失败:', error)
            toast.error('启动服务失败')
        } finally {
            setIsStarting(false)
        }
    }

    // 停止服务
    const handleStopService = async () => {
        try {
            setIsStopping(true)
            await stopServiceData(selectedEnvironmentId, serviceData)
            toast.success('服务停止命令已发送')
        } catch (error) {
            console.error('停止服务失败:', error)
            toast.error('停止服务失败')
        } finally {
            setIsStopping(false)
        }
    }

    // 重启服务
    const handleRestartService = async () => {
        try {
            setIsRestarting(true)
            await restartServiceData(selectedEnvironmentId, serviceData)
            toast.success('服务重启命令已发送')
        } catch (error) {
            console.error('重启服务失败:', error)
            toast.error('重启服务失败')
        } finally {
            setIsRestarting(false)
        }
    }

    return (
        <div className="w-full space-y-4">
            {/* 控制面板 */}
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
                <div className="flex flex-wrap gap-2">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        onClick={handleStartService}
                        disabled={serviceStatus === ServiceStatus.Running || isStarting || isStopping || isRestarting}
                    >
                        <Play className="h-3.5 w-3.5 text-green-600" />
                        启动
                    </Button>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        onClick={handleStopService}
                        disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
                    >
                        <Square className="h-3.5 w-3.5 text-red-600" />
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
            </div>

            {/* 配置路径设置 */}
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    配置文件设置
                </Label>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="config-path" className="text-xs text-muted-foreground font-normal">配置文件路径 (dnsmasq.conf)</Label>
                        <div className="flex gap-2">
                            <Input 
                                id="config-path" 
                                value={editingConfigPath} 
                                onChange={(e) => setEditingConfigPath(e.target.value)}
                                placeholder="输入绝对路径..."
                                className="h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                            />
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={handleOpenConfigFolder} 
                                title="打开所在文件夹"
                                className="h-8 w-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
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
                            className="h-8 text-xs shadow-none"
                        >
                            更新路径
                        </Button>
                    </div>
                </div>
            </div>

        </div>
    )
}
