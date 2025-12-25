import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ServiceData, ServiceDataStatus } from '@/types/index'
import { Plus, Trash2, X } from 'lucide-react'
import { FolderOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCustomService } from '@/hooks/services/custom'
import { toast } from 'sonner'

interface PathConfigViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

export function PathConfigView({
    selectedEnvironmentId,
    serviceData,
}: PathConfigViewProps) {
    const { updateCustomServicePaths, applyServiceMetadata } = useCustomService()
    const [paths, setPaths] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active

    // 从服务数据加载路径配置
    useEffect(() => {
        const pathsFromMetadata = serviceData.metadata?.paths || []
        setPaths(Array.isArray(pathsFromMetadata) ? pathsFromMetadata : [])
    }, [serviceData])

    // 添加新的路径
    const addPath = () => {
        setPaths([...paths, ''])
    }

    // 更新路径
    const updatePath = (index: number, value: string) => {
        const newPaths = [...paths]
        newPaths[index] = value
        setPaths(newPaths)
    }

    // 删除路径
    const removePath = (index: number) => {
        const newPaths = paths.filter((_, i) => i !== index)
        setPaths(newPaths)
    }

    // 保存路径配置
    const savePaths = async () => {
        setIsLoading(true)
        try {
            // 过滤掉空字符串
            const validPaths = paths.filter(path => path.trim() !== '')
            const res = await updateCustomServicePaths(selectedEnvironmentId, serviceData, validPaths)
            if (res && res.success) {
                // IPC 成功后，单独应用 metadata 到前端 store
                const newMetadata = { ...(serviceData.metadata || {}), paths: validPaths }
                const applyRes = await applyServiceMetadata(serviceData.id, newMetadata)
                if (applyRes && applyRes.success) {
                    setPaths(validPaths)
                    toast.success('路径配置已保存')
                } else {
                    toast.error('保存到本地状态失败')
                }
            } else {
                toast.error('保存路径配置失败: ' + (res?.message || '未知错误'))
            }
        } catch (error) {
            console.error('保存路径配置失败:', error)
            toast.error('保存路径配置失败')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        {/* <FolderOpen className="h-3.5 w-3.5" /> */}
                        路径配置
                    </Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        配置需要添加到 PATH 环境变量的路径
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={addPath}
                    disabled={!isServiceDataActive && isLoading}
                    className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                >
                    <Plus className="h-3 w-3 mr-1" />
                    添加路径
                </Button>
            </div>
            
            <div className="space-y-4">
                <div className="space-y-2">
                    {paths.map((path, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            <Input
                                value={path}
                                onChange={(e) => updatePath(index, e.target.value)}
                                placeholder="/usr/local/bin"
                                className="flex-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                disabled={isLoading || !isServiceDataActive}
                            />
                            {isServiceDataActive && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removePath(index)}
                                    disabled={isLoading}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>

                {paths.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
                        <p className="text-sm">还没有配置路径</p>
                        <p className="text-xs mt-1">点击"添加路径"开始配置</p>
                    </div>
                )}

                <div className="flex items-center space-x-2">
                    <div className="flex-1" />
                    <Button
                        variant="default"
                        size="sm"
                        onClick={savePaths}
                        disabled={isLoading || !isServiceDataActive}
                        className="shadow-none h-8 text-xs"
                    >
                        {isLoading ? '保存中...' : '保存配置'}
                    </Button>
                </div>

            </div>
        </div>
    )
}