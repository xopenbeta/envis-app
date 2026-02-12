import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { CanRunServices, DownloadStatus, EnvironmentStatus, NeedDownloadServices, NoNeedDownloadServices, NoNeedVersionServices, ServiceData, ServiceDataStatus, ServiceStatus, ServiceType } from '@/types/index'
import {
  useSortable
} from '@dnd-kit/sortable'
import {
  CSS,
} from '@dnd-kit/utilities'
import { useAtom } from 'jotai'
import {
  Download,
  Folder,
  GripVertical,
  MoreHorizontal,
  Play,
  Settings,
  Square,
  Trash,
  XCircle
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useService } from '@/hooks/service'
import { useServiceData } from '@/hooks/env-serv-data'
import { toast } from 'sonner'
import { selectedServiceDataIdAtom } from '@/store/service'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { Input } from '@/components/ui/input'
import { useAppSettings } from '@/hooks/appSettings'
import { useFileOperations } from '@/hooks/file-operations'
import { setImmediateInterval } from '@/utils/patch'
import { useEnvironment } from '@/hooks/environment'

export interface ServiceDownloadProgress {
  serviceType: ServiceType;
  version: string;
  progress: number;
  isDownloading: boolean;
  isCancelling?: boolean;
}

// Devicon 图标映射
const SERVICE_TYPE_ICONS: Record<ServiceType, string> = {
  [ServiceType.Nodejs]: 'nodejs',
  [ServiceType.Nginx]: 'nginx',
  [ServiceType.Mongodb]: 'mongodb',
  [ServiceType.Mariadb]: 'mariadb',
  [ServiceType.Mysql]: 'mysql',
  [ServiceType.Postgresql]: 'postgresql',
  [ServiceType.Python]: 'python',
  [ServiceType.Custom]: 'devicon', // 使用 devicon logo
  [ServiceType.Host]: 'windows11', // 使用 windows11 作为 host 图标
  [ServiceType.SSL]: 'cloudflare', // 使用 cloudflare 作为 SSL 图标
  [ServiceType.Dnsmasq]: 'linux', // 使用 linux 作为 Dnsmasq 图标
  [ServiceType.Java]: 'java', // 使用 java 作为 Java 图标
}

