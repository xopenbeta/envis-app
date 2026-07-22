import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ServiceData, ServiceDataStatus } from '@/types/index'
import { Plus, Trash2, X, Info } from 'lucide-react'
import { Globe } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCustomService } from '@/hooks/services/custom'
import { toast } from 'sonner'
import { Trans, useTranslation } from 'react-i18next'

interface EnvironmentVariable {
    key: string
    value: string
}

interface EnvironmentVariablesViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
    status: ServiceDataStatus
}

export function EnvironmentVariablesView({
    selectedEnvironmentId,
    serviceData,
    status,
}: EnvironmentVariablesViewProps) {
    const { t } = useTranslation()
    const { updateCustomServiceEnvVars, applyServiceMetadata } = useCustomService()
    const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const isServiceDataActive = status === ServiceDataStatus.Active
    const isWindows = typeof navigator !== 'undefined' && navigator.platform.includes('Win')

    // 从服务数据加载环境变量配置
    useEffect(() => {
        const envVarsFromMetadata = serviceData.metadata?.envVars || {}
        const vars = Object.entries(envVarsFromMetadata).map(([key, value]) => ({
            key,
            value: String(value)
        }))
        setEnvVars(vars)
    }, [serviceData])

    // 添加新的环境变量
    const addEnvVar = () => {
        setEnvVars([...envVars, { key: '', value: '' }])
    }

    // 更新环境变量的键
    const updateEnvVarKey = (index: number, key: string) => {
        const newEnvVars = [...envVars]
        newEnvVars[index].key = key
        setEnvVars(newEnvVars)
    }

    // 更新环境变量的值
    const updateEnvVarValue = (index: number, value: string) => {
        const newEnvVars = [...envVars]
        newEnvVars[index].value = value
        setEnvVars(newEnvVars)
    }

    // 删除环境变量
    const removeEnvVar = (index: number) => {
        const newEnvVars = envVars.filter((_, i) => i !== index)
        setEnvVars(newEnvVars)
    }

    // 保存环境变量配置
    const saveEnvVars = async () => {
        setIsLoading(true)
        try {
            // 过滤掉空的键值对，并转换为对象
            const validEnvVars = envVars
                .filter(env => env.key.trim() !== '' && env.value.trim() !== '')
                .reduce((acc, env) => {
                    acc[env.key.trim()] = env.value.trim()
                    return acc
                }, {} as Record<string, string>)

            const res = await updateCustomServiceEnvVars(selectedEnvironmentId, serviceData, validEnvVars)
            if (res && res.success) {
                // IPC 成功后，将 metadata 应用到前端 store
                const newMetadata = { ...(serviceData.metadata || {}), envVars: validEnvVars }
                const applyRes = await applyServiceMetadata(selectedEnvironmentId, serviceData.id, newMetadata)
                if (applyRes && applyRes.success) {
                    const vars = Object.entries(validEnvVars).map(([key, value]) => ({ key, value }))
                    setEnvVars(vars)
                    toast.success(t('custom_service.env_var_saved'))
                } else {
                    toast.error(t('custom_service.save_local_failed'))
                }
            } else {
                toast.error(t('custom_service.save_env_var_failed', { message: res?.message || t('common.unknown_error') }))
            }
        } catch (error) {
            console.error('保存环境变量配置失败:', error)
            toast.error(t('custom_service.save_env_var_failed', { message: t('common.unknown_error') }))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {/* <Globe className="h-3.5 w-3.5" /> */}
                                    {t('custom_service.env_var_config_label')}
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                </Label>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs space-y-1">
                                    {isWindows ? (
                                        <>
                                            <div>
                                                <Trans
                                                    i18nKey="custom_service.env_windows_view"
                                                    components={[<code key="cmd" />, <code key="pwsh" />]}
                                                />
                                            </div>
                                            <div>
                                                <Trans
                                                    i18nKey="custom_service.env_windows_set"
                                                    components={[<code key="setx" />, <code key="pwshset" />]}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <Trans
                                                    i18nKey="custom_service.env_unix_view"
                                                    components={[<code key="view" />]}
                                                />
                                            </div>
                                            <div>
                                                <Trans
                                                    i18nKey="custom_service.env_unix_set"
                                                    components={[<code key="set" />]}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {t('custom_service.env_var_config_desc')}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={addEnvVar}
                    disabled={isLoading || !isServiceDataActive}
                    className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                >
                    <Plus className="h-3 w-3 mr-1" />
                    {t('custom_service.add_env_var')}
                </Button>
            </div>
            
            <div className="space-y-4">
                <div className="space-y-3">
                    {envVars.map((envVar, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            <Input
                                value={envVar.key}
                                onChange={(e) => updateEnvVarKey(index, e.target.value)}
                                placeholder={t('custom_service.env_var_key_placeholder')}
                                className="flex-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                disabled={isLoading || !isServiceDataActive}
                            />
                            <span className="text-muted-foreground">=</span>
                            <Input
                                value={envVar.value}
                                onChange={(e) => updateEnvVarValue(index, e.target.value)}
                                placeholder={t('custom_service.env_var_value_placeholder')}
                                className="flex-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                disabled={isLoading || !isServiceDataActive}
                            />
                            {isServiceDataActive && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeEnvVar(index)}
                                    disabled={isLoading}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>

                {envVars.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
                        <p className="text-sm">{t('custom_service.no_env_vars')}</p>
                        <p className="text-xs mt-1">{t('custom_service.no_env_vars_hint')}</p>
                    </div>
                )}

                <div className="flex items-center space-x-2">
                    <div className="flex-1" />
                    <Button
                        variant="default"
                        size="sm"
                        onClick={saveEnvVars}
                        disabled={isLoading || !isServiceDataActive}
                        className="shadow-none h-8 text-xs"
                    >
                        {isLoading ? t('custom_service.saving') : t('custom_service.save_path_config')}
                    </Button>
                </div>

            </div>
        </div>
    )
}