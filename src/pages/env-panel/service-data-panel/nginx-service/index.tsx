import { Environment, ServiceData } from '@/types/index'
import { NginxConfigView } from './NginxConfigView'

interface NginxServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function NginxService({ serviceData, selectedEnvironment }: NginxServiceProps) {
    return (
        <NginxConfigView
            selectedEnvironmentId={selectedEnvironment.id}
            serviceData={serviceData}
        />
    )
}
