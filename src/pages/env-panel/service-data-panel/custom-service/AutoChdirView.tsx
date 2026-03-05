import { useState, useEffect } from 'react'
import { ServiceData, ServiceDataStatus } from '@/types/index'
import { useCustomService } from '@/hooks/services/custom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface AutoChdirViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

export function AutoChdirView({ selectedEnvironmentId, serviceData }: AutoChdirViewProps) {
    const { updateCustomServiceChdir, applyServiceMetadata } = useCustomService()
    const [path, setPath] = useState('')
    const [enabled, setEnabled] = useState(true)
    const [isLoading, setIsLoading] = useState(false)
    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active

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
                    toast.success('目录配置已保存')
                } else {
                    toast.error('保存到本地状态失败')
                }
            } else {
                toast.error('保存失败: ' + (res?.message || '未知错误'))
            }
        } catch (error) {
            console.error('保存自动跳转目录失败:', error)
            toast.error('保存失败')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        终端自动跳转目录
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

            {enabled && (
                <div className="flex items-center space-x-2 mt-2">
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
            )}
        </div>
    )
}
