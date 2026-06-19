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
import { useState, useEffect, useRef } from 'react'
import { useAtom } from 'jotai'
import { selectedEnvironmentIdAtom } from '../../../../store/environment'
import { usePostgresqlService, PostgreSQLConfig, PostgreSQLRole, PostgreSQLGrant } from '@/hooks/services/postgresql'
import { useFileOperations } from "@/hooks/file-operations"
import { PostgreSQLMetadata } from "@/types/service"
import { useEnvironmentServiceData, useServiceData } from '@/hooks/env-serv-data'
import {
  registerDbObjectWatch,
  unregisterDbObjectWatch,
  useServiceDataStatus,
  useServiceDatabasePush,
  useServiceDbObjectPush,
  useServicePrincipalPush,
  useServiceStatus,
} from '@/hooks/useStatus'

interface PostgreSQLServiceProps {
  serviceData: ServiceData
}

export function PostgreSQLService({ serviceData }: PostgreSQLServiceProps) {
  const { t } = useTranslation()
  const { openFolderInFinder } = useFileOperations()
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)

  const [isInitialized, setIsInitialized] = useState<boolean | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [showInitDialog, setShowInitDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)

  const { serviceDataStatus } = useServiceDataStatus(selectedEnvironmentId, serviceData.id, {
    enabled: true,
    interval: 500,
  })

  const isServiceActive = serviceDataStatus === ServiceDataStatus.Active

  const { status: serviceStatus, refresh: refreshServiceStatus } = useServiceStatus(selectedEnvironmentId, serviceData, {
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

  const [serviceAction, setServiceAction] = useState<'starting' | 'stopping' | 'restarting' | null>(null)
  const watchedDatabasesRef = useRef<Set<string>>(new Set())

  const isStarting = serviceAction === 'starting'
  const isStopping = serviceAction === 'stopping'
  const isRestarting = serviceAction === 'restarting'

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
    startServiceData,
    stopServiceData,
    restartServiceData,
  } = useServiceData()

  const {
    updateServiceData,
    selectedServiceDatas,
  } = useEnvironmentServiceData()

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
      console.error('回写 PostgreSQL 激活状态失败:', error)
    })
  }, [
    serviceDataStatus,
    selectedEnvironmentId,
    serviceData.id,
    serviceData.status,
    selectedServiceDatas,
    updateServiceData,
  ])

  useEffect(() => {
    if (isServiceActive) {
      void checkInitialized()
      return
    }
  }, [isServiceActive, selectedEnvironmentId, serviceData.id, serviceData.version])

  useEffect(() => {
    if (isServiceActive && isInitialized) {
      loadPostgresqlConfig()
    } else {
      setPostgresqlConfig(null)
    }
  }, [isServiceActive, isInitialized])

  useEffect(() => {
    if (isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running) {
      void loadDatabases()
      void loadRoles()
      return () => {}
    }

    const watched = Array.from(watchedDatabasesRef.current)
    for (const dbName of watched) {
      void unregisterDbObjectWatch(selectedEnvironmentId, serviceData.id, dbName)
    }
    watchedDatabasesRef.current.clear()
    setDatabases([])
    setRoles([])
    return () => {}
  }, [isServiceActive, isInitialized, serviceStatus])

  useEffect(() => {
    if (serviceAction === 'starting' && serviceStatus === ServiceStatus.Running) {
      setServiceAction(null)
      return
    }

    if (serviceAction === 'stopping' && serviceStatus === ServiceStatus.Stopped) {
      setServiceAction(null)
      return
    }

    if (serviceAction === 'restarting' && serviceStatus === ServiceStatus.Running) {
      setServiceAction(null)
    }
  }, [serviceAction, serviceStatus])

  useEffect(() => {
    return () => {
      const watched = Array.from(watchedDatabasesRef.current)
      for (const dbName of watched) {
        void unregisterDbObjectWatch(selectedEnvironmentId, serviceData.id, dbName)
      }
      watchedDatabasesRef.current.clear()
    }
  }, [selectedEnvironmentId, serviceData.id])

  useServiceDatabasePush<string[]>(
    selectedEnvironmentId,
    serviceData,
    (payload) => {
      const names = Array.isArray(payload.items)
        ? payload.items.filter((item): item is string => typeof item === 'string')
        : []

      setDatabases(prev => {
        const nextDatabases = names.map((name) => {
          const existing = prev.find(d => d.name === name)
          return {
            name,
            tables: existing?.tables,
            isLoadingTables: existing?.isLoadingTables || false,
            showTables: existing?.showTables || false,
            showAllTables: existing?.showAllTables || false,
          }
        })
        return nextDatabases
      })
    },
    { enabled: isServiceActive && Boolean(isInitialized) && serviceStatus === ServiceStatus.Running },
  )

  useServicePrincipalPush<PostgreSQLRole[]>(
    selectedEnvironmentId,
    serviceData,
    (payload) => {
      const nextRoles = Array.isArray(payload.items) ? payload.items : []
      setRoles(nextRoles)
    },
    { enabled: isServiceActive && Boolean(isInitialized) && serviceStatus === ServiceStatus.Running },
  )

  useServiceDbObjectPush<string[]>(
    selectedEnvironmentId,
    serviceData,
    (payload) => {
      if (!payload.databaseName) return
      const tableNames = Array.isArray(payload.items)
        ? payload.items.filter((item): item is string => typeof item === 'string')
        : []

      setDatabases(prev => prev.map(db =>
        db.name === payload.databaseName
          ? {
            ...db,
            tables: tableNames,
            isLoadingTables: false,
            showTables: db.showTables || watchedDatabasesRef.current.has(db.name),
          }
          : db,
      ))
    },
    { enabled: isServiceActive && Boolean(isInitialized) && serviceStatus === ServiceStatus.Running },
  )

  const checkInitialized = async () => {
    try {
      const result = await checkPostgresqlInitialized(selectedEnvironmentId, serviceData)
      if (result.success && result.data) {
        setIsInitialized(result.data.initialized)
        return
      }

      // 检查失败或返回空数据时，按未初始化处理，避免首屏无法出现初始化卡片。
      setIsInitialized(false)
    } catch (error) {
      console.error('检查 PostgreSQL 初始化状态失败:', error)
      setIsInitialized(false)
    }
  }

  const loadPostgresqlConfig = async () => {
    try {
      const result = await getPostgresqlConfig(selectedEnvironmentId, serviceData)
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

    setIsLoadingDatabases(true)
    try {
      const result = await listPostgresqlDatabases(selectedEnvironmentId, serviceData)
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
    } finally {
      setIsLoadingDatabases(false)
    }
  }

  const loadTables = async (databaseName: string) => {
    setDatabases(prev => prev.map(db =>
      db.name === databaseName ? { ...db, isLoadingTables: true } : db
    ))

    try {
      const result = await listPostgresqlTables(selectedEnvironmentId, serviceData, databaseName)
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
      const result = await listPostgresqlRoles(selectedEnvironmentId, serviceData)
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
      watchedDatabasesRef.current.delete(databaseName)
      void unregisterDbObjectWatch(selectedEnvironmentId, serviceData.id, databaseName)
      setDatabases(prev => prev.map(d =>
        d.name === databaseName ? { ...d, showTables: false } : d
      ))
      return
    }

    watchedDatabasesRef.current.add(databaseName)
    void registerDbObjectWatch(selectedEnvironmentId, serviceData.id, databaseName)
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
      const result = await createPostgresqlDatabase(selectedEnvironmentId, serviceData, newDbName)
      if (result.success) {
        toast.success(t('postgresql_service.db_create_success'))
        setShowCreateDbDialog(false)
        setNewDbName('')
        void loadDatabases()
      } else {
        toast.error(t('postgresql_service.db_create_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('postgresql_service.db_create_failed', { message: String(error) }))
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
      const result = await createPostgresqlRole(selectedEnvironmentId, serviceData, roleForm.roleName, roleForm.password, grants)
      if (result.success) {
        toast.success(t('postgresql_service.role_create_success', { roleName: roleForm.roleName }))
        setShowCreateRoleDialog(false)
        setRoleForm({ roleName: '', password: '', grants: {}, customDb: '' })
        void loadRoles()
      } else {
        toast.error(t('postgresql_service.role_create_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('postgresql_service.role_create_failed', { message: String(error) }))
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
      const result = await updatePostgresqlRoleGrants(selectedEnvironmentId, serviceData, selectedRoleName, grants)
      if (result.success) {
        toast.success(t('postgresql_service.permission_update_success', { roleName: selectedRoleName }))
        setShowEditRoleDialog(false)
        void loadRoles()
      } else {
        toast.error(t('postgresql_service.permission_update_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('postgresql_service.permission_update_failed', { message: String(error) }))
    } finally {
      setIsSubmittingRole(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!selectedRoleName) return

    setIsSubmittingRole(true)
    try {
      const result = await deletePostgresqlRole(selectedEnvironmentId, serviceData, selectedRoleName)
      if (result.success) {
        toast.success(t('postgresql_service.role_delete_success', { roleName: selectedRoleName }))
        setShowDeleteRoleDialog(false)
        void loadRoles()
      } else {
        toast.error(t('postgresql_service.role_delete_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('postgresql_service.role_delete_failed', { message: String(error) }))
    } finally {
      setIsSubmittingRole(false)
    }
  }

  const refreshServiceStatusSafely = async () => {
    try {
      await refreshServiceStatus()
    } catch (error) {
      console.error('刷新 PostgreSQL 服务状态失败:', error)
    }
  }

  const startService = async () => {
    if (!serviceData?.version) return

    setServiceAction('starting')
    try {
      await refreshServiceStatusSafely()
      const result = await startServiceData(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success(t('postgresql_service.start_success'))
      } else {
        toast.error(t('postgresql_service.start_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('postgresql_service.start_failed', { message: String(error) }))
    } finally {
      await refreshServiceStatusSafely()
      setServiceAction((prev) => (prev === 'starting' ? null : prev))
    }
  }

  const stopService = async () => {
    if (!serviceData?.version) return

    setServiceAction('stopping')
    try {
      await refreshServiceStatusSafely()
      const result = await stopServiceData(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success(t('postgresql_service.stop_success'))
      } else {
        toast.error(t('postgresql_service.stop_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('postgresql_service.stop_failed', { message: String(error) }))
    } finally {
      await refreshServiceStatusSafely()
      setServiceAction((prev) => (prev === 'stopping' ? null : prev))
    }
  }

  const restartService = async () => {
    if (!serviceData?.version) return

    setServiceAction('restarting')
    try {
      await refreshServiceStatusSafely()
      const result = await restartServiceData(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success(t('postgresql_service.restart_success'))
      } else {
        toast.error(t('postgresql_service.restart_failed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('postgresql_service.restart_failed', { message: String(error) }))
    } finally {
      await refreshServiceStatusSafely()
      setServiceAction((prev) => (prev === 'restarting' ? null : prev))
    }
  }

  const handleInitialize = async (reset: boolean = false) => {
    if (!dialogData.superPassword) {
      toast.error(t('postgresql_service.password_required'))
      return
    }

    if (reset && serviceStatus === ServiceStatus.Running) {
      toast.error(t('postgresql_service.running_warning'))
      return
    }

    setIsInitializing(true)
    try {
      const result = await initializePostgresql(
        selectedEnvironmentId,
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

        await updateServiceData({
          environmentId: selectedEnvironmentId,
          serviceId: serviceData.id,
          updates: { metadata: newMetadata },
          serviceDatas: selectedServiceDatas,
        })

        toast.success(t('postgresql_service.init_success'))
        setShowInitDialog(false)
        setShowResetDialog(false)
        setIsInitialized(true)
      } else {
        toast.error(result.message || t('postgresql_service.init_failed'))
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message?: unknown }).message || '未知错误')
            : String(error)

      console.error('初始化 PostgreSQL 失败:', {
        environmentId: selectedEnvironmentId,
        serviceId: serviceData.id,
        error,
      })
      toast.error(t('postgresql_service.init_failed_msg', { message: errorMessage }))
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
              {t('postgresql_service.init_title')}
            </DialogTitle>
            <DialogDescription>
              {t('postgresql_service.init_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="postgres-super-password">{t('postgresql_service.super_password_label')}</Label>
              <Input
                id="postgres-super-password"
                type="password"
                value={dialogData.superPassword}
                onChange={(e) => setDialogData(prev => ({ ...prev, superPassword: e.target.value }))}
                placeholder={t('postgresql_service.super_password_placeholder')}
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
              {dialogData.showAdvanced ? t('postgresql_service.hide_advanced') : t('postgresql_service.show_advanced')}
            </Button>
            {dialogData.showAdvanced && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="postgres-init-port">{t('postgresql_service.port_label')}</Label>
                  <Input
                    id="postgres-init-port"
                    value={dialogData.port}
                    onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="5432"
                    disabled={isInitializing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postgres-init-bind-address">{t('postgresql_service.bind_address_label')}</Label>
                  <Input
                    id="postgres-init-bind-address"
                    value={dialogData.bindAddress}
                    onChange={(e) => setDialogData(prev => ({ ...prev, bindAddress: e.target.value }))}
                    placeholder="127.0.0.1"
                    disabled={isInitializing}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('postgresql_service.local_access_note')}
                  </p>
                </div>
              </>
            )}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {t('postgresql_service.init_alert')}
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitDialog(false)} disabled={isInitializing} className="shadow-none">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void handleInitialize(false)}
              disabled={isInitializing || !dialogData.superPassword}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('postgresql_service.initializing')}
                </>
              ) : t('postgresql_service.start_init')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t('postgresql_service.reset_title')}
            </DialogTitle>
            <DialogDescription>
              {t('postgresql_service.reset_desc')}
              <span className="text-red-600 font-semibold">{t('postgresql_service.reset_irrecoverable')}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!isInitializing && serviceStatus === ServiceStatus.Running && (
              <Alert variant="destructive" className="p-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {t('postgresql_service.running_warning_text')}
                  </AlertDescription>
                </div>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="postgres-reset-password">{t('postgresql_service.new_super_password_label')}</Label>
              <Input
                id="postgres-reset-password"
                type="password"
                value={dialogData.superPassword}
                onChange={(e) => setDialogData(prev => ({ ...prev, superPassword: e.target.value }))}
                placeholder={t('postgresql_service.new_super_password_placeholder')}
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
              {dialogData.showAdvanced ? t('postgresql_service.hide_advanced') : t('postgresql_service.show_advanced')}
            </Button>
            {dialogData.showAdvanced && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="postgres-reset-port">{t('postgresql_service.port_label')}</Label>
                  <Input
                    id="postgres-reset-port"
                    value={dialogData.port}
                    onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="5432"
                    disabled={isInitializing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postgres-reset-bind-address">{t('postgresql_service.bind_address_label')}</Label>
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
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleInitialize(true)}
              disabled={isInitializing || !dialogData.superPassword || serviceStatus === ServiceStatus.Running}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('postgresql_service.resetting')}
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {t('postgresql_service.confirm_reset')}
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
                  {t('postgresql_service.not_initialized_title')}
                </p>
                <p className="text-[11px] text-orange-700 dark:text-orange-400 leading-relaxed">
                  {t('postgresql_service.not_initialized_desc')}
                </p>
              </div>
            </div>
            <div className="flex">
              <Button
                size="sm"
                onClick={() => setShowInitDialog(true)}
                className="h-7 text-xs shadow-none bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white"
              >
                {t('postgresql_service.init_now')}
              </Button>
            </div>
          </div>
        )}

        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              {t('postgresql_service.service_control')}
            </Label>
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                serviceStatus === ServiceStatus.Running ? 'bg-green-500' :
                  serviceStatus === ServiceStatus.Stopped ? 'bg-red-500' : 'bg-gray-300'
              )} />
              <span className="text-xs font-normal text-muted-foreground">
                {serviceStatus === ServiceStatus.Running ? t('postgresql_service.running') :
                  serviceStatus === ServiceStatus.Stopped ? t('postgresql_service.stopped') : t('postgresql_service.unknown_status')}
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
                {t('postgresql_service.start')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                onClick={() => void stopService()}
                disabled={serviceStatus === ServiceStatus.Stopped || isStarting || isStopping || isRestarting}
              >
                <PowerOff className="h-3.5 w-3.5 text-red-600" />
                {t('postgresql_service.stop')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                onClick={() => void restartService()}
                disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
              >
                <RotateCw className={cn('h-3.5 w-3.5 text-blue-600', isRestarting && 'animate-spin')} />
                {t('postgresql_service.restart')}
              </Button>
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          {isServiceActive && isInitialized ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('postgresql_service.config_file_label')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={configPath}
                    readOnly
                    placeholder={t('postgresql_service.config_path_placeholder')}
                    className="flex-1 h-8 text-xs shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => configPath && openFolderInFinder(configPath)}
                    disabled={!configPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    title={t('postgresql_service.open_config_dir_title')}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('postgresql_service.data_dir_label')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={postgresqlConfig?.dataPath || t('postgresql_service.not_configured')}
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
                    title={t('postgresql_service.open_dir_title')}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('postgresql_service.log_file_label')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={postgresqlConfig?.logPath || t('postgresql_service.not_configured')}
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
                    title={t('postgresql_service.open_dir_title')}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('postgresql_service.host_label')}</Label>
                  <Input
                    value={postgresqlConfig?.bindIp || t('postgresql_service.not_configured')}
                    readOnly
                    className="text-xs h-8 mt-1 shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('postgresql_service.port_from_config')}</Label>
                  <Input
                    value={postgresqlConfig?.port ?? t('postgresql_service.not_configured')}
                    readOnly
                    className="text-xs h-8 mt-1 shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('postgresql_service.management_tools')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const result = await openPostgresqlClient(selectedEnvironmentId, serviceData)
                        if (result.success) {
                          toast.success(t('postgresql_service.client_opened'))
                        } else {
                          toast.error(result.message || t('postgresql_service.client_open_failed'))
                        }
                      } catch (error) {
                        toast.error(t('postgresql_service.client_open_failed') + ': ' + String(error))
                      }
                    }}
                    disabled={serviceStatus !== ServiceStatus.Running}
                    className="flex items-center gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    {t('postgresql_service.psql_client_label')}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Settings className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {!isServiceActive ? (
                <>
                  <p className="text-sm">{t('postgresql_service.service_not_active_config')}</p>
                  <p className="text-xs">{t('postgresql_service.activate_service_hint')}</p>
                </>
              ) : (
                <>
                  <p className="text-sm">{t('postgresql_service.not_initialized_short')}</p>
                  <p className="text-xs">{t('postgresql_service.complete_init')}</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              {t('postgresql_service.db_management')}
            </Label>
            {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDbDialog(true)}
                className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
              >
                <Plus className="h-3 w-3 mr-1" />
                {t('postgresql_service.new_database')}
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
                                      {t('postgresql_service.collapse_tables', { count: db.tables.length - 4 })}
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      {t('postgresql_service.more_tables', { count: db.tables.length - 4 })}
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 text-center py-2">{t('postgresql_service.no_tables')}</div>
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
                          {t('postgresql_service.collapse_dbs', { count: databases.length - 4 })}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5 mr-1" />
                          {t('postgresql_service.more_dbs', { count: databases.length - 4 })}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed border-gray-200 dark:border-white/10">
                  {isLoadingDatabases ? (
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                  ) : t('postgresql_service.no_databases')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Database className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {!isServiceActive ? (
                <>
                  <p className="text-sm">{t('postgresql_service.service_not_active_db')}</p>
                  <p className="text-xs">{t('postgresql_service.cannot_manage_db')}</p>
                </>
              ) : !isInitialized ? (
                <>
                  <p className="text-sm">{t('postgresql_service.not_initialized_short')}</p>
                  <p className="text-xs">{t('postgresql_service.complete_init')}</p>
                </>
              ) : (
                <>
                  <p className="text-sm">{t('postgresql_service.service_not_running')}</p>
                  <p className="text-xs">{t('postgresql_service.start_first')}</p>
                </>
              )}
            </div>
          )}
        </div>

        <Dialog open={showCreateDbDialog} onOpenChange={setShowCreateDbDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('postgresql_service.new_database_title')}</DialogTitle>
              <DialogDescription>
                {t('postgresql_service.new_database_desc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="pg-db-name">{t('postgresql_service.db_name_label')}</Label>
                <Input
                  id="pg-db-name"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  placeholder={t('postgresql_service.db_name_placeholder')}
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
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void handleCreateDatabase()} disabled={!newDbName || isCreatingDb}>
                {isCreatingDb ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {t('postgresql_service.creating')}
                  </>
                ) : t('postgresql_service.create')}
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
                {t('postgresql_service.new_role_title')}
              </DialogTitle>
              <DialogDescription>{t('postgresql_service.new_role_desc')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-role-name">{t('postgresql_service.role_name_label')}</Label>
                <Input
                  id="new-role-name"
                  value={roleForm.roleName}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, roleName: e.target.value }))}
                  placeholder={t('postgresql_service.role_name_placeholder')}
                  disabled={isSubmittingRole}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role-password">{t('postgresql_service.password_label')}</Label>
                <Input
                  id="new-role-password"
                  type="password"
                  value={roleForm.password}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={t('postgresql_service.password_placeholder')}
                  disabled={isSubmittingRole}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">{t('postgresql_service.db_permissions')}</Label>
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
                              {priv === 'SELECT' ? t('postgresql_service.privilege_read') : t('postgresql_service.privilege_read_write')}
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
                    placeholder={t('postgresql_service.custom_db_placeholder')}
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
                          {db}: {priv === 'ALL PRIVILEGES' ? t('postgresql_service.privilege_read_write') : t('postgresql_service.privilege_read')}
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
              <Button className="shadow-none" variant="outline" onClick={() => setShowCreateRoleDialog(false)} disabled={isSubmittingRole}>{t('common.cancel')}</Button>
              <Button onClick={() => void handleCreateRole()} disabled={!roleForm.roleName || !roleForm.password || isSubmittingRole}>
                {isSubmittingRole ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('postgresql_service.creating')}</> : t('postgresql_service.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditRoleDialog} onOpenChange={setShowEditRoleDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                {t('postgresql_service.edit_permissions_title', { roleName: selectedRoleName })}
              </DialogTitle>
              <DialogDescription>{t('postgresql_service.edit_permissions_desc')}</DialogDescription>
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
                            {priv === 'SELECT' ? t('postgresql_service.privilege_read') : t('postgresql_service.privilege_read_write')}
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
                  placeholder={t('postgresql_service.custom_db_placeholder')}
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
                        {db}: {priv === 'ALL PRIVILEGES' ? t('postgresql_service.privilege_read_write') : t('postgresql_service.privilege_read')}
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
              <Button className="shadow-none" variant="outline" onClick={() => setShowEditRoleDialog(false)} disabled={isSubmittingRole}>{t('common.cancel')}</Button>
              <Button onClick={() => void handleUpdateRoleGrants()} disabled={isSubmittingRole}>
                {isSubmittingRole ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('postgresql_service.saving')}</> : t('postgresql_service.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteRoleDialog} onOpenChange={setShowDeleteRoleDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                {t('postgresql_service.delete_role_title')}
              </DialogTitle>
              <DialogDescription>
                {t('postgresql_service.delete_role_confirm', { roleName: selectedRoleName })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button className="shadow-none" variant="outline" onClick={() => setShowDeleteRoleDialog(false)} disabled={isSubmittingRole}>{t('common.cancel')}</Button>
              <Button variant="destructive" onClick={() => void handleDeleteRole()} disabled={isSubmittingRole}>
                {isSubmittingRole ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('postgresql_service.deleting')}</> : t('postgresql_service.confirm_delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              {t('postgresql_service.role_management')}
            </Label>
            {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateRoleDialog(true)}
                className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
              >
                <UserPlus className="h-3 w-3 mr-1" />
                {t('postgresql_service.new_role')}
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
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">{t('postgresql_service.admin_tag')}</span>
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
                          title={t('common.edit')}
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
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-6 border rounded-lg border-dashed border-gray-200 dark:border-white/10">
                  {t('postgresql_service.no_normal_roles')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Users className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {!isServiceActive ? (
                <><p className="text-sm">{t('postgresql_service.service_not_active_roles')}</p><p className="text-xs">{t('postgresql_service.cannot_manage_roles')}</p></>
              ) : !isInitialized ? (
                <><p className="text-sm">{t('postgresql_service.not_initialized_short')}</p><p className="text-xs">{t('postgresql_service.complete_init')}</p></>
              ) : (
                <><p className="text-sm">{t('postgresql_service.service_not_running')}</p><p className="text-xs">{t('postgresql_service.start_first')}</p></>
              )}
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('postgresql_service.other_operations')}
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
                {t('postgresql_service.reset_init')}
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <BarChart3 className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('postgresql_service.service_not_active_db')}</p>
              <p className="text-xs">{t('postgresql_service.cannot_use_other_operations')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
