import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { ServiceData, Environment } from "@/types"
import { CAConfig } from "@/types/service"
import { useSSLService } from "@/hooks/services/ssl"
import { toast } from "sonner"
import { useTranslation } from 'react-i18next'

interface CAInitDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    selectedEnvironment: Environment
    serviceData: ServiceData
}

export function CAInitDialog({
    open,
    onOpenChange,
    onSuccess,
    selectedEnvironment,
    serviceData,
}: CAInitDialogProps) {
    const { t } = useTranslation()
    const { initializeCA } = useSSLService()
    const [isLoading, setIsLoading] = useState(false)

    const [formData, setFormData] = useState<CAConfig>({
        commonName: 'Envis Local CA',
        organization: 'Envis Development',
        organizationalUnit: 'Development Team',
        country: 'CN',
        state: 'Beijing',
        locality: 'Beijing',
        validityDays: 3650, // 10年
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const result = await initializeCA(
                selectedEnvironment.id,
                serviceData,
                formData
            )

            if (result.success) {
                toast.success(t('ssl_service.ca_init_success'))
                onSuccess()
            } else {
                toast.error(result.message || t('ssl_service.ca_init_failed'))
            }
        } catch (error) {
            console.error('CA 初始化失败:', error)
            toast.error(t('ssl_service.ca_init_failed'))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('ssl_service.init_ca_title')}</DialogTitle>
                    <DialogDescription>
                        {t('ssl_service.init_ca_desc')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="commonName">{t('ssl_service.cn_label')}</Label>
                        <Input
                            id="commonName"
                            value={formData.commonName}
                            onChange={(e) => setFormData({ ...formData, commonName: e.target.value })}
                            placeholder={t('ssl_service.cn_placeholder')}
                            required
                            className="shadow-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="organization">{t('ssl_service.org_label')}</Label>
                        <Input
                            id="organization"
                            value={formData.organization}
                            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                            placeholder={t('ssl_service.org_placeholder')}
                            required
                            className="shadow-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="organizationalUnit">{t('ssl_service.ou_label')}</Label>
                        <Input
                            id="organizationalUnit"
                            value={formData.organizationalUnit || ''}
                            onChange={(e) => setFormData({ ...formData, organizationalUnit: e.target.value })}
                            placeholder={t('ssl_service.ou_placeholder')}
                            className="shadow-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="country">{t('ssl_service.country_label')}</Label>
                            <Input
                                id="country"
                                value={formData.country}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value.toUpperCase() })}
                                placeholder={t('ssl_service.country_placeholder')}
                                maxLength={2}
                                required
                                className="shadow-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="validityDays">{t('ssl_service.validity_label')}</Label>
                            <Input
                                id="validityDays"
                                type="number"
                                value={formData.validityDays}
                                onChange={(e) => setFormData({ ...formData, validityDays: parseInt(e.target.value) })}
                                min={365}
                                max={7300}
                                required
                                className="shadow-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="state">{t('ssl_service.state_label')}</Label>
                        <Input
                            id="state"
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            placeholder={t('ssl_service.state_placeholder')}
                            required
                            className="shadow-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="locality">{t('ssl_service.locality_label')}</Label>
                        <Input
                            id="locality"
                            value={formData.locality}
                            onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
                            placeholder={t('ssl_service.locality_placeholder')}
                            required
                            className="shadow-none"
                        />
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
                            {isLoading ? t('ssl_service.initializing') : t('ssl_service.init_ca_btn')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
