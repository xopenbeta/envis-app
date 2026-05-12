import { useTranslation } from 'react-i18next'
import { Label } from "@/components/ui/label"
import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
import { useServiceDataStatus } from '@/hooks/useStatus'
import { CAInitDialog } from './ca-init-dialog'
import { CertificateList } from './certificate-list'
import { IssueCertificateDialog } from './issue-certificate-dialog'
import { CAInstallGuide } from './ca-install-guide'
import { useSSLService } from '@/hooks/services/ssl'
import { useEffect, useState, useRef } from 'react'
import { Certificate } from '@/types/service'
import { Button } from '@/components/ui/button'
import { Shield, Plus, Download, AlertCircle, ChevronDown, ChevronUp, Loader2, Folder, FolderOpen } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { useFileOperations } from '@/hooks/file-operations'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface SSLServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function SSLService({ serviceData, selectedEnvironment }: SSLServiceProps) {
    const { t } = useTranslation()
    const {
        checkCAInitialized,
        getCAInfo,
        listCertificates,
        exportCACertificate,
        checkCAInstalled,
    } = useSSLService()

    const { openFolderInFinder } = useFileOperations()

    // 服务是否激活
    const { serviceDataStatus } = useServiceDataStatus(selectedEnvironment.id, serviceData.id, {
        enabled: true,
        interval: 500,
    })
    const isServiceActive = serviceDataStatus === ServiceDataStatus.Active

    // CA 初始化状态
    const [isCAInitialized, setIsCAInitialized] = useState<boolean>(false)
    const [isCheckingCA, setIsCheckingCA] = useState<boolean>(false)
    const [caInfo, setCAInfo] = useState<any>(null)
    const [showCAInitDialog, setShowCAInitDialog] = useState(false)
    const [showCADetails, setShowCADetails] = useState(false)

    // CA 系统安装状态
    const [isCAInstalledToSystem, setIsCAInstalledToSystem] = useState<boolean>(false)
    const [caCertPath, setCACertPath] = useState<string>('')
    const checkIntervalRef = useRef<any>(null)

    // 证书列表
    const [certificates, setCertificates] = useState<Certificate[]>([])
    const [isLoadingCerts, setIsLoadingCerts] = useState(false)

    // 签发证书对话框
    const [showIssueCertDialog, setShowIssueCertDialog] = useState(false)

    // 检查 CA 初始化状态
    useEffect(() => {
        if (isServiceActive) {
            checkCAStatus()
        }
    }, [isServiceActive])

    // 加载证书列表
    useEffect(() => {
        if (isServiceActive && isCAInitialized) {
            loadCertificates()
        }
    }, [isServiceActive, isCAInitialized])

    // 定期检查 CA 是否安装到系统 (每3秒)
    useEffect(() => {
        if (isServiceActive && isCAInitialized) {
            // 立即执行一次检查
            checkCAInstalledStatus()

            // 设置定时器
            checkIntervalRef.current = setInterval(() => {
                checkCAInstalledStatus()
            }, 3000)
        }

        // 清理定时器
        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current)
                checkIntervalRef.current = null
            }
        }
    }, [isServiceActive, isCAInitialized])

    const checkCAStatus = async () => {
        setIsCheckingCA(true)
        try {
            const result = await checkCAInitialized(selectedEnvironment.id)
            if (result.success && result.data) {
                setIsCAInitialized(result.data.initialized)
                if (result.data.initialized) {
                    await loadCAInfo()
                }
            }
        } catch (error) {
            console.error('检查 CA 状态失败:', error)
        } finally {
            setIsCheckingCA(false)
        }
    }

    const checkCAInstalledStatus = async () => {
        try {
            const result = await checkCAInstalled(selectedEnvironment.id)
            if (result.success && result.data) {
                setIsCAInstalledToSystem(result.data.installed)
                if (result.data.certPath) {
                    setCACertPath(result.data.certPath)
                }
            }
        } catch (error) {
            console.error('检查 CA 安装状态失败:', error)
        }
    }

    const loadCAInfo = async () => {
        try {
            const result = await getCAInfo(selectedEnvironment.id, serviceData)
            if (result.success && result.data) {
                setCAInfo(result.data)
                if (result.data.caCertPath) {
                    setCACertPath(result.data.caCertPath)
                }
            }
        } catch (error) {
            console.error('加载 CA 信息失败:', error)
        }
    }

    const loadCertificates = async () => {
        setIsLoadingCerts(true)
        try {
            const result = await listCertificates(selectedEnvironment.id, serviceData)
            if (result.success && result.data?.certificates) {
                setCertificates(result.data.certificates)
            }
        } catch (error) {
            console.error('加载证书列表失败:', error)
        } finally {
            setIsLoadingCerts(false)
        }
    }

    const handleCAInitialized = () => {
        setIsCAInitialized(true)
        setShowCAInitDialog(false)
        checkCAStatus()
        toast.success(t('ssl_service.ca_init_success'))
    }

    const handleCertificateIssued = () => {
        setShowIssueCertDialog(false)
        loadCertificates()
        toast.success(t('ssl_service.cert_issued_success'))
    }

    const handleExportCA = async () => {
        try {
            const result = await exportCACertificate(selectedEnvironment.id, serviceData)
            if (result.success && result.data?.caCertPath) {
                // 打开证书所在文件夹
                await openFolderInFinder(result.data.caCertPath)
                toast.success(t('ssl_service.ca_cert_path_opened'))
            }
        } catch (error) {
            console.error('导出 CA 证书失败:', error)
            toast.error(t('ssl_service.export_ca_failed'))
        }
    }

    return (
        <div className="w-full space-y-4">
            {/* CA 状态 */}
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        <Shield className="h-3.5 w-3.5" />
                        {t('ssl_service.ca_title')}
                    </Label>
                    {isCAInitialized && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleExportCA}
                            className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            <FolderOpen className="h-3 w-3 mr-1" />
                            {t('ssl_service.open_ca_cert')}
                        </Button>
                    )}
                </div>

                {!isServiceActive && (
                    <div className="text-center py-6 text-muted-foreground bg-white dark:bg-white/5 rounded-lg border border-dashed border-gray-200 dark:border-white/10">
                        <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('ssl_service.service_not_active')}</p>
                        <p className="text-xs">{t('ssl_service.service_not_active_hint')}</p>
                    </div>
                )}

                {isServiceActive && isCheckingCA && (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span className="text-sm">{t('ssl_service.checking_ca')}</span>
                    </div>
                )}

                {isServiceActive && !isCheckingCA && !isCAInitialized && (
                    <div className="space-y-3">
                        <Alert className="bg-white dark:bg-white/5 border-gray-200 dark:border-white/10">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                                {t('ssl_service.ca_not_initialized')}
                            </AlertDescription>
                        </Alert>
                        <Button
                            onClick={() => setShowCAInitDialog(true)}
                            className="w-full h-8 text-xs shadow-none"
                        >
                            {t('ssl_service.init_ca')}
                        </Button>
                    </div>
                )}

                {isServiceActive && !isCheckingCA && isCAInitialized && (
                    <div className="space-y-4">
                        {/* CA 安装状态指南 */}
                        <CAInstallGuide
                            isInstalled={isCAInstalledToSystem}
                            certPath={caCertPath}
                        />

                        {/* CA 详细信息 - 可折叠 */}
                        <Collapsible open={showCADetails} onOpenChange={setShowCADetails}>
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-medium text-muted-foreground">{t('ssl_service.ca_details')}</div>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs shadow-none hover:bg-white dark:hover:bg-white/10">
                                        {showCADetails ? (
                                            <>
                                                <ChevronUp className="h-3 w-3 mr-1" />
                                                {t('ssl_service.collapse')}
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown className="h-3 w-3 mr-1" />
                                                {t('ssl_service.expand')}
                                            </>
                                        )}
                                    </Button>
                                </CollapsibleTrigger>
                            </div>

                            <CollapsibleContent>
                                <div className="space-y-2 text-xs mt-2 p-3 bg-white dark:bg-white/5 rounded border border-gray-200 dark:border-white/10">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('ssl_service.common_name')}</span>
                                        <span className="font-medium">{caInfo?.subject}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('ssl_service.issuer')}</span>
                                        <span className="font-medium">{caInfo?.issuer}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('ssl_service.validity')}</span>
                                        <span className="font-medium">
                                            {caInfo?.validFrom} ~ {caInfo?.validTo}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('ssl_service.serial_number')}</span>
                                        <span className="font-mono">{caInfo?.serialNumber}</span>
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </div>
                )}

            </div>

            {/* 证书管理 */}
            {isCAInitialized && (
                <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('ssl_service.cert_management')}</Label>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowIssueCertDialog(true)}
                            disabled={!isServiceActive}
                            className="h-7 px-2 shadow-none text-xs"
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            {t('ssl_service.issue_new_cert')}
                        </Button>
                    </div>
                    <div>
                        <CertificateList
                            certificates={certificates}
                            isLoading={isLoadingCerts}
                            onRefresh={loadCertificates}
                            selectedEnvironment={selectedEnvironment}
                            serviceData={serviceData}
                        />
                    </div>
                </div>
            )}
            {/* CA 初始化对话框 */}
            <CAInitDialog
                open={showCAInitDialog}
                onOpenChange={setShowCAInitDialog}
                onSuccess={handleCAInitialized}
                selectedEnvironment={selectedEnvironment}
                serviceData={serviceData}
            />

            {/* 签发证书对话框 */}
            <IssueCertificateDialog
                open={showIssueCertDialog}
                onOpenChange={setShowIssueCertDialog}
                onSuccess={handleCertificateIssued}
                selectedEnvironment={selectedEnvironment}
                serviceData={serviceData}
            />
        </div>
    )
}
