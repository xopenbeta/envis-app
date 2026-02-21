import { useState, useEffect } from 'react'
import { ServiceData, ServiceDataStatus } from '@/types/index'
import { useCustomService } from '@/hooks/services/custom'
import { ipcExecuteCustomServiceAlias } from '@/ipc/services/custom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Play } from 'lucide-react'
import { toast } from 'sonner'

interface AliasItem {
    key: string
    value: string
}

interface AliasesConfigViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

export function AliasesConfigView({
    selectedEnvironmentId,
    serviceData,
}: AliasesConfigViewProps) {
    const { updateCustomServiceAliases, applyServiceMetadata } = useCustomService()
    const [aliases, setAliases] = useState<AliasItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active

    // 从服务数据加载 Alias 配置
    useEffect(() => {
        const aliasesFromMetadata = serviceData.metadata?.aliases || {}
        const vars = Object.entries(aliasesFromMetadata).map(([key, value]) => ({
            key,
            value: String(value)
        }))
        setAliases(vars)
    }, [serviceData])

    // 添加新的 Alias
    const addAlias = () => {
        setAliases([...aliases, { key: '', value: '' }])
    }

    // 更新 Alias 的键
    const updateAliasKey = (index: number, key: string) => {
        const newAliases = [...aliases]
        newAliases[index].key = key
        setAliases(newAliases)
    }

    // 更新 Alias 的值
    const updateAliasValue = (index: number, value: string) => {
        const newAliases = [...aliases]
        newAliases[index].value = value
        setAliases(newAliases)
    }

    // 删除 Alias
    const removeAlias = (index: number) => {
        const newAliases = aliases.filter((_, i) => i !== index)
        setAliases(newAliases)
    }

    // 执行 Alias 命令
    const executeAlias = async (alias: AliasItem) => {
        if (!alias.key || !alias.value) {
            toast.error('别名或命令不能为空')
            return
        }

        try {
            toast.info(`正在执行命令: ${alias.value}`)
            
            // 通过 IPC 调用后端执行命令
            const result = await ipcExecuteCustomServiceAlias(alias.key, alias.value)
            
            if (result.success) {
                const data = result.data as { stdout?: string; stderr?: string; exitCode?: number }
                toast.success(`命令执行成功 (${alias.key})`, {
                    description: data.stdout ? data.stdout.substring(0, 200) : '执行完成'
                })
            } else {
                const data = result.data as { stdout?: string; stderr?: string; exitCode?: number }
                toast.error(`命令执行失败 (${alias.key})`, {
                    description: data?.stderr || result.message || '未知错误'
                })
            }
        } catch (error) {
            console.error('执行命令失败:', error)
            toast.error('执行命令失败', {
                description: String(error)
            })
        }
    }

    // 保存 Alias 配置
    const saveAliases = async () => {
        setIsLoading(true)
        try {
            // 过滤掉空的键值对，并转换为对象
            const validAliases = aliases
                .filter(item => item.key.trim() !== '' && item.value.trim() !== '')
                .reduce((acc, item) => {
                    acc[item.key.trim()] = item.value.trim()
                    return acc
                }, {} as Record<string, string>)

            const res = await updateCustomServiceAliases(selectedEnvironmentId, serviceData, validAliases)
            if (res && res.success) {
                // IPC 成功后，将 metadata 应用到前端 store
                const newMetadata = { ...(serviceData.metadata || {}), aliases: validAliases }
                const applyRes = await applyServiceMetadata(selectedEnvironmentId, serviceData.id, newMetadata)
                if (applyRes && applyRes.success) {
                    const vars = Object.entries(validAliases).map(([key, value]) => ({ key, value }))
                    setAliases(vars)
                    toast.success('Alias 配置已保存')
                } else {
                    toast.error('保存到本地状态失败')
                }
            } else {
                toast.error('保存 Alias 配置失败: ' + (res?.message || '未知错误'))
            }
        } catch (error) {
            console.error('保存 Alias 配置失败:', error)
            toast.error('保存 Alias 配置失败')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        {/* <Command className="h-3.5 w-3.5" /> */}
                        Alias 配置
                    </Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        配置 Shell 别名 (Alias)
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={addAlias}
                    disabled={isLoading || !isServiceDataActive}
                    className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                >
                    <Plus className="h-3 w-3 mr-1" />
                    添加 Alias
                </Button>
            </div>
            
            <div className="space-y-4">
                <div className="space-y-3">
                    {aliases.map((item, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            <Input
                                value={item.key}
                                onChange={(e) => updateAliasKey(index, e.target.value)}
                                placeholder="别名 (如: ll)"
                                className="w-1/3 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                disabled={isLoading || !isServiceDataActive}
                            />
                            <span className="text-muted-foreground">=</span>
                            <Input
                                value={item.value}
                                onChange={(e) => updateAliasValue(index, e.target.value)}
                                placeholder="命令 (如: ls -l)"
                                className="flex-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                                disabled={isLoading || !isServiceDataActive}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => executeAlias(item)}
                                disabled={isLoading || !item.key || !item.value}
                                className="h-8 w-8 text-muted-foreground hover:text-green-600 dark:hover:text-green-400"
                                title="执行命令"
                            >
                                <Play className="h-4 w-4" />
                            </Button>
                            {isServiceDataActive && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeAlias(index)}
                                    disabled={isLoading}
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>

                {aliases.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
                        <p className="text-sm">还没有配置 Alias</p>
                        <p className="text-xs mt-1">点击"添加 Alias"开始配置</p>
                    </div>
                )}

                <div className="flex items-center space-x-2">
                    <div className="flex-1" />
                    <Button
                        variant="default"
                        size="sm"
                        onClick={saveAliases}
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
