import { useState, useEffect } from 'react'
import { ServiceData, ServiceDataStatus } from '@/types/index'
import { useCustomService } from '@/hooks/services/custom'
import { useServiceDataStatus } from '@/hooks/useStatus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

interface AutoChdirViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

export function AutoChdirView({ selectedEnvironmentId, serviceData }: AutoChdirViewProps) {
    const { t } = useTranslation()
    const { updateCustomServiceChdir, applyServiceMetadata } = useCustomService()
    const { serviceDataStatus } = useServiceDataStatus(selectedEnvironmentId, serviceData.id, { enabled: true })
    const [path, setPath] = useState('')
    const [enabled, setEnabled] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const isServiceDataActive = serviceDataStatus === ServiceDataStatus.Active

    // 从 metadata 加载配置
    useEffect(() => {
        const p = serviceData.metadata?.autoChdirPath || ''
        // autoChdirEnabled 未设置时默认为 false
        const e = serviceData.metadata?.autoChdirEnabled === true
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
            const wasActive = serviceData.metadata?.autoChdirEnabled === true
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
                toast.success(newEnabled ? t('custom_service.auto_chdir_enabled') : t('custom_service.auto_chdir_disabled'))
            } else {
                // 回滚开关状态
                setEnabled(!newEnabled)
                toast.error(t('custom_service.op_failed', { message: res?.message || t('common.unknown_error') }))
            }
        } catch (error) {
            setEnabled(!newEnabled)
            toast.error(t('custom_service.op_failed_generic'))
        } finally {
            setIsLoading(false)
        }
    }

    // 应用按钮：保存路径并更新 shell 配置文件
    const handleApply = async () => {
        setIsLoading(true)
        try {
            const newPath = path.trim()
            const wasActive = serviceData.metadata?.autoChdirEnabled === true
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
                    toast.success(t('custom_service.dir_saved'))
                } else {
                    toast.error(t('custom_service.save_local_failed'))
                }
            } else {
                toast.error(t('custom_service.save_dir_failed', { message: res?.message || t('common.unknown_error') }))
            }
        } catch (error) {
            console.error('保存自动跳转目录失败:', error)
            toast.error(t('custom_service.save_failed_generic'))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        {t('custom_service.auto_chdir_label')}
                    </Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {t('custom_service.auto_chdir_desc')}
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
                        {isLoading ? t('custom_service.applying') : t('custom_service.apply')}
                    </Button>
                </div>
            )}
        </div>
    )
}
