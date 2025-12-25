import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { ServiceData, Environment } from "@/types"
import { useSSLService } from "@/hooks/services/ssl"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface IssueCertificateDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    selectedEnvironment: Environment
    serviceData: ServiceData
}

export function IssueCertificateDialog({
    open,
    onOpenChange,
    onSuccess,
    selectedEnvironment,
    serviceData,
}: IssueCertificateDialogProps) {
    const { issueCertificate } = useSSLService()
    const [isLoading, setIsLoading] = useState(false)

    const [domain, setDomain] = useState('')
    const [validityDays, setValidityDays] = useState(365)
    const [sans, setSans] = useState<string[]>([])
    const [sanInput, setSanInput] = useState('')

    const handleAddSan = () => {
        if (sanInput && !sans.includes(sanInput)) {
            setSans([...sans, sanInput])
            setSanInput('')
        }
    }

    const handleRemoveSan = (san: string) => {
        setSans(sans.filter(s => s !== san))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const result = await issueCertificate(
                selectedEnvironment.id,
                serviceData,
                domain,
                sans.length > 0 ? sans : undefined,
                validityDays
            )

            if (result.success) {
                toast.success('证书签发成功')
                // 重置表单
                setDomain('')
                setValidityDays(365)
                setSans([])
                setSanInput('')
                onSuccess()
            } else {
                toast.error(result.message || '证书签发失败')
            }
        } catch (error) {
            console.error('证书签发失败:', error)
            toast.error('证书签发失败')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>签发新证书</DialogTitle>
                    <DialogDescription>
                        为本地开发域名签发 SSL/TLS 证书
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="domain">域名 *</Label>
                        <Input
                            id="domain"
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            placeholder="例如: localhost 或 example.local"
                            required
                            className="shadow-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            常用开发域名: localhost, 127.0.0.1, *.local
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="validityDays">有效期 (天) *</Label>
                        <Input
                            id="validityDays"
                            type="number"
                            value={validityDays}
                            onChange={(e) => setValidityDays(parseInt(e.target.value))}
                            min={1}
                            max={825} // Chrome/Safari 最长支持 825 天
                            required
                            className="shadow-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            建议 365 天（浏览器限制最长 825 天）
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="san">主题备用名称 (SAN)</Label>
                        <div className="flex gap-2">
                            <Input
                                id="san"
                                value={sanInput}
                                onChange={(e) => setSanInput(e.target.value)}
                                placeholder="例如: www.example.local"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleAddSan()
                                    }
                                }}
                                className="shadow-none"
                            />
                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={handleAddSan}
                                className="shadow-none"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {sans.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {sans.map((san) => (
                                    <Badge key={san} variant="secondary" className="gap-1">
                                        {san}
                                        <X
                                            className="h-3 w-3 cursor-pointer"
                                            onClick={() => handleRemoveSan(san)}
                                        />
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            可选，用于支持多个域名的证书
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                            className="shadow-none"
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={isLoading} className="shadow-none">
                            {isLoading ? '签发中...' : '签发证书'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
