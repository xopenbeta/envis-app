import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useTranslation } from 'react-i18next'

interface CAInstallGuideProps {
    isInstalled: boolean
    certPath?: string
}

export function CAInstallGuide({ isInstalled, certPath }: CAInstallGuideProps) {
    const { t } = useTranslation()
    const handleCopyPath = () => {
        if (certPath) {
            navigator.clipboard.writeText(certPath)
            toast.success(t('ssl_service.path_copied'))
        }
    }

    const handleCopyCommand = (command: string) => {
        navigator.clipboard.writeText(command)
        toast.success(t('ssl_service.command_copied'))
    }

    if (isInstalled) {
        return (
            <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-400 text-xs">
                    {t('ssl_service.ca_installed_desc')}
                </AlertDescription>
            </Alert>
        )
    }

    // macOS 安装指南
    const macOSGuide = (
        <div className="bg-white dark:bg-white/5 rounded border border-gray-200 dark:border-white/10 p-4 space-y-3">
                <div className="text-sm font-medium">{t('ssl_service.macos_system')}</div>
                <ol className="text-xs space-y-3 text-muted-foreground list-decimal pl-4">
                    <li>
                        <div className="mb-1">{t('ssl_service.macos_step1')}</div>
                        {certPath && (
                            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded font-mono">
                                <code className="text-xs flex-1 truncate">{certPath}</code>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCopyPath}
                                    className="h-6 px-2"
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </li>
                    <li>{t('ssl_service.macos_step2')}:
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded font-mono mt-1">
                            <code className="text-xs flex-1 break-all">
                                sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "{certPath}"
                            </code>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopyCommand(`sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${certPath}"`)}
                                className="h-6 px-2 flex-shrink-0"
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                    </li>
                    <li>{t('ssl_service.macos_step3')}</li>
                    <li>{t('ssl_service.macos_step4')}</li>
                    <li>{t('ssl_service.macos_step5')}</li>
                </ol>
        </div>
    )

    // Windows 安装指南
    const windowsGuide = (
        <div className="bg-white dark:bg-white/5 rounded border border-gray-200 dark:border-white/10 p-4 space-y-3">
                <div className="text-sm font-medium">{t('ssl_service.windows_system')}</div>
                <ol className="text-xs space-y-3 text-muted-foreground list-decimal pl-4">
                    <li>
                        <div className="mb-1">{t('ssl_service.windows_step1')}</div>
                        {certPath && (
                            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded font-mono">
                                <code className="text-xs flex-1 truncate">{certPath}</code>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCopyPath}
                                    className="h-6 px-2"
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </li>
                    <li>{t('ssl_service.windows_step2')}:
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded font-mono mt-1">
                            <code className="text-xs flex-1 break-all">
                                Import-Certificate -FilePath "{certPath}" -CertStoreLocation Cert:\LocalMachine\Root
                            </code>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopyCommand(`Import-Certificate -FilePath "${certPath}" -CertStoreLocation Cert:\\LocalMachine\\Root`)}
                                className="h-6 px-2 flex-shrink-0"
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                    </li>
                    <li>{t('ssl_service.windows_step3')}</li>
                    <li>{t('ssl_service.windows_step4')}</li>
                    <li>{t('ssl_service.windows_step5')}</li>
                    <li>{t('ssl_service.windows_step6')}</li>
                </ol>
        </div>
    )

    // Linux 安装指南
    const linuxGuide = (
        <div className="bg-white dark:bg-white/5 rounded border border-gray-200 dark:border-white/10 p-4 space-y-3">
                <div className="text-sm font-medium">{t('ssl_service.linux_system')}</div>
                
                <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">{t('ssl_service.ubuntu_debian')}</div>
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded font-mono">
                        <code className="text-xs flex-1 break-all">
                            sudo cp "{certPath}" /usr/local/share/ca-certificates/envis-ca.crt && sudo update-ca-certificates
                        </code>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyCommand(`sudo cp "${certPath}" /usr/local/share/ca-certificates/envis-ca.crt && sudo update-ca-certificates`)}
                            className="h-6 px-2 flex-shrink-0"
                        >
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">{t('ssl_service.centos_rhel')}</div>
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded font-mono">
                        <code className="text-xs flex-1 break-all">
                            sudo cp "{certPath}" /etc/pki/ca-trust/source/anchors/envis-ca.crt && sudo update-ca-trust
                        </code>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyCommand(`sudo cp "${certPath}" /etc/pki/ca-trust/source/anchors/envis-ca.crt && sudo update-ca-trust`)}
                            className="h-6 px-2 flex-shrink-0"
                        >
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
        </div>
    )

    return (
        <div className="space-y-3">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    {t('ssl_service.ca_not_installed_desc')}
                </AlertDescription>
            </Alert>

            {/* 根据操作系统显示对应指南 */}
            {navigator.platform.includes('Mac') && macOSGuide}
            {navigator.platform.includes('Win') && windowsGuide}
            {navigator.platform.includes('Linux') && linuxGuide}

            <Alert>
                <AlertDescription className="text-xs">
                    <div className="font-medium mb-1">{t('ssl_service.tip_title')}</div>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>{t('ssl_service.tip1')}</li>
                        <li>{t('ssl_service.tip2')}</li>
                        <li>{t('ssl_service.tip3')}</li>
                    </ul>
                </AlertDescription>
            </Alert>
        </div>
    )
}
