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

interface PipConfigViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

export function PipConfigView({
    selectedEnvironmentId,
    serviceData,
}: PipConfigViewProps) {
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
            } else {
                console.error('设置 index-url 失败:', res)
            }
            return res
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
            } else {
                console.error('设置 python3 别名失败:', res)
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full p-3 space-y-6">
            <div className="w-full p-3 space-y-6 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                {/* Index URL Configuration */}
                <div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                    pip下载源 (index-url)
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                </Label>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs space-y-1">
                                    <div>作用: 记录 <code>PIP_INDEX_URL</code> 并写入终端配置</div>
                                    <div>查看当前源: <code>echo $PIP_INDEX_URL</code></div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <div className="flex items-center space-x-2 mt-2">
                        <Input
                            value={config?.indexUrl || ''}
                            onChange={(e) => setConfig(prev => prev ? { ...prev, indexUrl: e.target.value } : { indexUrl: e.target.value, trustedHost: '' })}
                            placeholder="镜像源地址"
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
                            应用
                        </Button>
                    </div>

                    {/* Quick Index URL Options */}
                    <div className="flex flex-wrap gap-2 items-center mt-3">
                        <Label className="block text-[10px] text-gray-500 uppercase tracking-wider">快速设置</Label>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIndexUrl('https://pypi.org/simple')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            官方源
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIndexUrl('https://pypi.tuna.tsinghua.edu.cn/simple')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            清华源
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIndexUrl('https://mirrors.aliyun.com/pypi/simple')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            阿里源
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIndexUrl('https://pypi.org/simple')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            恢复默认
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
                                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">python/pip 别名设置</Label>
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>为 python3 和 pip3 创建 python 和 pip 别名</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            启用后，在终端中使用 python/pip 命令将分别执行 python3/pip3
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
