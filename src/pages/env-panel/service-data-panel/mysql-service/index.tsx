import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from 'sonner'
import { 
  ExternalLink,
  Database,
  BarChart3,
  Play,
  Square,
  RefreshCw,
  FolderOpen,
  Settings,
  Terminal,
  Activity,
  Save,
  Copy
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseService } from '../base-service'
import { ServiceData } from '@/types/index'
import { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { selectedEnvironmentIdAtom } from '../../../../store/environment'
import {
  type MySQLConfig
} from '@/hooks/services/mysql'
import { useFileOperations } from "@/hooks/file-operations"
import { getMariadbConfig, getMariadbServiceStatus, startMariadbService, stopMariadbService, restartMariadbService, setMariadbDataPath, setMariadbLogPath } from "@/hooks/services/mariadb"

interface MySQLServiceProps {
  serviceData: ServiceData
}

export function MySQLService({ serviceData }: MySQLServiceProps) {
  const { openFolderInFinder } = useFileOperations()
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)
  
  // 检查服务是否激活
  const isServiceActive = ['running', 'active'].includes(serviceData.status)

  // MySQL 配置状态
  const [mysqlConfig, setMariadbConfig] = useState<MySQLConfig | null>(null)
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)
  
  // 当前选中的 Tab
  const [activeTab, setActiveTab] = useState('config')

  // 加载 MySQL 配置
  useEffect(() => {
    // 只有在服务激活时才加载配置
    if (isServiceActive) {
      loadMariadbConfig()
      // 每隔一秒刷新一次
      const timer = setInterval(() => {
        checkServiceStatus()
      }, 1000);
      return () => {
        clearInterval(timer)
      }
    } else {
      // 服务未激活时清空配置
      setMariadbConfig(null)
      return () => {} // 确保所有路径都有返回值
    }
  }, [isServiceActive])

  const loadMariadbConfig = async () => {
    // 只有在服务激活时才加载配置
    if (!isServiceActive) return
    
    setIsLoading(true)
    try {
      const result = await getMariadbConfig(selectedEnvironmentId, serviceData)
      if (result.success && result.config) {
        setMariadbConfig(result.config)
      } else {
        toast.error('加载 MySQL 配置失败: ' + result.message)
      }
    } catch (error) {
      toast.error('加载 MySQL 配置失败: ' + error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkServiceStatus = async () => {
    try {
      const result = await getMariadbServiceStatus(selectedEnvironmentId, serviceData)
      if (result.success) {
        setMariadbConfig(prev => (prev ? { ...prev, isRunning: result.isRunning || false } : prev))
      }
    } catch (error) {
      console.error('检查服务状态失败:', error)
    }
  }

  // 启动 MySQL 服务
  const startService = async () => {
    if (!serviceData?.version) return
    
    setIsStarting(true)
    try {
      const result = await startMariadbService(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success('MySQL 服务启动成功')
        checkServiceStatus()
      } else {
        toast.error('启动 MySQL 服务失败: ' + result.message)
      }
    } catch (error) {
      toast.error('启动 MySQL 服务失败: ' + error)
    } finally {
      setIsStarting(false)
    }
  }

  // 停止 MySQL 服务
  const stopService = async () => {
    if (!serviceData?.version) return
    
    setIsStopping(true)
    try {
      const result = await stopMariadbService(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success('MySQL 服务已停止')
        checkServiceStatus()
      } else {
        toast.error('停止 MySQL 服务失败: ' + result.message)
      }
    } catch (error) {
      toast.error('停止 MySQL 服务失败: ' + error)
    } finally {
      setIsStopping(false)
    }
  }

  // 重启 MySQL 服务
  const restartService = async () => {
    if (!serviceData?.version) return
    
    setIsRestarting(true)
    try {
      const result = await restartMariadbService(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success('MySQL 服务重启成功')
        checkServiceStatus()
      } else {
        toast.error('重启 MySQL 服务失败: ' + result.message)
      }
    } catch (error) {
      toast.error('重启 MySQL 服务失败: ' + error)
    } finally {
      setIsRestarting(false)
    }
  }

  // 设置数据目录
  const handleSetDataPath = async (dataPath: string) => {
    if (!serviceData?.version) return
    
    setIsLoading(true)
    try {
      const result = await setMariadbDataPath(selectedEnvironmentId, serviceData, dataPath)
      if (result.success) {
        toast.success('数据目录设置成功')
        loadMariadbConfig()
      } else {
        toast.error('设置数据目录失败: ' + result.message)
      }
    } catch (error) {
      toast.error('设置数据目录失败: ' + error)
    } finally {
      setIsLoading(false)
    }
  }

  // 设置日志目录
  const handleSetLogPath = async (logPath: string) => {
    if (!serviceData?.version) return
    
    setIsLoading(true)
    try {
      const result = await setMariadbLogPath(selectedEnvironmentId, serviceData, logPath)
      if (result.success) {
        toast.success('日志目录设置成功')
        loadMariadbConfig()
      } else {
        toast.error('设置日志目录失败: ' + result.message)
      }
    } catch (error) {
      toast.error('设置日志目录失败: ' + error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <BaseService service={serviceData}>
      {/* MySQL 状态卡片 */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            MySQL 服务状态
            {mysqlConfig?.isRunning && (
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <Activity className="h-3 w-3 mr-1" />
                运行中
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">版本</Label>
              <div className="text-sm font-medium">{serviceData.version}</div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">状态</Label>
              <div className={cn(
                "text-sm font-medium",
                isServiceActive ? "text-green-600" : "text-gray-500"
              )}>
                {isServiceActive ? '已激活' : '未激活'}
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">端口</Label>
              <div className="text-sm font-medium">
                {isServiceActive ? (mysqlConfig?.port || 3306) : '--'}
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">服务状态</Label>
              <div className={cn(
                "text-sm font-medium",
                isServiceActive && mysqlConfig?.isRunning ? "text-green-600" : "text-gray-500"
              )}>
                {isServiceActive ? (mysqlConfig?.isRunning ? '运行中' : '已停止') : '未激活'}
              </div>
            </div>
          </div>

          {/* 服务控制按钮 */}
          {isServiceActive && (
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={startService}
                disabled={isStarting || mysqlConfig?.isRunning}
                className="flex items-center gap-2 shadow-none"
              >
                {isStarting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                启动
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={stopService}
                disabled={isStopping || !mysqlConfig?.isRunning}
                className="flex items-center gap-2 shadow-none"
              >
                {isStopping ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                停止
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={restartService}
                disabled={isRestarting}
                className="flex items-center gap-2 shadow-none"
              >
                {isRestarting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                重启
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 详细配置 Tabs */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            配置管理
          </CardTitle>
          {!isServiceActive && (
            <p className="text-xs text-muted-foreground mt-1">
              服务未激活，配置功能已禁用
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {isServiceActive ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="config" className="text-xs">配置设置</TabsTrigger>
                <TabsTrigger value="connection" className="text-xs">连接信息</TabsTrigger>
              </TabsList>

              <TabsContent value="config" className="space-y-3 mt-3">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">配置文件</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={mysqlConfig?.configPath || ''}
                        onChange={(e) => mysqlConfig && setMariadbConfig({ ...mysqlConfig, configPath: e.target.value })}
                        placeholder="MySQL 配置文件路径"
                        disabled={isLoading}
                        className="flex-1 h-8 text-xs shadow-none bg-content2 dark:bg-content3"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (mysqlConfig?.configPath) {
                            navigator.clipboard.writeText(mysqlConfig.configPath)
                            toast.success('配置文件路径已复制到剪贴板')
                          } else {
                            toast.warning('配置文件路径为空')
                          }
                        }}
                        disabled={!mysqlConfig?.configPath}
                        className="h-8 px-2 shadow-none"
                        title="复制配置文件路径"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (mysqlConfig?.configPath) {
                            openFolderInFinder(mysqlConfig.configPath)
                          } else {
                            toast.warning('配置文件路径为空')
                          }
                        }}
                        disabled={!mysqlConfig?.configPath}
                        className="h-8 px-2 shadow-none"
                        title="打开配置文件目录"
                      >
                        <FolderOpen className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">数据目录</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={mysqlConfig?.dataPath || ''}
                        onChange={(e) => mysqlConfig && setMariadbConfig({ ...mysqlConfig, dataPath: e.target.value })}
                        placeholder="MySQL 数据目录路径"
                        disabled={true}
                        className="flex-1 h-8 text-xs shadow-none"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mysqlConfig?.dataPath && handleSetDataPath(mysqlConfig.dataPath)}
                        disabled={isLoading || !mysqlConfig?.dataPath}
                        className="h-8 px-2 shadow-none"
                        title="保存数据目录配置"
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (mysqlConfig?.dataPath) {
                            navigator.clipboard.writeText(mysqlConfig.dataPath)
                            toast.success('数据目录路径已复制到剪贴板')
                          } else {
                            toast.warning('数据目录路径为空')
                          }
                        }}
                        disabled={!mysqlConfig?.dataPath}
                        className="h-8 px-2 shadow-none"
                        title="复制数据目录路径"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (mysqlConfig?.dataPath) {
                            openFolderInFinder(mysqlConfig.dataPath)
                          } else {
                            toast.warning('数据目录路径为空')
                          }
                        }}
                        disabled={!mysqlConfig?.dataPath}
                        className="h-8 px-2 shadow-none"
                        title="打开数据目录"
                      >
                        <FolderOpen className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">日志目录</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={mysqlConfig?.logPath || ''}
                        onChange={(e) => mysqlConfig && setMariadbConfig({ ...mysqlConfig, logPath: e.target.value })}
                        placeholder="MySQL 日志目录路径"
                        disabled={true}
                        className="flex-1 h-8 text-xs shadow-none"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mysqlConfig?.logPath && handleSetLogPath(mysqlConfig.logPath)}
                        disabled={isLoading || !mysqlConfig?.logPath}
                        className="h-8 px-2 shadow-none"
                        title="保存日志目录配置"
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (mysqlConfig?.logPath) {
                            navigator.clipboard.writeText(mysqlConfig.logPath)
                            toast.success('日志目录路径已复制到剪贴板')
                          } else {
                            toast.warning('日志目录路径为空')
                          }
                        }}
                        disabled={!mysqlConfig?.logPath}
                        className="h-8 px-2 shadow-none"
                        title="复制日志目录路径"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (mysqlConfig?.logPath) {
                            openFolderInFinder(mysqlConfig.logPath)
                          } else {
                            toast.warning('日志目录路径为空')
                          }
                        }}
                        disabled={!mysqlConfig?.logPath}
                        className="h-8 px-2 shadow-none"
                        title="打开日志目录"
                      >
                        <FolderOpen className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="connection" className="space-y-3 mt-3">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">主机</Label>
                    <Input value={mysqlConfig?.bindIp || 'localhost'} readOnly className="text-xs h-8 mt-1 shadow-none" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">端口</Label>
                    <Input value={mysqlConfig?.port || 3306} readOnly className="text-xs h-8 mt-1 shadow-none" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">管理界面</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toast.info('推荐使用 MySQL Workbench 或 DBeaver 等工具')
                        }}
                        className="flex items-center gap-1 h-8 text-xs shadow-none"
                      >
                        <ExternalLink className="h-3 w-3" />
                        MySQL Workbench
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toast.info('可以使用 mysql 客户端连接到数据库')
                        }}
                        className="flex items-center gap-1 h-8 text-xs shadow-none"
                      >
                        <Terminal className="h-3 w-3" />
                        MySQL Client
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Settings className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">服务未激活，无法显示配置信息</p>
              <p className="text-xs">请先激活 MySQL 服务</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 快速操作 */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            快速操作
          </CardTitle>
          {!isServiceActive && (
            <p className="text-xs text-muted-foreground mt-1">
              服务未激活，快速操作功能已禁用
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {isServiceActive ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">快速操作功能待完善</p>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <BarChart3 className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">服务未激活，无法使用快速操作</p>
              <p className="text-xs">请先激活 MySQL 服务</p>
            </div>
          )}
        </CardContent>
      </Card>
    </BaseService>
  )
}
