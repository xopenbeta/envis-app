import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from 'sonner'
import { 
  Database,
  Play,
  Square,
  RefreshCw,
  FolderOpen,
  Settings,
  Activity,
  Save
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseService } from '../base-service'
import { ServiceData, Environment } from '@/types/index'
import { useState, useEffect } from 'react'
import { 
  usePostgresqlService,
  type PostgreSQLConfig
} from '@/hooks/services/postgresql'
import { useFileOperations } from "@/hooks/file-operations"

interface PostgreSQLServiceProps {
  serviceData: ServiceData
  selectedEnvironment: Environment
}

export function PostgreSQLService({ serviceData, selectedEnvironment }: PostgreSQLServiceProps) {
  const { openFolderInFinder } = useFileOperations()
  const {
    getPostgresqlConfig,
    setPostgresqlDataPath,
    setPostgresqlPort,
    getPostgresqlServiceStatus,
    startPostgresqlService,
    stopPostgresqlService,
    restartPostgresqlService
  } = usePostgresqlService()
  
  // 检查服务是否激活
  const isServiceActive = serviceData.status === 'active'

  // PostgreSQL 配置状态
  const [pgConfig, setPgConfig] = useState<PostgreSQLConfig | null>(null)
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)

  // 加载 PostgreSQL 配置
  useEffect(() => {
    if (isServiceActive) {
      loadPgConfig()
      const timer = setInterval(() => {
        checkServiceStatus()
      }, 1000);
      return () => {
        clearInterval(timer)
      }
    } else {
      setPgConfig(null)
      return () => {}
    }
  }, [isServiceActive, selectedEnvironment.id])

  const loadPgConfig = async () => {
    if (!isServiceActive) return
    
    setIsLoading(true)
    try {
      const result = await getPostgresqlConfig(selectedEnvironment.id, serviceData)
      if (result.success && result.config) {
        setPgConfig(result.config)
      } else {
        toast.error('加载 PostgreSQL 配置失败: ' + result.message)
      }
    } catch (error) {
      toast.error('加载 PostgreSQL 配置失败: ' + error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkServiceStatus = async () => {
    if (!isServiceActive) return
    
    try {
      const result = await getPostgresqlServiceStatus(selectedEnvironment.id, serviceData)
      if (result.success && pgConfig) {
        setPgConfig({
          ...pgConfig,
          isRunning: result.isRunning
        })
      }
    } catch (error) {
      // 静默失败，不显示错误提示
    }
  }

  const handleDataPathChange = async (newPath: string) => {
    if (!pgConfig) return
    
    setIsLoading(true)
    try {
      const result = await setPostgresqlDataPath(selectedEnvironment.id, serviceData, newPath)
      if (result.success) {
        setPgConfig({ ...pgConfig, dataPath: newPath })
        toast.success('数据目录设置成功')
      } else {
        toast.error('设置失败: ' + result.message)
      }
    } catch (error) {
      toast.error('设置失败: ' + error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePortChange = async (newPort: number) => {
    if (!pgConfig) return
    
    setIsLoading(true)
    try {
      const result = await setPostgresqlPort(selectedEnvironment.id, serviceData, newPort)
      if (result.success) {
        setPgConfig({ ...pgConfig, port: newPort })
        toast.success('端口设置成功')
      } else {
        toast.error('设置失败: ' + result.message)
      }
    } catch (error) {
      toast.error('设置失败: ' + error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStart = async () => {
    setIsStarting(true)
    try {
      const result = await startPostgresqlService(selectedEnvironment.id, serviceData)
      if (result.success) {
        toast.success('PostgreSQL 服务启动成功')
        await checkServiceStatus()
      } else {
        toast.error('启动失败: ' + result.message)
      }
    } catch (error) {
      toast.error('启动失败: ' + error)
    } finally {
      setIsStarting(false)
    }
  }

  const handleStop = async () => {
    setIsStopping(true)
    try {
      const result = await stopPostgresqlService(selectedEnvironment.id, serviceData)
      if (result.success) {
        toast.success('PostgreSQL 服务停止成功')
        await checkServiceStatus()
      } else {
        toast.error('停止失败: ' + result.message)
      }
    } catch (error) {
      toast.error('停止失败: ' + error)
    } finally {
      setIsStopping(false)
    }
  }

  const handleRestart = async () => {
    setIsRestarting(true)
    try {
      const result = await restartPostgresqlService(selectedEnvironment.id, serviceData)
      if (result.success) {
        toast.success('PostgreSQL 服务重启成功')
        await checkServiceStatus()
      } else {
        toast.error('重启失败: ' + result.message)
      }
    } catch (error) {
      toast.error('重启失败: ' + error)
    } finally {
      setIsRestarting(false)
    }
  }

  return (
    <BaseService service={serviceData}>
      {!isServiceActive ? (
        <Card className='shadow-none'>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              服务未激活，请先激活服务后再进行配置
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 服务状态卡片 */}
          <Card className='shadow-none'>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  服务状态
                </div>
                <Badge
                  variant={pgConfig?.isRunning ? "default" : "secondary"}
                  className={cn(
                    "shadow-none",
                    pgConfig?.isRunning && "bg-green-500 hover:bg-green-600"
                  )}
                >
                  {pgConfig?.isRunning ? "运行中" : "已停止"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleStart}
                  disabled={isStarting || pgConfig?.isRunning || isLoading}
                  className="shadow-none"
                >
                  <Play className="h-4 w-4 mr-1" />
                  启动
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStop}
                  disabled={isStopping || !pgConfig?.isRunning || isLoading}
                  className="shadow-none"
                >
                  <Square className="h-4 w-4 mr-1" />
                  停止
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRestart}
                  disabled={isRestarting || !pgConfig?.isRunning || isLoading}
                  className="shadow-none"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  重启
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 配置卡片 */}
          <Card className='shadow-none'>
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                服务配置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 数据目录配置 */}
              <div className="space-y-2">
                <Label className="flex items-center">
                  <Database className="h-4 w-4 mr-2" />
                  数据目录
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={pgConfig?.dataPath || ''}
                    onChange={(e) => setPgConfig(pgConfig ? { ...pgConfig, dataPath: e.target.value } : null)}
                    placeholder="请输入数据目录路径"
                    disabled={isLoading}
                    className="shadow-none"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pgConfig?.dataPath && handleDataPathChange(pgConfig.dataPath)}
                    disabled={isLoading}
                    className="shadow-none"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pgConfig?.dataPath && openFolderInFinder(pgConfig.dataPath)}
                    disabled={!pgConfig?.dataPath}
                    className="shadow-none"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 端口配置 */}
              <div className="space-y-2">
                <Label>端口</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={pgConfig?.port || 5432}
                    onChange={(e) => setPgConfig(pgConfig ? { ...pgConfig, port: parseInt(e.target.value) } : null)}
                    placeholder="5432"
                    disabled={isLoading}
                    className="shadow-none"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pgConfig?.port && handlePortChange(pgConfig.port)}
                    disabled={isLoading}
                    className="shadow-none"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    保存
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </BaseService>
  )
}
