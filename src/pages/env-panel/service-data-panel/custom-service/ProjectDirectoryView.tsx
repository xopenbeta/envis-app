import { useState, useEffect } from 'react'
import { ServiceData, ServiceDataStatus } from '@/types/index'
import { useCustomService } from '@/hooks/services/custom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { Code2, FolderOpen, Terminal, ChevronDown } from 'lucide-react'
import { ipcOpenProjectInVSCode, ipcOpenFolderInFinder, ipcOpenTerminalInFolder } from '@/ipc/services/custom'

interface ProjectDirectoryViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
    status: ServiceDataStatus
}

export function ProjectDirectoryView({ selectedEnvironmentId, serviceData, status }: ProjectDirectoryViewProps) {
    const { updateCustomServiceChdir, applyServiceMetadata } = useCustomService()
    const [path, setPath] = useState('')
    const [enabled, setEnabled] = useState(true)
    const [isLoading, setIsLoading] = useState(false)
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
    const isServiceDataActive = status === ServiceDataStatus.Active

    // 从 metadata 加载配置
    useEffect(() => {
        const p = serviceData.metadata?.autoChdirPath || ''
        // autoChdirEnabled 未设置时默认为 true
        const e = serviceData.metadata?.autoChdirEnabled !== false
        setPath(p)
        setEnabled(e)
    }, [serviceData])

    // 切换开关时立即更新 shell 配置文件
    const handleToggle = async (newEnabled: boolean) => {
        setEnabled(newEnabled)

        const currentPath = path.trim()
        if (!currentPath) {
            // 路径为空时仅更新 metadata，无需写 shell
            const newMetadata = {
                ...(serviceData.metadata || {}),
                autoChdirEnabled: newEnabled,
                autoChdirPath: currentPath,
            }
            await applyServiceMetadata(selectedEnvironmentId, serviceData.id, newMetadata)
            return
        }

        setIsLoading(true)
        try {
            const wasActive = serviceData.metadata?.autoChdirEnabled !== false
            const oldChdir = wasActive && serviceData.metadata?.autoChdirPath
                ? serviceData.metadata.autoChdirPath as string
                : null
            const newChdir = newEnabled ? currentPath : null

            const res = await updateCustomServiceChdir(
                selectedEnvironmentId, serviceData, oldChdir, newChdir
            )
            if (res && res.success) {
                const newMetadata = {
                    ...(serviceData.metadata || {}),
                    autoChdirEnabled: newEnabled,
                    autoChdirPath: currentPath,
                }
                await applyServiceMetadata(selectedEnvironmentId, serviceData.id, newMetadata)
                toast.success(newEnabled ? '终端自动跳转已启用' : '终端自动跳转已禁用')
            } else {
                // 回滚开关状态
                setEnabled(!newEnabled)
                toast.error('操作失败: ' + (res?.message || '未知错误'))
            }
        } catch (error) {
            setEnabled(!newEnabled)
            toast.error('操作失败')
        } finally {
            setIsLoading(false)
        }
    }

    // 应用按钮：保存路径并更新 shell 配置文件
    const handleApply = async () => {
        setIsLoading(true)
        try {
            const newPath = path.trim()
            const wasActive = serviceData.metadata?.autoChdirEnabled !== false
            const oldChdir = wasActive && serviceData.metadata?.autoChdirPath
                ? serviceData.metadata.autoChdirPath as string
                : null
            const newChdir = enabled && newPath ? newPath : null

            const res = await updateCustomServiceChdir(
                selectedEnvironmentId, serviceData, oldChdir, newChdir
            )
            if (res && res.success) {
                const newMetadata = {
                    ...(serviceData.metadata || {}),
                    autoChdirEnabled: enabled,
                    autoChdirPath: newPath,
                }
                const applyRes = await applyServiceMetadata(
                    selectedEnvironmentId, serviceData.id, newMetadata
                )
                if (applyRes && applyRes.success) {
                    toast.success('项目目录已保存')
                } else {
                    toast.error('保存到本地状态失败')
                }
            } else {
                toast.error('保存失败: ' + (res?.message || '未知错误'))
            }
        } catch (error) {
            console.error('保存项目目录失败:', error)
            toast.error('保存失败')
        } finally {
            setIsLoading(false)
        }
    }

    // 打开 VSCode
    const handleOpenVSCode = async () => {
        const currentPath = path.trim()
        if (!currentPath) {
            toast.error('请先输入项目目录')
            return
        }
        try {
            await ipcOpenProjectInVSCode(currentPath, selectedEnvironmentId)
            toast.success('正在用 VSCode 打开项目...')
        } catch (error) {
            toast.error('打开 VSCode 失败')
        }
    }

    // 打开文件夹
    const handleOpenFolder = async () => {
        const currentPath = path.trim()
        if (!currentPath) {
            toast.error('请先输入项目目录')
            return
        }
        try {
            await ipcOpenFolderInFinder(currentPath)
            toast.success('正在打开文件夹...')
        } catch (error) {
            toast.error('打开文件夹失败')
        }
    }

    // 打开终端
    const handleOpenTerminal = async () => {
        const currentPath = path.trim()
        if (!currentPath) {
            toast.error('请先输入项目目录')
            return
        }
        try {
            await ipcOpenTerminalInFolder(currentPath)
            toast.success('正在打开终端...')
        } catch (error) {
            toast.error('打开终端失败')
        }
    }

    return (
        <TooltipProvider>
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                {/* 项目目录标题 */}
                <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    项目目录
                </Label>
                <p className="text-[10px] text-muted-foreground mb-3">
                    配置项目路径，快速用 VSCode、文件夹或终端打开
                </p>

                {/* 输入框和操作按钮 */}
                <div className="flex items-center gap-2 mb-3">
                    <Input
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="/path/to/project"
                        className="flex-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        disabled={isLoading || !isServiceDataActive}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApply()
                        }}
                    />
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleApply}
                        disabled={isLoading || !isServiceDataActive}
                        className="shadow-none h-8 text-xs"
                    >
                        {isLoading ? '应用中...' : '应用'}
                    </Button>
                </div>

                {/* 快速打开按钮组 */}
                <div className="flex items-center gap-2 mb-3">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleOpenVSCode}
                                disabled={!path.trim() || !isServiceDataActive}
                                className="h-8 w-8 p-0 shadow-none"
                            >
                                <Code2 className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>用 VSCode 打开</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleOpenFolder}
                                disabled={!path.trim() || !isServiceDataActive}
                                className="h-8 w-8 p-0 shadow-none"
                            >
                                <FolderOpen className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>打开文件夹</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleOpenTerminal}
                                disabled={!path.trim() || !isServiceDataActive}
                                className="h-8 w-8 p-0 shadow-none"
                            >
                                <Terminal className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>打开终端</TooltipContent>
                    </Tooltip>
                </div>

                {/* 高级选项 - 自动跳转终端 */}
                <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                    <CollapsibleTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground w-full justify-start"
                        >
                            <ChevronDown className={`h-3 w-3 mr-1.5 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
                            高级选项
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 pt-2 border-t border-gray-200 dark:border-white/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    打开终端自动跳转
                                </Label>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    打开终端时自动执行 cd 进入指定目录
                                </p>
                            </div>
                            <Switch
                                checked={enabled}
                                onCheckedChange={handleToggle}
                                disabled={isLoading || !isServiceDataActive}
                            />
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </TooltipProvider>
    )
}
