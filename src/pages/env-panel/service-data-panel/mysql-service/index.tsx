import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
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
import { ServiceData, ServiceDataStatus, ServiceStatus } from '@/types/index'
import { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { selectedEnvironmentIdAtom } from '../../../../store/environment'
import { useMysql, MySQLConfig } from '@/hooks/services/mysql'
import { useFileOperations } from "@/hooks/file-operations"
import { MySQLMetadata, MySQLUser, MySQLGrant } from '@/types/service'
import { useEnvironmentServiceData, useServiceData } from '@/hooks/env-serv-data'
import { useServiceDataStatus, useServiceStatus } from '@/hooks/useStatus'

interface MySQLServiceProps {
  serviceData: ServiceData
}

export function MySQLService({ serviceData }: MySQLServiceProps) {
  const { t } = useTranslation()
  const { openFolderInFinder } = useFileOperations()
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)

  // 初始化状态
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [showInitDialog, setShowInitDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)

  const { serviceDataStatus } = useServiceDataStatus(selectedEnvironmentId, serviceData.id, {
    enabled: true,
    interval: 500,
  })

  // 检查服务是否激活
  const isServiceActive = serviceDataStatus === ServiceDataStatus.Active

  const { status: serviceStatus, refresh: refreshServiceStatus } = useServiceStatus(selectedEnvironmentId, serviceData, {
    enabled: isServiceActive && Boolean(isInitialized),
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

  // MySQL 配置状态
  const [mysqlConfig, setMysqlConfig] = useState<MySQLConfig | null>(null)

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
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false)
  const [showAllDatabases, setShowAllDatabases] = useState(false)
  const [showCreateDbDialog, setShowCreateDbDialog] = useState(false)
  const [newDbName, setNewDbName] = useState('')
  const [isCreatingDb, setIsCreatingDb] = useState(false)

  // 用户管理相关状态
  const [users, setUsers] = useState<MySQLUser[]>([])
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false)
  const [showEditUserDialog, setShowEditUserDialog] = useState(false)
  const [showDeleteUserDialog, setShowDeleteUserDialog] = useState(false)
  const [selectedUsername, setSelectedUsername] = useState('')
  const [isSubmittingUser, setIsSubmittingUser] = useState(false)
  const [userForm, setUserForm] = useState<{
    username: string
    password: string
    grants: Record<string, 'SELECT' | 'ALL PRIVILEGES'>
    customDb: string
  }>({
    username: '',
    password: '',
    grants: {},
    customDb: '',
  })

  const {
    getMysqlConfig,
    initializeMysql,
    checkMysqlInitialized,
    listMysqlDatabases,
    createMysqlDatabase,
    listMysqlTables,
    openMysqlClient,
    listMysqlUsers,
    createMysqlUser,
    deleteMysqlUser,
    updateMysqlUserGrants,
  } = useMysql()

  const {
    startServiceData,
    stopServiceData,
    restartServiceData,
  } = useServiceData()

  const {
    updateServiceData,
    selectedServiceDatas,
  } = useEnvironmentServiceData()

  // 检查初始化状态
  useEffect(() => {
    if (isServiceActive) {
      checkInitialized()
    }
  }, [isServiceActive])

  // 激活状态变化时回写到 store
  useEffect(() => {
    if (serviceDataStatus === ServiceDataStatus.Unknown || serviceDataStatus === serviceData.status) {
      return
    }
    updateServiceData({
      environmentId: selectedEnvironmentId,
      serviceId: serviceData.id,
      updates: { status: serviceDataStatus },
      serviceDatas: selectedServiceDatas,
    }).catch((error) => {
      console.error('回写 MySQL 激活状态失败:', error)
    })
  }, [
    serviceDataStatus,
    selectedEnvironmentId,
    serviceData.id,
    serviceData.status,
    selectedServiceDatas,
    updateServiceData,
  ])

  // 加载 MySQL 配置（初始化完成后）
  useEffect(() => {
    if (isServiceActive && isInitialized) {
      loadMysqlConfig()
    } else {
      setMysqlConfig(null)
    }
  }, [isServiceActive, isInitialized])

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

  // 定时刷新用户列表（每3秒）
  useEffect(() => {
    if (isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running) {
      loadUsers()
      const timer = setInterval(() => {
        loadUsers()
      }, 3000)
      return () => clearInterval(timer)
    } else {
      setUsers([])
      return () => {}
    }
  }, [isServiceActive, isInitialized, serviceStatus])

  const checkInitialized = async () => {
    try {
      const result = await checkMysqlInitialized(selectedEnvironmentId, serviceData)
      if (result.success && result.data) {
        setIsInitialized(result.data.initialized)
      }
    } catch (error) {
      console.error('检查 MySQL 初始化状态失败:', error)
    }
  }

  // 加载 MySQL 配置
  const loadMysqlConfig = async () => {
    try {
      const result = await getMysqlConfig(selectedEnvironmentId, serviceData)
      if (result.success && result.config) {
        setMysqlConfig(result.config)
      }
    } catch (error) {
      console.error('加载 MySQL 配置失败:', error)
    }
  }

  // 加载用户列表
  const loadUsers = async () => {
    if (!isServiceActive || !isInitialized || serviceStatus !== ServiceStatus.Running) {
      setUsers([])
      return
    }
    try {
      const result = await listMysqlUsers(selectedEnvironmentId, serviceData)
      if (result.success && result.data?.users) {
        setUsers(result.data.users as MySQLUser[])
      }
    } catch (error) {
      console.error('加载用户列表失败:', error)
    }
  }

  // 加载数据库列表
  const loadDatabases = async () => {
    if (!isServiceActive || !isInitialized || serviceStatus !== ServiceStatus.Running) {
      setDatabases([])
      return
    }
    setIsLoadingDatabases(true)
    try {
      const result = await listMysqlDatabases(selectedEnvironmentId, serviceData)
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
    } finally {
      setIsLoadingDatabases(false)
    }
  }

  // 加载指定数据库的表列表
  const loadTables = async (databaseName: string) => {
    setDatabases(prev => prev.map(db =>
      db.name === databaseName ? { ...db, isLoadingTables: true } : db
    ))
    try {
      const result = await listMysqlTables(selectedEnvironmentId, serviceData, databaseName)
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
      const result = await createMysqlDatabase(selectedEnvironmentId, serviceData, newDbName)
      if (result.success) {
        toast.success(t('mysql_service.db_create_success'))
        setShowCreateDbDialog(false)
        setNewDbName('')
        loadDatabases()
      } else {
        toast.error(t('mysql_service.db_create_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mysql_service.db_create_failed', { message: String(error) }))
    } finally {
      setIsCreatingDb(false)
    }
  }

  // 创建用户
  const handleCreateUser = async () => {
    if (!userForm.username || !userForm.password) return
    setIsSubmittingUser(true)
    try {
      const grants: MySQLGrant[] = Object.entries(userForm.grants).map(([database, privilege]) => ({
        database,
        privilege,
      }))
      const result = await createMysqlUser(selectedEnvironmentId, serviceData, userForm.username, userForm.password, grants)
      if (result.success) {
        toast.success(t('mysql_service.user_create_success', { username: userForm.username }))
        setShowCreateUserDialog(false)
        setUserForm({ username: '', password: '', grants: {}, customDb: '' })
        loadUsers()
      } else {
        toast.error(t('mysql_service.user_create_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mysql_service.user_create_failed', { message: String(error) }))
    } finally {
      setIsSubmittingUser(false)
    }
  }

  // 打开编辑权限弹框
  const openEditUserDialog = (user: MySQLUser) => {
    const grantsMap: Record<string, 'SELECT' | 'ALL PRIVILEGES'> = {}
    for (const g of user.grants) {
      grantsMap[g.database] = g.privilege as 'SELECT' | 'ALL PRIVILEGES'
    }
    setSelectedUsername(user.username)
    setUserForm({ username: user.username, password: '', grants: grantsMap, customDb: '' })
    setShowEditUserDialog(true)
  }

  // 更新用户权限
  const handleUpdateUserGrants = async () => {
    if (!selectedUsername) return
    setIsSubmittingUser(true)
    try {
      const grants: MySQLGrant[] = Object.entries(userForm.grants).map(([database, privilege]) => ({
        database,
        privilege,
      }))
      const result = await updateMysqlUserGrants(selectedEnvironmentId, serviceData, selectedUsername, grants)
      if (result.success) {
        toast.success(t('mysql_service.permission_update_success', { username: selectedUsername }))
        setShowEditUserDialog(false)
        loadUsers()
      } else {
        toast.error(t('mysql_service.permission_update_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mysql_service.permission_update_failed', { message: String(error) }))
    } finally {
      setIsSubmittingUser(false)
    }
  }

  // 删除用户
  const handleDeleteUser = async () => {
    if (!selectedUsername) return
    setIsSubmittingUser(true)
    try {
      const result = await deleteMysqlUser(selectedEnvironmentId, serviceData, selectedUsername)
      if (result.success) {
        toast.success(t('mysql_service.user_delete_success', { username: selectedUsername }))
        setShowDeleteUserDialog(false)
        loadUsers()
      } else {
        toast.error(t('mysql_service.user_delete_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mysql_service.user_delete_failed', { message: String(error) }))
    } finally {
      setIsSubmittingUser(false)
    }
  }

  // 启动服务
  const startService = async () => {
    if (!serviceData?.version) return
    setIsStarting(true)
    try {
      const result = await startServiceData(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success(t('mysql_service.start_success'))
        refreshServiceStatus()
      } else {
        toast.error(t('mysql_service.start_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mysql_service.start_failed', { message: String(error) }))
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
        toast.success(t('mysql_service.stop_success'))
        refreshServiceStatus()
      } else {
        toast.error(t('mysql_service.stop_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mysql_service.stop_failed', { message: String(error) }))
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
        toast.success(t('mysql_service.restart_success'))
        refreshServiceStatus()
      } else {
        toast.error(t('mysql_service.restart_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mysql_service.restart_failed', { message: String(error) }))
    } finally {
      setIsRestarting(false)
    }
  }

  // 初始化 MySQL
  const handleInitialize = async (reset: boolean = false) => {
    if (!dialogData.rootPassword) {
      toast.error(t('mysql_service.password_required'))
      return
    }
    if (reset && serviceStatus === ServiceStatus.Running) {
      toast.error(t('mysql_service.running_warning'))
      return
    }
    setIsInitializing(true)
    try {
      const result = await initializeMysql(
        selectedEnvironmentId,
        serviceData,
        dialogData.rootPassword,
        dialogData.port,
        dialogData.bindAddress,
        reset
      )
      if (result.success && result.data) {
        const data = result.data
        const newMetadata: MySQLMetadata = { ...(serviceData.metadata || {}) }
        newMetadata['MYSQL_CONFIG'] = data.configPath
        newMetadata['MYSQL_ROOT_PASSWORD'] = data.rootPassword
        await updateServiceData({
          environmentId: selectedEnvironmentId,
          serviceId: serviceData.id,
          updates: { metadata: newMetadata },
          serviceDatas: selectedServiceDatas,
        })
        toast.success(t('mysql_service.init_success'))
        setShowInitDialog(false)
        setShowResetDialog(false)
        setIsInitialized(true)
      } else {
        toast.error(result.message || t('mysql_service.init_failed'))
      }
    } catch (error) {
      toast.error(t('mysql_service.init_failed_msg', { message: String(error) }))
    } finally {
      setIsInitializing(false)
    }
  }

  const configPath = serviceData.metadata?.['MYSQL_CONFIG'] || ''

  return (
    <div className="p-3">
      {/* 初始化对话框 */}
      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {t('mysql_service.init_title')}
            </DialogTitle>
            <DialogDescription>
              {t('mysql_service.init_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="root-password">{t('mysql_service.root_password_label')}</Label>
              <Input
                id="root-password"
                type="password"
                value={dialogData.rootPassword}
                onChange={(e) => setDialogData(prev => ({ ...prev, rootPassword: e.target.value }))}
                placeholder={t('mysql_service.root_password_placeholder')}
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
              {dialogData.showAdvanced ? t('mysql_service.hide_advanced') : t('mysql_service.show_advanced')}
            </Button>
            {dialogData.showAdvanced && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="init-port">{t('mysql_service.port_label')}</Label>
                  <Input
                    id="init-port"
                    value={dialogData.port}
                    onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="3306"
                    disabled={isInitializing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="init-bind-address">{t('mysql_service.bind_address_label')}</Label>
                  <Input
                    id="init-bind-address"
                    value={dialogData.bindAddress}
                    onChange={(e) => setDialogData(prev => ({ ...prev, bindAddress: e.target.value }))}
                    placeholder="127.0.0.1"
                    disabled={isInitializing}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('mysql_service.local_access_note')}
                  </p>
                </div>
              </>
            )}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {t('mysql_service.init_alert')}
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitDialog(false)} disabled={isInitializing} className="shadow-none">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => handleInitialize(false)}
              disabled={isInitializing || !dialogData.rootPassword}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('mysql_service.initializing')}
                </>
              ) : t('mysql_service.start_init')}
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
              {t('mysql_service.reset_title')}
            </DialogTitle>
            <DialogDescription>
              {t('mysql_service.reset_desc')}
              <span className="text-red-600 font-semibold">{t('mysql_service.reset_irrecoverable')}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!isInitializing && serviceStatus === ServiceStatus.Running && (
              <Alert variant="destructive" className="p-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>MySQL</strong> {t('mysql_service.running_warning_text')}
                  </AlertDescription>
                </div>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="reset-root-password">{t('mysql_service.new_root_password_label')}</Label>
              <Input
                id="reset-root-password"
                type="password"
                value={dialogData.rootPassword}
                onChange={(e) => setDialogData(prev => ({ ...prev, rootPassword: e.target.value }))}
                placeholder={t('mysql_service.new_root_password_placeholder')}
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
              {dialogData.showAdvanced ? t('mysql_service.hide_advanced') : t('mysql_service.show_advanced')}
            </Button>
            {dialogData.showAdvanced && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reset-port">{t('mysql_service.port_label')}</Label>
                  <Input
                    id="reset-port"
                    value={dialogData.port}
                    onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="3306"
                    disabled={isInitializing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-bind-address">{t('mysql_service.bind_address_label')}</Label>
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
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleInitialize(true)}
              disabled={isInitializing || !dialogData.rootPassword || serviceStatus === ServiceStatus.Running}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('mysql_service.resetting')}
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {t('mysql_service.confirm_reset')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建用户对话框 */}
      <Dialog open={showCreateUserDialog} onOpenChange={(open) => {
        setShowCreateUserDialog(open)
        if (!open) setUserForm({ username: '', password: '', grants: {}, customDb: '' })
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {t('mysql_service.new_user_title')}
            </DialogTitle>
            <DialogDescription>{t('mysql_service.new_user_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">{t('mysql_service.username_label')}</Label>
              <Input
                id="new-username"
                value={userForm.username}
                onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder={t('mysql_service.username_placeholder')}
                disabled={isSubmittingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-password">{t('mysql_service.password_label')}</Label>
              <Input
                id="new-user-password"
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder={t('mysql_service.password_placeholder')}
                disabled={isSubmittingUser}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">{t('mysql_service.db_permissions')}</Label>
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
                            onClick={() => setUserForm(prev => {
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
                              userForm.grants[db.name] === priv
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
                  value={userForm.customDb}
                  onChange={(e) => setUserForm(prev => ({ ...prev, customDb: e.target.value }))}
                  placeholder={t('mysql_service.custom_db_placeholder')}
                  className="h-7 text-xs shadow-none"
                  disabled={isSubmittingUser}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && userForm.customDb) {
                      setUserForm(prev => ({
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
                  disabled={!userForm.customDb || isSubmittingUser}
                  onClick={() => {
                    if (!userForm.customDb) return
                    setUserForm(prev => ({
                      ...prev,
                      grants: { ...prev.grants, [prev.customDb]: 'SELECT' },
                      customDb: '',
                    }))
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {Object.keys(userForm.grants).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(userForm.grants).map(([db, priv]) => (
                    <span
                      key={db}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                    >
                      {db}: {priv === 'ALL PRIVILEGES' ? 'ReadWrite' : 'Read'}
                      <button
                        type="button"
                        onClick={() => setUserForm(prev => {
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
            <Button className="shadow-none" variant="outline" onClick={() => setShowCreateUserDialog(false)} disabled={isSubmittingUser}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateUser} disabled={!userForm.username || !userForm.password || isSubmittingUser}>
              {isSubmittingUser ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('mysql_service.creating')}</> : t('mysql_service.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户权限对话框 */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              {t('mysql_service.edit_permissions_title')} - {selectedUsername}
            </DialogTitle>
            <DialogDescription>{t('mysql_service.edit_permissions_desc')}</DialogDescription>
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
                          onClick={() => setUserForm(prev => {
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
                            userForm.grants[db.name] === priv
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
                value={userForm.customDb}
                onChange={(e) => setUserForm(prev => ({ ...prev, customDb: e.target.value }))}
                placeholder={t('mysql_service.custom_db_placeholder')}
                className="h-7 text-xs shadow-none"
                disabled={isSubmittingUser}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && userForm.customDb) {
                    setUserForm(prev => ({
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
                disabled={!userForm.customDb || isSubmittingUser}
                onClick={() => {
                  if (!userForm.customDb) return
                  setUserForm(prev => ({
                    ...prev,
                    grants: { ...prev.grants, [prev.customDb]: 'SELECT' },
                    customDb: '',
                  }))
                }}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {Object.keys(userForm.grants).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(userForm.grants).map(([db, priv]) => (
                  <span
                    key={db}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                  >
                    {db}: {priv === 'ALL PRIVILEGES' ? 'ReadWrite' : 'Read'}
                    <button
                      type="button"
                      onClick={() => setUserForm(prev => {
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
            <Button className="shadow-none" variant="outline" onClick={() => setShowEditUserDialog(false)} disabled={isSubmittingUser}>{t('common.cancel')}</Button>
            <Button onClick={handleUpdateUserGrants} disabled={isSubmittingUser}>
              {isSubmittingUser ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('common.saving')}</> : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除用户确认对话框 */}
      <Dialog open={showDeleteUserDialog} onOpenChange={setShowDeleteUserDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              {t('mysql_service.delete_user_title')}
            </DialogTitle>
            <DialogDescription>
              {t('mysql_service.delete_user_confirm', { username: selectedUsername })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="shadow-none" variant="outline" onClick={() => setShowDeleteUserDialog(false)} disabled={isSubmittingUser}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isSubmittingUser}>
              {isSubmittingUser ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('mysql_service.deleting')}</> : t('mysql_service.confirm_delete')}
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
                  {t('mysql_service.not_initialized_title')}
                </p>
                <p className="text-[11px] text-orange-700 dark:text-orange-400 leading-relaxed">
                  {t('mysql_service.not_initialized_desc')}
                </p>
              </div>
            </div>
            <div className="flex">
              <Button
                size="sm"
                onClick={() => setShowInitDialog(true)}
                className="h-7 text-xs shadow-none bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white"
              >
                {t('mysql_service.init_now')}
              </Button>
            </div>
          </div>
        )}

        {/* 服务控制 */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              {t('mysql_service.service_control')}
            </Label>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                serviceStatus === ServiceStatus.Running ? "bg-green-500" :
                  serviceStatus === ServiceStatus.Stopped ? "bg-red-500" : "bg-gray-300"
              )} />
              <span className="text-xs font-normal text-muted-foreground">
                {serviceStatus === ServiceStatus.Running ? t('mysql_service.running') :
                  serviceStatus === ServiceStatus.Stopped ? t('mysql_service.stopped') : t('mysql_service.unknown_status')}
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
                {t('mysql_service.start')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                onClick={stopService}
                disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
              >
                <PowerOff className="h-3.5 w-3.5 text-red-600" />
                {t('mysql_service.stop')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                onClick={restartService}
                disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
              >
                <RotateCw className={cn("h-3.5 w-3.5 text-blue-600", isRestarting && "animate-spin")} />
                {t('mysql_service.restart')}
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
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('mysql_service.config_file_label')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={configPath}
                    readOnly
                    placeholder={t('mysql_service.config_path_placeholder')}
                    className="flex-1 h-8 text-xs shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => configPath && openFolderInFinder(configPath)}
                    disabled={!configPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    title={t('mysql_service.open_config_dir_title')}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* 数据目录 */}
              <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('mysql_service.data_dir_label')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={mysqlConfig?.dataPath || t('mysql_service.not_configured')}
                    readOnly
                    className={cn(
                      "flex-1 h-8 text-xs shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10",
                      !mysqlConfig?.dataPath && "text-muted-foreground"
                    )}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mysqlConfig?.dataPath && openFolderInFinder(mysqlConfig.dataPath)}
                    disabled={!mysqlConfig?.dataPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    title={t('mysql_service.open_dir_title')}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* 日志文件 */}
              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('mysql_service.log_file_label')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={mysqlConfig?.logPath || t('mysql_service.not_configured')}
                    readOnly
                    className={cn(
                      "flex-1 h-8 text-xs shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10",
                      !mysqlConfig?.logPath && "text-muted-foreground"
                    )}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mysqlConfig?.logPath && openFolderInFinder(mysqlConfig.logPath)}
                    disabled={!mysqlConfig?.logPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    title={t('mysql_service.open_dir_title')}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* 主机 & 端口 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('mysql_service.host_label')}</Label>
                  <Input
                    value={mysqlConfig?.bindIp || t('mysql_service.not_configured')}
                    readOnly
                    className="text-xs h-8 mt-1 shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('mysql_service.port_from_config')}</Label>
                  <Input
                    value={mysqlConfig?.port ?? t('mysql_service.not_configured')}
                    readOnly
                    className="text-xs h-8 mt-1 shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                </div>
              </div>

              {/* Root 密码 */}
              <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('mysql_service.root_password_label')}</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={serviceData.metadata?.['MYSQL_ROOT_PASSWORD'] || t('mysql_service.not_set')}
                    readOnly
                    className="h-8 text-xs shadow-none bg-muted cursor-not-allowed pr-10 border-gray-200 dark:border-white/10"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={!serviceData.metadata?.['MYSQL_ROOT_PASSWORD']}
                    className="absolute right-1 top-0 h-8 w-8 p-0 hover:bg-transparent"
                    aria-label={showPassword ? t('mysql_service.hide_password') : t('mysql_service.show_password')}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3 w-3 text-gray-500" />
                    ) : (
                      <Eye className="h-3 w-3 text-gray-500" />
                    )}
                  </Button>
                </div>
              </div>

              {/* 管理工具 */}
              <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('mysql_service.management_tools')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const result = await openMysqlClient(selectedEnvironmentId, serviceData)
                        if (result.success) {
                          toast.success(t('mysql_service.client_opened'))
                        } else {
                          toast.error(result.message || t('mysql_service.client_open_failed'))
                        }
                      } catch (error) {
                        toast.error(t('mysql_service.client_open_failed'))
                      }
                    }}
                    disabled={serviceStatus !== ServiceStatus.Running}
                    className="flex items-center gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    MySQL Client
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Settings className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {!isServiceActive ? (
                <>
                  <p className="text-sm">{t('mysql_service.service_not_active_config')}</p>
                  <p className="text-xs">{t('mysql_service.activate_service_hint')}</p>
                </>
              ) : (
                <>
                  <p className="text-sm">{t('mysql_service.not_initialized_short')}</p>
                  <p className="text-xs">{t('mysql_service.complete_init')}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* 数据库管理 */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              {t('mysql_service.db_management')}
            </Label>
            {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDbDialog(true)}
                className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
              >
                <Plus className="h-3 w-3 mr-1" />
                {t('mysql_service.new_database')}
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
                                      {t('mysql_service.collapse_tables', { count: db.tables.length - 4 })}
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      {t('mysql_service.more_tables', { count: db.tables.length - 4 })}
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 text-center py-2">{t('mysql_service.no_tables')}</div>
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
                          {t('mysql_service.collapse_dbs', { count: databases.length - 4 })}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5 mr-1" />
                          {t('mysql_service.more_dbs', { count: databases.length - 4 })}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed border-gray-200 dark:border-white/10">
                  {isLoadingDatabases ? (
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                  ) : t('mysql_service.no_databases')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Database className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {!isServiceActive ? (
                <>
                  <p className="text-sm">{t('mysql_service.service_not_active_db')}</p>
                  <p className="text-xs">{t('mysql_service.cannot_manage_db')}</p>
                </>
              ) : !isInitialized ? (
                <>
                  <p className="text-sm">{t('mysql_service.not_initialized_short')}</p>
                  <p className="text-xs">{t('mysql_service.complete_init')}</p>
                </>
              ) : (
                <>
                  <p className="text-sm">{t('mysql_service.service_not_running')}</p>
                  <p className="text-xs">{t('mysql_service.start_first')}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* 创建数据库对话框 */}
        <Dialog open={showCreateDbDialog} onOpenChange={setShowCreateDbDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('mysql_service.new_database_title')}</DialogTitle>
              <DialogDescription>
                {t('mysql_service.new_database_desc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="db-name">{t('mysql_service.db_name_label')}</Label>
                <Input
                  id="db-name"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  placeholder={t('mysql_service.db_name_placeholder')}
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
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreateDatabase} disabled={!newDbName || isCreatingDb}>
                {isCreatingDb ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {t('mysql_service.creating')}
                  </>
                ) : t('mysql_service.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 用户管理 */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              {t('mysql_service.user_management')}
            </Label>
            {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateUserDialog(true)}
                className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
              >
                <UserPlus className="h-3 w-3 mr-1" />
                {t('mysql_service.new_user')}
              </Button>
            )}
          </div>
          {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running ? (
            <div className="space-y-2">
              {/* root 管理员卡片 */}
              <div className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">root</span>
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">{t('mysql_service.admin_tag')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {serviceData.metadata?.['MYSQL_ROOT_PASSWORD']
                      ? showPassword
                        ? serviceData.metadata['MYSQL_ROOT_PASSWORD']
                        : '••••••••'
                      : '—'}
                  </span>
                  {serviceData.metadata?.['MYSQL_ROOT_PASSWORD'] && (
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
              {/* 普通用户列表 */}
              {users.length > 0 ? (
                <div className="border rounded-lg p-1 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10">
                  {users.map((user) => (
                    <div key={user.username} className="flex items-center justify-between p-1 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 text-xs">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Users className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-700 dark:text-gray-300">{user.username}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                          onClick={() => openEditUserDialog(user)}
                          title={t('mysql_service.edit_permissions_title')}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          onClick={() => {
                            setSelectedUsername(user.username)
                            setShowDeleteUserDialog(true)
                          }}
                          title={t('mysql_service.delete_user_title')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-6 border rounded-lg border-dashed border-gray-200 dark:border-white/10">
                  {t('mysql_service.no_normal_users')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Users className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {!isServiceActive ? (
                <><p className="text-sm">{t('mysql_service.service_not_active_users')}</p><p className="text-xs">{t('mysql_service.cannot_manage_users')}</p></>
              ) : !isInitialized ? (
                <><p className="text-sm">{t('mysql_service.not_initialized_short')}</p><p className="text-xs">{t('mysql_service.complete_init')}</p></>
              ) : (
                <><p className="text-sm">{t('mysql_service.service_not_running')}</p><p className="text-xs">{t('mysql_service.start_first')}</p></>
              )}
            </div>
          )}
        </div>

        {/* 其他操作 */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('mysql_service.other_operations')}
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
                {t('mysql_service.reset_init')}
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <BarChart3 className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('mysql_service.service_not_active_config')}</p>
              <p className="text-xs">{t('mysql_service.activate_service_hint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
