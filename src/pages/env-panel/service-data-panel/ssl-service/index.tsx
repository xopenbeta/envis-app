import { Label } from "@/components/ui/label"
import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
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
    const {
        checkCAInitialized,
        getCAInfo,
        listCertificates,
        exportCACertificate,
        checkCAInstalled,
    } = useSSLService()

    const { openFolderInFinder } = useFileOperations()

    // 服务是否激活
    const isServiceActive = serviceData.status === ServiceDataStatus.Active

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
        toast.success('CA 初始化成功')
    }

    const handleCertificateIssued = () => {
        setShowIssueCertDialog(false)
        loadCertificates()
        toast.success('证书签发成功')
    }

    const handleExportCA = async () => {
        try {
            const result = await exportCACertificate(selectedEnvironment.id, serviceData)
            if (result.success && result.data?.caCertPath) {
                // 打开证书所在文件夹
                await openFolderInFinder(result.data.caCertPath)
                toast.success('CA 证书路径已打开')
            }
        } catch (error) {
            console.error('导出 CA 证书失败:', error)
            toast.error('导出 CA 证书失败')
        }
    }

    return (
        <div className="w-full space-y-4">
            {/* CA 状态 */}
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        <Shield className="h-3.5 w-3.5" />
                        证书颁发机构 (CA)
                    </Label>
                    {isCAInitialized && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleExportCA}
                            className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            <FolderOpen className="h-3 w-3 mr-1" />
                            打开 CA 证书
                        </Button>
                    )}
                </div>

                {!isServiceActive && (
                    <div className="text-center py-6 text-muted-foreground bg-white dark:bg-white/5 rounded-lg border border-dashed border-gray-200 dark:border-white/10">
                        <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">服务未激活</p>
                        <p className="text-xs">请先激活 SSL 服务</p>
                    </div>
                )}

                {isServiceActive && isCheckingCA && (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span className="text-sm">正在检查 CA 状态...</span>
                    </div>
                )}

                {isServiceActive && !isCheckingCA && !isCAInitialized && (
                    <div className="space-y-3">
                        <Alert className="bg-white dark:bg-white/5 border-gray-200 dark:border-white/10">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                                CA 未初始化，请先初始化 CA 后才能签发证书
                            </AlertDescription>
                        </Alert>
                        <Button
                            onClick={() => setShowCAInitDialog(true)}
                            className="w-full h-8 text-xs shadow-none"
                        >
                            初始化 CA
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
                                <div className="text-xs font-medium text-muted-foreground">CA 详细信息</div>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs shadow-none hover:bg-white dark:hover:bg-white/10">
                                        {showCADetails ? (
                                            <>
                                                <ChevronUp className="h-3 w-3 mr-1" />
                                                收起
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown className="h-3 w-3 mr-1" />
                                                展开
                                            </>
                                        )}
                                    </Button>
                                </CollapsibleTrigger>
                            </div>

                            <CollapsibleContent>
                                <div className="space-y-2 text-xs mt-2 p-3 bg-white dark:bg-white/5 rounded border border-gray-200 dark:border-white/10">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">通用名称:</span>
                                        <span className="font-medium">{caInfo?.subject}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">颁发者:</span>
                                        <span className="font-medium">{caInfo?.issuer}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">有效期:</span>
                                        <span className="font-medium">
                                            {caInfo?.validFrom} ~ {caInfo?.validTo}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">序列号:</span>
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
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">证书管理</Label>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowIssueCertDialog(true)}
                            disabled={!isServiceActive}
                            className="h-7 px-2 shadow-none text-xs"
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            签发新证书
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
