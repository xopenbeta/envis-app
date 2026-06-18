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
import { useTranslation } from 'react-i18next'

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
    const { t } = useTranslation()
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
                toast.success(t('ssl_service.cert_issued_success'))
                // 重置表单
                setDomain('')
                setValidityDays(365)
                setSans([])
                setSanInput('')
                onSuccess()
            } else {
                toast.error(result.message || t('ssl_service.issue_cert_failed'))
            }
        } catch (error) {
            console.error('证书签发失败:', error)
            toast.error(t('ssl_service.issue_cert_failed'))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('ssl_service.issue_cert_title')}</DialogTitle>
                    <DialogDescription>
                        {t('ssl_service.issue_cert_desc')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="domain">{t('ssl_service.domain_label')}</Label>
                        <Input
                            id="domain"
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            placeholder={t('ssl_service.domain_placeholder')}
                            required
                            className="shadow-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('ssl_service.domain_hint')}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="validityDays">{t('ssl_service.validity_days_label')}</Label>
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
                            {t('ssl_service.validity_hint')}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="san">{t('ssl_service.san_title')}</Label>
                        <div className="flex gap-2">
                            <Input
                                id="san"
                                value={sanInput}
                                onChange={(e) => setSanInput(e.target.value)}
                                placeholder={t('ssl_service.san_placeholder')}
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
                            {t('ssl_service.san_hint')}
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
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" disabled={isLoading} className="shadow-none">
                            {isLoading ? t('ssl_service.issuing') : t('ssl_service.issue_cert_btn')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
