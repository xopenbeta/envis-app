import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
import {
    RefreshCw,
    FolderOpen,
    ChevronDown,
    Info
} from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
    const {
        getRustInfo,
        setCargoHome,
    } = useRustService()

    const [rustHome, setRustHomeState] = useState('')
    const [cargoHome, setCargoHomeState] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isRustInfoExpanded, setIsRustInfoExpanded] = useState(false)
    const [rustInfo, setRustInfo] = useState<{
        rustcVersion: string
        cargoVersion: string
        rustHome: string
        cargoHome?: string
    } | null>(null)

    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active

    useEffect(() => {
        setRustHomeState(serviceData.metadata?.RUST_HOME || '')
        setCargoHomeState((serviceData.metadata?.CARGO_HOME || '').trim())

        if (isServiceDataActive) {
            loadRustInfo()
        } else {
            setRustInfo(null)
        }
    }, [serviceData, isServiceDataActive])

    const loadRustInfo = async () => {
        try {
            const res = await getRustInfo(serviceData)
            if (res && (res as any).success && (res as any).data) {
                setRustInfo((res as any).data)
            }
        } catch (error) {
            console.error('获取 Rust 信息失败:', error)
        }
    }

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
        <TooltipProvider>
            <div className="space-y-4 p-4">
                {/* RUST_HOME 显示 */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Label>{t('rust_service.rust_home_label')}</Label>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t('rust_service.rust_home_desc')}</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="flex gap-2">
                        <Input
                            value={rustHome}
                            readOnly
                            className="font-mono text-sm flex-1"
                            placeholder={t('rust_service.rust_home_label')}
                        />
                        {rustHome && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openFolderInFinder(rustHome)}
                                title={t('rust_service.rust_home_label')}
                            >
                                <FolderOpen className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Rust 版本信息（仅激活状态展示） */}
                {isServiceDataActive && (
                    <Collapsible open={isRustInfoExpanded} onOpenChange={setIsRustInfoExpanded}>
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                                <span className="text-sm font-medium">{t('rust_service.rust_info_label')}</span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            loadRustInfo()
                                        }}
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                    </Button>
                                    <ChevronDown
                                        className={`h-4 w-4 transition-transform ${isRustInfoExpanded ? 'rotate-180' : ''}`}
                                    />
                                </div>
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="space-y-2 px-2 pt-2">
                                {rustInfo ? (
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{t('rust_service.rustc_version')}</span>
                                            <span className="font-mono">{rustInfo.rustcVersion}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{t('rust_service.cargo_version')}</span>
                                            <span className="font-mono">{rustInfo.cargoVersion}</span>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">{t('rust_service.checking')}</p>
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                {/* CARGO_HOME 配置 */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Label>{t('rust_service.cargo_home_label')}</Label>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t('rust_service.cargo_home_desc')}</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="flex gap-2">
                        <Input
                            value={cargoHome}
                            onChange={(e) => setCargoHomeState(e.target.value)}
                            className="font-mono text-sm flex-1"
                            placeholder={t('rust_service.cargo_home_placeholder')}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleApplyCargoHome}
                            disabled={isLoading}
                        >
                            {t('rust_service.apply')}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('rust_service.cargo_home_tip')}</p>
                </div>
            </div>
        </TooltipProvider>
    )
}
