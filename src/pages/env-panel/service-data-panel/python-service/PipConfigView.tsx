import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    const { setPipIndexUrl, setPipTrustedHost } = usePythonService()
    const [config, setConfig] = useState<{ indexUrl: string; trustedHost: string } | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active;

    // 加载配置
    useEffect(() => {
        setConfig({
            indexUrl: serviceData.metadata?.PIP_INDEX_URL || '',
            trustedHost: serviceData.metadata?.PIP_TRUSTED_HOST || ''
        })
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

    const setTrustedHost = async (trustedHost: string) => {
        try {
            setIsLoading(true)
            const res = await setPipTrustedHost(selectedEnvironmentId, serviceData, trustedHost)
            if (res && (res as any).success) {
                setConfig(prev => prev ? { ...prev, trustedHost } : { indexUrl: '', trustedHost })
            } else {
                console.error('设置 trusted-host 失败:', res)
            }
            return res
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Index URL Configuration */}
            <div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Label className="cursor-help flex items-center gap-1">
                                镜像源 (index-url)
                                <Info className="h-3 w-3 text-muted-foreground" />
                            </Label>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="text-xs space-y-1">
                                <div>查看当前源: <code>pip config get global.index-url</code></div>
                                <div>设置源: <code>pip config set global.index-url &lt;url&gt;</code></div>
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
                        className="flex-1 shadow-none"
                    />
                    <Button
                        size="sm"
                        onClick={() => config?.indexUrl && setIndexUrl(config.indexUrl)}
                        disabled={isLoading || !isServiceDataActive}
                        className='shadow-none'
                        variant="outline"
                    >
                        应用
                    </Button>
                </div>

                {/* Quick Index URL Options */}
                <div className="flex gap-2 items-center mt-2">
                    <Label className="block text-xs">快速设置源</Label>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIndexUrl('https://pypi.org/simple')}
                        disabled={isLoading || !isServiceDataActive}
                        className='h-6 shadow-none'
                    >
                        官方源
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIndexUrl('https://pypi.tuna.tsinghua.edu.cn/simple')}
                        disabled={isLoading || !isServiceDataActive}
                        className='h-6 shadow-none'
                    >
                        清华源
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIndexUrl('https://mirrors.aliyun.com/pypi/simple')}
                        disabled={isLoading || !isServiceDataActive}
                        className='h-6 shadow-none'
                    >
                        阿里源
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIndexUrl('https://pypi.org/simple')}
                        disabled={isLoading || !isServiceDataActive}
                        className='h-6 shadow-none'
                    >
                        恢复默认
                    </Button>
                </div>
            </div>

            {/* Trusted Host Configuration */}
            <div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Label className="cursor-help flex items-center gap-1">
                                信任主机 (trusted-host)
                                <Info className="h-3 w-3 text-muted-foreground" />
                            </Label>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="text-xs space-y-1">
                                <div>查看当前配置: <code>pip config get global.trusted-host</code></div>
                                <div>设置配置: <code>pip config set global.trusted-host &lt;host&gt;</code></div>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <p className="text-xs text-muted-foreground mt-1">
                    设置信任的主机，用于跳过 SSL 验证
                </p>
                <div className="flex items-center space-x-2 mt-1">
                    <Input
                        value={config?.trustedHost || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, trustedHost: e.target.value } : { indexUrl: '', trustedHost: e.target.value })}
                        placeholder={'信任主机地址'}
                        disabled={isLoading || !isServiceDataActive}
                        className="flex-1 shadow-none"
                    />
                    <Button
                        size="sm"
                        onClick={() => {
                            const host = config?.trustedHost || ''
                            setTrustedHost(host)
                        }}
                        disabled={isLoading || !isServiceDataActive}
                        className='shadow-none'
                        variant="outline"
                    >
                        应用
                    </Button>
                </div>
                {/* Quick Trusted Host Options */}
                <div className="flex gap-2 items-center mt-2">
                    <Label className="block text-xs">快速设置</Label>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTrustedHost('pypi.tuna.tsinghua.edu.cn')}
                        disabled={isLoading || !isServiceDataActive}
                        className='h-6 shadow-none'
                    >
                        清华源
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTrustedHost('mirrors.aliyun.com')}
                        disabled={isLoading || !isServiceDataActive}
                        className='h-6 shadow-none'
                    >
                        阿里源
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTrustedHost('')}
                        disabled={isLoading || !isServiceDataActive}
                        className='h-6 shadow-none'
                    >
                        清除
                    </Button>
                </div>
            </div>
        </div>
    )
}
