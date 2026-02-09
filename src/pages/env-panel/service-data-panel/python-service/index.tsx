import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Environment, ServiceData } from '@/types/index'
import {
    Settings
} from 'lucide-react'
import { PipConfigView } from './PipConfigView'
import { VenvView } from './VenvView'

interface PythonServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function PythonService({ serviceData, selectedEnvironment }: PythonServiceProps) {

    return (
        <div className="flex flex-col">
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
