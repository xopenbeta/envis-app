import { Environment, ServiceData } from '@/types/index'
import { HostManagementView } from './HostManagementView'

interface HostServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function HostService({ serviceData, selectedEnvironment }: HostServiceProps) {
    return (
        <HostManagementView
            selectedEnvironmentId={selectedEnvironment.id}
            serviceData={serviceData}
        />
    )
}
