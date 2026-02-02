import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Environment, ServiceData } from '@/types/index'
import {
    Settings
} from 'lucide-react'
import { PipConfigView } from './PipConfigView'

interface PythonServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function PythonService({ serviceData, selectedEnvironment }: PythonServiceProps) {

    return (
        <>
            {<PipConfigView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
            />}
        </>
    )
}
