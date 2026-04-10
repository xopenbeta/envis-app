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
  Users,
  UserPlus,
  Trash2,
  Pencil,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Environment, ServiceData, ServiceDataStatus, ServiceStatus } from '@/types/index'
import { useState, useEffect } from 'react'
import { usePostgresqlService, PostgreSQLConfig, PostgreSQLRole, PostgreSQLGrant } from '@/hooks/services/postgresql'
import { useFileOperations } from "@/hooks/file-operations"
import { PostgreSQLMetadata } from "@/types/service"
import { useEnvironmentServiceData } from "@/hooks/env-serv-data"
import { useServiceDataStatus, useServiceStatus } from '@/hooks/service-pollers'

interface PostgreSQLServiceProps {
  serviceData: ServiceData
  selectedEnvironment: Environment
}

export function PostgreSQLService({ serviceData, selectedEnvironment }: PostgreSQLServiceProps) {
  const { openFolderInFinder } = useFileOperations()

  const [isInitialized, setIsInitialized] = useState<boolean | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [showInitDialog, setShowInitDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)

  const { serviceDataStatus } = useServiceDataStatus(selectedEnvironment.id, serviceData.id, {
    enabled: true,
    interval: 500,
  })

  const isServiceActive = serviceDataStatus === ServiceDataStatus.Active

  const { status: serviceStatus, refresh: refreshServiceStatus } = useServiceStatus(selectedEnvironment.id, serviceData, {
    enabled: isServiceActive && Boolean(isInitialized),
    interval: 500,
  })

  const [dialogData, setDialogData] = useState({
    superPassword: '',
    port: '5432',
    bindAddress: '127.0.0.1',
    showAdvanced: false,
  })

  const [showPassword, setShowPassword] = useState(false)
  const [postgresqlConfig, setPostgresqlConfig] = useState<PostgreSQLConfig | null>(null)

  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)

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

  const [roles, setRoles] = useState<PostgreSQLRole[]>([])
  const [showCreateRoleDialog, setShowCreateRoleDialog] = useState(false)
  const [showEditRoleDialog, setShowEditRoleDialog] = useState(false)
  const [showDeleteRoleDialog, setShowDeleteRoleDialog] = useState(false)
  const [selectedRoleName, setSelectedRoleName] = useState('')
  const [isSubmittingRole, setIsSubmittingRole] = useState(false)
  const [roleForm, setRoleForm] = useState<{
    roleName: string
    password: string
    grants: Record<string, 'SELECT' | 'ALL PRIVILEGES'>
    customDb: string
  }>({
    roleName: '',
    password: '',
    grants: {},
    customDb: '',
  })

  const {
    getPostgresqlConfig,
    startPostgresqlService,
    stopPostgresqlService,
    restartPostgresqlService,
    initializePostgresql,
    checkPostgresqlInitialized,
    listPostgresqlDatabases,
    createPostgresqlDatabase,
    listPostgresqlTables,
    openPostgresqlClient,
    listPostgresqlRoles,
    createPostgresqlRole,
    deletePostgresqlRole,
    updatePostgresqlRoleGrants,
  } = usePostgresqlService()

  const {
    updateServiceData,
    selectedServiceDatas,
  } = useEnvironmentServiceData()

  useEffect(() => {
    if (serviceDataStatus === ServiceDataStatus.Unknown || serviceDataStatus === serviceData.status) {
      return
    }

    updateServiceData({
      environmentId: selectedEnvironment.id,
      serviceId: serviceData.id,
      updates: { status: serviceDataStatus },
      serviceDatasSnapshot: selectedServiceDatas,
    }).catch((error) => {
      console.error('回写 PostgreSQL 激活状态失败:', error)
    })
  }, [
    serviceDataStatus,
    selectedEnvironment.id,
    serviceData.id,
    serviceData.status,
    selectedServiceDatas,
    updateServiceData,
  ])

  useEffect(() => {
    if (isServiceActive) {
      checkInitialized()
    }
  }, [isServiceActive])

  useEffect(() => {
    if (isServiceActive && isInitialized) {
      loadPostgresqlConfig()
    } else {
      setPostgresqlConfig(null)
    }
  }, [isServiceActive, isInitialized])

  useEffect(() => {
    if (isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running) {
      loadDatabases()
      const timer = setInterval(() => {
        void loadDatabases()
      }, 3000)
      return () => clearInterval(timer)
    }

    setDatabases([])
    return () => {}
  }, [isServiceActive, isInitialized, serviceStatus])

  useEffect(() => {
    if (isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running) {
      loadRoles()
      const timer = setInterval(() => {
        void loadRoles()
      }, 3000)
      return () => clearInterval(timer)
    }

    setRoles([])
    return () => {}
  }, [isServiceActive, isInitialized, serviceStatus])

  const checkInitialized = async () => {
    try {
      const result = await checkPostgresqlInitialized(selectedEnvironment.id, serviceData)
      if (result.success && result.data) {
        setIsInitialized(result.data.initialized)
      }
    } catch (error) {
      console.error('检查 PostgreSQL 初始化状态失败:', error)
    }
  }

  const loadPostgresqlConfig = async () => {
    try {
      const result = await getPostgresqlConfig(selectedEnvironment.id, serviceData)
      if (result.success && result.config) {
        setPostgresqlConfig(result.config)
      }
    } catch (error) {
      console.error('加载 PostgreSQL 配置失败:', error)
    }
  }

  const loadDatabases = async () => {
    if (!isServiceActive || !isInitialized || serviceStatus !== ServiceStatus.Running) {
      setDatabases([])
      return
    }

    try {
      const result = await listPostgresqlDatabases(selectedEnvironment.id, serviceData)
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
      console.error('加载 PostgreSQL 数据库列表失败:', error)
    }
  }

  const loadTables = async (databaseName: string) => {
    setDatabases(prev => prev.map(db =>
      db.name === databaseName ? { ...db, isLoadingTables: true } : db
    ))

    try {
      const result = await listPostgresqlTables(selectedEnvironment.id, serviceData, databaseName)
      if (result.success && result.data?.tables) {
        setDatabases(prev => prev.map(db =>
          db.name === databaseName
            ? { ...db, tables: result.data!.tables, isLoadingTables: false, showTables: true }
            : db
        ))
      }
    } catch (error) {
      console.error(`加载数据库 ${databaseName} 的表失败:`, error)
      setDatabases(prev => prev.map(db =>
        db.name === databaseName ? { ...db, isLoadingTables: false } : db
      ))
    }
  }

  const loadRoles = async () => {
    if (!isServiceActive || !isInitialized || serviceStatus !== ServiceStatus.Running) {
      setRoles([])
      return
    }

    try {
      const result = await listPostgresqlRoles(selectedEnvironment.id, serviceData)
      if (result.success && result.data?.roles) {
        setRoles(result.data.roles as PostgreSQLRole[])
      }
    } catch (error) {
      console.error('加载 PostgreSQL 角色列表失败:', error)
    }
  }

  const toggleTables = (databaseName: string) => {
    const db = databases.find(d => d.name === databaseName)
    if (!db) return

    if (db.showTables) {
      setDatabases(prev => prev.map(d =>
        d.name === databaseName ? { ...d, showTables: false } : d
      ))
      return
    }

    if (!db.tables) {
      void loadTables(databaseName)
    } else {
      setDatabases(prev => prev.map(d =>
        d.name === databaseName ? { ...d, showTables: true } : d
      ))
    }
  }

  const toggleAllTables = (databaseName: string) => {
    setDatabases(prev => prev.map(d =>
      d.name === databaseName ? { ...d, showAllTables: !d.showAllTables } : d
    ))
  }

  const handleCreateDatabase = async () => {
    if (!newDbName) return

    setIsCreatingDb(true)
    try {
      const result = await createPostgresqlDatabase(selectedEnvironment.id, serviceData, newDbName)
      if (result.success) {
        toast.success('数据库创建成功')
        setShowCreateDbDialog(false)
        setNewDbName('')
        void loadDatabases()
      } else {
        toast.error('创建数据库失败: ' + result.message)
      }
    } catch (error) {
      toast.error('创建数据库失败: ' + error)
    } finally {
      setIsCreatingDb(false)
    }
  }

  const handleCreateRole = async () => {
    if (!roleForm.roleName || !roleForm.password) return

    setIsSubmittingRole(true)
    try {
      const grants: PostgreSQLGrant[] = Object.entries(roleForm.grants).map(([database, privilege]) => ({
        database,
        privilege,
      }))
      const result = await createPostgresqlRole(selectedEnvironment.id, serviceData, roleForm.roleName, roleForm.password, grants)
      if (result.success) {
        toast.success(`角色 '${roleForm.roleName}' 创建成功`)
        setShowCreateRoleDialog(false)
        setRoleForm({ roleName: '', password: '', grants: {}, customDb: '' })
        void loadRoles()
      } else {
        toast.error('创建角色失败: ' + result.message)
      }
    } catch (error) {
      toast.error('创建角色失败: ' + error)
    } finally {
      setIsSubmittingRole(false)
    }
  }

  const openEditRoleDialog = (role: PostgreSQLRole) => {
    const grantsMap: Record<string, 'SELECT' | 'ALL PRIVILEGES'> = {}
    for (const g of role.grants) {
      grantsMap[g.database] = g.privilege as 'SELECT' | 'ALL PRIVILEGES'
    }
    setSelectedRoleName(role.roleName)
    setRoleForm({ roleName: role.roleName, password: '', grants: grantsMap, customDb: '' })
    setShowEditRoleDialog(true)
  }

  const handleUpdateRoleGrants = async () => {
    if (!selectedRoleName) return

    setIsSubmittingRole(true)
    try {
      const grants: PostgreSQLGrant[] = Object.entries(roleForm.grants).map(([database, privilege]) => ({
        database,
        privilege,
      }))
      const result = await updatePostgresqlRoleGrants(selectedEnvironment.id, serviceData, selectedRoleName, grants)
      if (result.success) {
        toast.success(`角色 '${selectedRoleName}' 权限更新成功`)
        setShowEditRoleDialog(false)
        void loadRoles()
      } else {
        toast.error('更新权限失败: ' + result.message)
      }
    } catch (error) {
      toast.error('更新权限失败: ' + error)
    } finally {
      setIsSubmittingRole(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!selectedRoleName) return

    setIsSubmittingRole(true)
    try {
      const result = await deletePostgresqlRole(selectedEnvironment.id, serviceData, selectedRoleName)
      if (result.success) {
        toast.success(`角色 '${selectedRoleName}' 删除成功`)
        setShowDeleteRoleDialog(false)
        void loadRoles()
      } else {
        toast.error('删除角色失败: ' + result.message)
      }
    } catch (error) {
      toast.error('删除角色失败: ' + error)
    } finally {
      setIsSubmittingRole(false)
    }
  }

  const startService = async () => {
    if (!serviceData?.version) return

    setIsStarting(true)
    try {
      const result = await startPostgresqlService(selectedEnvironment.id, serviceData)
      if (result.success) {
        toast.success('PostgreSQL 服务启动成功')
        void refreshServiceStatus()
      } else {
        toast.error('启动 PostgreSQL 服务失败: ' + result.message)
      }
    } catch (error) {
      toast.error('启动 PostgreSQL 服务失败: ' + error)
    } finally {
      setIsStarting(false)
    }
  }

  const stopService = async () => {
    if (!serviceData?.version) return

    setIsStopping(true)
    try {
      const result = await stopPostgresqlService(selectedEnvironment.id, serviceData)
      if (result.success) {
        toast.success('PostgreSQL 服务已停止')
        void refreshServiceStatus()
      } else {
        toast.error('停止 PostgreSQL 服务失败: ' + result.message)
      }
    } catch (error) {
      toast.error('停止 PostgreSQL 服务失败: ' + error)
    } finally {
      setIsStopping(false)
    }
  }

  const restartService = async () => {
    if (!serviceData?.version) return

    setIsRestarting(true)
    try {
      const result = await restartPostgresqlService(selectedEnvironment.id, serviceData)
      if (result.success) {
        toast.success('PostgreSQL 服务重启成功')
        void refreshServiceStatus()
      } else {
        toast.error('重启 PostgreSQL 服务失败: ' + result.message)
      }
    } catch (error) {
      toast.error('重启 PostgreSQL 服务失败: ' + error)
    } finally {
      setIsRestarting(false)
    }
  }

  const handleInitialize = async (reset: boolean = false) => {
    if (!dialogData.superPassword) {
      toast.error('请输入 postgres 超级用户密码')
      return
    }

    if (reset && serviceStatus === ServiceStatus.Running) {
      toast.error('PostgreSQL 正在运行中，请先停止服务后再进行重置')
      return
    }

    setIsInitializing(true)
    try {
      const result = await initializePostgresql(
        selectedEnvironment.id,
        serviceData,
        dialogData.superPassword,
        dialogData.port,
        dialogData.bindAddress,
        reset
      )

      if (result.success && result.data) {
        const data = result.data
        const newMetadata: PostgreSQLMetadata = { ...(serviceData.metadata || {}) }
        newMetadata.POSTGRESQL_CONFIG = data.configPath
        newMetadata.POSTGRESQL_SUPER_PASSWORD = data.superPassword
        newMetadata.PGDATA = data.dataPath
        newMetadata.PGPORT = data.port
        newMetadata.PGHOST = data.bindAddress

        await updateServiceData({
          environmentId: selectedEnvironment.id,
          serviceId: serviceData.id,
          updates: { metadata: newMetadata },
          serviceDatasSnapshot: selectedServiceDatas,
        })

        toast.success('PostgreSQL 初始化成功')
        setShowInitDialog(false)
        setShowResetDialog(false)
        setIsInitialized(true)
      } else {
        toast.error(result.message || 'PostgreSQL 初始化失败')
      }
    } catch (error) {
      toast.error('初始化失败: ' + error)
    } finally {
      setIsInitializing(false)
    }
  }

  const configPath = serviceData.metadata?.POSTGRESQL_CONFIG || ''

  return (
    <div className="p-3">
      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              初始化 PostgreSQL
            </DialogTitle>
            <DialogDescription>
              首次使用需要初始化 PostgreSQL。系统将创建配置文件、数据目录，并设置 postgres 超级用户密码。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="postgres-super-password">超级用户密码</Label>
              <Input
                id="postgres-super-password"
                type="password"
                value={dialogData.superPassword}
                onChange={(e) => setDialogData(prev => ({ ...prev, superPassword: e.target.value }))}
                placeholder="输入 postgres 超级用户密码"
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
                  <Label htmlFor="postgres-init-port">端口</Label>
                  <Input
                    id="postgres-init-port"
                    value={dialogData.port}
                    onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="5432"
                    disabled={isInitializing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postgres-init-bind-address">绑定地址</Label>
                  <Input
                    id="postgres-init-bind-address"
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
                请牢记超级用户密码。初始化包含：创建配置文件、数据目录并初始化数据库集群。
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitDialog(false)} disabled={isInitializing} className="shadow-none">
              取消
            </Button>
            <Button
              onClick={() => void handleInitialize(false)}
              disabled={isInitializing || !dialogData.superPassword}
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

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              重置 PostgreSQL
            </DialogTitle>
            <DialogDescription>
              重置将删除所有现有数据、配置文件和角色信息，然后重新初始化 PostgreSQL。
              <span className="text-red-600 font-semibold">此操作不可恢复！</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!isInitializing && serviceStatus === ServiceStatus.Running && (
              <Alert variant="destructive" className="p-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>PostgreSQL 正在运行中！</strong> 请先停止 PostgreSQL 服务后再进行重置。
                  </AlertDescription>
                </div>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="postgres-reset-password">新超级用户密码</Label>
              <Input
                id="postgres-reset-password"
                type="password"
                value={dialogData.superPassword}
                onChange={(e) => setDialogData(prev => ({ ...prev, superPassword: e.target.value }))}
                placeholder="输入新超级用户密码"
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
                  <Label htmlFor="postgres-reset-port">端口</Label>
                  <Input
                    id="postgres-reset-port"
                    value={dialogData.port}
                    onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="5432"
                    disabled={isInitializing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postgres-reset-bind-address">绑定地址</Label>
                  <Input
                    id="postgres-reset-bind-address"
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
              onClick={() => void handleInitialize(true)}
              disabled={isInitializing || !dialogData.superPassword || serviceStatus === ServiceStatus.Running}
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
        {isServiceActive && isInitialized === false && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                  PostgreSQL 尚未初始化
                </p>
                <p className="text-[11px] text-orange-700 dark:text-orange-400 leading-relaxed">
                  首次使用需要初始化配置文件、数据目录，并设置超级用户密码。
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

        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              服务控制
            </Label>
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                serviceStatus === ServiceStatus.Running ? 'bg-green-500' :
                  serviceStatus === ServiceStatus.Stopped ? 'bg-red-500' : 'bg-gray-300'
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
                onClick={() => void startService()}
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
                onClick={() => void stopService()}
                disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
              >
                <PowerOff className="h-3.5 w-3.5 text-red-600" />
                停止
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                onClick={() => void restartService()}
                disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
              >
                <RotateCw className={cn('h-3.5 w-3.5 text-blue-600', isRestarting && 'animate-spin')} />
                重启
              </Button>
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          {isServiceActive && isInitialized ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">配置文件</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={configPath}
                    readOnly
                    placeholder="PostgreSQL 配置文件路径"
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

              <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">数据目录（从配置读取）</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={postgresqlConfig?.dataPath || '未配置'}
                    readOnly
                    className={cn(
                      'flex-1 h-8 text-xs shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10',
                      !postgresqlConfig?.dataPath && 'text-muted-foreground'
                    )}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => postgresqlConfig?.dataPath && openFolderInFinder(postgresqlConfig.dataPath)}
                    disabled={!postgresqlConfig?.dataPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    title="打开目录"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">日志文件（从配置读取）</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={postgresqlConfig?.logPath || '未配置'}
                    readOnly
                    className={cn(
                      'flex-1 h-8 text-xs shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10',
                      !postgresqlConfig?.logPath && 'text-muted-foreground'
                    )}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => postgresqlConfig?.logPath && openFolderInFinder(postgresqlConfig.logPath)}
                    disabled={!postgresqlConfig?.logPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    title="打开目录"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">主机（从配置读取）</Label>
                  <Input
                    value={postgresqlConfig?.bindIp || '未配置'}
                    readOnly
                    className="text-xs h-8 mt-1 shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">端口（从配置读取）</Label>
                  <Input
                    value={postgresqlConfig?.port ?? '未配置'}
                    readOnly
                    className="text-xs h-8 mt-1 shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">管理工具</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const result = await openPostgresqlClient(selectedEnvironment.id, serviceData)
                        if (result.success) {
                          toast.success('PostgreSQL 客户端已打开')
                        } else {
                          toast.error(result.message || '打开 PostgreSQL 客户端失败')
                        }
                      } catch (error) {
                        toast.error('打开 PostgreSQL 客户端失败: ' + error)
                      }
                    }}
                    disabled={serviceStatus !== ServiceStatus.Running}
                    className="flex items-center gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    psql Client
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
                  <p className="text-xs">请先激活 PostgreSQL 服务</p>
                </>
              ) : (
                <>
                  <p className="text-sm">PostgreSQL 尚未初始化</p>
                  <p className="text-xs">请先完成初始化</p>
                </>
              )}
            </div>
          )}
        </div>

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
            <div className="space-y-1">
              {databases.length > 0 ? (
                <div className="border rounded-lg p-1 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10">
                  {(showAllDatabases ? databases : databases.slice(0, 4)).map((db) => (
                    <div key={db.name} className="text-xs">
                      <div
                        onClick={() => toggleTables(db.name)}
                        className="flex items-center justify-between p-1 hover:bg-gray-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer"
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
                                      收起 ({db.tables.length - 4} 张表)
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
                  <p className="text-sm">PostgreSQL 尚未初始化</p>
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

        <Dialog open={showCreateDbDialog} onOpenChange={setShowCreateDbDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新建数据库</DialogTitle>
              <DialogDescription>
                创建一个新的 PostgreSQL 数据库。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="pg-db-name">数据库名称</Label>
                <Input
                  id="pg-db-name"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  placeholder="输入数据库名称"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newDbName) {
                      void handleCreateDatabase()
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button className="shadow-none" variant="outline" onClick={() => setShowCreateDbDialog(false)}>
                取消
              </Button>
              <Button onClick={() => void handleCreateDatabase()} disabled={!newDbName || isCreatingDb}>
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

        <Dialog open={showCreateRoleDialog} onOpenChange={(open) => {
          setShowCreateRoleDialog(open)
          if (!open) setRoleForm({ roleName: '', password: '', grants: {}, customDb: '' })
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                新建角色
              </DialogTitle>
              <DialogDescription>创建一个新的 PostgreSQL 登录角色并分配数据库权限。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-role-name">角色名</Label>
                <Input
                  id="new-role-name"
                  value={roleForm.roleName}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, roleName: e.target.value }))}
                  placeholder="输入角色名"
                  disabled={isSubmittingRole}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role-password">密码</Label>
                <Input
                  id="new-role-password"
                  type="password"
                  value={roleForm.password}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="输入密码"
                  disabled={isSubmittingRole}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">数据库权限</Label>
                {databases.length > 0 && (
                  <div className="space-y-1 border rounded-lg p-2 bg-white dark:bg-white/5 max-h-40 overflow-y-auto">
                    {databases.map((db) => (
                      <div key={db.name} className="flex items-center justify-between py-1 px-1.5 rounded text-xs hover:bg-gray-50 dark:hover:bg-white/5">
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{db.name}</span>
                        <div className="flex gap-1">
                          {(['SELECT', 'ALL PRIVILEGES'] as const).map((priv) => (
                            <button
                              key={priv}
                              type="button"
                              onClick={() => setRoleForm(prev => {
                                const newGrants = { ...prev.grants }
                                if (newGrants[db.name] === priv) {
                                  delete newGrants[db.name]
                                } else {
                                  newGrants[db.name] = priv
                                }
                                return { ...prev, grants: newGrants }
                              })}
                              className={cn(
                                'px-2 py-0.5 rounded text-[10px] border transition-colors',
                                roleForm.grants[db.name] === priv
                                  ? priv === 'ALL PRIVILEGES'
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-200 dark:border-white/20 text-gray-500 hover:border-gray-400'
                              )}
                            >
                              {priv === 'SELECT' ? 'Read' : 'ReadWrite'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={roleForm.customDb}
                    onChange={(e) => setRoleForm(prev => ({ ...prev, customDb: e.target.value }))}
                    placeholder="自定义数据库名"
                    className="h-7 text-xs shadow-none"
                    disabled={isSubmittingRole}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && roleForm.customDb) {
                        setRoleForm(prev => ({
                          ...prev,
                          grants: { ...prev.grants, [prev.customDb]: 'SELECT' },
                          customDb: '',
                        }))
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs shadow-none"
                    disabled={!roleForm.customDb || isSubmittingRole}
                    onClick={() => {
                      if (!roleForm.customDb) return
                      setRoleForm(prev => ({
                        ...prev,
                        grants: { ...prev.grants, [prev.customDb]: 'SELECT' },
                        customDb: '',
                      }))
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {Object.keys(roleForm.grants).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(roleForm.grants).map(([db, priv]) => (
                      <span
                        key={db}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                      >
                        {db}: {priv === 'ALL PRIVILEGES' ? 'ReadWrite' : 'Read'}
                        <button
                          type="button"
                          onClick={() => setRoleForm(prev => {
                            const newGrants = { ...prev.grants }
                            delete newGrants[db]
                            return { ...prev, grants: newGrants }
                          })}
                          className="hover:text-blue-900 dark:hover:text-blue-100"
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button className="shadow-none" variant="outline" onClick={() => setShowCreateRoleDialog(false)} disabled={isSubmittingRole}>取消</Button>
              <Button onClick={() => void handleCreateRole()} disabled={!roleForm.roleName || !roleForm.password || isSubmittingRole}>
                {isSubmittingRole ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />创建中...</> : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditRoleDialog} onOpenChange={setShowEditRoleDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                编辑权限 - {selectedRoleName}
              </DialogTitle>
              <DialogDescription>修改角色的数据库访问权限（全量替换）。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {databases.length > 0 && (
                <div className="space-y-1 border rounded-lg p-2 bg-white dark:bg-white/5 max-h-48 overflow-y-auto">
                  {databases.map((db) => (
                    <div key={db.name} className="flex items-center justify-between py-1 px-1.5 rounded text-xs hover:bg-gray-50 dark:hover:bg-white/5">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{db.name}</span>
                      <div className="flex gap-1">
                        {(['SELECT', 'ALL PRIVILEGES'] as const).map((priv) => (
                          <button
                            key={priv}
                            type="button"
                            onClick={() => setRoleForm(prev => {
                              const newGrants = { ...prev.grants }
                              if (newGrants[db.name] === priv) {
                                delete newGrants[db.name]
                              } else {
                                newGrants[db.name] = priv
                              }
                              return { ...prev, grants: newGrants }
                            })}
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] border transition-colors',
                              roleForm.grants[db.name] === priv
                                ? priv === 'ALL PRIVILEGES'
                                  ? 'bg-blue-500 border-blue-500 text-white'
                                  : 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-200 dark:border-white/20 text-gray-500 hover:border-gray-400'
                            )}
                          >
                            {priv === 'SELECT' ? 'Read' : 'ReadWrite'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={roleForm.customDb}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, customDb: e.target.value }))}
                  placeholder="自定义数据库名"
                  className="h-7 text-xs shadow-none"
                  disabled={isSubmittingRole}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && roleForm.customDb) {
                      setRoleForm(prev => ({
                        ...prev,
                        grants: { ...prev.grants, [prev.customDb]: 'SELECT' },
                        customDb: '',
                      }))
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs shadow-none"
                  disabled={!roleForm.customDb || isSubmittingRole}
                  onClick={() => {
                    if (!roleForm.customDb) return
                    setRoleForm(prev => ({
                      ...prev,
                      grants: { ...prev.grants, [prev.customDb]: 'SELECT' },
                      customDb: '',
                    }))
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {Object.keys(roleForm.grants).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(roleForm.grants).map(([db, priv]) => (
                    <span
                      key={db}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                    >
                      {db}: {priv === 'ALL PRIVILEGES' ? 'ReadWrite' : 'Read'}
                      <button
                        type="button"
                        onClick={() => setRoleForm(prev => {
                          const newGrants = { ...prev.grants }
                          delete newGrants[db]
                          return { ...prev, grants: newGrants }
                        })}
                        className="hover:text-blue-900 dark:hover:text-blue-100"
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button className="shadow-none" variant="outline" onClick={() => setShowEditRoleDialog(false)} disabled={isSubmittingRole}>取消</Button>
              <Button onClick={() => void handleUpdateRoleGrants()} disabled={isSubmittingRole}>
                {isSubmittingRole ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />保存中...</> : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteRoleDialog} onOpenChange={setShowDeleteRoleDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                删除角色
              </DialogTitle>
              <DialogDescription>
                确认要删除角色 <span className="font-semibold text-foreground">'{selectedRoleName}'</span> 吗？此操作不可恢复。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button className="shadow-none" variant="outline" onClick={() => setShowDeleteRoleDialog(false)} disabled={isSubmittingRole}>取消</Button>
              <Button variant="destructive" onClick={() => void handleDeleteRole()} disabled={isSubmittingRole}>
                {isSubmittingRole ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />删除中...</> : '确认删除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              角色管理（Role）
            </Label>
            {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateRoleDialog(true)}
                className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
              >
                <UserPlus className="h-3 w-3 mr-1" />
                新建角色
              </Button>
            )}
          </div>
          {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">postgres</span>
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">管理员</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {serviceData.metadata?.POSTGRESQL_SUPER_PASSWORD
                      ? showPassword
                        ? serviceData.metadata.POSTGRESQL_SUPER_PASSWORD
                        : '••••••••'
                      : '—'}
                  </span>
                  {serviceData.metadata?.POSTGRESQL_SUPER_PASSWORD && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      onClick={() => setShowPassword(v => !v)}
                    >
                      {!showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </div>
              {roles.length > 0 ? (
                <div className="border rounded-lg p-1 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10">
                  {roles.map((role) => (
                    <div key={role.roleName} className="flex items-center justify-between p-1 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 text-xs">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Users className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{role.roleName}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                          onClick={() => openEditRoleDialog(role)}
                          title="编辑权限"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          onClick={() => {
                            setSelectedRoleName(role.roleName)
                            setShowDeleteRoleDialog(true)
                          }}
                          title="删除角色"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-6 border rounded-lg border-dashed border-gray-200 dark:border-white/10">
                  暂无普通角色
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Users className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {!isServiceActive ? (
                <><p className="text-sm">服务未激活</p><p className="text-xs">无法管理角色</p></>
              ) : !isInitialized ? (
                <><p className="text-sm">PostgreSQL 尚未初始化</p><p className="text-xs">请先完成初始化</p></>
              ) : (
                <><p className="text-sm">服务未运行</p><p className="text-xs">请先启动服务</p></>
              )}
            </div>
          )}
        </div>

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
