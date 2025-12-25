import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { ServiceData, Environment } from "@/types"
import { CAConfig } from "@/types/service"
import { useSSLService } from "@/hooks/services/ssl"
import { toast } from "sonner"

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
                toast.success('CA 初始化成功')
                onSuccess()
            } else {
                toast.error(result.message || 'CA 初始化失败')
            }
        } catch (error) {
            console.error('CA 初始化失败:', error)
            toast.error('CA 初始化失败')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>初始化证书颁发机构 (CA)</DialogTitle>
                    <DialogDescription>
                        配置 CA 信息，该 CA 将用于签发所有本地开发证书
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="commonName">通用名称 (CN) *</Label>
                        <Input
                            id="commonName"
                            value={formData.commonName}
                            onChange={(e) => setFormData({ ...formData, commonName: e.target.value })}
                            placeholder="例如: My Local CA"
                            required
                            className="shadow-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="organization">组织名称 (O) *</Label>
                        <Input
                            id="organization"
                            value={formData.organization}
                            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                            placeholder="例如: My Company"
                            required
                            className="shadow-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="organizationalUnit">组织单位 (OU)</Label>
                        <Input
                            id="organizationalUnit"
                            value={formData.organizationalUnit || ''}
                            onChange={(e) => setFormData({ ...formData, organizationalUnit: e.target.value })}
                            placeholder="例如: Development"
                            className="shadow-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="country">国家代码 (C) *</Label>
                            <Input
                                id="country"
                                value={formData.country}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value.toUpperCase() })}
                                placeholder="例如: CN"
                                maxLength={2}
                                required
                                className="shadow-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="validityDays">有效期 (天) *</Label>
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
                        <Label htmlFor="state">省/州 (ST) *</Label>
                        <Input
                            id="state"
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            placeholder="例如: Beijing"
                            required
                            className="shadow-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="locality">城市 (L) *</Label>
                        <Input
                            id="locality"
                            value={formData.locality}
                            onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
                            placeholder="例如: Beijing"
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
                            取消
                        </Button>
                        <Button type="submit" disabled={isLoading} className="shadow-none">
                            {isLoading ? '初始化中...' : '初始化 CA'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
