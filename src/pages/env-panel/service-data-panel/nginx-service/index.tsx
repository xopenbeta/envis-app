import { Environment, ServiceData } from '@/types/index'
import { BaseService } from '../base-service'
import { NginxConfigView } from './NginxConfigView'

interface NginxServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function NginxService({ serviceData, selectedEnvironment }: NginxServiceProps) {
    return (
        <BaseService service={serviceData}>
            <NginxConfigView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
            />
        </BaseService>
    )
}
