// Card moved into child views
import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
import { 
    Settings,
    FolderOpen,
    Globe
} from 'lucide-react'
import { PathConfigView } from './PathConfigView'
import { EnvironmentVariablesView } from './EnvironmentVariablesView'
import { AliasesConfigView } from './AliasesConfigView'

interface CustomServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function CustomService({ serviceData, selectedEnvironment }: CustomServiceProps) {
    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active;

    return (
        <div className="w-full p-3 space-y-4">
            {/* Aliases Configuration */}
            <AliasesConfigView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
            />
            
            {/* Path Configuration */}
            <PathConfigView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
            />

            {/* Environment Variables Configuration */}
            <EnvironmentVariablesView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
            />
        </div>
    )
}