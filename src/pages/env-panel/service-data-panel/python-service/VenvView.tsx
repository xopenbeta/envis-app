import { useEffect, useState } from "react"
import { ServiceData, ServiceDataStatus } from "@/types"
import { usePythonService } from "@/hooks/services/python"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
    Trash2, 
    Plus, 
    AlertCircle, 
    Box, 
    RefreshCw, 
    Terminal,
    Info
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslation } from "react-i18next"

interface VenvViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

export function VenvView({ selectedEnvironmentId, serviceData }: VenvViewProps) {
    const { t } = useTranslation()
    const { checkVenvSupport, getVenvs, createVenv, removeVenv } = usePythonService()
    
    // null: checking, true: supported, false: not supported
    const [isSupported, setIsSupported] = useState<boolean | null>(null)
    const [venvs, setVenvs] = useState<string[]>([])
    const [venvsDir, setVenvsDir] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [newVenvName, setNewVenvName] = useState("")
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    
    const isServiceActive = serviceData.status === ServiceDataStatus.Active

    useEffect(() => {
        checkSupport()
    }, [serviceData.version])

    useEffect(() => {
        // 当支持检查完成且为 true 时加载列表
        if (isSupported) {
            loadVenvs()
        }
    }, [isSupported, selectedEnvironmentId, serviceData.id])

    const checkSupport = async () => {
        setIsLoading(true)
        try {
            const res = await checkVenvSupport(serviceData.version)
            if (res && res.data) {
                setIsSupported(res.data.supported)
            } else {
                 setIsSupported(false)
            }
        } catch (e) {
            console.error(e)
            // 出错也视为不支持或未知
            setIsSupported(false)
        } finally {
            setIsLoading(false)
        }
    }

    const loadVenvs = async () => {
        try {
            const res = await getVenvs(selectedEnvironmentId, serviceData)
            if (res && res.data) {
                setVenvs(res.data.venvs)
                setVenvsDir(res.data.venvsDir || "")
            }
        } catch (e) {
            console.error(e)
        }
    }

    const handleCreate = async () => {
        if (!newVenvName.trim()) {
             toast.error(t('python_service.enter_venv_name'))
             return
        }
        setIsCreating(true)
        try {
            const res = await createVenv(selectedEnvironmentId, serviceData, newVenvName)
            if (res.success) {
                toast.success(t('python_service.create_venv_success'))
                setShowCreateDialog(false)
                setNewVenvName("")
                loadVenvs()
            } else {
                toast.error(t('python_service.create_venv_failed', { message: res.message }))
            }
        } catch (e) {
            toast.error(t('python_service.create_venv_failed', { message: String(e) }))
        } finally {
            setIsCreating(false)
        }
    }

    const handleRemove = async (name: string) => {
        if (!confirm(`确定要删除虚拟环境 "${name}" 吗？`)) return
        
        try {
            const res = await removeVenv(selectedEnvironmentId, serviceData, name)
            if (res.success) {
                 loadVenvs()
            } else {
                 toast.error(t('python_service.remove_venv_failed', { message: res.message }))
            }
        } catch (e) {
            toast.error(t('python_service.remove_venv_failed', { message: String(e) }))
        }
    }

    if (isSupported === false) {
        return (
            <div className="w-full p-3">
                <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="ml-2">不支持 venv</AlertTitle>
                    <AlertDescription className="ml-2 mt-1 text-xs">
                        当前 Python 版本 ({serviceData.version}) 不支持创建 venv 虚拟环境，或未正确安装 venv 模块。
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="w-full p-3 space-y-6">
            <div className="w-full p-3 space-y-6 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                        虚拟环境 (只统计默认文件夹下的venv)
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                    </Label>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="text-xs space-y-1">
                                        <div>管理 Python 虚拟环境</div>
                                        <div>位置: <code>{venvsDir}</code></div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100" 
                            onClick={loadVenvs} 
                            disabled={isLoading || isSupported === null}
                        >
                            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 shadow-none"
                        onClick={() => setShowCreateDialog(true)}
                        disabled={!isServiceActive}
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        新建环境
                    </Button>
                 </div>

                 <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                     <DialogContent>
                         <DialogHeader>
                             <DialogTitle>新建虚拟环境</DialogTitle>
                             <DialogDescription>
                                 将在当前服务目录下创建新的 Python 虚拟环境。
                             </DialogDescription>
                         </DialogHeader>
                         <div className="grid gap-4 py-4">
                             <div className="space-y-2">
                                 <Label htmlFor="name" className="text-xs">环境名称</Label>
                                 <Input 
                                    id="name" 
                                    value={newVenvName} 
                                    onChange={e => setNewVenvName(e.target.value)} 
                                    className="text-xs font-mono"
                                    placeholder={"myVenv"}
                                 />
                             </div>
                             <div className="space-y-2">
                                 <Label htmlFor="path" className="text-xs">存放地址</Label>
                                 <Input 
                                    id="path" 
                                    value={venvsDir} 
                                    readOnly 
                                    disabled
                                    className="text-xs font-mono bg-gray-100 dark:bg-white/5"
                                 />
                             </div>
                         </div>
                         <DialogFooter>
                             <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isCreating} className="shadow-none" size="sm">取消</Button>
                             <Button onClick={handleCreate} disabled={isCreating} size="sm">
                                 {isCreating ? "创建中..." : "创建"}
                             </Button>
                         </DialogFooter>
                     </DialogContent>
                 </Dialog>

                 {/* 列表区域 */}
                 {venvs.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground bg-white dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5">
                            <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">暂无虚拟环境</p>
                        </div>
                    ) : (
                    <div className="rounded-lg border border-gray-200 dark:border-white/5 bg-white dark:bg-white/5">
                        <ScrollArea className="h-[200px]">
                            <div className="space-y-1 p-2">
                                {venvs.map(venv => (
                                    <div key={venv} className="flex items-center justify-between p-2 pl-3 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-all group border border-transparent hover:border-gray-100 dark:hover:border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                                <Terminal className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{venv}</span>
                                                <span className="text-[10px] text-gray-400" title={`${venvsDir}/${venv}`}>{venvsDir}/{venv}</span>
                                            </div>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 opacity-70 group-hover:opacity-100 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            onClick={() => handleRemove(venv)}
                                            title="删除环境"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>
        </div>
    )
}
