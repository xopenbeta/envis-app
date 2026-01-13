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
import { useAppSettings } from '@/hooks/appSettings'
import { toast } from 'sonner'

interface SortableEnvironmentItemProps {
  environment: Environment;
  isSelected: boolean;
  isDragEnabled: boolean;
  onSelect: (environment: Environment) => void;
  onToggle: (environment: Environment, e: React.MouseEvent) => void;
  onEdit: (environment: Environment) => void;
  onDelete: (environment: Environment) => void;
}

export function SortableEnvironmentItem({
  environment,
  isSelected,
  isDragEnabled,
  onSelect,
  onToggle,
  onEdit,
  onDelete
}: SortableEnvironmentItemProps) {
  const { t } = useTranslation()
  const { openFolderInFinder } = useFileOperations()
  const { systemSettings } = useAppSettings()
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
        className={cn(
          // 使 item 不被内部文字撑宽，并让文字能正确省略
          "group relative flex items-center p-2 rounded-lg cursor-pointer heroui-transition overflow-hidden w-full min-w-0",
          isSelected && "bg-content4",
          isDragging && "z-50"
        )}
        onClick={() => onSelect(environment)}
      >
        <div className="flex items-center w-full min-w-0">
          {/* 拖动图标 */}
          {isDragEnabled && (
            <div
              {...attributes}
              {...listeners}
              className="mr-2 cursor-grab active:cursor-grabbing hover:text-foreground heroui-transition flex-shrink-0"
              title={t('nav_bar_item.drag_to_sort')}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <span className="font-medium text-sm text-gray-700 dark:text-gray-300 min-w-0 truncate">
              {environment.name}
            </span>
            <span className={cn("text-xs truncate font-mono flex items-center gap-1.5", environment.status === 'active' ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500")}>
              {environment.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* 绝对定位的操作按钮 */}
        <div
          className={cn(
            "absolute right-3 top-1/2 transform -translate-y-1/2",
            "flex items-center heroui-transition",
            "opacity-0 group-hover:opacity-100",
            "hover:backdrop-blur-sm rounded"
          )}
        >
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => onToggle(environment, e)}
            className="h-7 w-7 p-0"
          >
            {environment.status === EnvironmentStatus.Active ? (
              <Square className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>

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
              <DropdownMenuItem onClick={() => onEdit(environment)}>
                <Settings className="h-4 w-4 mr-2" />
                {t('nav_bar_item.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(environment)}
                className="text-danger"
              >
                <Trash className="h-4 w-4 mr-2" />
                {t('nav_bar_item.delete')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleOpenFolder}>
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
