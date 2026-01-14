import appIcon from '@/assets/envis.svg'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { AppTheme, Environment } from '@/types/index'
import { useAtom } from 'jotai'
import {
  Github,
  Monitor,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Server,
  Settings,
  Sun,
  SquareTerminal,
  User,
  X,
  MessageSquareText,
  FlaskConical,
  MoreHorizontal,
  Hexagon
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useAppSettings } from '@/hooks/appSettings'
import { useEnvironment } from '@/hooks/environment'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { appSettingsAtom, isAppLoadingAtom, updateAvailableAtom } from '../../store/appSettings'
import {
  environmentsAtom,
  selectedEnvironmentIdAtom
} from '../../store/environment'
import { sortEnvironments } from '@/utils/sort'
import { SortableEnvironmentItem } from './nav-bar-item'
import SettingsDialog from './settings-dialog'
import { selectedServiceDataIdAtom } from '../../store/service'
import { isLogPanelOpenAtom } from '../../store/log'
import { useLogger } from '@/hooks/log'
import { eventLogFunc } from '@/utils/logger'
import { useSystemInfo } from '@/hooks/system-info'
import { isAIPanelOpenAtom } from '@/store'
import { useTranslation } from 'react-i18next'

interface NavBarProps {
  onClose?: () => void
}

