// Card moved into child views
import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
import { 
    Settings,
    FolderOpen,
    Globe
} from 'lucide-react'
import { BaseService } from '../base-service'
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
        <BaseService service={serviceData}>
            <div className="w-full space-y-4">
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

                {/* Aliases Configuration */}
                <AliasesConfigView
                    selectedEnvironmentId={selectedEnvironment.id}
                    serviceData={serviceData}
                />
            </div>
        </BaseService>
    )
}