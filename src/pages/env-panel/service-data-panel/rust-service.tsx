import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
import {
    RefreshCw,
    FolderOpen,
    Info
} from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useFileOperations } from "@/hooks/file-operations"
import { useRustService } from "@/hooks/services/rust"

interface RustServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function RustService({ serviceData, selectedEnvironment }: RustServiceProps) {
    return (
        <RustServiceCard serviceData={serviceData} selectedEnvironmentId={selectedEnvironment.id} />
    )
}

interface RustServiceCardProps {
    serviceData: ServiceData
    selectedEnvironmentId: string
}

function RustServiceCard({ serviceData, selectedEnvironmentId }: RustServiceCardProps) {
    const { t } = useTranslation()
    const { openFolderInFinder } = useFileOperations()
    const { setCargoHome } = useRustService()

    const [rustHome, setRustHomeState] = useState('')
    const [cargoHome, setCargoHomeState] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const isActive = serviceData.status === ServiceDataStatus.Active

    useEffect(() => {
        setRustHomeState(serviceData.metadata?.RUST_HOME || '')
        setCargoHomeState((serviceData.metadata?.CARGO_HOME || '').trim())
    }, [serviceData])

    const handleApplyCargoHome = async () => {
        setIsLoading(true)
        try {
            const res = await setCargoHome(selectedEnvironmentId, serviceData, cargoHome)
            if (res && (res as any).success) {
                toast.success(t('rust_service.apply'))
            } else {
                toast.error((res as any)?.message || t('rust_service.apply'))
            }
        } catch (error) {
            toast.error(String(error))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full p-3 space-y-3">
            <div className="w-full p-3 space-y-4 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                {/* RUST_HOME 显示 */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                        {t('rust_service.rust_home_label')}
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                    </Label>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="text-xs font-mono">RUST_HOME</div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 mb-2">
                        {t('rust_service.rust_home_desc')}
                    </p>
                    <div className="flex items-center gap-2">
                        <Input
                            value={rustHome}
                            readOnly
                            disabled
                            placeholder="/path/to/rust/home"
                            className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        />
                        {rustHome && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openFolderInFinder(rustHome)}
                                className="h-8 w-8 shrink-0 shadow-none border-gray-200 dark:border-white/10"
                            >
                                <FolderOpen className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* CARGO_HOME 配置 */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                        {t('rust_service.cargo_home_label')}
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                    </Label>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="text-xs font-mono">CARGO_HOME</div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 mb-2">
                        {t('rust_service.cargo_home_desc')}
                    </p>
                    <div className="flex items-center gap-2">
                        <Input
                            value={cargoHome}
                            onChange={(e) => setCargoHomeState(e.target.value)}
                            placeholder={t('rust_service.cargo_home_placeholder')}
                            disabled={!isActive}
                            className="text-xs h-8 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleApplyCargoHome}
                            disabled={isLoading || !isActive}
                            className="h-8 text-xs shadow-none shrink-0"
                        >
                            {isLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                            {t('rust_service.apply')}
                        </Button>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">
                        {t('rust_service.cargo_home_tip')}
                    </p>
                </div>
            </div>
        </div>
    )
}
