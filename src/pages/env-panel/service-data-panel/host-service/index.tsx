import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
import { BaseService } from '../base-service'
import { HostManagementView } from './HostManagementView'

interface HostServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function HostService({ serviceData, selectedEnvironment }: HostServiceProps) {
    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active;

    return (
        <BaseService service={serviceData}>
            {/* Host Management View */}
            <HostManagementView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
            />
        </BaseService>
    )
}