export default function NavBar({ onClose }: NavBarProps) {
  const { t } = useTranslation()
  const [environments] = useAtom(environmentsAtom)
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)
  const {
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    updateEnvironmentsOrder,
    selectEnvironment
  } = useEnvironment()
  const [appSettings] = useAtom(appSettingsAtom)
  const [updateAvailable] = useAtom(updateAvailableAtom)
  const [, setSelectedServiceDataId] = useAtom(selectedServiceDataIdAtom)
  const [, setIsLogOpen] = useAtom(isLogPanelOpenAtom)
  const [, setIsAIPanelOpen] = useAtom(isAIPanelOpenAtom)
  const { updateAppSettings } = useAppSettings()
  const { switchEnvAndServDatasActive } = useEnvironmentServiceData()
  const { openTerminal: openTerminalFunc } = useSystemInfo()
  const currentTheme = appSettings?.theme as AppTheme
  const { logInfo, logError } = useLogger()

  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [editingEnvironment, setEditingEnvironment] = useState<Environment | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [envInfoFormData, setEnvInfoFormData] = useState({ name: '' })

  // 处理环境选择
  const onEnvItemClick = async (environment: Environment) => {
    setSelectedServiceDataId('') // 清除选中的服务
    if (selectedEnvironmentId === environment.id) return
    await selectEnvironment(environment)
  }

  // 激活/停用环境
  const onActiveEnvBtnClick = async (environment: Environment, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发环境选择
    await switchEnvAndServDatasActive(environment);
  }

  // 删除环境
  const onDeleteEnvBtnClick = async (environment: Environment) => {
    if (environment.status === 'active') {
      toast.error(t('nav_bar.delete_active_env_error'))
      logError(t('nav_bar.delete_env_error_active', { name: environment.name }))
      return
    }

    logInfo(t('nav_bar.delete_env_log', { name: environment.name }))
    const res = await deleteEnvironment(environment)
    if (res.success) {
      toast.success(t('nav_bar.delete_env_success', { name: environment.name }))
      logInfo(t('nav_bar.delete_env_log_success', { name: environment.name }))
    } else {
      toast.error(t('nav_bar.delete_env_error_msg', { message: res.message }))
      logError(t('nav_bar.delete_env_error_full', { name: environment.name, message: res.message }))
    }
  }

  // 打开新增/编辑对话框
  const onOpenNewDialogBtnClick = eventLogFunc(t('nav_bar.open_env_dialog'), (environment?: Environment) => {
    setEditingEnvironment(environment || null)
    setEnvInfoFormData({
      name: environment?.name || '',
    })
    setIsNewDialogOpen(true)
  })

  // 保存环境
  const onDialogSaveEnvBtnClick = async () => {
    if (!envInfoFormData.name.trim()) {
      toast.error(t('nav_bar.enter_env_name'))
      return
    }

    // 名称重复
    if (environments.some(env => env.name === envInfoFormData.name.trim() && env.id !== editingEnvironment?.id)) {
      toast.error(t('nav_bar.env_name_exists'))
      return
    }

    if (editingEnvironment) {
      // 编辑环境
      logInfo(t('nav_bar.save_env_log', { oldName: editingEnvironment.name, newName: envInfoFormData.name.trim() }))
      const res = await updateEnvironment(editingEnvironment.id, {
        name: envInfoFormData.name.trim(),
      })
      if (res && res.success) {
        toast.success(t('nav_bar.env_updated'))
      } else {
        toast.error(t('nav_bar.update_env_error') + (res?.message ? `: ${res?.message}` : ''))
        console.error(t('nav_bar.update_env_error') + ':', res?.message)
      }
    } else {
      // 新增环境
      const res = await createEnvironment(envInfoFormData.name.trim(), '')
      if (res?.success) {
        toast.success(t('nav_bar.env_created'));
        console.log(t('nav_bar.create_env_log'), res?.data?.environment);
      } else {
        console.error(t('nav_bar.create_env_error_log'), res?.message);
        toast.error(t('nav_bar.create_env_error') + (res?.message ? `: ${res?.message}` : ''));
        return;
      }
    }
    setIsNewDialogOpen(false)
    setEditingEnvironment(null)
    setEnvInfoFormData({ name: '' })
  }

  // 点击首页
  const onHomeClick = eventLogFunc(t('nav_bar.back_home'), () => {
    selectEnvironment(null)
  })

  // 打开设置对话框
  const onOpenSettingsDialog = eventLogFunc(t('nav_bar.open_settings'), () => {
    setIsSettingsDialogOpen(true)
  })

  // 打开终端
  const onOpenTerminal = eventLogFunc(t('nav_bar.open_terminal'), async () => {
    try {
      await openTerminalFunc()
      logInfo(t('nav_bar.terminal_opened'))
    } catch (error) {
      logError(`${t('nav_bar.open_terminal_error')}: ${error}`)
      toast.error(t('nav_bar.open_terminal_error'))
    }
  })

  // 打开日志面板
  const onOpenLogPanel = eventLogFunc(t('nav_bar.open_log_panel'), () => {
    setIsLogOpen(true)
  })

  // 切换主题
  const onToggleTheme = eventLogFunc(t('nav_bar.toggle_theme'), () => {
    if (currentTheme === 'light') {
      updateAppSettings({ theme: 'dark' })
    } else if (currentTheme === 'dark') {
      updateAppSettings({ theme: 'system' })
    } else {
      updateAppSettings({ theme: 'light' })
    }
  })

  // 获取主题图标
  const getThemeIcon = () => {
    if (currentTheme === 'light') {
      return <Sun className="h-4 w-4" />
    } else if (currentTheme === 'dark') {
      return <Moon className="h-4 w-4" />
    } else {
      return <Monitor className="h-4 w-4" />
    }
  }

  // 获取主题描述
  const getThemeTooltip = () => {
    if (currentTheme === 'light') {
      return t('nav_bar.theme_dark')
    } else if (currentTheme === 'dark') {
      return t('nav_bar.theme_system')
    } else {
      return t('nav_bar.theme_light')
    }
  }

  // 底部动作按钮定义（顺序即默认显示顺序，必要时最后一个将被“更多”替代）
  const actions = [
    {
      key: 'settings',
      title: t('nav_bar.settings'),
      icon: <Settings className="h-4 w-4" />,
      onClick: onOpenSettingsDialog,
    },
    {
      key: 'theme',
      title: getThemeTooltip(),
      icon: getThemeIcon(),
      onClick: onToggleTheme,
    },
    // {
    //   key: 'user',
    //   title: t('nav_bar.user'),
    //   icon: <User className="h-4 w-4" />,
    //   onClick: onOpenSettingsDialog,
    // },
    {
      key: 'terminal',
      title: t('nav_bar.open_terminal'),
      icon: <SquareTerminal className="h-4 w-4" />,
      onClick: onOpenTerminal,
    },
    {
      key: 'log',
      title: t('nav_bar.diagnosis'),
      icon: <FlaskConical className="h-4 w-4" />,
      onClick: onOpenLogPanel,
    },
  ] as const

  // 计算可显示按钮数量，溢出时用“更多”替代最后一个并放入菜单
  const actionsContainerRef = useRef<HTMLDivElement | null>(null)
  const [visibleCount, setVisibleCount] = useState<number>(actions.length)

  useEffect(() => {
    const el = actionsContainerRef.current
    if (!el) return

    const calc = () => {
      const containerWidth = el.clientWidth
      // 估算单个按钮宽度（优先读取真实按钮宽度，回退到28px）
      const anyBtn = el.querySelector('[data-action-btn="true"]') as HTMLElement | null
      const btnW = anyBtn?.offsetWidth || 28
      const reserveForMore = btnW + 6 // 为“更多”按钮预留的空间（按钮宽度 + 少量间隙）

      // 计算在不给“更多”预留空间的情况下最多能放下多少个按钮
      const fitWithoutReserve = Math.floor(containerWidth / btnW)

      let fit = fitWithoutReserve
      if (fit < actions.length) {
        // 有溢出，需要为“更多”按钮预留空间后重新计算
        const available = Math.max(containerWidth - reserveForMore, 0)
        fit = Math.floor(available / btnW)
      }

      // 可见数量不能超过总数，且不能为负
      fit = Math.max(0, Math.min(fit, actions.length))
      setVisibleCount(fit)
    }

    calc()
    const ro = new ResizeObserver(() => calc())
    ro.observe(el)
    return () => ro.disconnect()
  }, [actions.length, currentTheme])

  const hasOverflow = visibleCount < actions.length
  const visibleActions = actions.slice(0, visibleCount)
  const overflowActions = actions.slice(visibleCount)

  // 过滤和排序环境列表
  const filteredEnvironments = sortEnvironments(
    environments.filter(env => env.name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 拖拽功能只在没有搜索时启用
  const isDragEnabled = searchTerm.trim() === '';

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    // 只在没有搜索过滤时允许排序
    if (active.id !== over?.id && isDragEnabled) {
      const oldIndex = environments.findIndex((item) => item.id === active.id);
      const newIndex = environments.findIndex((item) => item.id === over?.id);

      const newEnvironments = arrayMove(environments, oldIndex, newIndex);

      // 更新排序并持久化保存
      await updateEnvironmentsOrder(newEnvironments);
      logInfo(`环境排序变更: ${String(active.id)} -> 索引 ${newIndex}`)
    }
  };

  return (
    <div className={cn("w-full min-w-0 h-full flex flex-col")}>
      {/* Header */}
      <div className="relative mb-4">
        <div className="p-[15px] pr-[6px] cursor-pointer" onClick={onHomeClick}>
          <div className="flex items-center justify-between">
            <div className="flex items-center relative">
              <img
              src={appIcon}
              alt="App Icon"
              className="h-[22px] w-[22px] mr-1 rounded heroui-transition"
              style={{ filter: currentTheme === 'dark' ? 'invert(1)' : 'none' }}
              />
              <span className="text-base font-semibold text-foreground group-hover:text-primary hover:underline heroui-transition">Envis</span>
              {updateAvailable && (
                <span className="absolute left-12 bottom-3 items-center rounded-full bg-red-500/90 px-1 py-0 text-[10px] font-medium text-white">
                  update
                </span>
              )}
            </div>
            {onClose && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
                className="h-7 w-7 p-0 hover:bg-content3"
                title={t('nav_bar.close_nav')}
              >
                <PanelLeft className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar with Add Button */}
        <div className="flex items-center gap-2 pl-[10px] pr-[4px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('nav_bar.search_env')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-8 ${searchTerm ? 'pr-8' : ''} h-8 text-sm shadow-none`}
            />
            {searchTerm && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSearchTerm('')}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 shadow-none"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenNewDialogBtnClick()}
            className="h-8 w-8 p-0 flex-shrink-0 shadow-none"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

      </div>

      {/* Environment List */}
      <ScrollArea className="flex-1 w-full min-w-0 min-h-0">
        <div className="p-0 pl-[10px] pr-[4px] w-full min-w-0 min-h-full">
          {filteredEnvironments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? (
                <>
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('nav_bar.no_matching_env')}</p>
                  <p className="text-xs mt-1">{t('nav_bar.adjust_search')}</p>
                </>
              ) : (
                <>
                  <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('nav_bar.no_env')}</p>
                  <Button
                    size="sm"
                    onClick={() => onOpenNewDialogBtnClick()}
                    className="mt-2 text-xs"
                  >
                    {t('nav_bar.create_first_env')}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={filteredEnvironments.map(env => env.id)} strategy={verticalListSortingStrategy}>
                {filteredEnvironments.map((environment) => (
                  <SortableEnvironmentItem
                    key={environment.id}
                    environment={environment}
                    isSelected={selectedEnvironmentId === environment.id}
                    isDragEnabled={isDragEnabled}
                    onSelect={onEnvItemClick}
                    onToggle={onActiveEnvBtnClick}
                    onEdit={onOpenNewDialogBtnClick}
                    onDelete={onDeleteEnvBtnClick}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="h-[38px] border-t border-divider pl-2 pt-1">
        <div
          ref={actionsContainerRef}
          className={cn(
            "relative flex flex-nowrap items-center w-full overflow-hidden",
            hasOverflow ? "pr-8" : "pr-0"
          )}
        >
          {visibleActions.map(action => (
            <Button
              key={action.key}
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); action.onClick(); }}
              className="h-7 w-7 p-0 hover:bg-content3 flex-shrink-0 text-gray-700 dark:text-gray-300"
              title={action.title}
              data-action-btn="true"
            >
              {action.icon}
            </Button>
          ))}
          {hasOverflow && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-content2"
                  title={t('nav_bar.more')}
                >
                  <MoreHorizontal className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="min-w-[140px]">
                {overflowActions.map(a => (
                  <DropdownMenuItem
                    key={a.key}
                    onClick={(e) => {
                      e.stopPropagation()
                      a.onClick()
                    }}
                    className="cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {a.icon}
                      <span className="text-sm">{a.title}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Environment Dialog */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEnvironment ? t('nav_bar.edit_env') : t('nav_bar.create_env')}
            </DialogTitle>
            <DialogDescription>
              {editingEnvironment ? t('nav_bar.edit_env_desc') : t('nav_bar.create_env_desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t('nav_bar.env_name')}</Label>
              <Input
                id="name"
                value={envInfoFormData.name}
                onChange={(e) => setEnvInfoFormData(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    onDialogSaveEnvBtnClick();
                  }
                }}
                placeholder={t('nav_bar.env_name_placeholder')}
                className="mt-1 shadow-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className='shadow-none' onClick={() => setIsNewDialogOpen(false)}>
              {t('nav_bar.cancel')}
            </Button>
            <Button onClick={onDialogSaveEnvBtnClick}>
              {editingEnvironment ? t('nav_bar.save') : t('nav_bar.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <SettingsDialog
        isSettingDialogOpen={isSettingsDialogOpen}
        setIsSettingDialogOpen={setIsSettingsDialogOpen}
      />
    </div>
  )
}
