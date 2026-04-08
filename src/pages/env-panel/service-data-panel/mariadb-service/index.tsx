import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from 'sonner'
import {
  Database,
  BarChart3,
  RefreshCw,
  FolderOpen,
  Settings,
  Terminal,
  AlertTriangle,
  Key,
  Eye,
  EyeOff,
  Power,
  PowerOff,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  RotateCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ServiceData, ServiceDataStatus, ServiceStatus } from '@/types/index'
import { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { selectedEnvironmentIdAtom } from '../../../../store/environment'
import { useMariadb } from '@/hooks/services/mariadb'
import { useFileOperations } from "@/hooks/file-operations"
import { MariaDBMetadata } from "@/types/service"
import { useEnvironmentServiceData, useServiceData } from "@/hooks/env-serv-data"
import { useServiceActivationStatus, useServiceProcessStatus } from '@/hooks/service-pollers'

interface MariaDBServiceProps {
  serviceData: ServiceData
}

export function MariaDBService({ serviceData }: MariaDBServiceProps) {
  const { openFolderInFinder } = useFileOperations()
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)

  // 检查服务是否激活
  const isServiceActive = [ServiceDataStatus.Active].includes(serviceData.status)

  // 初始化状态
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [showInitDialog, setShowInitDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)

  const { status: serviceStatus, refresh: refreshServiceStatus } = useServiceProcessStatus(selectedEnvironmentId, serviceData, {
    enabled: isServiceActive && Boolean(isInitialized),
    interval: 500,
  })
  const { activationStatus } = useServiceActivationStatus(selectedEnvironmentId, serviceData.id, {
    enabled: true,
    interval: 500,
  })

  // 弹窗数据
  const [dialogData, setDialogData] = useState({
    rootPassword: '',
    port: '3306',
    bindAddress: '127.0.0.1',
    showAdvanced: false,
  })

  // 密码显示状态
  const [showPassword, setShowPassword] = useState(false)

  // 加载状态
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)

  // 数据库管理相关状态
  const [databases, setDatabases] = useState<Array<{
    name: string,
    tables?: string[],
    isLoadingTables?: boolean,
    showTables?: boolean,
    showAllTables?: boolean,
  }>>([])
  const [showAllDatabases, setShowAllDatabases] = useState(false)
  const [showCreateDbDialog, setShowCreateDbDialog] = useState(false)
  const [newDbName, setNewDbName] = useState('')
  const [isCreatingDb, setIsCreatingDb] = useState(false)

  const {
    getMariadbConfig,
    initializeMariadb,
    checkMariadbInitialized,
    listMariadbDatabases,
    createMariadbDatabase,
    listMariadbTables,
    openMariadbClient,
  } = useMariadb()

  const {
    startServiceData,
    stopServiceData,
    restartServiceData,
  } = useServiceData()

  const {
    updateServiceData,
    selectedServiceDatas,
  } = useEnvironmentServiceData()

  // 激活状态变化时回写到 store，驱动面板自动同步
  useEffect(() => {
    if (activationStatus === ServiceDataStatus.Unknown || activationStatus === serviceData.status) {
      return
    }

    updateServiceData({
      environmentId: selectedEnvironmentId,
      serviceId: serviceData.id,
      updates: { status: activationStatus },
      serviceDatasSnapshot: selectedServiceDatas,
    }).catch((error) => {
      console.error('回写 MariaDB 激活状态失败:', error)
    })
  }, [
    activationStatus,
    selectedEnvironmentId,
    serviceData.id,
    serviceData.status,
    selectedServiceDatas,
    updateServiceData,
  ])

  // 检查初始化状态
  useEffect(() => {
    if (isServiceActive) {
      checkInitialized()
    }
  }, [isServiceActive])

  // 定时刷新数据库列表（每3秒）
  useEffect(() => {
    if (isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running) {
      loadDatabases()
      const timer = setInterval(() => {
        loadDatabases()
      }, 3000)
      return () => clearInterval(timer)
    } else {
      setDatabases([])
      return () => {}
    }
  }, [isServiceActive, isInitialized, serviceStatus])

  const checkInitialized = async () => {
    try {
      const result = await checkMariadbInitialized(selectedEnvironmentId, serviceData)
      if (result.success && result.data) {
        setIsInitialized(result.data.initialized)
      }
    } catch (error) {
      console.error('检查 MariaDB 初始化状态失败:', error)
    }
  }

  // 加载数据库列表
  const loadDatabases = async () => {
    if (!isServiceActive || !isInitialized || serviceStatus !== ServiceStatus.Running) {
      setDatabases([])
      return
    }
    try {
      const result = await listMariadbDatabases(selectedEnvironmentId, serviceData)
      if (result.success && result.data?.databases) {
        setDatabases(prev => {
          const newDatabases = result.data!.databases.map((name: string) => {
            const existing = prev.find(d => d.name === name)
            return {
              name,
              tables: existing?.tables,
              isLoadingTables: existing?.isLoadingTables || false,
              showTables: existing?.showTables || false,
              showAllTables: existing?.showAllTables || false,
            }
          })
          return newDatabases
        })
      }
    } catch (error) {
      console.error('加载数据库列表失败:', error)
    }
  }

  // 加载指定数据库的表列表
  const loadTables = async (databaseName: string) => {
    setDatabases(prev => prev.map(db =>
      db.name === databaseName ? { ...db, isLoadingTables: true } : db
    ))
    try {
      const result = await listMariadbTables(selectedEnvironmentId, serviceData, databaseName)
      if (result.success && result.data?.tables) {
        setDatabases(prev => prev.map(db =>
          db.name === databaseName
            ? { ...db, tables: result.data!.tables, isLoadingTables: false, showTables: true }
            : db
        ))
      }
    } catch (error) {
      console.error(`加载数据库 ${databaseName} 的表列表失败:`, error)
      setDatabases(prev => prev.map(db =>
        db.name === databaseName ? { ...db, isLoadingTables: false } : db
      ))
    }
  }

  // 切换表显示状态
  const toggleTables = (databaseName: string) => {
    const db = databases.find(d => d.name === databaseName)
    if (!db) return
    if (db.showTables) {
      setDatabases(prev => prev.map(d =>
        d.name === databaseName ? { ...d, showTables: false } : d
      ))
    } else {
      if (!db.tables) {
        loadTables(databaseName)
      } else {
        setDatabases(prev => prev.map(d =>
          d.name === databaseName ? { ...d, showTables: true } : d
        ))
      }
    }
  }

  // 切换显示所有表
  const toggleAllTables = (databaseName: string) => {
    setDatabases(prev => prev.map(d =>
      d.name === databaseName ? { ...d, showAllTables: !d.showAllTables } : d
    ))
  }

  // 创建数据库
  const handleCreateDatabase = async () => {
    if (!newDbName) return
    setIsCreatingDb(true)
    try {
      const result = await createMariadbDatabase(selectedEnvironmentId, serviceData, newDbName)
      if (result.success) {
        toast.success('数据库创建成功')
        setShowCreateDbDialog(false)
        setNewDbName('')
        loadDatabases()
      } else {
        toast.error('创建数据库失败: ' + result.message)
      }
    } catch (error) {
      toast.error('创建数据库失败: ' + error)
    } finally {
      setIsCreatingDb(false)
    }
  }

  // 启动服务
  const startService = async () => {
    if (!serviceData?.version) return
    setIsStarting(true)
    try {
      const result = await startServiceData(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success('MariaDB 服务启动成功')
        refreshServiceStatus()
      } else {
        toast.error('启动 MariaDB 服务失败: ' + result.message)
      }
    } catch (error) {
      toast.error('启动 MariaDB 服务失败: ' + error)
    } finally {
      setIsStarting(false)
    }
  }

  // 停止服务
  const stopService = async () => {
    if (!serviceData?.version) return
    setIsStopping(true)
    try {
      const result = await stopServiceData(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success('MariaDB 服务已停止')
        refreshServiceStatus()
      } else {
        toast.error('停止 MariaDB 服务失败: ' + result.message)
      }
    } catch (error) {
      toast.error('停止 MariaDB 服务失败: ' + error)
    } finally {
      setIsStopping(false)
    }
  }

  // 重启服务
  const restartService = async () => {
    if (!serviceData?.version) return
    setIsRestarting(true)
    try {
      const result = await restartServiceData(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success('MariaDB 服务重启成功')
        refreshServiceStatus()
      } else {
        toast.error('重启 MariaDB 服务失败: ' + result.message)
      }
    } catch (error) {
      toast.error('重启 MariaDB 服务失败: ' + error)
    } finally {
      setIsRestarting(false)
    }
  }

  // 初始化 MariaDB
  const handleInitialize = async (reset: boolean = false) => {
    if (!dialogData.rootPassword) {
      toast.error('请输入 root 密码')
      return
    }
    if (reset && serviceStatus === ServiceStatus.Running) {
      toast.error('MariaDB 正在运行中，请先停止服务后再进行重置')
      return
    }
    setIsInitializing(true)
    try {
      const result = await initializeMariadb(
        selectedEnvironmentId,
        serviceData,
        dialogData.rootPassword,
        dialogData.port,
        dialogData.bindAddress,
        reset
      )
      if (result.success && result.data) {
        const data = result.data
        const newMetadata: MariaDBMetadata = { ...(serviceData.metadata || {}) }
        newMetadata['MARIADB_CONFIG'] = data.configPath
        newMetadata['MARIADB_ROOT_PASSWORD'] = data.rootPassword
        await updateServiceData({
          environmentId: selectedEnvironmentId,
          serviceId: serviceData.id,
          updates: { metadata: newMetadata },
          serviceDatasSnapshot: selectedServiceDatas,
        })
        toast.success('MariaDB 初始化成功')
        setShowInitDialog(false)
        setShowResetDialog(false)
        setIsInitialized(true)
      } else {
        toast.error(result.message || 'MariaDB 初始化失败')
      }
    } catch (error) {
      toast.error('初始化失败: ' + error)
    } finally {
      setIsInitializing(false)
    }
  }

  const configPath = serviceData.metadata?.['MARIADB_CONFIG'] || ''

  return (
    <div className="p-3">
      {/* 初始化对话框 */}
      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              初始化 MariaDB
            </DialogTitle>
            <DialogDescription>
              首次使用需要初始化 MariaDB。系统将创建配置文件、数据目录，并设置 root 账户。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="root-password">Root 密码</Label>
              <Input
                id="root-password"
                type="password"
                value={dialogData.rootPassword}
                onChange={(e) => setDialogData(prev => ({ ...prev, rootPassword: e.target.value }))}
                placeholder="输入 root 密码"
                disabled={isInitializing}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogData(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
              className="w-full"
              type="button"
            >
              {dialogData.showAdvanced ? '隐藏高级选项' : '显示高级选项'}
            </Button>
            {dialogData.showAdvanced && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="init-port">端口</Label>
                  <Input
                    id="init-port"
                    value={dialogData.port}
                    onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="3306"
                    disabled={isInitializing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="init-bind-address">绑定地址</Label>
                  <Input
                    id="init-bind-address"
                    value={dialogData.bindAddress}
                    onChange={(e) => setDialogData(prev => ({ ...prev, bindAddress: e.target.value }))}
                    placeholder="127.0.0.1"
                    disabled={isInitializing}
                  />
                  <p className="text-xs text-muted-foreground">
                    默认仅本地访问。如需远程访问请设置为 0.0.0.0
                  </p>
                </div>
              </>
            )}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                请牢记 root 密码。初始化包含：创建配置文件、数据目录和 root 账户。
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitDialog(false)} disabled={isInitializing} className="shadow-none">
              取消
            </Button>
            <Button
              onClick={() => handleInitialize(false)}
              disabled={isInitializing || !dialogData.rootPassword}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  初始化中...
                </>
              ) : '开始初始化'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置初始化对话框 */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              重置 MariaDB
            </DialogTitle>
            <DialogDescription>
              重置将删除所有现有数据、配置文件和用户信息，然后重新初始化 MariaDB。
              <span className="text-red-600 font-semibold">此操作不可恢复！</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!isInitializing && serviceStatus === ServiceStatus.Running && (
              <Alert variant="destructive" className="p-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>MariaDB 正在运行中！</strong> 请先停止 MariaDB 服务后再进行重置。
                  </AlertDescription>
                </div>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="reset-root-password">新 Root 密码</Label>
              <Input
                id="reset-root-password"
                type="password"
                value={dialogData.rootPassword}
                onChange={(e) => setDialogData(prev => ({ ...prev, rootPassword: e.target.value }))}
                placeholder="输入新 root 密码"
                disabled={isInitializing}
                className="shadow-none"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogData(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
              className="w-full"
            >
              {dialogData.showAdvanced ? '隐藏高级选项' : '显示高级选项'}
            </Button>
            {dialogData.showAdvanced && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reset-port">端口</Label>
                  <Input
                    id="reset-port"
                    value={dialogData.port}
                    onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="3306"
                    disabled={isInitializing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-bind-address">绑定地址</Label>
                  <Input
                    id="reset-bind-address"
                    value={dialogData.bindAddress}
                    onChange={(e) => setDialogData(prev => ({ ...prev, bindAddress: e.target.value }))}
                    placeholder="127.0.0.1"
                    disabled={isInitializing}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)} disabled={isInitializing} className="shadow-none">
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleInitialize(true)}
              disabled={isInitializing || !dialogData.rootPassword || serviceStatus === ServiceStatus.Running}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  重置中...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  确认重置
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="w-full space-y-3">
        {/* 未初始化提示 */}
        {isServiceActive && isInitialized === false && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                  MariaDB 尚未初始化
                </p>
                <p className="text-[11px] text-orange-700 dark:text-orange-400 leading-relaxed">
                  首次使用需要初始化配置文件、数据目录，并创建 root 账户。
                </p>
              </div>
            </div>
            <div className="flex">
              <Button
                size="sm"
                onClick={() => setShowInitDialog(true)}
                className="h-7 text-xs shadow-none bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white"
              >
                立即初始化
              </Button>
            </div>
          </div>
        )}

        {/* 服务控制 */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              服务控制
            </Label>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                serviceStatus === ServiceStatus.Running ? "bg-green-500" :
                  serviceStatus === ServiceStatus.Stopped ? "bg-red-500" : "bg-gray-300"
              )} />
              <span className="text-xs font-normal text-muted-foreground">
                {serviceStatus === ServiceStatus.Running ? '运行中' :
                  serviceStatus === ServiceStatus.Stopped ? '已停止' : '未知状态'}
              </span>
            </div>
          </div>
          {isServiceActive && isInitialized && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                onClick={startService}
                disabled={serviceStatus === ServiceStatus.Running || isStarting || isStopping || isRestarting}
              >
                {isStarting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Power className="h-3.5 w-3.5 text-green-600" />
                )}
                启动
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                onClick={stopService}
                disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
              >
                <PowerOff className="h-3.5 w-3.5 text-red-600" />
                停止
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                onClick={restartService}
                disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
              >
                <RotateCw className={cn("h-3.5 w-3.5 text-blue-600", isRestarting && "animate-spin")} />
                重启
              </Button>
            </div>
          )}
        </div>

        {/* 配置管理 */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          {isServiceActive && isInitialized ? (
            <div className="space-y-4">
              {/* 配置文件路径 */}
              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">配置文件</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={configPath}
                    readOnly
                    placeholder="MariaDB 配置文件路径"
                    className="flex-1 h-8 text-xs shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => configPath && openFolderInFinder(configPath)}
                    disabled={!configPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    title="打开配置文件目录"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Root 密码 */}
              <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Root 密码</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={serviceData.metadata?.['MARIADB_ROOT_PASSWORD'] || '未设置'}
                    readOnly
                    className="h-8 text-xs shadow-none bg-muted cursor-not-allowed pr-10 border-gray-200 dark:border-white/10"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={!serviceData.metadata?.['MARIADB_ROOT_PASSWORD']}
                    className="absolute right-1 top-0 h-8 w-8 p-0 hover:bg-transparent"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3 w-3 text-gray-500" />
                    ) : (
                      <Eye className="h-3 w-3 text-gray-500" />
                    )}
                  </Button>
                </div>
              </div>

              {/* 连接信息 */}
              <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">管理工具</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const result = await openMariadbClient(selectedEnvironmentId, serviceData)
                        if (result.success) {
                          toast.success('MariaDB 客户端已打开')
                        } else {
                          toast.error(result.message || '打开 MariaDB 客户端失败')
                        }
                      } catch (error) {
                        toast.error('打开 MariaDB 客户端失败: ' + error)
                      }
                    }}
                    disabled={serviceStatus !== ServiceStatus.Running}
                    className="flex items-center gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    MariaDB Client
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Settings className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {!isServiceActive ? (
                <>
                  <p className="text-sm">服务未激活，无法显示配置信息</p>
                  <p className="text-xs">请先激活 MariaDB 服务</p>
                </>
              ) : (
                <>
                  <p className="text-sm">MariaDB 尚未初始化</p>
                  <p className="text-xs">请先完成初始化</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* 数据库管理 */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              数据库管理
            </Label>
            {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDbDialog(true)}
                className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
              >
                <Plus className="h-3 w-3 mr-1" />
                新建数据库
              </Button>
            )}
          </div>

          {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running ? (
            <div className="space-y-2">
              {databases.length > 0 ? (
                <div className="space-y-1 border rounded-lg p-2 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10">
                  {(showAllDatabases ? databases : databases.slice(0, 4)).map((db) => (
                    <div key={db.name} className="text-xs">
                      {/* 数据库行 */}
                      <div
                        onClick={() => toggleTables(db.name)}
                        className="flex items-center justify-between p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Database className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                          <span className="font-medium truncate text-gray-700 dark:text-gray-300">{db.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 flex-shrink-0 hover:bg-transparent"
                          disabled={db.isLoadingTables}
                        >
                          {db.isLoadingTables ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : db.showTables ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                      </div>

                      {/* 表列表 */}
                      {db.showTables && db.tables && (
                        <div className="pl-6 pr-2 pb-2">
                          {db.tables.length > 0 ? (
                            <div className="space-y-0.5 mt-1">
                              {(db.showAllTables ? db.tables : db.tables.slice(0, 4)).map((table) => (
                                <div
                                  key={table}
                                  className="flex items-center gap-1.5 py-1 px-1.5 rounded text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                                >
                                  <div className="h-1 w-1 rounded-full bg-gray-400 flex-shrink-0" />
                                  <span className="truncate">{table}</span>
                                </div>
                              ))}
                              {db.tables.length > 4 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleAllTables(db.name)}
                                  className="w-full h-6 text-xs text-gray-500 hover:text-foreground mt-1"
                                >
                                  {db.showAllTables ? (
                                    <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      收起 ({db.tables.length - 4} 个)
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      还有 {db.tables.length - 4} 张表
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 text-center py-2">暂无表</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {databases.length > 4 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllDatabases(!showAllDatabases)}
                      className="w-full h-7 text-xs shadow-none text-gray-500"
                    >
                      {showAllDatabases ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5 mr-1" />
                          收起 ({databases.length - 4} 个数据库)
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5 mr-1" />
                          还有 {databases.length - 4} 个数据库
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed border-gray-200 dark:border-white/10">
                  暂无数据库
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Database className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {!isServiceActive ? (
                <>
                  <p className="text-sm">服务未激活</p>
                  <p className="text-xs">无法管理数据库</p>
                </>
              ) : !isInitialized ? (
                <>
                  <p className="text-sm">MariaDB 尚未初始化</p>
                  <p className="text-xs">请先完成初始化</p>
                </>
              ) : (
                <>
                  <p className="text-sm">服务未运行</p>
                  <p className="text-xs">请先启动服务</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* 创建数据库对话框 */}
        <Dialog open={showCreateDbDialog} onOpenChange={setShowCreateDbDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新建数据库</DialogTitle>
              <DialogDescription>
                创建一个新的 MariaDB 数据库。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="db-name">数据库名称</Label>
                <Input
                  id="db-name"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  placeholder="输入数据库名称"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newDbName) {
                      handleCreateDatabase()
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button className="shadow-none" variant="outline" onClick={() => setShowCreateDbDialog(false)}>
                取消
              </Button>
              <Button onClick={handleCreateDatabase} disabled={!newDbName || isCreatingDb}>
                {isCreatingDb ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 其他操作 */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            其他操作
          </Label>
          {isServiceActive && isInitialized ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResetDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                重置初始化
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <BarChart3 className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">服务未激活</p>
              <p className="text-xs">无法使用其他操作</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

