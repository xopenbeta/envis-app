import { useEffect, useState } from "react"
import { ServiceData, ServiceDataStatus } from "@/types"
import { useServiceDataStatus } from '@/hooks/useStatus'
import { usePythonService } from "@/hooks/services/python"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    Plus,
    AlertCircle,
    Box,
    RefreshCw,
    Terminal,
    Info,
    Folder,
    MoreHorizontal,
    Trash2,
    Play
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslation } from "react-i18next"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ipcOpenFolderInFinder } from "@/ipc/file-operations"

interface VenvViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

export function VenvView({ selectedEnvironmentId, serviceData }: VenvViewProps) {
    const { t } = useTranslation()
    const { checkVenvSupport, getVenvs, createVenv, removeVenv, openVenvTerminal } = usePythonService()
    const { serviceDataStatus } = useServiceDataStatus(selectedEnvironmentId, serviceData.id, {
        enabled: true,
        interval: 500,
    })
    const isServiceActive = serviceDataStatus === ServiceDataStatus.Active

    // null: checking, true: supported, false: not supported
    const [isSupported, setIsSupported] = useState<boolean | null>(null)
    const [venvs, setVenvs] = useState<string[]>([])
    const [venvsDir, setVenvsDir] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [activatingVenvName, setActivatingVenvName] = useState<string | null>(null)
    const [newVenvName, setNewVenvName] = useState("")
    const [showCreateDialog, setShowCreateDialog] = useState(false)

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
            toast.error(t('python_service.load_venvs_failed'))
        }
    }

    const handleActivateVenv = async (name: string) => {
        try {
            setActivatingVenvName(name)
            const res = await openVenvTerminal(selectedEnvironmentId, serviceData, name)
            if (res.success) {
                toast.success(t('python_service.activate_venv_success'))
            } else {
                toast.error(t('python_service.activate_venv_failed', { message: res.message }))
            }
        } catch (e) {
            toast.error(t('python_service.activate_venv_failed', { message: String(e) }))
        } finally {
            setActivatingVenvName(null)
        }
    }

    const handleOpenVenvFolder = async (name: string) => {
        try {
            const folderPath = `${venvsDir}/${name}`
            const res = await ipcOpenFolderInFinder(folderPath)
            if (!res.success) {
                toast.error(t('python_service.open_venv_folder_failed', { message: res.message }))
            }
        } catch (e) {
            toast.error(t('python_service.open_venv_folder_failed', { message: String(e) }))
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

    // 删除虚拟环境：不可逆操作，先弹应用内确认（原来是原生 window.confirm）
    const [venvPendingRemove, setVenvPendingRemove] = useState<string | null>(null)

    const handleRemove = (name: string) => setVenvPendingRemove(name)

    const performRemove = async (name: string) => {
        setVenvPendingRemove(null)
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
            <div className="w-full p-3 pb-0">
                <Alert variant="destructive" className="bg-danger/10 dark:bg-danger/10 border-danger/30 dark:border-danger/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="ml-2">{t('python_service.venv_unsupported_title')}</AlertTitle>
                    <AlertDescription className="ml-2 mt-1 text-xs">
                        {t('python_service.venv_unsupported_desc', { version: serviceData.version })}
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="w-full p-3 space-y-6">
            <div className="w-full p-3 space-y-3 rounded-xl border border-divider bg-content1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Label className="cursor-help flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                        {t('python_service.venv_title')}
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                    </Label>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="text-xs space-y-1">
                                        {/* <div>{t('python_service.venv_manage_desc')}</div> */}
                                        <div>{t('python_service.venv_default_only')}</div>
                                        <div>{t('python_service.location')}: <code>{venvsDir}</code></div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
                            onClick={loadVenvs}
                            disabled={isLoading || isSupported === null}
                            aria-label={t('common.refresh')}
                            title={t('common.refresh')}
                        >
                            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs bg-content1 dark:bg-content1/40 border-divider"
                        onClick={() => setShowCreateDialog(true)}
                        disabled={!isServiceActive}
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        {t('python_service.new_venv')}
                    </Button>
                </div>

                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t('python_service.new_venv_dialog_title')}</DialogTitle>
                            <DialogDescription>
                                {t('python_service.new_venv_dialog_desc')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-xs">{t('python_service.venv_name')}</Label>
                                <Input
                                    id="name"
                                    value={newVenvName}
                                    onChange={e => setNewVenvName(e.target.value)}
                                    className="text-xs font-mono"
                                    placeholder={t('python_service.venv_name_placeholder')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="path" className="text-xs">{t('python_service.venv_path')}</Label>
                                <Input
                                    id="path"
                                    value={venvsDir}
                                    readOnly
                                    disabled
                                    className="text-xs font-mono bg-content2 dark:bg-content1/40"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isCreating} className="" size="sm">{t('python_service.cancel')}</Button>
                            <Button onClick={handleCreate} disabled={isCreating} size="sm">
                                {isCreating ? t('python_service.creating') : t('python_service.create')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* 列表区域 */}
                {venvs.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground bg-content1 dark:bg-content1/40 rounded-lg border border-divider">
                        <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">{t('python_service.no_venvs')}</p>
                    </div>
                ) : (
                    <div className="rounded-lg border border-divider bg-content1 dark:bg-content1/40">
                        <ScrollArea className="">
                            <div className="space-y-1 p-2">
                                {venvs.map(venv => (
                                    <div key={venv} className="flex items-center justify-between p-2 pl-3 rounded-md hover:bg-background dark:hover:bg-white/[0.03] transition-all group border border-transparent hover:border-divider dark:hover:border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-1.5 rounded-full bg-focus/10 dark:bg-focus/10 text-focus dark:text-focus">
                                                <Terminal className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-foreground dark:text-foreground">{venv}</span>
                                                {/* <span className="text-[10px] text-muted-foreground" title={`${venvsDir}/${venv}`}>{venvsDir}/{venv}</span> */}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-[10px] px-2 bg-content1 dark:bg-content1/40 border-divider"
                                                onClick={() => handleActivateVenv(venv)}
                                                disabled={activatingVenvName === venv}
                                                aria-label={t('nav_bar.open_terminal')}
                                                title={t('nav_bar.open_terminal')}
                                            >
                                                <Play className="h-3 w-3" />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-[10px] px-2 bg-content1 dark:bg-content1/40 border-divider"
                                                        aria-label={t('nav_bar.more')}
                                                        title={t('nav_bar.more')}
                                                    >
                                                        <MoreHorizontal className="h-3 w-3" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleOpenVenvFolder(venv)}>
                                                        <Folder className="h-4 w-4 mr-2" />
                                                        {t('python_service.open_venv_folder')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleRemove(venv)}
                                                        className="text-danger"
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        {t('python_service.delete_venv')}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>
            {/* 删除虚拟环境确认 */}
            <AlertDialog open={venvPendingRemove !== null} onOpenChange={(open) => { if (!open) setVenvPendingRemove(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('python_service.delete_venv')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('python_service.confirm_remove_venv', { name: venvPendingRemove ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => venvPendingRemove && performRemove(venvPendingRemove)}
                            className="bg-danger text-danger-foreground hover:bg-danger/90"
                        >
                            {t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    )
}
