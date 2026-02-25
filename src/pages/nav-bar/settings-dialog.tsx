import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { environmentsAtom } from '@/store/environment'
import { useAtom } from 'jotai'
import { HardDrive, Info, Moon, RefreshCw, Sun, Monitor, Bot, Code, Power, Globe, Terminal, Folder, Trash2, AlertTriangle, Server, Database, ExternalLink, LogOut } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import _ from 'lodash'
import { toast } from 'sonner'
import { AppSettings, AppTheme, Service, ServiceData, EnvironmentStatus } from "@/types/index"
import { appSettingsAtom, systemSettingsAtom } from "../../store/appSettings"
import { useAppSettings } from "@/hooks/appSettings"
import { useService } from "@/hooks/service"
import { useServiceData } from "@/hooks/env-serv-data"
import { useSystemInfo } from "@/hooks/system-info"
import { useFileOperations } from "@/hooks/file-operations"
import { AIProvider } from "@/types/ai"
import { useTranslation } from 'react-i18next'

// 服务行组件
function ServiceRow({ service, onDelete, getReferences }: {
  service: Service
  onDelete: (type: string, version: string) => void
  getReferences: (type: string, version: string) => Promise<string[]> // 获取服务引用情况
}) {
  const { t } = useTranslation()
  const [references, setReferences] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    (async () => {
      const refs = await getReferences(service.type, service.version)
      setReferences(refs)
      })()
  }, [service.type, service.version])

  const handleDelete = async () => {
    setLoading(true)
    try {
      onDelete(service.type, service.version)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error(t('settings.delete_service_error'), error)
    } finally {
      setLoading(false)
    }
  }

  const getServiceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'nodejs':
        return <Code className="h-4 w-4" />
      case 'mariadb':
      case 'mysql':
      case 'postgresql':
        return <Database className="h-4 w-4" />
      default:
        return <Server className="h-4 w-4" />
    }
  }

  const canDelete = references.length === 0

  return (
    <TableRow className="hover:bg-content2">
      <TableCell className="font-medium">
        <div className="flex items-center space-x-2">
          {getServiceIcon(service.type)}
          <span className="capitalize">{service.type}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="bg-content2 text-foreground">
          {service.version}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        <div className="flex items-center space-x-1">
          {service.sizeFormatted === '计算中...' && (
            <RefreshCw className="h-3 w-3 animate-spin" />
          )}
          <span className={service.sizeFormatted === '计算失败' ? 'text-destructive' : ''}>
            {service.sizeFormatted === '计算中...' ? t('settings.calculating') :
             service.sizeFormatted === '计算失败' ? t('settings.calc_failed') :
             service.sizeFormatted}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {references.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {references.map((env, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {env}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">{t('settings.not_referenced')}</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canDelete}
              className={`${canDelete
                ? 'text-destructive hover:text-destructive hover:bg-destructive/10'
                : 'text-muted-foreground cursor-not-allowed'
                }`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border border-divider rounded-2xl bg-content1 shadow-none">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {t('settings.confirm_delete_service')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('settings.confirm_delete_service_msg')} <strong>{service.type} {service.version}</strong>?
                <br />
                <span className="text-muted-foreground text-sm">
                  {t('settings.delete_service_permanent')}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="heroui-button-secondary border-divider shadow-none">
                {t('nav_bar.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={loading}
                className="heroui-button bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    {t('settings.deleting')}
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('settings.delete')}
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}

export default function SettingsDialog(props: {
  isSettingDialogOpen: boolean
  setIsSettingDialogOpen: (isSettingDialogOpen: boolean) => void
}) {
  const { t } = useTranslation()
  const { isSettingDialogOpen, setIsSettingDialogOpen } = props;

  const [appSettings] = useAtom(appSettingsAtom)
  const [systemSettings] = useAtom(systemSettingsAtom)
  const { updateAppSettings, updateSystemSettings, openAppConfigFolder } = useAppSettings()
  const [environments] = useAtom(environmentsAtom)
  const { toggleDevTools, quitApp, getSystemInfo, openSystemEnvSettings } = useSystemInfo()
  const { getAllServiceDatas } = useServiceData()
  const { openFolderInFinder, selectFolder } = useFileOperations()
  const { getAllInstalledServices, getServiceSize, deleteService } = useService()
  const currentTheme = appSettings?.theme as AppTheme

  const [newFontSize, setNewFontSize] = useState(14)
  const saveButtonRef = useRef<HTMLButtonElement>(null)

  // AI设置相关状态
  const [newAIProvider, setNewAIProvider] = useState<AIProvider>('openai')
  const [newAIApiKey, setNewAIApiKey] = useState('')
  const [newAIBaseUrl, setNewAIBaseUrl] = useState('')
  const [newAIModel, setNewAIModel] = useState('')
  const [newAIEnabled, setNewAIEnabled] = useState(false)

  // 服务管理相关状态
  const [installedServices, setInstalledServices] = useState<any[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [osName, setOsName] = useState('')

  useEffect(() => {
    // 初始化AI设置，添加安全检查
    setNewAIProvider(appSettings?.ai?.provider || 'openai')
    setNewAIApiKey(appSettings?.ai?.apiKey || '')
    setNewAIBaseUrl(appSettings?.ai?.baseUrl || 'https://api.openai.com/v1')
    setNewAIModel(appSettings?.ai?.model || 'gpt-3.5-turbo')
    setNewAIEnabled(appSettings?.ai?.enabled || false)
  }, [isSettingDialogOpen, appSettings])

  useEffect(() => {
    if (isSettingDialogOpen) {
      getSystemInfo().then(res => {
        if (res.success) {
          setOsName(res.data.os_name)
        }
      })
    }
  }, [isSettingDialogOpen])

  // 加载已安装的服务列表
  const loadInstalledServices = async () => {
    setServicesLoading(true)
    const servicesRes = await getAllInstalledServices()
    if (servicesRes.success && servicesRes.data?.services) {
      setInstalledServices(servicesRes.data?.services)
      getServiceSizes(servicesRes.data?.services)
    }
    setServicesLoading(false)
  }

  // 异步加载服务大小信息
  const getServiceSizes = async (services: Service[]) => {
    for (const service of services) {
      const sizeResult = await getServiceSize(service.type, service.version)
      if (sizeResult.success) {
        service.size = sizeResult.data?.size || 0;
        service.sizeFormatted = sizeResult.data?.sizeFormatted || '';
      }
    }
    setInstalledServices([...services]); // 更新状态以触发重新渲染
  }

  // 检查服务引用情况
  const checkServiceReferences = async (serviceType: string, version: string) => {
    const referencingEnvs: string[] = []
    for (const env of environments) {
      const serviceDatasRes = await getAllServiceDatas(env.id)
      if (!serviceDatasRes.success || !serviceDatasRes.data?.serviceDatas) {
        console.error(t('settings.get_env_service_data_failed', { name: env.name }), serviceDatasRes.message)
        continue
      }
      const hasReference = serviceDatasRes.data.serviceDatas.some((serviceData: ServiceData) =>
        serviceData.type === serviceType && serviceData.version === version
      )
      if (hasReference) {
        referencingEnvs.push(env.name)
      }
    }

    return {
      hasReferences: referencingEnvs.length > 0,
      referencingEnvironments: referencingEnvs
    }
  }

  // 删除服务
  const onDelete = async (serviceType: string, version: string) => {
    try {
      // 先检查引用情况
      const refResult = await checkServiceReferences(serviceType, version)

      if (refResult.hasReferences) {
        toast.error(`${t('settings.cannot_delete_service_referenced')} ${refResult.referencingEnvironments.join(', ')}`)
        return
      }

      const result = await deleteService(serviceType, version)

      if (result.success) {
        toast.success(result.message)
        // 重新加载服务列表
        loadInstalledServices()
      } else {
        toast.error(t('settings.delete_service_error') + ' ' + result.message)
      }
    } catch (error) {
      console.error(t('settings.delete_service_error'), error)
      toast.error(t('settings.delete_service_error'))
    }
  }

  // 获取服务的引用环境列表
  const getServiceReferences = async (serviceType: string, version: string) => {
    const refResult = await checkServiceReferences(serviceType, version)
    return refResult.referencingEnvironments
  }

  // 当对话框打开时加载服务列表
  useEffect(() => {
    if (isSettingDialogOpen) {
      loadInstalledServices()
      // 延迟聚焦到保存按钮，确保 DOM 已渲染
      setTimeout(() => {
        saveButtonRef.current?.focus()
      }, 100)
    }
  }, [isSettingDialogOpen])

  const onSaveBtnClick = () => {
    if (appSettings) {
      const newAppSettings: AppSettings = {
        ...appSettings,
        ai: {
          provider: newAIProvider,
          apiKey: newAIApiKey,
          baseUrl: newAIBaseUrl,
          model: newAIModel,
          enabled: newAIEnabled
        }
      };
      updateAppSettings(newAppSettings);
      toast.success(t('settings.settings_saved'))
      setIsSettingDialogOpen(false)
    }
  }

  const onRevertBtnClick = () => {
    // 还原AI设置，添加安全检查
    setNewAIProvider(appSettings?.ai?.provider || 'openai')
    setNewAIApiKey(appSettings?.ai?.apiKey || '')
    setNewAIBaseUrl(appSettings?.ai?.baseUrl || 'https://api.openai.com/v1')
    setNewAIModel(appSettings?.ai?.model || 'gpt-3.5-turbo')
    setNewAIEnabled(appSettings?.ai?.enabled || false)
  }

  const onToggleDevTools = async () => {
    toggleDevTools()
  }

  const onOpenSystemEnvSettings = async () => {
    const res = await openSystemEnvSettings()
    if (!res.success) {
      toast.error(res.message)
    }
  }

  const onQuitApp = async () => {
    try {
      await quitApp()
    } catch (error) {
      console.error(t('settings.quit_app_failed') + ':', error)
      toast.error(t('settings.quit_app_failed'))
    }
  }

  // 选择文件夹
  const onSelectFolder = async () => {
    try {
      const currentPath = systemSettings?.envisFolder
      const result = await selectFolder({
        title: t('settings.select_data_folder'),
        defaultPath: currentPath
      })

      if (result.success && result.data?.path) {
        const selectedPath = result.data.path
        
        // 如果路径有变化，需要检查环境状态并迁移数据
        if (selectedPath !== currentPath) {
          // 检查是否有活跃的环境
          const activeEnvironments = environments.filter(env => env.status === EnvironmentStatus.Active)
          if (activeEnvironments.length > 0) {
            const activeEnvNames = activeEnvironments.map(env => env.name).join(', ')
            toast.error(t('settings.cannot_migrate_data', { names: activeEnvNames }))
            return
          }
          
          toast.info(t('settings.migrating_data'))
        }
        
        await updateSystemSettings({ envisFolder: selectedPath })
        
        if (selectedPath !== currentPath) {
          toast.success(t('settings.data_migrated'))
        } else {
          toast.success(t('settings.folder_confirmed'))
        }
      }
    } catch (error) {
      console.error(t('settings.select_folder_failed') + ':', error)
      toast.error(t('settings.select_folder_failed'))
    }
  }

  // 在Finder中打开文件夹
  const onOpenFolder = async () => {
    try {
      const folderPath = systemSettings?.envisFolder
      if (!folderPath) {
        toast.error(t('settings.set_folder_first'))
        return
      }
      openFolderInFinder(folderPath)
    } catch (error) {
      console.error(t('settings.open_folder_failed') + ':', error)
      toast.error(t('settings.open_folder_failed'))
    }
  }

  return (
    <Dialog open={isSettingDialogOpen} onOpenChange={setIsSettingDialogOpen}>
      <DialogContent 
        className="sm:max-w-[625px] h-[500px] border border-divider rounded-2xl bg-content1 shadow-none flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()} // 防止自动focus到content
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">{t('settings.settings')}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {/* 配置应用程序的各项设置,包括主题、系统、服务管理、编辑器和AI助手等选项。 */}
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={"general"} className="w-full flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-5 bg-content2 p-1 rounded-lg">
            <TabsTrigger
              value="general"
              className="rounded-md heroui-transition data-[state=active]:bg-content1 data-[state=active]:shadow-none"
            >
              {t('settings.general')}
            </TabsTrigger>
            <TabsTrigger
              value="system"
              className="rounded-md heroui-transition data-[state=active]:bg-content1 data-[state=active]:shadow-none"
            >
              {t('settings.system')}
            </TabsTrigger>
            <TabsTrigger
              value="services"
              className="rounded-md heroui-transition data-[state=active]:bg-content1 data-[state=active]:shadow-none"
            >
              {t('settings.services')}
            </TabsTrigger>
            <TabsTrigger
              value="editor"
              className="rounded-md heroui-transition data-[state=active]:bg-content1 data-[state=active]:shadow-none"
            >
              {t('settings.editor')}
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="rounded-md heroui-transition data-[state=active]:bg-content1 data-[state=active]:shadow-none"
            >
              {t('settings.ai')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-4 py-2 pb-4">
              <div className="space-y-2">
                <Label htmlFor="theme" className="text-sm font-medium text-foreground">{t('settings.theme_mode')}</Label>
                <Select value={currentTheme} onValueChange={(value: 'light' | 'dark' | 'system') => updateAppSettings({ theme: value })}>
                  <SelectTrigger className="bg-content2 dark:bg-content3 border-divider focus:border-primary heroui-transition shadow-none">
                    <SelectValue placeholder={t('settings.select_theme')} />
                  </SelectTrigger>
                  <SelectContent className="heroui-card">
                    <SelectItem value="light" className="heroui-transition hover:bg-content2 dark:hover:bg-content3">
                      <div className="flex items-center">
                        <Sun className="mr-2 h-4 w-4" />
                        {t('settings.light_mode')}
                      </div>
                    </SelectItem>
                    <SelectItem value="dark" className="heroui-transition hover:bg-content2 dark:hover:bg-content3">
                      <div className="flex items-center">
                        <Moon className="mr-2 h-4 w-4" />
                        {t('settings.dark_mode')}
                      </div>
                    </SelectItem>
                    <SelectItem value="system" className="heroui-transition hover:bg-content2 dark:hover:bg-content3">
                      <div className="flex items-center">
                        <Monitor className="mr-2 h-4 w-4" />
                        {t('settings.follow_system')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 语言设置 */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="language">{t('settings.interface_language')}</Label>
                  <Select
                    value={appSettings?.language}
                    onValueChange={(value) =>
                      updateAppSettings({ language: value })
                    }
                  >
                    <SelectTrigger className="shadow-none bg-content2 dark:bg-content3">
                      <SelectValue placeholder={t('settings.select_language')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh-CN">{t('settings.simplified_chinese')}</SelectItem>
                      <SelectItem value="en-US">{t('settings.english')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t('settings.about')}</Label>
                <Button
                  variant="outline"
                  className="w-full dark:bg-content3 justify-start heroui-button-secondary border-divider hover:border-primary shadow-none"
                  onClick={() => window.open('https://github.com/xopenbeta/envis-app', '_blank')}
                >
                  <Info className="mr-2 h-4 w-4" /> {t('settings.about_us')}
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t('settings.dev_tools')}</Label>
                <Button
                  onClick={onToggleDevTools}
                  variant="outline"
                  className="w-full dark:bg-content3 justify-start heroui-button-secondary border-divider hover:border-primary shadow-none"
                >
                  <Code className="mr-2 h-4 w-4" /> {t('settings.open_dev_tools')}
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t('settings.application')}</Label>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full dark:bg-content3 justify-start heroui-button-secondary border-divider hover:border-destructive shadow-none text-destructive hover:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" /> {t('settings.quit_app')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border border-divider rounded-2xl bg-content1 shadow-none">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        {t('settings.confirm_quit')}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('settings.confirm_quit_msg')}
                        {systemSettings?.stopAllServicesOnExit && (
                          <>
                            <br />
                            <span className="text-muted-foreground text-sm">
                              {t('settings.stop_services_warning')}
                            </span>
                          </>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="heroui-button-secondary border-divider shadow-none">
                        {t('nav_bar.cancel')}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onQuitApp}
                        className="heroui-button bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        {t('settings.quit')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="system" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 py-2 pb-4">
              {/* 启动设置 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Power className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-medium">{t('settings.startup_settings')}</h3>
                </div>

                <div className="space-y-3 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoStart">{t('settings.auto_start')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.auto_start_desc')}</p>
                    </div>
                    <Switch
                      id="autoStart"
                      checked={systemSettings?.autoStartAppOnLogin}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateSystemSettings({ autoStartAppOnLogin: checked });
                        } catch (e) {
                          toast.error(t('settings.auto_start_failed'));
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="deactivateOthers">{t('settings.deactivate_others')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.deactivate_others_desc')}</p>
                    </div>
                    <Switch
                      id="deactivateOthers"
                      checked={systemSettings?.deactivateOtherEnvironmentsOnActivate ?? true}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateSystemSettings({ deactivateOtherEnvironmentsOnActivate: checked });
                        } catch (e) {
                          toast.error(t('settings.setting_failed'));
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="stopOnExit">{t('settings.stop_on_exit')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.stop_on_exit_desc')}</p>
                    </div>
                    <Switch
                      id="stopOnExit"
                      checked={systemSettings?.stopAllServicesOnExit}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateSystemSettings({ stopAllServicesOnExit: checked });
                          toast.success(checked ? t('settings.stop_on_exit_enabled') : t('settings.stop_on_exit_disabled'));
                        } catch (e) {
                          toast.error(t('settings.setting_failed'));
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="startLastEnv">{t('settings.start_last_env')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.start_last_env_desc')}</p>
                    </div>
                    <Switch
                      id="startLastEnv"
                      checked={systemSettings?.autoActivateLastUsedEnvironmentOnAppStart}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateSystemSettings({ autoActivateLastUsedEnvironmentOnAppStart: checked });
                        } catch (e) {
                          toast.error(t('settings.setting_failed'));
                        }
                      }}
                    />
                  </div>

                </div>
              </div>

              {/* 工具设置 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-medium">{t('settings.cli_tools')}</h3>
                </div>

                <div className="space-y-3 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="terminal">{t('settings.terminal_program')}</Label>
                    <Select
                      value={systemSettings?.terminalTool}
                      onValueChange={(value) =>
                        updateSystemSettings({ terminalTool: value })
                      }
                    >
                      <SelectTrigger className="shadow-none bg-content2 dark:bg-content3">
                        <SelectValue placeholder={t('settings.select_terminal')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">{t('settings.system_default')}</SelectItem>
                        <SelectItem value="iterm2">iTerm2</SelectItem>
                        <SelectItem value="terminal">Terminal.app</SelectItem>
                        <SelectItem value="warp">Warp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="showEnvName">{t('settings.show_env_name')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.show_env_name_desc')}</p>
                    </div>
                    <Switch
                      id="showEnvName"
                      checked={systemSettings?.showEnvironmentNameOnTerminalOpen ?? true}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateSystemSettings({ showEnvironmentNameOnTerminalOpen: checked });
                        } catch (e) {
                          toast.error(t('settings.setting_failed'));
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="showServiceInfo">{t('settings.show_service_info')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.show_service_info_desc')}</p>
                    </div>
                    <Switch
                      id="showServiceInfo"
                      checked={systemSettings?.showServiceInfoOnTerminalOpen ?? false}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateSystemSettings({ showServiceInfoOnTerminalOpen: checked });
                        } catch (e) {
                          toast.error(t('settings.setting_failed'));
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 路径设置 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-medium">{t('settings.path_settings')}</h3>
                </div>

                <div className="space-y-3 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="servicesFolder">{t('settings.service_data_folder')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="servicesFolder"
                        value={systemSettings?.envisFolder || ''}
                        onChange={(e) =>
                          updateSystemSettings({ envisFolder: e.target.value })
                        }
                        placeholder="/usr/local/bin"
                        className="flex-1 shadow-none bg-content2 dark:bg-content3"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectFolder()}
                        className="px-3 shadow-none"
                        title={t('settings.select_folder')}
                      >
                        <Folder className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenFolder()}
                        className="px-3 shadow-none"
                        title={t('settings.open_in_finder')}
                        disabled={!systemSettings?.envisFolder}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.service_folder_desc')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="configFolder">{t('settings.app_config_file')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="configFolder"
                        value="~/.envis.json"
                        readOnly
                        disabled
                        placeholder="~/.envis.json"
                        className="flex-1 shadow-none bg-content2 dark:bg-content3 cursor-not-allowed"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAppConfigFolder()}
                        className="px-3 shadow-none"
                        title={t('settings.open_config_folder')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.app_config_desc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* 高级设置 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-medium">{t('settings.advanced_settings')}</h3>
                </div>

                <div className="space-y-3 pl-6">
                  <div className="space-y-2">
                    <Label>{t('settings.app_config')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.open_app_config_folder')}
                    </p>
                    <Button variant="outline" size="sm" onClick={openAppConfigFolder}>
                      {t('settings.open_folder')}
                    </Button>
                  </div>
                  {osName.toLowerCase().includes('windows') && (
                    <div className="space-y-2">
                      <Label>{t('settings.system_env_vars')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('settings.open_system_env_vars')}
                      </p>
                      <Button variant="outline" className="shadow-none" size="sm" onClick={onOpenSystemEnvSettings}>
                        {t('settings.open')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="services" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-4 py-2 pb-4">
              <div className="rounded-md border border-divider">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t('settings.service_type')}</TableHead>
                      <TableHead>{t('settings.version')}</TableHead>
                      <TableHead>{t('settings.size')}</TableHead>
                      <TableHead>{t('settings.referenced_envs')}</TableHead>
                      <TableHead className="text-right">{t('settings.operation')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicesLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          <div className="flex justify-center items-center">
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            {t('settings.loading')}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : installedServices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          {t('settings.no_installed_services')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      installedServices.map((service, index) => (
                        <ServiceRow
                          key={`${service.type}-${service.version}-${index}`}
                          service={service}
                          onDelete={onDelete}
                          getReferences={getServiceReferences}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="editor" className="flex-1 min-h-0 overflow-y-auto">
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Code className="h-12 w-12 mb-4 opacity-20" />
                <p>{t('settings.editor_settings_dev')}</p>
             </div>
          </TabsContent>

          <TabsContent value="ai" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-4 py-2 pb-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ai-enabled" className="text-sm font-medium text-foreground">{t('settings.enable_ai')}</Label>
                  <Switch
                    id="ai-enabled"
                    checked={newAIEnabled}
                    onCheckedChange={setNewAIEnabled}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-provider" className="text-sm font-medium text-foreground">{t('settings.ai_provider')}</Label>
                <Select value={newAIProvider} onValueChange={(value: AIProvider) => {
                  setNewAIProvider(value)
                  // 自动设置默认配置
                  if (value === 'openai') {
                    setNewAIBaseUrl('https://api.openai.com/v1')
                    setNewAIModel('gpt-3.5-turbo')
                  } else if (value === 'deepseek') {
                    setNewAIBaseUrl('https://api.deepseek.com/v1')
                    setNewAIModel('deepseek-chat')
                  }
                }}>
                  <SelectTrigger className="bg-content2 border-divider focus:border-primary heroui-transition shadow-none">
                    <SelectValue placeholder={t('settings.select_ai_provider')} />
                  </SelectTrigger>
                  <SelectContent className="heroui-card">
                    <SelectItem value="openai" className="heroui-transition hover:bg-content2">
                      <div className="flex items-center">
                        <Bot className="mr-2 h-4 w-4" />
                        OpenAI
                      </div>
                    </SelectItem>
                    <SelectItem value="deepseek" className="heroui-transition hover:bg-content2">
                      <div className="flex items-center">
                        <Bot className="mr-2 h-4 w-4" />
                        DeepSeek
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-api-key" className="text-sm font-medium text-foreground">{t('settings.api_key')}</Label>
                <Input
                  id="ai-api-key"
                  type="password"
                  value={newAIApiKey}
                  onChange={(e) => setNewAIApiKey(e.target.value)}
                  placeholder={t('settings.enter_api_key')}
                  className="bg-content2 border-divider focus:border-primary heroui-transition shadow-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-base-url" className="text-sm font-medium text-foreground">{t('settings.api_base_url')}</Label>
                <Input
                  id="ai-base-url"
                  value={newAIBaseUrl}
                  onChange={(e) => setNewAIBaseUrl(e.target.value)}
                  placeholder={t('settings.api_endpoint')}
                  className="bg-content2 border-divider focus:border-primary heroui-transition shadow-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-model" className="text-sm font-medium text-foreground">{t('settings.model')}</Label>
                <Input
                  id="ai-model"
                  value={newAIModel}
                  onChange={(e) => setNewAIModel(e.target.value)}
                  placeholder={t('settings.model_name')}
                  className="bg-content2 border-divider focus:border-primary heroui-transition shadow-none"
                />
              </div>

              {newAIProvider === 'openai' && (
                <div className="text-xs text-muted-foreground bg-content2 p-3 rounded-lg">
                  <p className="font-medium mb-1">{t('settings.openai_config')}</p>
                  <p>• {t('settings.openai_recommend')}</p>
                  <p>• {t('settings.openai_key_req')}</p>
                </div>
              )}

              {newAIProvider === 'deepseek' && (
                <div className="text-xs text-muted-foreground bg-content2 p-3 rounded-lg">
                  <p className="font-medium mb-1">{t('settings.deepseek_config')}</p>
                  <p>• {t('settings.deepseek_recommend')}</p>
                  <p>• {t('settings.deepseek_key_req')}</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <div className="flex items-center space-x-2 justify-end">
            <Button
              onClick={onRevertBtnClick}
              variant="outline"
              className="heroui-button heroui-button-secondary border border-divider hover:border-primary rounded-lg shadow-none"
            >
              <RefreshCw className="mr-2 h-4 w-4" />{t('settings.revert_settings')}
            </Button>
            <Button
              ref={saveButtonRef}
              onClick={onSaveBtnClick}
              className="heroui-button heroui-button-primary border-0 rounded-lg shadow-none"
            >
              <HardDrive className="mr-2 h-4 w-4" />{t('settings.save_settings')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
