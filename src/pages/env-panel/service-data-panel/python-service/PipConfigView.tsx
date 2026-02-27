import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ServiceData, ServiceDataStatus } from '@/types/index'
import {
    Info
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePythonService } from '@/hooks/services/python'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

interface PipConfigViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

export function PipConfigView({
    selectedEnvironmentId,
    serviceData,
}: PipConfigViewProps) {
    const { t } = useTranslation()
    const { setPipIndexUrl, setPython3AsPython } = usePythonService()
    const [config, setConfig] = useState<{ indexUrl: string; trustedHost: string } | null>(null)
    const [python3AsPython, setPython3AsPythonState] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active;

    // 加载配置
    useEffect(() => {
        setConfig({
            indexUrl: serviceData.metadata?.PIP_INDEX_URL || '',
            trustedHost: serviceData.metadata?.PIP_TRUSTED_HOST || ''
        })
        setPython3AsPythonState(serviceData.metadata?.PYTHON3_AS_PYTHON === true)
    }, [serviceData])

    const setIndexUrl = async (indexUrl: string) => {
        try {
            setIsLoading(true)
            const res = await setPipIndexUrl(selectedEnvironmentId, serviceData, indexUrl)
            if (res && (res as any).success) {
                setConfig(prev => prev ? { ...prev, indexUrl } : { indexUrl, trustedHost: '' })
                toast.success(t('python_service.pip_index_set_success'))
            } else {
                console.error('设置 index-url 失败:', res)
                toast.error(t('python_service.pip_index_set_failed'))
            }
            return res
        } catch (error) {
            console.error('设置 index-url 异常:', error)
            toast.error(t('python_service.pip_index_set_failed'))
            throw error
        } finally {
            setIsLoading(false)
        }
    }



    const handlePython3AsPythonChange = async (enable: boolean) => {
        try {
            setIsLoading(true)
            const res = await setPython3AsPython(selectedEnvironmentId, serviceData, enable)
            if (res && (res as any).success) {
                setPython3AsPythonState(enable)
                toast.success(t(enable ? 'python_service.alias_set_success_enable' : 'python_service.alias_set_success_disable'))
            } else {
                console.error('设置 python3 别名失败:', res)
                toast.error(t('python_service.alias_set_failed'))
            }
        } catch (error) {
            console.error('设置 python3 别名异常:', error)
            toast.error(t('python_service.alias_set_failed'))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full p-3 pb-0">
            <div className="w-full p-3 space-y-6 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                {/* Index URL Configuration */}
                <div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {t('python_service.pip_index_label')}
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                </Label>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs space-y-1">
                                    <div>{t('python_service.pip_index_tooltip_desc')} <code>PIP_INDEX_URL</code> {t('python_service.pip_index_tooltip_desc_suffix')}</div>
                                    <div>{t('python_service.pip_index_tooltip_view')} <code>echo $PIP_INDEX_URL</code></div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <div className="flex items-center space-x-2 mt-2">
                        <Input
                            value={config?.indexUrl || ''}
                            onChange={(e) => setConfig(prev => prev ? { ...prev, indexUrl: e.target.value } : { indexUrl: e.target.value, trustedHost: '' })}
                            placeholder={t('python_service.pip_index_placeholder')}
                            disabled={isLoading || !isServiceDataActive}
                            className="flex-1 h-8 text-xs bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => config?.indexUrl && setIndexUrl(config.indexUrl)}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            {t('python_service.apply')}
                        </Button>
                    </div>

                    {/* Quick Index URL Options */}
                    <div className="flex flex-wrap gap-2 items-center mt-3">
                        <Label className="block text-[10px] text-gray-500 uppercase tracking-wider">{t('python_service.quick_set')}</Label>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIndexUrl('https://pypi.org/simple')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            {t('python_service.official')}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIndexUrl('https://pypi.tuna.tsinghua.edu.cn/simple')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            {t('python_service.tuna')}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIndexUrl('https://mirrors.aliyun.com/pypi/simple')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            {t('python_service.aliyun')}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIndexUrl('https://pypi.org/simple')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            {t('python_service.reset_default')}
                        </Button>
                    </div>
                </div>

                {/* Python3 as Python Configuration */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 cursor-help w-fit">
                                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('python_service.alias_label')}</Label>
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{t('python_service.alias_tooltip')}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {t('python_service.alias_desc')}
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch
                            checked={python3AsPython}
                            onCheckedChange={handlePython3AsPythonChange}
                            disabled={isLoading || !isServiceDataActive}
                            className="data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-white/20"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
