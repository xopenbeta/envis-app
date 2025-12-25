import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface CAInstallGuideProps {
    isInstalled: boolean
    certPath?: string
}

export function CAInstallGuide({ isInstalled, certPath }: CAInstallGuideProps) {
    const handleCopyPath = () => {
        if (certPath) {
            navigator.clipboard.writeText(certPath)
            toast.success('路径已复制到剪贴板')
        }
    }

    const handleCopyCommand = (command: string) => {
        navigator.clipboard.writeText(command)
        toast.success('命令已复制到剪贴板')
    }

    if (isInstalled) {
        return (
            <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-400 text-xs">
                    CA 证书已安装到系统，浏览器可以信任由此 CA 签发的所有证书
                </AlertDescription>
            </Alert>
        )
    }

    // macOS 安装指南
    const macOSGuide = (
        <div className="bg-white dark:bg-white/5 rounded border border-gray-200 dark:border-white/10 p-4 space-y-3">
                <div className="text-sm font-medium">macOS 系统</div>
                <ol className="text-xs space-y-3 text-muted-foreground list-decimal pl-4">
                    <li>
                        <div className="mb-1">双击 CA 证书文件打开钥匙串访问</div>
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
                    <li>或使用命令行安装（推荐）:
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
                    <li>在钥匙串中找到该证书，双击打开</li>
                    <li>展开"信任"部分，将"使用此证书时"设置为"始终信任"</li>
                    <li>关闭窗口并输入系统密码确认</li>
                </ol>
        </div>
    )

    // Windows 安装指南
    const windowsGuide = (
        <div className="bg-white dark:bg-white/5 rounded border border-gray-200 dark:border-white/10 p-4 space-y-3">
                <div className="text-sm font-medium">Windows 系统</div>
                <ol className="text-xs space-y-3 text-muted-foreground list-decimal pl-4">
                    <li>
                        <div className="mb-1">右键点击 CA 证书文件，选择"安装证书"</div>
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
                    <li>或使用 PowerShell（管理员权限）:
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
                    <li>选择"本地计算机"存储位置</li>
                    <li>选择"将所有的证书都放入下列存储"</li>
                    <li>点击"浏览"并选择"受信任的根证书颁发机构"</li>
                    <li>点击"下一步"并完成导入</li>
                </ol>
        </div>
    )

    // Linux 安装指南
    const linuxGuide = (
        <div className="bg-white dark:bg-white/5 rounded border border-gray-200 dark:border-white/10 p-4 space-y-3">
                <div className="text-sm font-medium">Linux 系统</div>
                
                <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Ubuntu/Debian:</div>
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
                    <div className="text-xs font-medium text-muted-foreground">CentOS/RHEL/Fedora:</div>
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
                    CA 证书尚未安装到系统，浏览器将显示证书不受信任警告。
                    请按照以下步骤安装 CA 证书:
                </AlertDescription>
            </Alert>

            {/* 根据操作系统显示对应指南 */}
            {navigator.platform.includes('Mac') && macOSGuide}
            {navigator.platform.includes('Win') && windowsGuide}
            {navigator.platform.includes('Linux') && linuxGuide}

            <Alert>
                <AlertDescription className="text-xs">
                    <div className="font-medium mb-1">💡 提示:</div>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>安装 CA 证书后，所有由此 CA 签发的证书都会被自动信任</li>
                        <li>仅需安装一次，之后签发的新证书无需再次安装</li>
                        <li>建议定期更新 CA 证书以确保安全性</li>
                    </ul>
                </AlertDescription>
            </Alert>
        </div>
    )
}
