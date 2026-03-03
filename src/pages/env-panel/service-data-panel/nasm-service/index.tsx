import { Environment, ServiceData } from '@/types/index'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface NasmServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function NasmService({ serviceData }: NasmServiceProps) {
    const { t } = useTranslation()

    return (
        <div className="w-full p-3 space-y-3">
            <Alert className="border border-divider bg-content1">
                <Info className="h-4 w-4" />
                <AlertTitle>{t('nasm_service.title')}</AlertTitle>
                <AlertDescription className="text-xs leading-5">
                    {t('nasm_service.description')}
                </AlertDescription>
            </Alert>

            <div className="rounded-md border border-divider bg-content1 p-3 text-xs text-muted-foreground">
                {t('nasm_service.current_version', { version: serviceData.version })}
            </div>
        </div>
    )
}
