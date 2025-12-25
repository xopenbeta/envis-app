import { NodeService } from './nodejs-service'
import { ServicesDashboard } from './services-dashboard'
import { MongoDBService } from './mongodb-service'
import { MariaDBService } from './mariadb-service'
import { MySQLService } from './mysql-service'
import { PostgreSQLService } from './postgresql-service'
import { NginxService } from './nginx-service'
import { CustomService } from './custom-service'
import { HostService } from './host-service'
import { PythonService } from './python-service'
import { SSLService } from './ssl-service'
import { DnsmasqService } from './dnsmasq-service'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { ServiceType } from '@/types'
import { useAtom } from 'jotai'
import { selectedEnvironmentIdAtom } from '@/store/environment'
import { useEnvironment } from '@/hooks/environment'

export function ServiceDetailRouter() {
  const { selectedEnvironment } = useEnvironment()
  const { selectedServiceData } = useEnvironmentServiceData()

  if (!selectedServiceData || !selectedEnvironment) {
      return <ServicesDashboard />
  }

  // 根据服务类型返回对应的组件
  switch (selectedServiceData.type) {
    case ServiceType.Nodejs:
      return <NodeService selectedEnvironment={selectedEnvironment} serviceData={selectedServiceData} />
    case ServiceType.Nginx:
      return <NginxService selectedEnvironment={selectedEnvironment} serviceData={selectedServiceData} />
    case ServiceType.Mariadb:
      return <MariaDBService serviceData={selectedServiceData} />
    case ServiceType.Mysql:
      return <MySQLService serviceData={selectedServiceData} />
    case ServiceType.Mongodb:
      return <MongoDBService serviceData={selectedServiceData} />
    case ServiceType.Postgresql:
      return <PostgreSQLService selectedEnvironment={selectedEnvironment} serviceData={selectedServiceData} />
    case ServiceType.Python:
      return <PythonService selectedEnvironment={selectedEnvironment} serviceData={selectedServiceData} />
    case ServiceType.Custom:
      return <CustomService selectedEnvironment={selectedEnvironment} serviceData={selectedServiceData} />
    case ServiceType.Host:
      return <HostService selectedEnvironment={selectedEnvironment} serviceData={selectedServiceData} />
    case ServiceType.SSL:
      return <SSLService selectedEnvironment={selectedEnvironment} serviceData={selectedServiceData} />
    case ServiceType.Dnsmasq:
      return <DnsmasqService selectedEnvironment={selectedEnvironment} serviceData={selectedServiceData} />
    // case 'java':
    //   return <JavaService service={selectedService} />
    default:
      return <ServicesDashboard />
  }
}
