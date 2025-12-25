import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
import {
    Hexagon,
    Info,
    AlertTriangle
} from 'lucide-react'
import { BaseService } from '../base-service'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@radix-ui/react-tooltip"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useNodejsService } from '@/hooks/services/nodejs'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface NodeServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function NodeService({ serviceData, selectedEnvironment }: NodeServiceProps) {
    return (
        <BaseService service={serviceData}>
            {/* Node Service Configuration */}
            <NodeServiceCard serviceData={serviceData} selectedEnvironmentId={selectedEnvironment.id} />
        </BaseService>
    )
}

interface NodeServiceCardProps {
    serviceData: ServiceData
    selectedEnvironmentId: string
}

function NodeServiceCard({ serviceData, selectedEnvironmentId }: NodeServiceCardProps) {
    const { setNpmRegistry, setConfigPrefix } = useNodejsService()
    const { updateServiceData } = useEnvironmentServiceData()
    const [registry, setRegistry] = useState('')
    const [prefix, setPrefix] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active;

    useEffect(() => {
        setRegistry(serviceData.metadata?.NPM_CONFIG_REGISTRY || '')
        setPrefix(serviceData.metadata?.NPM_CONFIG_PREFIX || '')
    }, [serviceData])

    const applyRegistry = async (val: string) => {
        try {
            setIsLoading(true)
            const res = await setNpmRegistry(selectedEnvironmentId, serviceData, val)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['NPM_CONFIG_REGISTRY'] = val
                await updateServiceData(serviceData.id, {
                    metadata: newMetadata
                })
                setRegistry(val)
                toast.success('设置 Node.js 源成功')
            } else {
                toast.error('设置 Node.js 源失败')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const applyPrefix = async (val: string) => {
        try {
            setIsLoading(true)
            const res = await setConfigPrefix(selectedEnvironmentId, serviceData, val)
            if (res && (res as any).success) {
                const newMetadata = { ...(serviceData.metadata || {}) }
                newMetadata['NPM_CONFIG_PREFIX'] = val
                await updateServiceData(serviceData.id, {
                    metadata: newMetadata
                })
                setPrefix(val)
                toast.success('设置 Node.js 配置前缀成功')
            } else {
                toast.error('设置 Node.js 配置前缀失败')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const versionNum = parseInt(serviceData.version.replace('v', '').split('.')[0]);
    const showLegacyMacWarning = !isNaN(versionNum) && versionNum <= 14 && navigator.userAgent.includes("Mac");

    return (<>
            {showLegacyMacWarning && (
                <Alert className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/20">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                    <AlertTitle className="text-yellow-800 dark:text-yellow-500 text-xs font-semibold">
                        macOS Apple Silicon 兼容性提示
                    </AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-600/90 text-xs mt-1.5 space-y-2">
                        <p>
                            Node.js v14 版本没有官方的 macOS ARM64 (Apple Silicon) 构建版本，只有 x64 版本。
                            针对 macOS 平台，当系统架构为 aarch64 (Apple Silicon) 且 Node.js 版本为 v14 及以下时，Envis 会自动回退使用 x64 架构的安装包。
                        </p>
                        <p>
                            在 Apple Silicon 设备上需要使用 Rosetta 2 运行 x64 版本。
                            请依次点击 访达 -&gt; 应用程序 -&gt; 实用工具 -&gt; 终端 -&gt; 右键菜单 -&gt; 显示简介 -&gt; 使用 Rosetta 打开。
                            之后再次打开终端，此时终端将以x64架构运行，以确保兼容性。
                        </p>
                    </AlertDescription>
                </Alert>
            )}
        <div className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] space-y-6">

            <div className="space-y-6">
                {/* Registry Configuration */}
                <div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Registry URL
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                </Label>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs space-y-1">
                                    <div>Current: <code>npm config get registry</code></div>
                                    <div>Set: <code>npm config set registry &lt;url&gt;</code></div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <div className="flex items-center space-x-2 mt-2">
                        <Input
                            value={registry}
                            onChange={(e) => setRegistry(e.target.value)}
                            placeholder="Registry URL"
                            disabled={isLoading || !isServiceDataActive}
                            className="flex-1 h-8 text-xs bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyRegistry(registry)}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            Apply
                        </Button>
                    </div>

                    {/* Quick Registry Options */}
                    <div className="flex flex-wrap gap-2 items-center mt-3">
                        <Label className="block text-[10px] text-gray-500 uppercase tracking-wider">Quick Set</Label>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyRegistry('https://registry.npmjs.org/')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            Official
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyRegistry('https://registry.npmmirror.com/')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            Taobao
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyRegistry('https://registry.anpm.alibaba-inc.com/')}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-6 text-[10px] px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            Ali
                        </Button>
                    </div>
                </div>

                {/* Prefix Configuration */}
                <div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Config Prefix (NPM_CONFIG_PREFIX)
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                </Label>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs space-y-1">
                                    <div>Current: <code>npm config get prefix</code></div>
                                    <div>Set: <code>npm config set prefix &lt;path&gt;</code></div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 mb-2">
                        Sets the installation location for global packages
                    </p>
                    <div className="flex items-center space-x-2">
                        <Input
                            value={prefix}
                            onChange={(e) => setPrefix(e.target.value)}
                            placeholder="Prefix path"
                            disabled={isLoading || !isServiceDataActive}
                            className="flex-1 h-8 text-xs bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyPrefix(prefix)}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            Apply
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </>)
}
