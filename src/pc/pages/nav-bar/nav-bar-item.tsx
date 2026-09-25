import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  useSortable
} from '@dnd-kit/sortable'
import {
  CSS,
} from '@dnd-kit/utilities'
import { Environment, EnvironmentStatus } from '@/types/index'
import {
  Download,
  Folder,
  GripVertical,
  MoreHorizontal,
  Play,
  Settings,
  Square,
  Trash,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFileOperations } from '@/hooks/file-operations'
import { useSettings } from '@/hooks/appSettings'
import { toast } from 'sonner'
import { useEnvironmentStatus } from '@/hooks/useStatus'

interface SortableEnvironmentItemProps {
  environment: Environment;
  isSelected: boolean;
  isDragEnabled: boolean;
  onSelect: (environment: Environment) => void;
  onToggle: (environment: Environment) => void;
  onEdit: (environment: Environment) => void;
  onDelete: (environment: Environment) => void;
  onExport: (environment: Environment) => void;
}

export function SortableEnvironmentItem({
  environment,
  isSelected,
  isDragEnabled,
  onSelect,
  onToggle,
  onEdit,
  onDelete,
  onExport
}: SortableEnvironmentItemProps) {
  const { t } = useTranslation()
  const { openFolderInFinder } = useFileOperations()
  const { systemSettings } = useSettings()
  const { status: currentStatus } = useEnvironmentStatus(environment.id)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: environment.id,
    disabled: !isDragEnabled
  });

  // 打开环境文件夹
  const handleOpenFolder = () => {
    if (!systemSettings?.envisFolder) {
      toast.error(t('nav_bar_item.no_env_folder'))
      return
    }
    const envFolderPath = `${systemSettings.envisFolder}/envs/${environment.id}`
    openFolderInFinder(envFolderPath)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-2 min-w-0">
      <div
        // 主环境列表行：必须键盘可达。原来只有 onClick，键盘与读屏用户完全无法切换环境。
        role="button"
        tabIndex={0}
        aria-current={isSelected ? 'true' : undefined}
        aria-label={environment.name}
        className={cn(
          // 使 item 不被内部文字撑宽，并让文字能正确省略
          "group relative flex items-center p-2 rounded-lg cursor-pointer transition-colors duration-150 overflow-hidden w-full min-w-0 hover:bg-content4",
          // 密集列表行用内描边焦点环，避免与外层行重叠
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset",
          isSelected && "bg-content4",
          isDragging && "z-50"
        )}
        onClick={() => onSelect(environment)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(environment)
          }
        }}
      >
        <div className="flex items-center w-full min-w-0">
          {/* 拖动图标 */}
          {isDragEnabled && (
            <div
              {...attributes}
              {...listeners}
              className="mr-2 cursor-grab active:cursor-grabbing hover:text-foreground transition-colors duration-150 flex-shrink-0"
              title={t('nav_bar_item.drag_to_sort')}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          <div className="flex flex-col min-w-0">
            {/* 列表行层级：标题 14px/medium，副标题 12px/次要色——字号、字重、颜色三重区分层级 */}
            <span className="text-md font-medium text-foreground min-w-0 truncate" title={environment.name}>
              {environment.name}
            </span>
            <span className={cn("text-xs truncate flex items-center gap-1.5 mt-0.5", currentStatus === 'active' ? " text-success" : " text-muted-foreground")}>
              {currentStatus === EnvironmentStatus.Active
                ? t('nav_bar_item.active')
                : currentStatus === EnvironmentStatus.Inactive
                  ? t('nav_bar_item.inactive')
                  : t('service_item.status.unknown')}
            </span>
          </div>
        </div>

        {/* 绝对定位的操作按钮 */}
        <div
          className={cn(
            "absolute right-3 top-1/2 transform -translate-y-1/2",
            "flex items-center transition-opacity duration-150",
            "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            "hover:backdrop-blur-sm rounded"
          )}
        >
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('service_item.toggle_status')}
            title={t('service_item.toggle_status')}
            onClick={(e) => { 
              e.stopPropagation(); 
              onToggle({ ...environment, status: currentStatus }); 
            }}
            className="h-7 w-7 p-0 hover:bg-content3 hover:text-foreground"
          >
            {currentStatus === EnvironmentStatus.Active ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                aria-label={t('nav_bar.more')}
                title={t('nav_bar.more')}
                className="h-7 w-7 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(environment) }}>
                <Settings className="h-4 w-4 mr-2" />
                {t('nav_bar_item.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />              
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExport(environment) }}>
                <Download className="h-4 w-4 mr-2" />
                {t('nav_bar_item.export')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete({ ...environment, status: currentStatus }) }}
                className="text-danger"
              >
                <Trash className="h-4 w-4 mr-2" />
                {t('nav_bar_item.delete')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenFolder() }}>
                <Folder className="mr-2 h-4 w-4" />
                <span>{t('nav_bar_item.open_folder')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
