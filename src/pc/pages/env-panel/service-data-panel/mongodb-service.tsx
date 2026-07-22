import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  Copy,
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
  Trash2,
  Info,
  Cpu,
  Users,
  MoreHorizontal,
  RotateCw,
  User,
  UserPlus,
  ShieldCheck,
  Pencil
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ServiceData, ServiceDataStatus, ServiceStatus } from '@/types/index'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtom } from 'jotai'
import { selectedEnvironmentIdAtom } from '../../../store/environment'
import { useFileOperations } from "@/hooks/file-operations"
import { MongoDBConfig, MongoDBMetadata } from "@/types/service"
import { useMongodb } from "@/hooks/services/mongodb"
import { useEnvironmentServiceData, useServiceData } from "@/hooks/env-serv-data"
import { useService } from "@/hooks/service"
import {
  registerDbObjectWatch,
  unregisterDbObjectWatch,
  useServiceDataStatus,
  useServiceDatabasePush,
  useServiceDbObjectPush,
  useServicePrincipalPush,
  useServiceStatus,
} from '@/hooks/useStatus'

interface MongoDBServiceProps {
  serviceData: ServiceData
}

export function MongoDBService({ serviceData }: MongoDBServiceProps) {
  const { t } = useTranslation()
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)

  const configPath = useMemo(() => {
    return serviceData.metadata?.['MONGODB_CONFIG'] || ''
  }, [serviceData, serviceData.metadata, serviceData.metadata?.['MONGODB_CONFIG']])

  // MongoDB 配置状态
  const [mongoConfig, setMongoConfig] = useState<MongoDBConfig | null>(null)

  // 编辑中的配置路径
  const [editingConfigPath, setEditingConfigPath] = useState<string>('')

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
  const isServiceActive = serviceDataStatus === ServiceDataStatus.Active;

  const { status: serviceStatus, refresh: refreshServiceStatus } = useServiceStatus(selectedEnvironmentId, serviceData, {
    enabled: isServiceActive && Boolean(isInitialized),
    interval: 500,
  })

  // 弹窗数据 - 整合到一个 state 对象
  const [dialogData, setDialogData] = useState({
    adminUsername: 'admin',
    adminPassword: '',
    port: '27017',
    bindIp: '127.0.0.1',
    enableReplicaSet: false,
    initStep: '',
    initMessage: '', // 新增：当前步骤的详细信息
    showAdvanced: false
  })

  // 密码显示状态
  const [showPassword, setShowPassword] = useState(false)

  // 加载状态
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)

  // 当前选中的 Tab
  const [activeTab, setActiveTab] = useState<'connection' | 'config'>('config')

  // 用户管理相关状态
  const [users, setUsers] = useState<Array<{
    _id: string;
    user: string;
    db: string;
    roles: Array<{ role: string; db: string }>;
  }>>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false)
  const [showEditUserDialog, setShowEditUserDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    databaseRoles: {} as Record<string, 'read' | 'readWrite'>, // 数据库名 -> 权限
  })

  // 数据库管理相关状态
  const [databases, setDatabases] = useState<Array<{
    name: string,
    sizeOnDisk: number,
    empty: boolean,
    collections?: string[],
    isLoadingCollections?: boolean,
    showCollections?: boolean,
    showAllCollections?: boolean
  }>>([])
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false)
  const [showAllDatabases, setShowAllDatabases] = useState(false)
  const [showCreateDbDialog, setShowCreateDbDialog] = useState(false)
  const [newDbName, setNewDbName] = useState('')
  const [isCreatingDb, setIsCreatingDb] = useState(false)
  const [customDbName, setCustomDbName] = useState('')
  const watchedDatabasesRef = useRef<Set<string>>(new Set())

  const { openFolderInFinder } = useFileOperations()
  const {
    getMongodbConfig,
    openMongoDBCompass,
    openMongoDBShell,
    initializeMongoDB,
    checkMongoDBInitialized,
    listMongoDBDatabases,
    listMongoDBCollections,
    createMongoDBDatabase,
    useMongoDBInitProgress,
    createMongoDBUser,
    listMongoDBUsers,
    updateMongoDBUserRoles,
    deleteMongoDBUser,
  } = useMongodb();
  const {
      startServiceData,
      stopServiceData,
      restartServiceData,
  } = useServiceData()
  const {
    updateServiceData,
    selectedServiceDatas,
  } = useEnvironmentServiceData();

  // 检查初始化状态
  useEffect(() => {
    if (isServiceActive) {
      checkInitialized()
    }
  }, [isServiceActive])

  // 监听初始化进度事件
  useMongoDBInitProgress(useCallback((payload: { step: string; message: string }) => {
    console.log('收到初始化进度:', payload);
    const { step, message } = payload;
    setDialogData(prev => ({
      ...prev,
      initStep: step,
      initMessage: message
    }));
  }, []));

  // 将步骤标识转换为友好的标签
  const getStepLabel = (step: string): string => {
    const stepLabels: Record<string, string> = {
      'mongodb_check_installation': t('mongodb.steps.check_installation'),
      'mongodb_reset': t('mongodb.steps.reset'),
      'mongodb_check_existing': t('mongodb.steps.check_existing'),
      'mongodb_create_directories': t('mongodb.steps.create_directories'),
      'mongodb_create_keyfile': t('mongodb.steps.create_keyfile'),
      'mongodb_create_config': t('mongodb.steps.create_config'),
      'mongodb_create_admin': t('mongodb.steps.create_admin'),
      'mongodb_init_replica_set': t('mongodb.steps.init_replica_set'),
      'mongodb_complete': t('mongodb.steps.complete'),
      'error': t('status.service.error')
    };
    return stepLabels[step] || step;
  };

  const checkInitialized = async () => {
    try {
      const result = await checkMongoDBInitialized(selectedEnvironmentId, serviceData)
      if (result.success && result.data) {
        setIsInitialized(result.data.initialized)
      }
    } catch (error) {
      console.error('检查初始化状态失败:', error)
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
      const result = await listMongoDBDatabases(selectedEnvironmentId, serviceData)
      if (result.success && result.data?.databases) {
        // 保留现有的展开/折叠状态
        setDatabases(prev => {
          const newDatabases = result.data!.databases.map(db => {
            const existingDb = prev.find(d => d.name === db.name)
            return {
              ...db,
              collections: existingDb?.collections,
              isLoadingCollections: existingDb?.isLoadingCollections || false,
              showCollections: existingDb?.showCollections || false,
              showAllCollections: existingDb?.showAllCollections || false
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

  // 加载指定数据库的集合列表
  const loadCollections = async (databaseName: string) => {
    setDatabases(prev => prev.map(db =>
      db.name === databaseName
        ? { ...db, isLoadingCollections: true }
        : db
    ))

    try {
      const result = await listMongoDBCollections(selectedEnvironmentId, serviceData, databaseName)
      if (result.success && result.data?.collections) {
        setDatabases(prev => prev.map(db =>
          db.name === databaseName
            ? {
              ...db,
              collections: result.data!.collections,
              isLoadingCollections: false,
              showCollections: true
            }
            : db
        ))
      }
    } catch (error) {
      console.error(`加载数据库 ${databaseName} 的集合列表失败:`, error)
      setDatabases(prev => prev.map(db =>
        db.name === databaseName
          ? { ...db, isLoadingCollections: false }
          : db
      ))
    }
  }

  // 创建数据库
  const handleCreateDatabase = async () => {
    if (!newDbName) return
    setIsCreatingDb(true)
    try {
      const result = await createMongoDBDatabase(selectedEnvironmentId, serviceData, newDbName)
      if (result.success) {
        toast.success(t('mongodb.db_create_success'))
        setShowCreateDbDialog(false)
        setNewDbName('')
        loadDatabases()
      } else {
        toast.error(t('mongodb.db_create_error', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mongodb.db_create_error', { message: error }))
    } finally {
      setIsCreatingDb(false)
    }
  }

  // 加载用户列表
  const loadUsers = async () => {
    if (!isServiceActive || !isInitialized || serviceStatus !== ServiceStatus.Running) {
      setUsers([])
      return
    }

    setIsLoadingUsers(true)
    try {
      const result = await listMongoDBUsers(selectedEnvironmentId, serviceData)
      if (result.success && result.data?.users) {
        setUsers(result.data.users)
      }
    } catch (error) {
      console.error('加载用户列表失败:', error)
    } finally {
      setIsLoadingUsers(false)
    }
  }

  // 创建用户
  const handleCreateUser = async () => {
    if (!userForm.username || !userForm.password) {
      toast.error(t('mongodb.user.input_required'))
      return
    }
    if (Object.keys(userForm.databaseRoles).length === 0) {
      toast.error(t('mongodb.user.role_required'))
      return
    }

    try {
      // 将 databaseRoles 转换为 databases 和 roles 数组
      const databases = Object.keys(userForm.databaseRoles)
      const roles = Object.values(userForm.databaseRoles)

      const result = await createMongoDBUser(
        selectedEnvironmentId,
        serviceData,
        userForm.username,
        userForm.password,
        databases,
        roles
      )
      if (result.success) {
        toast.success(t('mongodb.user.create_success'))
        setShowCreateUserDialog(false)
        setUserForm({
          username: '',
          password: '',
          databaseRoles: {},
        })
        loadUsers()
      } else {
        toast.error(t('mongodb.user.create_error', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mongodb.user.create_error', { message: error }))
    }
  }

  // 更新用户权限
  const handleUpdateUser = async () => {
    if (Object.keys(userForm.databaseRoles).length === 0) {
      toast.error(t('mongodb.user.role_required'))
      return
    }

    try {
      // 将 databaseRoles 转换为 databases 和 roles 数组
      const databases = Object.keys(userForm.databaseRoles)
      const roles = Object.values(userForm.databaseRoles)

      const result = await updateMongoDBUserRoles(
        selectedEnvironmentId,
        serviceData,
        selectedUser,
        databases,
        roles
      )
      if (result.success) {
        toast.success(t('mongodb.user.update_success'))
        setShowEditUserDialog(false)
        setUserForm({
          username: '',
          password: '',
          databaseRoles: {},
        })
        loadUsers()
      } else {
        toast.error(t('mongodb.user.update_error', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mongodb.user.update_error', { message: error }))
    }
  }

  // 删除用户
  const handleDeleteUser = async (username: string) => {
    if (!confirm(t('mongodb.user.delete_confirm', { username: username }))) {
      return
    }

    try {
      const result = await deleteMongoDBUser(selectedEnvironmentId, serviceData, username)
      if (result.success) {
        toast.success(t('mongodb.user.delete_success'))
        loadUsers()
      } else {
        toast.error(t('mongodb.user.delete_error', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mongodb.user.delete_error', { message: error }))
    }
  }

  // 打开编辑用户对话框
  const openEditUserDialog = (user: typeof users[0]) => {
    setSelectedUser(user.user)
    // 将用户的 roles 数组转换为 databaseRoles 对象
    const databaseRoles: Record<string, 'read' | 'readWrite'> = {}
    user.roles.forEach(role => {
      databaseRoles[role.db] = role.role as 'read' | 'readWrite'
    })
    setUserForm({
      username: user.user,
      password: '',
      databaseRoles,
    })
    setShowEditUserDialog(true)
  }

  // 切换集合显示状态
  const toggleCollections = (databaseName: string) => {
    const db = databases.find(d => d.name === databaseName)
    if (!db) return

    if (db.showCollections) {
      watchedDatabasesRef.current.delete(databaseName)
      void unregisterDbObjectWatch(selectedEnvironmentId, serviceData.id, databaseName)
      // 折叠
      setDatabases(prev => prev.map(d =>
        d.name === databaseName
          ? { ...d, showCollections: false }
          : d
      ))
    } else {
      watchedDatabasesRef.current.add(databaseName)
      void registerDbObjectWatch(selectedEnvironmentId, serviceData.id, databaseName)
      // 展开 - 如果还没加载过集合，则加载
      if (!db.collections) {
        loadCollections(databaseName)
      } else {
        setDatabases(prev => prev.map(d =>
          d.name === databaseName
            ? { ...d, showCollections: true }
            : d
        ))
      }
    }
  }

  // 切换显示所有集合
  const toggleAllCollections = (databaseName: string) => {
    setDatabases(prev => prev.map(d =>
      d.name === databaseName
        ? { ...d, showAllCollections: !d.showAllCollections }
        : d
    ))
  }

  // 加载 MongoDB 配置
  useEffect(() => {
    // 只有在服务激活且已初始化时才加载配置
    if (isServiceActive && isInitialized) {
      loadMongoConfig(serviceData)
      return () => { }
    } else {
      // 服务未激活时清空配置
      setMongoConfig(null)
      return () => { } // 确保所有路径都有返回值
    }
  }, [isServiceActive, isInitialized])

  // running 后执行一次初始化拉取，后续更新走 Rust 主动推送
  useEffect(() => {
    if (isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running) {
      void loadDatabases()
      void loadUsers()
      return () => { }
    } else {
      const watched = Array.from(watchedDatabasesRef.current)
      for (const dbName of watched) {
        void unregisterDbObjectWatch(selectedEnvironmentId, serviceData.id, dbName)
      }
      watchedDatabasesRef.current.clear()
      setDatabases([])
      setUsers([])
      return () => { }
    }
  }, [isServiceActive, isInitialized, serviceStatus])

  useEffect(() => {
    return () => {
      const watched = Array.from(watchedDatabasesRef.current)
      for (const dbName of watched) {
        void unregisterDbObjectWatch(selectedEnvironmentId, serviceData.id, dbName)
      }
      watchedDatabasesRef.current.clear()
    }
  }, [selectedEnvironmentId, serviceData.id])

  useServiceDatabasePush<Array<{ name: string, sizeOnDisk: number, empty: boolean }>>(
    selectedEnvironmentId,
    serviceData,
    (payload) => {
      const databaseItems = Array.isArray(payload.items)
        ? payload.items.filter((item): item is { name: string, sizeOnDisk: number, empty: boolean } =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as { name?: unknown }).name === 'string' &&
          typeof (item as { sizeOnDisk?: unknown }).sizeOnDisk === 'number' &&
          typeof (item as { empty?: unknown }).empty === 'boolean')
        : []

      setDatabases(prev => {
        const newDatabases = databaseItems.map((db) => {
          const existingDb = prev.find(d => d.name === db.name)
          return {
            ...db,
            collections: existingDb?.collections,
            isLoadingCollections: existingDb?.isLoadingCollections || false,
            showCollections: existingDb?.showCollections || false,
            showAllCollections: existingDb?.showAllCollections || false,
          }
        })
        return newDatabases
      })
    },
    { enabled: isServiceActive && Boolean(isInitialized) && serviceStatus === ServiceStatus.Running },
  )

  useServicePrincipalPush<Array<{
    _id: string;
    user: string;
    db: string;
    roles: Array<{ role: string; db: string }>;
  }>>(
    selectedEnvironmentId,
    serviceData,
    (payload) => {
      const nextUsers = Array.isArray(payload.items) ? payload.items : []
      setUsers(nextUsers)
      setIsLoadingUsers(false)
    },
    { enabled: isServiceActive && Boolean(isInitialized) && serviceStatus === ServiceStatus.Running },
  )

  useServiceDbObjectPush<string[]>(
    selectedEnvironmentId,
    serviceData,
    (payload) => {
      if (!payload.databaseName) {
        return
      }
      const collectionNames = Array.isArray(payload.items)
        ? payload.items.filter((item): item is string => typeof item === 'string')
        : []

      setDatabases(prev => prev.map(db =>
        db.name === payload.databaseName
          ? {
            ...db,
            collections: collectionNames,
            isLoadingCollections: false,
            showCollections: db.showCollections || watchedDatabasesRef.current.has(db.name),
          }
          : db
      ))
    },
    { enabled: isServiceActive && Boolean(isInitialized) && serviceStatus === ServiceStatus.Running },
  )

  // 当 configPath 变化时，更新编辑状态
  useEffect(() => {
    setEditingConfigPath(configPath || '')
  }, [configPath])

  const loadMongoConfig = async (serviceData: ServiceData) => {
    // 只有在服务激活时才加载配置
    if (!isServiceActive) return
    console.log('zws 加载 MongoDB 配置', serviceData)
    setIsLoading(true)
    try {
      const config = await getMongodbConfig(selectedEnvironmentId, serviceData)
      console.log(`zws 2452`, config)
      if (config) {
        setMongoConfig(config)
      }
    } catch (error) {
      toast.error(t('mongodb.config_load_error', { message: error }))
    } finally {
      setIsLoading(false)
    }
  }

  // 启动 MongoDB 服务
  const startService = async () => {
    if (!serviceData?.version) return

    setIsStarting(true)
    try {
      const result = await startServiceData(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success(t('mongodb.start_success'))
      } else {
        toast.error(t('mongodb.start_error', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mongodb.start_error', { message: error }))
    } finally {
      setIsStarting(false)
    }
  }

  // 停止 MongoDB 服务
  const stopService = async () => {
    if (!serviceData?.version) return

    setIsStopping(true)
    try {
      const result = await stopServiceData(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success(t('mongodb.stop_success'))
      } else {
        toast.error(t('mongodb.stop_error', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mongodb.stop_error', { message: error }))
    } finally {
      setIsStopping(false)
    }
  }

  // 重启 MongoDB 服务
  const restartService = async () => {
    if (!serviceData?.version) return

    setIsRestarting(true)
    try {
      const result = await restartServiceData(selectedEnvironmentId, serviceData)
      if (result.success) {
        toast.success(t('mongodb.restart_success'))
      } else {
        toast.error(t('mongodb.restart_error', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('mongodb.restart_error', { message: error }))
    } finally {
      setIsRestarting(false)
    }
  }

  // 初始化 MongoDB
  const handleInitialize = async (reset: boolean = false) => {
    if (!dialogData.adminUsername || !dialogData.adminPassword) {
      toast.error(t('mongodb.init_input_required'))
      return
    }

    // 如果是重置操作,检查 MongoDB 是否正在运行
    if (reset && serviceStatus === ServiceStatus.Running) {
      toast.error(t('mongodb.init_reset_running'))
      return
    }

    setIsInitializing(true)
    // 清空进度信息，准备接收新的进度更新
    setDialogData(prev => ({ ...prev, initStep: '', initMessage: t('mongodb.init_preparing') }))

    try {
      const result = await initializeMongoDB(
        selectedEnvironmentId,
        serviceData,
        dialogData.adminUsername,
        dialogData.adminPassword,
        dialogData.port,
        dialogData.bindIp,
        dialogData.enableReplicaSet,
        reset
      )
      const newMetadata: MongoDBMetadata = { ...(serviceData.metadata || {}) }
      console.log('zws 初始化结果:', result)
      if (result.success && result.data) {
        const data = result.data
        let successMessage = t('mongodb.init_success')

        // 根据副本集启用状态和初始化结果显示不同的消息
        if (dialogData.enableReplicaSet) {
          if (data?.replicaSetInitialized === false) {
            successMessage += t('mongodb.init_success_replica_failed')
          } else if (data?.replicaSetInitialized === true) {
            successMessage += t('mongodb.init_success_replica_enabled')
          }
        }

        newMetadata['MONGODB_CONFIG'] = data.configPath
        newMetadata['MONGODB_KEYFILE_PATH'] = data.keyfilePath
        newMetadata['MONGODB_ADMIN_USERNAME'] = data.adminUsername
        newMetadata['MONGODB_ADMIN_PASSWORD'] = data.adminPassword
        const updatedServiceData = await updateServiceData({
          environmentId: selectedEnvironmentId,
          serviceId: serviceData.id,
          updates: { metadata: newMetadata },
          serviceDatas: selectedServiceDatas,
        });
        if (updatedServiceData) {
          // 重新加载配置
          loadMongoConfig(updatedServiceData)
        }

        toast.success(successMessage)
        setShowInitDialog(false)
        setShowResetDialog(false)
        setIsInitialized(true)
        setDialogData(prev => ({ ...prev, initStep: '', initMessage: '' }))
      } else {
        const errorMsg = result.message || t('mongodb.init_failed')
        toast.error(errorMsg)
        setDialogData(prev => ({ ...prev, initStep: 'error', initMessage: t('mongodb.init_failed_with_message', { message: errorMsg }) }))
      }
    } catch (error) {
      const errorMsg = String(error)
      toast.error(t('mongodb.init_failed_with_message', { message: errorMsg }))
      setDialogData(prev => ({ ...prev, initStep: 'error', initMessage: t('mongodb.init_failed_with_message', { message: errorMsg }) }))
    } finally {
      setIsInitializing(false)
    }
  }

  // 设置配置文件路径
  const handleSetConfigPath = async () => {
    if (!serviceData?.version) return
    if (!editingConfigPath) {
      toast.error(t('mongodb.config_path_required'))
      return
    }

    setIsLoading(true)
    try {
      const newMetadata: MongoDBMetadata = { ...(serviceData.metadata || {}) }
      newMetadata['MONGODB_CONFIG'] = editingConfigPath
      const updatedServiceData = await updateServiceData({
        environmentId: selectedEnvironmentId,
        serviceId: serviceData.id,
        updates: { metadata: newMetadata },
        serviceDatas: selectedServiceDatas,
      })
      if (updatedServiceData) {
        toast.success(t('mongodb.config_path_set_success'))
        loadMongoConfig(updatedServiceData)
      } else {
        toast.error(t('mongodb.config_path_set_failed'))
      }
    } catch (error) {
      toast.error(t('mongodb.config_path_set_failed_with_message', { message: error }))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-3">
      {/* 初始化对话框 */}
      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {t('mongodb.init_dialog_title')}
            </DialogTitle>
            <DialogDescription>
              {t('mongodb.init_dialog_desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-username">{t('mongodb.admin_username')}</Label>
              <Input
                id="admin-username"
                value={dialogData.adminUsername}
                onChange={(e) => setDialogData(prev => ({ ...prev, adminUsername: e.target.value }))}
                placeholder={t('mongodb.admin_username_placeholder')}
                disabled={isInitializing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">{t('mongodb.admin_password')}</Label>
              <Input
                id="admin-password"
                type="password"
                value={dialogData.adminPassword}
                onChange={(e) => setDialogData(prev => ({ ...prev, adminPassword: e.target.value }))}
                placeholder={t('mongodb.admin_password_placeholder')}
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
              {dialogData.showAdvanced ? t('mongodb.hide_advanced_options') : t('mongodb.show_advanced_options')}
            </Button>

            {dialogData.showAdvanced && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="init-port">{t('mongodb.port')}</Label>
                  <Input
                    id="init-port"
                    value={dialogData.port}
                    onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="27017"
                    disabled={isInitializing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="init-bind-ip">{t('mongodb.bind_ip')}</Label>
                  <Input
                    id="init-bind-ip"
                    value={dialogData.bindIp}
                    onChange={(e) => setDialogData(prev => ({ ...prev, bindIp: e.target.value }))}
                    placeholder="127.0.0.1"
                    disabled={isInitializing}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('mongodb.bind_ip_hint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enable-replica-set"
                      checked={dialogData.enableReplicaSet}
                      onCheckedChange={(checked) => setDialogData(prev => ({ ...prev, enableReplicaSet: checked as boolean }))}
                      disabled={isInitializing}
                    />
                    <Label
                      htmlFor="enable-replica-set"
                      className="text-sm font-normal cursor-pointer"
                    >
                      {t('mongodb.enable_replica_set')}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    {t('mongodb.replica_set_hint')}
                  </p>
                </div>
              </>
            )}

            {isInitializing && (dialogData.initStep || dialogData.initMessage) ? (
              <Alert>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <AlertDescription className="space-y-1">
                  {dialogData.initMessage && (
                    <div className="text-sm font-medium">{dialogData.initMessage}</div>
                  )}
                  {dialogData.initStep && dialogData.initStep !== 'error' && (
                    <div className="text-xs text-muted-foreground">
                      {t('mongodb.step_prefix')} {getStepLabel(dialogData.initStep)}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {t('mongodb.init_notice', { includeReplicaSet: dialogData.enableReplicaSet ? t('mongodb.init_notice_replica') : '' })}
                  {dialogData.enableReplicaSet && t('mongodb.init_notice_replica_extra')}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInitDialog(false)}
              disabled={isInitializing}
              className="shadow-none"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => handleInitialize(false)}
              disabled={isInitializing || !dialogData.adminUsername || !dialogData.adminPassword}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('mongodb.initializing')}
                </>
              ) : (
                t('mongodb.start_init')
              )}
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
              {t('mongodb.reset_dialog_title')}
            </DialogTitle>
            <DialogDescription>
              {t('mongodb.reset_dialog_desc')}
              <span className="text-red-600 font-semibold">{t('mongodb.irreversible')}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!isInitializing && serviceStatus === ServiceStatus.Running && (
              <Alert variant="destructive" className="p-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>{t('mongodb.running_warning_title')}</strong> {t('mongodb.running_warning_desc')}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="reset-admin-username">{t('mongodb.new_admin_username')}</Label>
              <Input
                id="reset-admin-username"
                value={dialogData.adminUsername}
                onChange={(e) => setDialogData(prev => ({ ...prev, adminUsername: e.target.value }))}
                placeholder={t('mongodb.admin_username_placeholder')}
                disabled={isInitializing}
                className="shadow-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-admin-password">{t('mongodb.new_admin_password')}</Label>
              <Input
                id="reset-admin-password"
                type="password"
                value={dialogData.adminPassword}
                onChange={(e) => setDialogData(prev => ({ ...prev, adminPassword: e.target.value }))}
                placeholder={t('mongodb.admin_password_placeholder')}
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
              {dialogData.showAdvanced ? t('mongodb.hide_advanced_options') : t('mongodb.show_advanced_options')}
            </Button>

            {dialogData.showAdvanced && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reset-port">{t('mongodb.port')}</Label>
                  <Input
                    id="reset-port"
                    value={dialogData.port}
                    onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="27017"
                    disabled={isInitializing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-bind-ip">{t('mongodb.bind_ip')}</Label>
                  <Input
                    id="reset-bind-ip"
                    value={dialogData.bindIp}
                    onChange={(e) => setDialogData(prev => ({ ...prev, bindIp: e.target.value }))}
                    placeholder="127.0.0.1"
                    disabled={isInitializing}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="reset-enable-replica-set"
                      checked={dialogData.enableReplicaSet}
                      onCheckedChange={(checked) => setDialogData(prev => ({ ...prev, enableReplicaSet: checked as boolean }))}
                      disabled={isInitializing}
                    />
                    <Label
                      htmlFor="reset-enable-replica-set"
                      className="text-sm font-normal cursor-pointer"
                    >
                      {t('mongodb.enable_replica_set')}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    {t('mongodb.replica_set_hint')}
                  </p>
                </div>
              </>
            )}

            {isInitializing && (dialogData.initStep || dialogData.initMessage) && (
              <Alert>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <AlertDescription className="space-y-1">
                  {dialogData.initMessage && (
                    <div className="text-sm font-medium">{dialogData.initMessage}</div>
                  )}
                  {dialogData.initStep && dialogData.initStep !== 'error' && (
                    <div className="text-xs text-muted-foreground">
                      {t('mongodb.step_prefix')} {getStepLabel(dialogData.initStep)}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              disabled={isInitializing}
              className="shadow-none"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleInitialize(true)}
              disabled={isInitializing || !dialogData.adminUsername || !dialogData.adminPassword || serviceStatus === ServiceStatus.Running}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('mongodb.resetting')}
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {t('mongodb.confirm_reset')}
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
                  {t('mongodb.uninitialized')}
                </p>
                <p className="text-[11px] text-orange-700 dark:text-orange-400 leading-relaxed">
                  {t('mongodb.uninitialized_desc')}
                </p>
              </div>
            </div>
            <div className="flex">
              <Button
                size="sm"
                onClick={() => setShowInitDialog(true)}
                className="h-7 text-xs shadow-none bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white"
              >
                {t('mongodb.init_now')}
              </Button>
            </div>
          </div>
        )}

        {/* MongoDB 状态 */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              {t('mongodb.service_control')}
            </Label>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                serviceStatus === ServiceStatus.Running ? "bg-green-500" :
                  serviceStatus === ServiceStatus.Stopped ? "bg-red-500" : "bg-gray-300"
              )} />
              <span className="text-xs font-normal text-muted-foreground">
                {serviceStatus === ServiceStatus.Running ? t('status.service.running') :
                  serviceStatus === ServiceStatus.Stopped ? t('status.service.stopped') : t('status.service.unknown')}
              </span>
            </div>
          </div>

          {/* 服务控制按钮 */}
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
                {t('mongodb.start')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                onClick={stopService}
                disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
              >
                <PowerOff className="h-3.5 w-3.5 text-red-600" />
                {t('mongodb.stop')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                onClick={restartService}
                disabled={serviceStatus !== ServiceStatus.Running || isStarting || isStopping || isRestarting}
              >
                <RotateCw className={cn("h-3.5 w-3.5 text-blue-600", isRestarting && "animate-spin")} />
                {t('mongodb.restart')}
              </Button>
            </div>
          )}
        </div>

        {/* 配置管理 */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          {isServiceActive && isInitialized ? (
            <div className="space-y-4">
              {/* 解析错误提示 */}
              {mongoConfig?.parseError && (
                <Alert variant="destructive" className="border-red-500 p-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs ml-2">
                    {mongoConfig.parseError}
                  </AlertDescription>
                </Alert>
              )}

              {/* 配置文件路径 */}
              <div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="cursor-help flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        {t('mongodb.config_file')}
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">{t('mongodb.config_file_tooltip')}</div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={editingConfigPath}
                    onChange={(e) => setEditingConfigPath(e.target.value)}
                    placeholder={t('mongodb.config_file_placeholder')}
                    disabled={isLoading}
                    className={cn(
                      "flex-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10",
                      mongoConfig?.parseError && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSetConfigPath}
                    disabled={isLoading || !editingConfigPath || editingConfigPath === configPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    title={t('common.save')}
                  >
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  {/* <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (configPath) {
                        navigator.clipboard.writeText(configPath)
                        toast.success('配置文件路径已复制到剪贴板')
                      }
                    }}
                    disabled={!configPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    title="复制"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button> */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => configPath && openFolderInFinder(configPath)}
                    disabled={!configPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    title={t('mongodb.open_dir')}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* 数据目录 */}
              <div className=" pt-2 border-t border-gray-200 dark:border-white/10">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('mongodb.data_dir')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={mongoConfig?.dataPath || t('mongodb.not_configured')}
                    readOnly
                    className={cn(
                      "flex-1 h-8 text-xs shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10",
                      !mongoConfig?.dataPath && "text-muted-foreground"
                    )}
                  />
                  {/* <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (mongoConfig?.dataPath) {
                        navigator.clipboard.writeText(mongoConfig.dataPath)
                        toast.success('数据目录路径已复制到剪贴板')
                      }
                    }}
                    disabled={!mongoConfig?.dataPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button> */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mongoConfig?.dataPath && openFolderInFinder(mongoConfig.dataPath)}
                    disabled={!mongoConfig?.dataPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* 日志路径 */}
              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('mongodb.log_file')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={mongoConfig?.logPath || t('mongodb.not_configured')}
                    readOnly
                    className={cn(
                      "flex-1 h-8 text-xs shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10",
                      !mongoConfig?.logPath && "text-muted-foreground"
                    )}
                  />
                  {/* <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (mongoConfig?.logPath) {
                        navigator.clipboard.writeText(mongoConfig.logPath)
                        toast.success('日志路径已复制到剪贴板')
                      }
                    }}
                    disabled={!mongoConfig?.logPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button> */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mongoConfig?.logPath && openFolderInFinder(mongoConfig.logPath)}
                    disabled={!mongoConfig?.logPath}
                    className="h-8 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* 主机 & 端口 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('mongodb.host')}</Label>
                  <Input
                    value={mongoConfig?.bindIp || 'localhost'}
                    readOnly
                    className="text-xs h-8 mt-1 shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('mongodb.port_readonly')}</Label>
                  <Input
                    value={mongoConfig?.port || 27017}
                    readOnly
                    className="text-xs h-8 mt-1 shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                </div>
              </div>

              {/* 管理工具 */}
              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('mongodb.tools')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const result = await openMongoDBCompass(selectedEnvironmentId, serviceData)
                        if (result.success) {
                          toast.success(t('mongodb.compass_opened'))
                        } else {
                          toast.error(result.message || t('mongodb.compass_open_failed'))
                        }
                      } catch (error) {
                        toast.error(t('mongodb.compass_open_failed_with_message', { message: error }))
                      }
                    }}
                    disabled={serviceStatus !== ServiceStatus.Running}
                    className="flex items-center gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    MongoDB Compass
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const result = await openMongoDBShell(selectedEnvironmentId, serviceData)
                        if (result.success) {
                          toast.success(t('mongodb.shell_opened'))
                        } else {
                          toast.error(result.message || t('mongodb.shell_open_failed'))
                        }
                      } catch (error) {
                        toast.error(t('mongodb.shell_open_failed_with_message', { message: error }))
                      }
                    }}
                    disabled={serviceStatus !== ServiceStatus.Running}
                    className="flex items-center gap-1 h-8 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    Mongo Shell
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Settings className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {!isServiceActive ? (
                <>
                  <p className="text-sm">{t('mongodb.config_unavailable_inactive')}</p>
                  <p className="text-xs">{t('mongodb.activate_mongodb_first')}</p>
                </>
              ) : (
                <>
                  <p className="text-sm">{t('mongodb.uninitialized')}</p>
                  <p className="text-xs">{t('mongodb.complete_init_first')}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* 数据库管理 */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              {/* <Database className="w-3.5 h-3.5" /> */}
              {t('mongodb.database_management')}
            </Label>
            {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDbDialog(true)}
                className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
              >
                <Plus className="h-3 w-3 mr-1" />
                {t('mongodb.new_database')}
              </Button>
            )}
          </div>

          {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running ? (
            <div className="space-y-1">
              {databases.length > 0 ? (
                <div className="border rounded-lg p-1 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10">
                  {(showAllDatabases ? databases : databases.slice(0, 4)).map((db) => (
                    <div
                      key={db.name}
                      className="text-xs"
                    >
                      {/* 数据库行 */}
                      <div onClick={() => toggleCollections(db.name)} className="flex items-center justify-between p-1 hover:bg-gray-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Database className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                          <span className="font-medium truncate text-gray-700 dark:text-gray-300">{db.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 flex-shrink-0 hover:bg-transparent"
                          disabled={db.isLoadingCollections}
                        >
                          {db.isLoadingCollections ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : db.showCollections ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                      </div>

                      {/* 集合列表 */}
                      {db.showCollections && db.collections && (
                        <div className="pl-6 pr-2 pb-2">
                          {db.collections.length > 0 ? (
                            <div className="space-y-0.5 mt-1">
                              {(db.showAllCollections ? db.collections : db.collections.slice(0, 4)).map((collection) => (
                                <div
                                  key={collection}
                                  className="flex items-center gap-1.5 py-1 px-1.5 rounded text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                                >
                                  <div className="h-1 w-1 rounded-full bg-gray-400 flex-shrink-0" />
                                  <span className="truncate">{collection}</span>
                                </div>
                              ))}
                              {db.collections.length > 4 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleAllCollections(db.name)}
                                  className="w-full h-6 text-xs text-gray-500 hover:text-foreground mt-1"
                                >
                                  {db.showAllCollections ? (
                                    <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      {t('mongodb.collapse_more_collections', { count: db.collections.length - 4 })}
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      {t('mongodb.more_collections', { count: db.collections.length - 4 })}
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 text-center py-2">
                              {t('mongodb.no_collections')}
                            </div>
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
                          {t('mongodb.collapse_more_databases', { count: databases.length - 4 })}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5 mr-1" />
                          {t('mongodb.more_databases', { count: databases.length - 4 })}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed border-gray-200 dark:border-white/10">
                  {t('mongodb.no_databases')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Database className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {!isServiceActive ? (
                <>
                  <p className="text-sm">{t('mongodb.service_inactive')}</p>
                  <p className="text-xs">{t('mongodb.cannot_manage_databases')}</p>
                </>
              ) : !isInitialized ? (
                <>
                  <p className="text-sm">{t('mongodb.uninitialized')}</p>
                  <p className="text-xs">{t('mongodb.complete_init_first')}</p>
                </>
              ) : (
                <>
                  <p className="text-sm">{t('mongodb.service_not_running')}</p>
                  <p className="text-xs">{t('mongodb.start_service_first')}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Users */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              {t('mongodb.user_management')}
            </Label>
            {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUserForm({
                    username: '',
                    password: '',
                    databaseRoles: {},
                  })
                  setShowCreateUserDialog(true)
                }}
                className="h-7 px-2 text-xs shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
              >
                <UserPlus className="h-3 w-3 mr-1" />
                {t('mongodb.new_user')}
              </Button>
            )}
          </div>

          {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running ? (
            <div className="space-y-2">
              {/* Admin User */}
              {serviceData.metadata?.['MONGODB_ADMIN_USERNAME'] && (
                <div className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{serviceData.metadata['MONGODB_ADMIN_USERNAME']}</span>
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">{t('mongodb.admin_badge')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {serviceData.metadata?.['MONGODB_ADMIN_PASSWORD']
                        ? showPassword
                          ? serviceData.metadata['MONGODB_ADMIN_PASSWORD']
                          : '••••••••'
                        : '—'}
                    </span>
                    {serviceData.metadata?.['MONGODB_ADMIN_PASSWORD'] && (
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
              )}

              {/* Normal Users */}
              {users.filter(u => u.user !== serviceData.metadata?.['MONGODB_ADMIN_USERNAME']).length > 0 && (
                <div className="border rounded-lg p-1 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10">
                  {users
                    .filter(u => u.user !== serviceData.metadata?.['MONGODB_ADMIN_USERNAME'])
                    .map((user) => (
                      <div key={user._id} className="flex items-center justify-between p-1 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 text-xs">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Users className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{user.user}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                            onClick={() => openEditUserDialog(user)}
                            title={t('mongodb.edit_permissions')}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                            onClick={() => handleDeleteUser(user.user)}
                            title={t('mongodb.delete_user')}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Key className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('mongodb.service_not_running')}</p>
              <p className="text-xs">{t('mongodb.start_service_first')}</p>
            </div>
          )}
        </div>

        {/* 创建数据库对话框 */}
        <Dialog open={showCreateDbDialog} onOpenChange={setShowCreateDbDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('mongodb.new_database')}</DialogTitle>
              <DialogDescription>
                {t('mongodb.new_database_desc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="db-name">{t('mongodb.database_name')}</Label>
                <Input
                  id="db-name"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  placeholder={t('mongodb.database_name_placeholder')}
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
                    {t('mongodb.creating')}
                  </>
                ) : (
                  t('common.create')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 创建用户对话框 */}
        <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                {t('mongodb.new_user')}
              </DialogTitle>
              <DialogDescription>{t('mongodb.new_user_desc')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-username">{t('mongodb.username')}</Label>
                <Input
                  id="new-username"
                  value={userForm.username}
                  onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder={t('mongodb.username_placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-password">{t('mongodb.password')}</Label>
                <Input
                  id="new-user-password"
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={t('mongodb.password_placeholder')}
                />
              </div>
              {/* 数据库权限设置 */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">{t('mongodb.database_permissions')}</Label>
                {databases.length > 0 && (
                  <div className="space-y-1 border rounded-lg p-2 bg-white dark:bg-white/5 max-h-40 overflow-y-auto">
                    {databases.map((db) => (
                      <div key={db.name} className="flex items-center justify-between py-1 px-1.5 rounded text-xs hover:bg-gray-50 dark:hover:bg-white/5">
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{db.name}</span>
                        <div className="flex gap-1">
                          {(['read', 'readWrite'] as const).map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => setUserForm(prev => {
                                const newRoles = { ...prev.databaseRoles }
                                if (newRoles[db.name] === role) {
                                  delete newRoles[db.name]
                                } else {
                                  newRoles[db.name] = role
                                }
                                return { ...prev, databaseRoles: newRoles }
                              })}
                              className={cn(
                                'px-2 py-0.5 rounded text-[10px] border transition-colors',
                                userForm.databaseRoles[db.name] === role
                                  ? role === 'readWrite'
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-200 dark:border-white/20 text-gray-500 hover:border-gray-400'
                              )}
                            >
                              {role === 'read' ? t('mongodb.role_read') : t('mongodb.role_read_write')}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* 自定义数据库 */}
                <div className="flex gap-2">
                  <Input
                    value={customDbName}
                    onChange={(e) => setCustomDbName(e.target.value)}
                    placeholder={t('mongodb.custom_database_name')}
                    className="h-7 text-xs shadow-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customDbName) {
                        setUserForm(prev => ({
                          ...prev,
                          databaseRoles: { ...prev.databaseRoles, [customDbName]: 'read' },
                        }))
                        setCustomDbName('')
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs shadow-none"
                    disabled={!customDbName}
                    onClick={() => {
                      if (!customDbName) return
                      setUserForm(prev => ({
                        ...prev,
                        databaseRoles: { ...prev.databaseRoles, [customDbName]: 'read' },
                      }))
                      setCustomDbName('')
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {/* 已选权限预览 */}
                {Object.keys(userForm.databaseRoles).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(userForm.databaseRoles).map(([db, role]) => (
                      <span
                        key={db}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                      >
                        {db}: {role === 'readWrite' ? t('mongodb.role_read_write') : t('mongodb.role_read')}
                        <button
                          type="button"
                          onClick={() => setUserForm(prev => {
                            const newRoles = { ...prev.databaseRoles }
                            delete newRoles[db]
                            return { ...prev, databaseRoles: newRoles }
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
              <Button className="shadow-none" variant="outline" onClick={() => setShowCreateUserDialog(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleCreateUser} disabled={!userForm.username || !userForm.password}>
                {t('common.create')}
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
                {t('mongodb.edit_permissions')} - {selectedUser}
              </DialogTitle>
              <DialogDescription>{t('mongodb.edit_permissions_desc')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {databases.length > 0 && (
                <div className="space-y-1 border rounded-lg p-2 bg-white dark:bg-white/5 max-h-48 overflow-y-auto">
                  {databases.map((db) => (
                    <div key={db.name} className="flex items-center justify-between py-1 px-1.5 rounded text-xs hover:bg-gray-50 dark:hover:bg-white/5">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{db.name}</span>
                      <div className="flex gap-1">
                        {(['read', 'readWrite'] as const).map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setUserForm(prev => {
                              const newRoles = { ...prev.databaseRoles }
                              if (newRoles[db.name] === role) {
                                delete newRoles[db.name]
                              } else {
                                newRoles[db.name] = role
                              }
                              return { ...prev, databaseRoles: newRoles }
                            })}
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] border transition-colors',
                              userForm.databaseRoles[db.name] === role
                                ? role === 'readWrite'
                                  ? 'bg-blue-500 border-blue-500 text-white'
                                  : 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-200 dark:border-white/20 text-gray-500 hover:border-gray-400'
                            )}
                          >
                            {role === 'read' ? t('mongodb.role_read') : t('mongodb.role_read_write')}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={customDbName}
                  onChange={(e) => setCustomDbName(e.target.value)}
                  placeholder={t('mongodb.custom_database_name')}
                  className="h-7 text-xs shadow-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customDbName) {
                      setUserForm(prev => ({
                        ...prev,
                        databaseRoles: { ...prev.databaseRoles, [customDbName]: 'read' },
                      }))
                      setCustomDbName('')
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs shadow-none"
                  disabled={!customDbName}
                  onClick={() => {
                    if (!customDbName) return
                    setUserForm(prev => ({
                      ...prev,
                      databaseRoles: { ...prev.databaseRoles, [customDbName]: 'read' },
                    }))
                    setCustomDbName('')
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {Object.keys(userForm.databaseRoles).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(userForm.databaseRoles).map(([db, role]) => (
                    <span
                      key={db}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                    >
                      {db}: {role === 'readWrite' ? t('mongodb.role_read_write') : t('mongodb.role_read')}
                      <button
                        type="button"
                        onClick={() => setUserForm(prev => {
                          const newRoles = { ...prev.databaseRoles }
                          delete newRoles[db]
                          return { ...prev, databaseRoles: newRoles }
                        })}
                        className="hover:text-blue-900 dark:hover:text-blue-100"
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button className="shadow-none" variant="outline" onClick={() => setShowEditUserDialog(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleUpdateUser}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Other Operations */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            {/* <MoreHorizontal className="w-3.5 h-3.5" /> */}
            {t('mongodb.other_operations')}
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
                {t('mongodb.reset_init')}
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <BarChart3 className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('mongodb.service_inactive')}</p>
              <p className="text-xs">{t('mongodb.cannot_use_other_ops')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
