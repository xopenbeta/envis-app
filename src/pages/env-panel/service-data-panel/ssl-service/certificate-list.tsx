import { Certificate } from "@/types/service"
import { ServiceData, Environment } from "@/types"
import { Button } from "@/components/ui/button"
import {
    Copy,
    Trash2,
    FolderOpen,
    FileText,
    Key,
    Package,
    RefreshCw,
    Calendar,
    Shield
} from "lucide-react"
import { toast } from "sonner"
import { useSSLService } from "@/hooks/services/ssl"
import { useFileOperations } from "@/hooks/file-operations"
import { Badge } from "@/components/ui/badge"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useState } from "react"

interface CertificateListProps {
    certificates: Certificate[]
    isLoading: boolean
    onRefresh: () => void
    selectedEnvironment: Environment
    serviceData: ServiceData
}

export function CertificateList({
    certificates,
    isLoading,
    onRefresh,
    selectedEnvironment,
    serviceData,
}: CertificateListProps) {
    const { deleteCertificate } = useSSLService()
    const { openFolderInFinder } = useFileOperations()
    const [expandedCert, setExpandedCert] = useState<string | null>(null)

    const handleDelete = async (domain: string) => {
        try {
            const result = await deleteCertificate(selectedEnvironment.id, serviceData, domain)
            if (result.success) {
                toast.success('证书已删除')
                onRefresh()
            } else {
                toast.error(result.message || '删除证书失败')
            }
        } catch (error) {
            console.error('删除证书失败:', error)
            toast.error('删除证书失败')
        }
    }

    const handleCopyPath = (path: string) => {
        navigator.clipboard.writeText(path)
        toast.success('路径已复制到剪贴板')
    }

    const handleOpenFolder = async (path: string) => {
        try {
            await openFolderInFinder(path)
        } catch (error) {
            console.error('打开文件夹失败:', error)
            toast.error('打开文件夹失败')
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (certificates.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>暂无证书</p>
                <p className="text-xs mt-1">点击上方按钮签发新证书</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {certificates.map((cert) => (
                <Collapsible
                    key={cert.id}
                    open={expandedCert === cert.id}
                    onOpenChange={(open) => setExpandedCert(open ? cert.id : null)}
                >
                    <div className="bg-white dark:bg-white/5 rounded border border-gray-200 dark:border-white/10 overflow-hidden">
                        <CollapsibleTrigger className="w-full">
                            <div className="p-2 hover:bg-accent/50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 ml-2">
                                        <Shield className="h-4 w-4 text-green-600" />
                                        <div className="text-left">
                                            <div className="font-medium">{cert.domain}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {cert.subjectAltNames && cert.subjectAltNames.length > 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                                +{cert.subjectAltNames.length} SAN
                                            </Badge>
                                        )}
                                        <Button
                                            variant="ghost"
                                            className="h-7 w-7 p-0 shadow-none"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleOpenFolder(cert.certPath)
                                            }}
                                            title="打开证书文件夹"
                                        >
                                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0 shadow-none"
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>确认删除证书？</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        将删除 {cert.domain} 的证书及所有相关文件，此操作不可恢复。
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(cert.domain)}>
                                                        删除
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="px-4 pb-4 pt-2 space-y-3 border-t">
                                {/* 基本信息 */}
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">序列号:</span>
                                        <span className="font-mono text-xs">{cert.serialNumber}</span>
                                    </div>
                                    {cert.subjectAltNames && cert.subjectAltNames.length > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">SAN:</span>
                                            <div className="text-right">
                                                {cert.subjectAltNames.map((san) => (
                                                    <div key={san} className="text-xs">{san}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 证书格式 */}
                                <div className="space-y-2">
                                    <div className="text-sm font-medium">证书文件</div>

                                    {/* PEM 格式 */}
                                    {cert.formats.pem && (
                                        <div className="flex items-center justify-between p-2 bg-accent/30 rounded text-xs">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-3 w-3" />
                                                <span className="font-medium">PEM (Nginx/Apache)</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 shadow-none"
                                                    onClick={() => handleCopyPath(cert.formats.pem!)}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 shadow-none"
                                                    onClick={() => handleOpenFolder(cert.formats.pem!)}
                                                >
                                                    <FolderOpen className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* CRT + KEY 格式 */}
                                    {cert.formats.crt && cert.formats.key && (
                                        <div className="flex items-center justify-between p-2 bg-accent/30 rounded text-xs">
                                            <div className="flex items-center gap-2">
                                                <Key className="h-3 w-3" />
                                                <span className="font-medium">CRT + KEY (通用)</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 shadow-none"
                                                    onClick={() => handleCopyPath(cert.formats.crt!)}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 shadow-none"
                                                    onClick={() => handleOpenFolder(cert.formats.crt!)}
                                                >
                                                    <FolderOpen className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* PFX 格式 */}
                                    {cert.formats.pfx && (
                                        <div className="flex items-center justify-between p-2 bg-accent/30 rounded text-xs">
                                            <div className="flex items-center gap-2">
                                                <Package className="h-3 w-3" />
                                                <span className="font-medium">PFX (IIS/Windows)</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 shadow-none"
                                                    onClick={() => handleCopyPath(cert.formats.pfx!)}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 shadow-none"
                                                    onClick={() => handleOpenFolder(cert.formats.pfx!)}
                                                >
                                                    <FolderOpen className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CollapsibleContent>
                    </div>
                </Collapsible>
            ))}

            {/* 安装说明 */}
            <div className="p-3 bg-muted/50 rounded text-xs space-y-2 mt-4">
                <div className="font-medium flex items-center gap-2">
                    <Shield className="h-3 w-3" />
                    安装说明
                </div>
                <div className="space-y-1 text-muted-foreground">
                    <p>1. 首次使用需要将 CA 证书添加到系统信任</p>
                    <p>2. Nginx: 使用 PEM 格式，配置 ssl_certificate 和 ssl_certificate_key</p>
                    <p>3. Apache: 使用 CRT + KEY，配置 SSLCertificateFile 和 SSLCertificateKeyFile</p>
                    <p>4. IIS: 导入 PFX 文件到证书存储</p>
                </div>
            </div>
        </div>
    )
}
