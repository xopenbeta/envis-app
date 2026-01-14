import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ServiceList } from "./service-data-list/service-data-list"
import { AppFooter } from "../app-footer"
import { EnvPanelHeader } from "./env-panel-header"
import { NodeService } from './service-data-panel/nodejs-service'
import { ServicesDashboard } from './service-data-panel/services-dashboard'
import { MongoDBService } from './service-data-panel/mongodb-service'
import { MariaDBService } from './service-data-panel/mariadb-service'
import { MySQLService } from './service-data-panel/mysql-service'
import { PostgreSQLService } from './service-data-panel/postgresql-service'
import { NginxService } from './service-data-panel/nginx-service'
import { CustomService } from './service-data-panel/custom-service'
import { HostService } from './service-data-panel/host-service'
import { PythonService } from './service-data-panel/python-service'
import { SSLService } from './service-data-panel/ssl-service'
import { DnsmasqService } from './service-data-panel/dnsmasq-service'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { ServiceType } from '@/types'
import { useAtom } from 'jotai'
import { selectedEnvironmentIdAtom } from '@/store/environment'
import { useEnvironment } from '@/hooks/environment'

function ServiceDetailRouter() {
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

export function EnvironmentPanel({ onOpen }: {
  onOpen?: () => void
}) {

  return (
    <ResizablePanelGroup direction="horizontal">
      {/* Service List */}
      <ResizablePanel defaultSize={30} minSize={10} maxSize={60}>
        <ServiceList onOpen={onOpen} />
      </ResizablePanel>

      <ResizableHandle className="w-px bg-border hover:bg-default heroui-transition" />

      {/* Service Detail or Dashboard */}
      <ResizablePanel defaultSize={69} minSize={40}>
        <div className="h-full flex flex-col">
          <EnvPanelHeader />
          <div className="flex-1 min-h-0 overflow-auto">
            <ServiceDetailRouter />
          </div>
          {/* Footer Status Bar */}
          <AppFooter isShowConsoleBtn={true} onConsoleBtnClick={() => { /* Add your console button click handler here */ }} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
