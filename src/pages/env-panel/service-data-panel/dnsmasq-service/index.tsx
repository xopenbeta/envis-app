import { Environment, ServiceData } from '@/types/index'
import { DnsmasqConfigView } from './DnsmasqConfigView'

interface DnsmasqServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function DnsmasqService({ serviceData, selectedEnvironment }: DnsmasqServiceProps) {
    return (
        <DnsmasqConfigView
            selectedEnvironmentId={selectedEnvironment.id}
            serviceData={serviceData}
        />
    )
}
