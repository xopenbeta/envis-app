import { Environment, ServiceData } from '@/types/index'
import { ApacheConfigView } from './ApacheConfigView'

interface ApacheServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function ApacheService({ serviceData, selectedEnvironment }: ApacheServiceProps) {
    return (
        <ApacheConfigView
            selectedEnvironmentId={selectedEnvironment.id}
            serviceData={serviceData}
        />
    )
}
