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
import { ProjectDirectoryView } from './ProjectDirectoryView'
import { useServiceDataStatus } from '@/hooks/service-pollers'

interface CustomServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function CustomService({ serviceData, selectedEnvironment }: CustomServiceProps) {
    const { serviceDataStatus } = useServiceDataStatus(selectedEnvironment.id, serviceData.id, {
        enabled: true,
        interval: 500,
    })
    
    return (
        <div className="w-full p-3 space-y-4">
            {/* Path Configuration */}
            <PathConfigView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
                status={serviceDataStatus}
            />

            {/* Environment Variables Configuration */}
            <EnvironmentVariablesView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
                status={serviceDataStatus}
            />

            {/* Aliases Configuration */}
            <AliasesConfigView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
                status={serviceDataStatus}
            />
            
            {/* Project Directory Configuration */}
            <ProjectDirectoryView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
                status={serviceDataStatus}
            />
        </div>
    )
}