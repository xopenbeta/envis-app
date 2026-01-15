import { Environment, ServiceData, ServiceDataStatus } from '@/types/index'
import { HostManagementView } from './HostManagementView'

interface HostServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function HostService({ serviceData, selectedEnvironment }: HostServiceProps) {
    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active;

    return (
        <HostManagementView
            selectedEnvironmentId={selectedEnvironment.id}
            serviceData={serviceData}
        />
    )
}
