import { Environment, ServiceData } from '@/types/index'
import { BaseService } from '../base-service'
import { DnsmasqConfigView } from './DnsmasqConfigView'

interface DnsmasqServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function DnsmasqService({ serviceData, selectedEnvironment }: DnsmasqServiceProps) {
    return (
        <BaseService service={serviceData}>
            <DnsmasqConfigView
                selectedEnvironmentId={selectedEnvironment.id}
                serviceData={serviceData}
            />
        </BaseService>
    )
}
