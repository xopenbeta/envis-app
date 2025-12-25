import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Environment, ServiceData } from '@/types/index'
import {
    Settings
} from 'lucide-react'
import { BaseService } from '../base-service'
import { PipConfigView } from './PipConfigView'

interface PythonServiceProps {
    serviceData: ServiceData
    selectedEnvironment: Environment
}

export function PythonService({ serviceData, selectedEnvironment }: PythonServiceProps) {
    // 检查服务是否正在运行
    const isServiceDataActive = serviceData.status;

    return (
        <BaseService service={serviceData}>
            <Card className='shadow-none'>
                <CardHeader>
                    <CardTitle className="text-base flex items-center">
                        <Settings className="h-4 w-4 mr-2" />
                        Pip 配置
                    </CardTitle>
                    {!isServiceDataActive && (
                        <p className="text-xs text-muted-foreground">
                            服务未运行,配置功能已禁用
                        </p>
                    )}
                </CardHeader>
                <CardContent>
                    {isServiceDataActive && <PipConfigView
                        selectedEnvironmentId={selectedEnvironment.id}
                        serviceData={serviceData}
                    />}
                </CardContent>
            </Card>
        </BaseService>
    )
}
