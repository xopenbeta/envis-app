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
  RotateCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BaseService } from './base-service'
import { ServiceData, ServiceDataStatus, ServiceStatus } from '@/types/index'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtom } from 'jotai'
import { selectedEnvironmentIdAtom } from '../../../store/environment'
import { useFileOperations } from "@/hooks/file-operations"
import { MongoDBConfig, MongoDBMetadata } from "@/types/service"
import { useMongodb } from "@/hooks/services/mongodb"
import { useEnvironmentServiceData } from "@/hooks/env-serv-data"
import { useService } from "@/hooks/service"

interface MongoDBServiceProps {
  serviceData: ServiceData
}

export function MongoDBService({ serviceData }: MongoDBServiceProps) {
  const { t } = useTranslation()
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)

  // 检查服务是否激活
  const isServiceActive = [ServiceDataStatus.Active].includes(serviceData.status)
  const configPath = useMemo(() => {
    return serviceData.metadata?.['MONGODB_CONFIG'] || ''
  }, [serviceData, serviceData.metadata, serviceData.metadata?.['MONGODB_CONFIG']])

  // MongoDB 配置状态
  const [mongoConfig, setMongoConfig] = useState<MongoDBConfig | null>(null)
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>(ServiceStatus.Unknown);

  // 编辑中的配置路径
  const [editingConfigPath, setEditingConfigPath] = useState<string>('')

  // 初始化状态
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [showInitDialog, setShowInitDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)

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
    getServiceStatus,
    updateServiceData,
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
      // 折叠
      setDatabases(prev => prev.map(d =>
        d.name === databaseName
          ? { ...d, showCollections: false }
          : d
      ))
    } else {
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
      // 每隔一秒刷新一次
      const timer = setInterval(() => {
        checkServiceStatus()
      }, 500);
      return () => {
        clearInterval(timer)
      }
    } else {
      // 服务未激活时清空配置
      setMongoConfig(null)
      return () => { } // 确保所有路径都有返回值
    }
  }, [isServiceActive, isInitialized])

  // 定时刷新数据库列表（每3秒）
  useEffect(() => {
    if (isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running) {
      // 首次加载
      loadDatabases()
      loadUsers()

      // 每3秒刷新一次
      const timer = setInterval(() => {
        loadDatabases()
        loadUsers()
      }, 3000);

      return () => {
        clearInterval(timer)
      }
    } else {
      setDatabases([])
      setUsers([])
      return () => { }
    }
  }, [isServiceActive, isInitialized, serviceStatus])

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

  const checkServiceStatus = async () => {
    try {
      const result = await getServiceStatus(selectedEnvironmentId, serviceData)
      // console.log('zws 服务状态检查结果:', result.data)
      if (result.success && result.data) {
        setServiceStatus(result.data.status);
      }
    } catch (error) {
      console.error('检查服务状态失败:', error)
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
        checkServiceStatus()
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
        checkServiceStatus()
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
        checkServiceStatus()
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
      toast.error('请输入管理员用户名和密码')
      return
    }

    // 如果是重置操作,检查 MongoDB 是否正在运行
    if (reset && serviceStatus === ServiceStatus.Running) {
      toast.error('MongoDB 正在运行中,请先停止服务后再进行重置')
      return
    }

    setIsInitializing(true)
    // 清空进度信息，准备接收新的进度更新
    setDialogData(prev => ({ ...prev, initStep: '', initMessage: '准备初始化...' }))

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
        let successMessage = 'MongoDB 初始化成功'

        // 根据副本集启用状态和初始化结果显示不同的消息
        if (dialogData.enableReplicaSet) {
          if (data?.replicaSetInitialized === false) {
            successMessage += '（副本集初始化失败，服务可正常使用）'
          } else if (data?.replicaSetInitialized === true) {
            successMessage += '（副本集已启用）'
          }
        }

        newMetadata['MONGODB_CONFIG'] = data.configPath
        newMetadata['MONGODB_KEYFILE_PATH'] = data.keyfilePath
        newMetadata['MONGODB_ADMIN_USERNAME'] = data.adminUsername
        newMetadata['MONGODB_ADMIN_PASSWORD'] = data.adminPassword
        const updatedServiceData = await updateServiceData(serviceData.id, {
          metadata: newMetadata
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
        const errorMsg = result.message || '初始化失败'
        toast.error(errorMsg)
        setDialogData(prev => ({ ...prev, initStep: 'error', initMessage: '初始化失败: ' + errorMsg }))
      }
    } catch (error) {
      const errorMsg = String(error)
      toast.error('初始化失败: ' + errorMsg)
      setDialogData(prev => ({ ...prev, initStep: 'error', initMessage: '初始化失败: ' + errorMsg }))
    } finally {
      setIsInitializing(false)
    }
  }

  // 设置配置文件路径
  const handleSetConfigPath = async () => {
    if (!serviceData?.version) return
    if (!editingConfigPath) {
      toast.error('配置文件路径不能为空')
      return
    }

    setIsLoading(true)
    try {
      const newMetadata: MongoDBMetadata = { ...(serviceData.metadata || {}) }
      newMetadata['MONGODB_CONFIG'] = editingConfigPath
      const updatedServiceData = await updateServiceData(serviceData.id, {
        metadata: newMetadata
      })
      if (updatedServiceData) {
        toast.success('配置文件路径设置成功')
        loadMongoConfig(updatedServiceData)
      } else {
        toast.error('设置配置文件路径失败')
      }
    } catch (error) {
      toast.error('设置配置文件路径失败: ' + error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <BaseService service={serviceData}>
      {/* 初始化对话框 */}
      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              初始化 MongoDB
            </DialogTitle>
            <DialogDescription>
              首次使用需要初始化 MongoDB。系统将创建配置文件、数据目录、keyfile，并设置管理员账户。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-username">管理员用户名</Label>
              <Input
                id="admin-username"
                value={dialogData.adminUsername}
                onChange={(e) => setDialogData(prev => ({ ...prev, adminUsername: e.target.value }))}
                placeholder="输入管理员用户名"
                disabled={isInitializing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">管理员密码</Label>
              <Input
                id="admin-password"
                type="password"
                value={dialogData.adminPassword}
                onChange={(e) => setDialogData(prev => ({ ...prev, adminPassword: e.target.value }))}
                placeholder="输入管理员密码"
                disabled={isInitializing}
              />
            </div>

            {dialogData.showAdvanced && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="init-port">端口</Label>
                  <Input
                    id="init-port"
                    value={dialogData.port}
                    onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="27017"
                    disabled={isInitializing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="init-bind-ip">绑定地址</Label>
                  <Input
                    id="init-bind-ip"
                    value={dialogData.bindIp}
                    onChange={(e) => setDialogData(prev => ({ ...prev, bindIp: e.target.value }))}
                    placeholder="127.0.0.1"
                    disabled={isInitializing}
                  />
                  <p className="text-xs text-muted-foreground">
                    默认仅本地访问。如需远程访问请设置为 0.0.0.0
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
                      启用副本集 (Replica Set)
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    副本集提供数据冗余和高可用性。开发环境通常不需要启用。
                  </p>
                </div>
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogData(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
              className="w-full"
              type="button"
            >
              {dialogData.showAdvanced ? '隐藏高级选项' : '显示高级选项'}
            </Button>

            {isInitializing && (dialogData.initStep || dialogData.initMessage) ? (
              <Alert>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <AlertDescription className="space-y-1">
                  {dialogData.initMessage && (
                    <div className="text-sm font-medium">{dialogData.initMessage}</div>
                  )}
                  {dialogData.initStep && dialogData.initStep !== 'error' && (
                    <div className="text-xs text-muted-foreground">
                      步骤: {getStepLabel(dialogData.initStep)}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  请牢记管理员账户信息。初始化包含：创建目录、生成密钥、创建管理员用户{dialogData.enableReplicaSet ? '、初始化副本集' : ''}。
                  {dialogData.enableReplicaSet && '副本集用于实现数据复制和高可用性。'}
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
              取消
            </Button>
            <Button
              onClick={() => handleInitialize(false)}
              disabled={isInitializing || !dialogData.adminUsername || !dialogData.adminPassword}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {'初始化中...'}
                </>
              ) : (
                '开始初始化'
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
              重置 MongoDB
            </DialogTitle>
            <DialogDescription>
              重置将删除所有现有数据、配置文件和用户信息，然后重新初始化 MongoDB。
              <span className="text-red-600 font-semibold">此操作不可恢复！</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!isInitializing && serviceStatus === ServiceStatus.Running && (
              <Alert variant="destructive" className="p-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>MongoDB 正在运行中！</strong> 请先停止 MongoDB 服务后再进行重置。
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="reset-admin-username">新管理员用户名</Label>
              <Input
                id="reset-admin-username"
                value={dialogData.adminUsername}
                onChange={(e) => setDialogData(prev => ({ ...prev, adminUsername: e.target.value }))}
                placeholder="输入管理员用户名"
                disabled={isInitializing}
                className="shadow-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-admin-password">新管理员密码</Label>
              <Input
                id="reset-admin-password"
                type="password"
                value={dialogData.adminPassword}
                onChange={(e) => setDialogData(prev => ({ ...prev, adminPassword: e.target.value }))}
                placeholder="输入管理员密码"
                disabled={isInitializing}
                className="shadow-none"
              />
            </div>

            {dialogData.showAdvanced && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reset-port">端口</Label>
                  <Input
                    id="reset-port"
                    value={dialogData.port}
                    onChange={(e) => setDialogData(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="27017"
                    disabled={isInitializing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-bind-ip">绑定地址</Label>
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
                      启用副本集 (Replica Set)
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    副本集提供数据冗余和高可用性。开发环境通常不需要启用。
                  </p>
                </div>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogData(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
              className="w-full"
            >
              {dialogData.showAdvanced ? '隐藏高级选项' : '显示高级选项'}
            </Button>

            {isInitializing && (dialogData.initStep || dialogData.initMessage) && (
              <Alert>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <AlertDescription className="space-y-1">
                  {dialogData.initMessage && (
                    <div className="text-sm font-medium">{dialogData.initMessage}</div>
                  )}
                  {dialogData.initStep && dialogData.initStep !== 'error' && (
                    <div className="text-xs text-muted-foreground">
                      步骤: {getStepLabel(dialogData.initStep)}
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
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleInitialize(true)}
              disabled={isInitializing || !dialogData.adminUsername || !dialogData.adminPassword || serviceStatus === ServiceStatus.Running}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {'重置中...'}
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

      <div className="w-full space-y-4">
        {/* 未初始化提示 */}
        {isServiceActive && isInitialized === false && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Key className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                    MongoDB 尚未初始化
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    首次使用需要初始化配置文件、数据目录、安全密钥文件，并创建管理员账户。
                  </p>
                </div>
                <Button
                  onClick={() => setShowInitDialog(true)}
                  className="bg-orange-600 hover:bg-orange-700 shadow-none"
                >
                  <Key className="h-4 w-4 mr-2" />
                  立即初始化
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MongoDB 状态 */}
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
                        配置文件
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">mongod.conf 文件的路径</div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={editingConfigPath}
                    onChange={(e) => setEditingConfigPath(e.target.value)}
                    placeholder="MongoDB 配置文件路径"
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
                    title="保存"
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
                    title="打开目录"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* 数据目录 */}
              <div className=" pt-2 border-t border-gray-200 dark:border-white/10">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">数据目录（从配置文件读取）</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={mongoConfig?.dataPath || '未配置'}
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
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">日志文件（从配置文件读取）</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={mongoConfig?.logPath || '未配置'}
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
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">主机（从配置文件读取）</Label>
                  <Input
                    value={mongoConfig?.bindIp || 'localhost'}
                    readOnly
                    className="text-xs h-8 mt-1 shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">端口（从配置文件读取）</Label>
                  <Input
                    value={mongoConfig?.port || 27017}
                    readOnly
                    className="text-xs h-8 mt-1 shadow-none bg-muted cursor-not-allowed border-gray-200 dark:border-white/10"
                  />
                </div>
              </div>

              {/* 管理工具 */}
              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">管理工具</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const result = await openMongoDBCompass(selectedEnvironmentId, serviceData)
                        if (result.success) {
                          toast.success('MongoDB Compass 已打开')
                        } else {
                          toast.error(result.message || '打开 MongoDB Compass 失败')
                        }
                      } catch (error) {
                        toast.error('打开 MongoDB Compass 失败: ' + error)
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
                          toast.success('Mongo Shell 已打开')
                        } else {
                          toast.error(result.message || '打开 Mongo Shell 失败')
                        }
                      } catch (error) {
                        toast.error('打开 Mongo Shell 失败: ' + error)
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
                  <p className="text-sm">服务未激活，无法显示配置信息</p>
                  <p className="text-xs">请先激活 MongoDB 服务</p>
                </>
              ) : (
                <>
                  <p className="text-sm">MongoDB 尚未初始化</p>
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
              {/* <Database className="w-3.5 h-3.5" /> */}
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
                    <div
                      key={db.name}
                      className="text-xs"
                    >
                      {/* 数据库行 */}
                      <div onClick={() => toggleCollections(db.name)} className="flex items-center justify-between p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer">
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
                                      收起 ({db.collections.length - 4} 个)
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      还有 {db.collections.length - 4} 个集合
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 text-center py-2">
                              暂无集合
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
                  <p className="text-sm">MongoDB 尚未初始化</p>
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

        {/* Users */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              {/* <Users className="w-3.5 h-3.5" /> */}
              用户管理
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
                <Plus className="h-3 w-3 mr-1" />
                创建用户
              </Button>
            )}
          </div>

          {isServiceActive && isInitialized && serviceStatus === ServiceStatus.Running ? (
            <div className="space-y-2">
              {/* Admin User */}
              {serviceData.metadata?.['MONGODB_ADMIN_USERNAME'] && (
                <div className="border rounded-lg p-3 space-y-2 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="h-3.5 w-3.5 text-gray-500" />
                      <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{serviceData.metadata['MONGODB_ADMIN_USERNAME']}</span>
                      <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 h-5">
                        超级管理员
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mt-1">
                      <Label className="text-xs font-medium text-gray-500 text-right">
                        密码
                      </Label>

                      <div className="relative flex-1">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={serviceData.metadata['MONGODB_ADMIN_PASSWORD'] || '未设置'}
                          readOnly
                          className="h-7 text-xs shadow-none bg-muted cursor-not-allowed pr-10 border-gray-200 dark:border-white/10"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={!serviceData.metadata['MONGODB_ADMIN_PASSWORD']}
                          className="absolute right-1 top-0 h-7 w-7 p-0 hover:bg-transparent"
                          title={showPassword ? "隐藏密码" : "显示密码"}
                          aria-label={showPassword ? "隐藏密码" : "显示密码"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-3 w-3 text-gray-500" />
                          ) : (
                            <Eye className="h-3 w-3 text-gray-500" />
                          )}
                        </Button>
                      </div>

                      {/* <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const password = serviceData.metadata?.['MONGODB_ADMIN_PASSWORD']
                          if (password) {
                            navigator.clipboard.writeText(password)
                            toast.success('密码已复制到剪贴板')
                          }
                        }}
                        disabled={!serviceData.metadata['MONGODB_ADMIN_PASSWORD']}
                        className="h-7 px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        title="复制密码"
                      >
                        <Copy className="h-3 w-3" />
                      </Button> */}
                    </div>
                  </div>
                </div>
              )}

              {/* Normal Users */}
              {users.filter(u => u.user !== serviceData.metadata?.['MONGODB_ADMIN_USERNAME']).length > 0 && (
                users
                  .filter(u => u.user !== serviceData.metadata?.['MONGODB_ADMIN_USERNAME'])
                  .map((user) => (
                    <div
                      key={user._id}
                      className="border rounded-lg p-3 space-y-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Key className="h-3.5 w-3.5 text-gray-500" />
                          <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{user.user}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditUserDialog(user)}
                            className="h-6 px-2 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            编辑权限
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.user)}
                            className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center flex-wrap gap-1">
                          <span className="text-xs text-gray-500 font-medium">数据库权限:</span>
                          {user.roles.map((role, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs h-5 font-normal"
                            >
                              {role.db}: {role.role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <Key className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">服务未运行，无法管理用户</p>
              <p className="text-xs">请先启动 MongoDB 服务</p>
            </div>
          )}
        </div>

        {/* 创建数据库对话框 */}
        <Dialog open={showCreateDbDialog} onOpenChange={setShowCreateDbDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新建数据库</DialogTitle>
              <DialogDescription>
                创建一个新的数据库。系统将自动创建一个名为 'test' 的集合以初始化数据库。
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
                ) : (
                  '创建'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 创建用户对话框 */}
        <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>创建 MongoDB 用户</DialogTitle>
              <DialogDescription>
                创建一个新的 MongoDB 用户，并为其分配数据库访问权限
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="输入用户名"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="输入密码"
                />
              </div>
              <div className="space-y-2">
                <Label>数据库权限设置</Label>
                <div className="text-xs text-muted-foreground mb-2">
                  为每个数据库单独设置访问权限
                </div>

                <div className="flex items-end gap-2 mb-2">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs font-normal text-muted-foreground">添加其他数据库</Label>
                    <Input
                      placeholder="输入数据库名称"
                      value={customDbName}
                      onChange={e => setCustomDbName(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shadow-none"
                    onClick={() => {
                      if (customDbName) {
                        setUserForm(prev => ({
                          ...prev,
                          databaseRoles: {
                            ...prev.databaseRoles,
                            [customDbName]: 'read'
                          }
                        }))
                        setCustomDbName('')
                      }
                    }}
                    disabled={!customDbName}
                  >
                    添加
                  </Button>
                </div>

                <div className="border rounded-md p-3 max-h-60 overflow-y-auto space-y-2">
                  {Array.from(new Set([
                    ...databases.map(d => d.name),
                    ...Object.keys(userForm.databaseRoles)
                  ])).sort().map((dbName) => (
                    <div key={dbName} className="flex items-center justify-between py-1.5 hover:bg-accent rounded px-2">
                      <div className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{dbName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={userForm.databaseRoles[dbName] === 'read'}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setUserForm({
                                  ...userForm,
                                  databaseRoles: {
                                    ...userForm.databaseRoles,
                                    [dbName]: 'read'
                                  }
                                })
                              } else {
                                const newRoles = { ...userForm.databaseRoles }
                                delete newRoles[dbName]
                                setUserForm({
                                  ...userForm,
                                  databaseRoles: newRoles
                                })
                              }
                            }}
                          />
                          <span className="text-sm">只读</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={userForm.databaseRoles[dbName] === 'readWrite'}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setUserForm({
                                  ...userForm,
                                  databaseRoles: {
                                    ...userForm.databaseRoles,
                                    [dbName]: 'readWrite'
                                  }
                                })
                              } else {
                                const newRoles = { ...userForm.databaseRoles }
                                delete newRoles[dbName]
                                setUserForm({
                                  ...userForm,
                                  databaseRoles: newRoles
                                })
                              }
                            }}
                          />
                          <span className="text-sm">读写</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button className="shadow-none" variant="outline" onClick={() => setShowCreateUserDialog(false)}>
                取消
              </Button>
              <Button onClick={handleCreateUser}>
                创建用户
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 编辑用户权限对话框 */}
        <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>编辑用户权限</DialogTitle>
              <DialogDescription>
                修改用户 "{selectedUser}" 的数据库访问权限
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>数据库权限设置</Label>
                <div className="text-xs text-muted-foreground mb-2">
                  为每个数据库单独设置访问权限
                </div>
                <div className="border rounded-md p-3 max-h-60 overflow-y-auto space-y-2">
                  {databases.map((db) => (
                    <div key={db.name} className="flex items-center justify-between py-1.5 hover:bg-accent rounded px-2">
                      <div className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{db.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={userForm.databaseRoles[db.name] === 'read'}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setUserForm({
                                  ...userForm,
                                  databaseRoles: {
                                    ...userForm.databaseRoles,
                                    [db.name]: 'read'
                                  }
                                })
                              } else {
                                const newRoles = { ...userForm.databaseRoles }
                                delete newRoles[db.name]
                                setUserForm({
                                  ...userForm,
                                  databaseRoles: newRoles
                                })
                              }
                            }}
                          />
                          <span className="text-sm">只读</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={userForm.databaseRoles[db.name] === 'readWrite'}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setUserForm({
                                  ...userForm,
                                  databaseRoles: {
                                    ...userForm.databaseRoles,
                                    [db.name]: 'readWrite'
                                  }
                                })
                              } else {
                                const newRoles = { ...userForm.databaseRoles }
                                delete newRoles[db.name]
                                setUserForm({
                                  ...userForm,
                                  databaseRoles: newRoles
                                })
                              }
                            }}
                          />
                          <span className="text-sm">读写</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button className="shadow-none" variant="outline" onClick={() => setShowEditUserDialog(false)}>
                取消
              </Button>
              <Button onClick={handleUpdateUser}>
                保存更改
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Other Operations */}
        <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            {/* <MoreHorizontal className="w-3.5 h-3.5" /> */}
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
    </BaseService>
  )
}
