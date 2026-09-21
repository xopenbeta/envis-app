import { Environment, ServiceData } from '@/types/index'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    AlertTriangle
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePythonService } from '@/hooks/services/python'
import { useTranslation } from 'react-i18next'
import { PipConfigView } from './PipConfigView'
import { VenvView } from './VenvView'

interface PythonServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function PythonService({ serviceData, selectedEnvironment }: PythonServiceProps) {
    const { t } = useTranslation()
    const { checkUvInstalled } = usePythonService()
    const [uvInstalled, setUvInstalled] = useState(false)

    useEffect(() => {
        checkUvInstalled().then((res) => {
            if (res && (res as any).success && (res as any).data) {
                setUvInstalled((res as any).data.installed === true)
                return
            }
            setUvInstalled(false)
        }).catch(() => {
            setUvInstalled(false)
        })
    }, [serviceData.id, serviceData.version])

    return (
        <div className="flex flex-col">
            {uvInstalled && (
                <div className="w-full p-3 pb-0">
                    <Alert variant="destructive" className="bg-danger/10 dark:bg-danger/10 border-danger/30 dark:border-danger/20">
                        <AlertTriangle className="h-4 w-4 text-danger dark:text-danger" />
                        <AlertTitle className="text-danger dark:text-danger text-xs font-semibold flex items-center gap-2">
                            {t('python_service.uv_conflict_title')}
                        </AlertTitle>
                        <AlertDescription className="text-danger dark:text-danger/90 text-xs mt-1.5">
                            {t('python_service.uv_conflict_desc')}
                        </AlertDescription>
                    </Alert>
                </div>
            )}
            <PipConfigView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
            />
            <VenvView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
            />
        </div>
    )
}