export function SortableServiceItem({
  serviceData,
  selectedEnvironmentId,
  isSelected,
  isDragEnabled,
}: {
  serviceData: ServiceData;
  selectedEnvironmentId: string;
  isSelected: boolean;
  isDragEnabled: boolean;
}) {
  const { t } = useTranslation()
  const [, setSelectedServiceDataId] = useAtom(selectedServiceDataIdAtom)

  const [showEnvironmentActivationDialog, setShowEnvironmentActivationDialog] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>(DownloadStatus.Unknown);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>(ServiceStatus.Unknown);
  const [activationStatus, setActivationStatus] = useState<ServiceDataStatus>(ServiceDataStatus.Unknown);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const { selectedEnvironment, activeEnvironment } = useEnvironment();
  const serviceDataStatus = (activeEnvironment?.id === selectedEnvironmentId) ? activationStatus : ServiceDataStatus.Inactive;
  const { getServiceData } = useServiceData();
  const { cancelServiceDownload, downloadService, checkServiceInstalled, getServiceDownloadProgress } = useService();
  const { switchEnvAndServDatasActive, deleteServiceData, activateServiceData, deactivateServiceData, updateServiceData, getServiceStatus } = useEnvironmentServiceData();
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameValue, setRenameValue] = useState(serviceData.name || '')
  const [renameLoading, setRenameLoading] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [password, setPassword] = useState('')
  const { systemSettings } = useAppSettings();
  const { openFolderInFinder } = useFileOperations();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: serviceData.id,
    disabled: !isDragEnabled
  });

  // 安装状态轮询
  useEffect(() => {
    if (!NeedDownloadServices.includes(serviceData.type)) {
      // 不需要下载的服务，不用轮询
      return;
    }
    // let hasShownDownloadFailedToast = false;
    const timer = setImmediateInterval(async () => {
      let downloadStatus = DownloadStatus.Unknown;
      const downloadRes = await getServiceDownloadProgress(serviceData.type, serviceData.version);
      if (downloadRes.success && downloadRes.data && downloadRes.data.task) {
        const downloadTask = downloadRes.data.task;
        downloadStatus = downloadTask.status;
        setDownloadProgress(downloadTask.progress);
        // 下载取消toast在点击下载取消按钮时弹
        // failed状态在点击下载按钮时弹
        // if (downloadTask.status === DownloadStatus.Failed) {
        //   if (!hasShownDownloadFailedToast) {
        //     hasShownDownloadFailedToast = true;
        //     toast.error(`服务 ${serviceData.name} 下载失败: ${downloadRes.message || '未知错误'}`);
        //     console.log('zws 2423', downloadRes)
        //   }
        // } else {
        //   // 非 failed 状态时重置，下一次失败可以再次提示
        //   if (hasShownDownloadFailedToast) {
        //     hasShownDownloadFailedToast = false;
        //   }
        // }
      } else {
        const isInstalledRes = await checkServiceInstalled(serviceData.type, serviceData.version);
        if (isInstalledRes.success && isInstalledRes.data) {
          downloadStatus = isInstalledRes.data.installed ? DownloadStatus.Installed : DownloadStatus.NotInstalled;
        }
      }
      setDownloadStatus(downloadStatus);
    }, 500);
    return () => clearInterval(timer);
  }, [serviceData.id, serviceData.type, serviceData.version]);

  // 服务程序状态轮询
  useEffect(() => {
    if (!CanRunServices.includes(serviceData.type)) {
      // 不可运行的服务，不用轮询
      return;
    }
    const timer = setInterval(async () => {
      const res = await getServiceStatus(selectedEnvironmentId, serviceData);
      if (res.success && res.data) {
        setServiceStatus(res.data.status);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [serviceData.id, serviceData.type, serviceData.version]);

  // 服务激活状态轮询（从文件读取）
  useEffect(() => {
    const timer = setImmediateInterval(async () => {
      const res = await getServiceData(selectedEnvironmentId, serviceData.id);
      if (res.success && res.data?.serviceData) {
        setActivationStatus(res.data.serviceData.status);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [serviceData.id, selectedEnvironmentId]);

  // 激活环境并启动所有服务
  const handleActivateEnvironmentAndStartServices = async () => {
    if (!selectedEnvironment) return
    try {
      await switchEnvAndServDatasActive(selectedEnvironment);
    } catch (error) {
      console.error('环境操作失败:', error)
      toast.error(t('service_item.env_op_error'))
    } finally {
      setShowEnvironmentActivationDialog(false)
    }
  }

  // 打开服务文件夹
  const handleOpenFolder = () => {
    if (!systemSettings?.envisFolder) {
      toast.error(t('nav_bar_item.no_env_folder'))
      return
    }
    const serviceFolderPath = `${systemSettings.envisFolder}/envs/${selectedEnvironmentId}/${serviceData.type}/${serviceData.version}`
    openFolderInFinder(serviceFolderPath)
  }

  // 取消下载服务
  const onCancelServiceDownloadBtnClick = async (serviceData: ServiceData) => {
    const res = await cancelServiceDownload(serviceData.type, serviceData.version)
    if (res.success) {
      toast.success(t('service_item.download_cancelled'))
    } else {
      // 如果取消失败，恢复状态
      toast.error(t('service_item.cancel_download_error'))
    }
  }

  // 处理服务选择
  const onServiceItemClick = (serviceData: ServiceData) => {
    setSelectedServiceDataId(serviceData.id)
  }

  // 删除服务
  const onDeleteBtnClick = async (serviceData: ServiceData) => {
    if ([ServiceDataStatus.Active].includes(activationStatus)) {
      toast.error(t('service_item.delete_active_error'))
      return
    }

    await deleteServiceData(serviceData)
  }

  // 切换服务状态
  const onSwitchServiceDataStatusBtnClick = async () => {
    // 如果没有选中的环境，一般是出错了，直接返回
    if (!selectedEnvironment) return;

    // 如果环境没有开启，需要先激活环境
    if (selectedEnvironment.status !== EnvironmentStatus.Active) {
      setShowEnvironmentActivationDialog(true)
      return
    }

    // 乐观更新：先保存当前状态
    const previousStatus = activationStatus;
    const isCurrentlyActive = activationStatus === ServiceDataStatus.Active;

    try {
      // 乐观更新：立即切换状态，让用户感觉响应快
      setActivationStatus(isCurrentlyActive ? ServiceDataStatus.Inactive : ServiceDataStatus.Active);

      if (isCurrentlyActive) {
        // 停用服务
        const res = await deactivateServiceData(selectedEnvironment.id, serviceData)
        
        if (!res?.success) {
          // 回滚状态
          setActivationStatus(previousStatus);
          // 严格根据后端返回的错误信息判断是否是权限问题
          if (serviceData.type === ServiceType.Host && res?.message?.includes('needAdminPasswordToModifyHosts')) {
            setShowPasswordDialog(true)
            return
          }
          toast.error(t('service_item.stop_error', { message: res?.message || t('common.unknown_error') }))
        } else {
          toast.success(t('service_item.stop_success'))
        }
      } else {
        // 激活/启动服务
        const res = await activateServiceData(selectedEnvironment.id, serviceData)
        
        if (!res?.success) {
          // 回滚状态
          setActivationStatus(previousStatus);
          // 严格根据后端返回的错误信息判断是否是权限问题
          if (serviceData.type === ServiceType.Host && res?.message?.includes('needAdminPasswordToModifyHosts')) {
            setShowPasswordDialog(true)
            return
          }
          toast.error(t('service_item.start_error', { message: res?.message || t('common.unknown_error') }))
        } else {
          toast.success(t('service_item.start_success'))
        }
      }
    } catch (err) {
      // 回滚状态
      setActivationStatus(previousStatus);
      console.error('切换服务状态失败:', err)
      toast.error(t('service_item.toggle_error'))
    }
  }

  const handlePasswordConfirm = async () => {
    if (!password.trim() || !selectedEnvironment) return;
    
    // 乐观更新：先保存当前状态
    const previousStatus = activationStatus;
    const isCurrentlyActive = activationStatus === ServiceDataStatus.Active;
    
    setShowPasswordDialog(false);
    
    try {
      // 乐观更新：立即切换状态
      setActivationStatus(isCurrentlyActive ? ServiceDataStatus.Inactive : ServiceDataStatus.Active);
      
      let res = await activateServiceData(selectedEnvironment.id, serviceData, password);

      if (res?.success) {
        sessionStorage.setItem('envis_sudo_password', password);
        toast.success(isCurrentlyActive ? t('service_item.stop_success') : t('service_item.start_success'));
      } else {
        // 回滚状态
        setActivationStatus(previousStatus);
        toast.error(t(isCurrentlyActive ? 'service_item.stop_error' : 'service_item.start_error', { message: res?.message || t('common.unknown_error') }));
        // 如果是因为密码错误，可能需要再次弹窗，这里暂时只提示错误
        if (res?.message?.includes('密码')) {
             // 可以选择再次打开弹窗
             // setShowPasswordDialog(true);
        }
      }
    } catch (err) {
      // 回滚状态
      setActivationStatus(previousStatus);
      console.error('带密码操作服务失败:', err);
      toast.error(t('service_item.operation_error'));
    } finally {
      setPassword('');
    }
  }

  const onDownloadServiceBtnClick = async () => {
    if (!selectedEnvironmentId) {
      toast.error(t('service_item.no_env_selected'))
      return
    }
    // 然后开始下载
    const result = await downloadService(serviceData.type, serviceData.version)
    if (result?.success) {
      toast.success(t('service_item.download_start', { name: serviceData.name, version: serviceData.version }))
    } else {
      toast.error(t('service_item.download_start_error', { message: result?.message || t('common.unknown_error') }))
    }
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isNeedDownload = !NoNeedDownloadServices.includes(serviceData.type);
  const showActive = !isNeedDownload ? true : downloadStatus === DownloadStatus.Installed;
  const canRun = CanRunServices.includes(serviceData.type);

  // 获取对应服务类型的 devicon 图标
  const getDeviconUrl = (type: ServiceType): string => {
    const iconName = SERVICE_TYPE_ICONS[type] || 'devicon';
    return `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${iconName}/${iconName}-original.svg`;
  };

  const StatusView = (): JSX.Element => {
    // 下载中/相关状态时，显示下载状态，并且不显示 active/running
    if ([
      DownloadStatus.NotInstalled,
      DownloadStatus.Pending,
      DownloadStatus.Downloading,
      DownloadStatus.Downloaded,
      DownloadStatus.Installing,
      DownloadStatus.Cancelled,
      DownloadStatus.Failed,
    ].includes(downloadStatus)) {
      let downloadStr = '';
      switch (downloadStatus) {
        case DownloadStatus.NotInstalled:
          downloadStr = t('service_item.download_status.not_installed');
          break;
        case DownloadStatus.Pending:
          downloadStr = t('service_item.download_status.pending');
          break;
        case DownloadStatus.Downloading:
          downloadStr = t('service_item.download_status.downloading');
          break;
        case DownloadStatus.Downloaded:
          downloadStr = t('service_item.download_status.downloaded');
          break;
        case DownloadStatus.Installing:
          downloadStr = t('service_item.download_status.installing');
          break;
        case DownloadStatus.Cancelled:
          downloadStr = t('service_item.download_status.cancelled');
          break;
        case DownloadStatus.Failed:
          downloadStr = t('service_item.download_status.failed');
          break;
        case DownloadStatus.Unknown:
          downloadStr = t('service_item.download_status.unknown');
          break;
      }
      
      return (
        <span
          className={cn(
            "text-xs font-medium",
            downloadStatus === DownloadStatus.NotInstalled && "text-muted-foreground",
            downloadStatus === DownloadStatus.Cancelled && "text-muted-foreground",
            downloadStatus === DownloadStatus.Pending && "text-success",
            downloadStatus === DownloadStatus.Downloading && "text-success",
            downloadStatus === DownloadStatus.Downloaded && "text-success",
            downloadStatus === DownloadStatus.Installing && "text-success",
            downloadStatus === DownloadStatus.Unknown && "text-danger",
            downloadStatus === DownloadStatus.Failed && "text-danger"
          )}
        >
          {downloadStr}
        </span>
      );
    }

    return (
      <>
        {showActive && (
          <span
            className={cn(
              "text-xs font-medium",
              serviceDataStatus === ServiceDataStatus.Active && "text-success",
              serviceDataStatus === ServiceDataStatus.Inactive && "text-muted-foreground",
              serviceDataStatus === ServiceDataStatus.Unknown && "text-muted-foreground"
            )}
          >
            {serviceDataStatus === ServiceDataStatus.Active ? t('service_item.status.active') : t('service_item.status.inactive')}
          </span>
        )}

        {/* 只有当服务可运行、处于 active 且 serviceStatus 不是 Unknown 时才显示 running 状态 */}
        {canRun && showActive && serviceDataStatus === ServiceDataStatus.Active && serviceStatus !== ServiceStatus.Unknown && (
          <span
            className={cn(
              "text-xs font-medium",
              serviceStatus === ServiceStatus.Running && "text-success",
              serviceStatus === ServiceStatus.Stopped && "text-muted-foreground",
              serviceStatus === ServiceStatus.Error && "text-danger"
              // 不再包含 ServiceStatus.Unknown 的样式，因为 Unknown 时不显示
            )}
          >
            · {serviceStatus === ServiceStatus.Running ? t('service_item.status.running') : serviceStatus === ServiceStatus.Stopped ? t('service_item.status.stopped') : serviceStatus === ServiceStatus.Error ? t('service_item.status.error') : t('service_item.status.unknown')}
          </span>
        )}
      </>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "overflow-hidden", // 添加 overflow-hidden 以裁剪图标
        "mb-2",
        "group relative flex items-center p-2 rounded-lg cursor-pointer heroui-transition",
        "border box-border",
        isSelected
          ? "bg-gray-50 dark:bg-gray-800 dark:border-gray-600  dark:bg-white/10 dark:border-white/5"
          : "hover:bg-content2 border-transparent dark:hover:bg-white/5",
        isDragging && "z-50"
      )}
      onClick={() => onServiceItemClick(serviceData)}
    >
      {/* 背景图标 */}
      <div
        className="absolute right-0 bottom-0 pointer-events-none"
        style={{
          height: '120%', // 图标高度稍大于容器，让图标更有视觉冲击力
          width: 'auto', // 宽度自动，保持图标原始宽高比
          transform: 'translate(-15%, 15%)', // 右下角位置
          opacity: 0.3, // 整体透明度
          maskImage: 'radial-gradient(circle at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 80%)', // 径向渐变
          WebkitMaskImage: 'radial-gradient(circle at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 80%)',
        }}
      >
        <img
          src={getDeviconUrl(serviceData.type)}
          alt=""
          className="h-full w-auto object-contain" // 高度100%，宽度自动以保持比例
          style={{
            filter: 'brightness(1.2)', // 稍微提亮
          }}
        />
      </div>

      <div className="flex items-center flex-1 min-w-0 relative z-10">{/* 添加 z-10 确保内容在图标上方 */}
        <div className="flex items-center w-full min-w-0">
          {/* 拖动图标 */}
          {isDragEnabled && (
            <div
              {...attributes}
              {...listeners}
              className="mr-2 cursor-grab active:cursor-grabbing hover:text-default heroui-transition flex-shrink-0"
              title={t('service_item.drag_sort')}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4 text-gray-300 dark:text-gray-500" />
            </div>
          )}


          <div className="flex flex-col min-w-0">
            {/* 服务名字 */}
            <span className="font-medium text-sm text-gray-700 dark:text-gray-300 min-w-0 truncate">
              {serviceData.type === ServiceType.Custom && (
                <span className="mr-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">{t('service_item.custom_tag')}</span>
              )}
              {serviceData.name}
              {!NoNeedVersionServices.includes(serviceData.type) && (
                <span className="text-xs text-muted-foreground ml-2">{serviceData.version}</span>
              )}
            </span>
            <span className={cn("text-xs truncate font-mono flex items-center gap-1.5", serviceData.status === 'active' ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500")}>
              {/* 服务状态 */}
              <StatusView />
              {/* 下载进度展示区域 */}
              <div className="flex items-center">
                {[
                  DownloadStatus.Pending,
                  DownloadStatus.Downloading,
                  DownloadStatus.Downloaded,
                  DownloadStatus.Installing
                ].includes(downloadStatus) && (
                    <div className="ml-auto flex items-center text-xs text-muted-foreground">
                      <span className="w-14 text-right tabular-nums">
                        {`${Math.round(downloadProgress)}%`}
                      </span>
                    </div>
                  )}
              </div>
            </span>

            {/* 下载进度条 与 取消按钮并排显示 */}
            {[
              DownloadStatus.Pending,
              DownloadStatus.Downloading,
              DownloadStatus.Downloaded,
              DownloadStatus.Installing
            ].includes(downloadStatus) && (
                <div className="flex items-center gap-1">
                  <div className="flex-1">
                    <Progress value={downloadProgress} className="h-1.5" />
                  </div>
                  <div className="flex-shrink-0 flex items-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        onCancelServiceDownloadBtnClick(serviceData)
                      }}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-danger"
                      title={t('service_item.cancel_download')}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* 绝对定位的操作按钮 */}
      <div className={cn(
        "absolute right-3 top-1/2 transform -translate-y-1/2",
        "flex items-center heroui-transition",
        "opacity-0 group-hover:opacity-100",
        "hover:backdrop-blur-sm rounded",
        "z-10" // 确保按钮在图标上方
      )}>
        {/* 显示下载按钮 */}
        {isNeedDownload && downloadStatus !== DownloadStatus.Installed && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onDownloadServiceBtnClick()
            }}
            title={t('service_item.download_install')}
          >
            <Download className="h-3 w-3" />
          </Button>
        )}

        {/* 显示激活按钮 */}
        {showActive && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onSwitchServiceDataStatusBtnClick()
            }}
            title={t('service_item.toggle_status')}
          >
            {serviceDataStatus === ServiceDataStatus.Active ? (
              <Square className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameValue(serviceData.name || ''); setShowRenameDialog(true); }}>
              <Settings className="h-4 w-4 mr-2" />
              {t('common.edit')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDeleteBtnClick(serviceData)}
              className="text-danger"
            >
              <Trash className="h-4 w-4 mr-2" />
              {t('common.delete')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleOpenFolder}>
              <Folder className="mr-2 h-4 w-4" />
              <span>{t('nav_bar_item.open_folder')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 环境激活确认弹窗 */}
      <AlertDialog open={showEnvironmentActivationDialog} onOpenChange={setShowEnvironmentActivationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('service_item.activate_env_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('service_item.activate_env_desc', { name: selectedEnvironment?.name })}
              <br />
              <span className="text-muted-foreground text-sm mt-2 block">
                {t('service_item.activate_env_note')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='shadow-none' onClick={() => {
              setShowEnvironmentActivationDialog(false)
            }}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleActivateEnvironmentAndStartServices}>
              {t('service_item.activate_env_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* 重命名服务对话框 */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('service_item.rename_title')}</DialogTitle>
            <DialogDescription>
              {t('service_item.rename_desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <Input className='shadow-none' value={renameValue} onChange={(e) => setRenameValue((e.target as HTMLInputElement).value)} placeholder={t('service_item.service_name_placeholder')} />
          </div>

          <DialogFooter>
            <Button variant="outline" className='shadow-none' onClick={() => setShowRenameDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={async () => {
              // 验证
              if (!renameValue || !renameValue.trim()) {
                toast.error(t('service_item.name_required'))
                return
              }
              try {
                setRenameLoading(true)
                await updateServiceData(serviceData.id, { name: renameValue.trim() })
                toast.success(t('service_item.rename_success'))
                setShowRenameDialog(false)
              } catch (err) {
                console.error('更新服务名称失败:', err)
                toast.error(t('service_item.rename_error'))
              } finally {
                setRenameLoading(false)
              }
            }}>{renameLoading ? t('common.saving') : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 密码输入弹窗 */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('service_item.admin_required_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('service_item.admin_required_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder={t('service_item.password_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePasswordConfirm();
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowPasswordDialog(false);
              setPassword('');
            }}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handlePasswordConfirm}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
