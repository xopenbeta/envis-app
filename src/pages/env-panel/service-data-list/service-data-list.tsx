import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
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
import { useAtom } from 'jotai'
import {
  PanelLeft,
  Search,
  Server,
  X
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useEnvironmentServiceData, useServiceData } from '@/hooks/env-serv-data'
import {
  environmentsAtom,
  selectedEnvironmentIdAtom,
} from '../../../store/environment'
import { selectedServiceDataIdAtom } from '../../../store/service'
import { sortServices } from '@/utils/sort'
import { AddServiceMenu } from './add-service-data-menu'
import { useClickOutsideBlur } from '../../../hooks/useClickOutsideBlur'
import { SortableServiceItem } from './service-data-item'
import { serviceTypeNames } from '@/types'

export function ServiceList({ onOpen }: {
  onOpen?: () => void;
}) {
  const { t } = useTranslation()
  const [environments] = useAtom(environmentsAtom)
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom)
  const selectedEnvironment = environments.find(env => env.id === selectedEnvironmentId)
  const { selectedServiceDatas, updateServicesOrder } = useEnvironmentServiceData()
  const [selectedServiceDataId, setSelectedServiceDataId] = useAtom(selectedServiceDataIdAtom)

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // 处理点击外部关闭搜索框
  useClickOutsideBlur({
    isSearchExpanded,
    setIsSearchExpanded,
    setSearchQuery,
    searchRef
  })

  const onTitleClick = () => {
    setSelectedServiceDataId('') // 清空选中的服务
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 拖拽功能只在没有搜索时启用
  const isDragEnabled = searchQuery.trim() === '';

  // 过滤和排序服务列表
  const filteredServices = sortServices(
    (selectedServiceDatas || []).filter(serviceData => {
      if (!searchQuery.trim()) return true

      const query = searchQuery.toLowerCase()
      return (
        serviceData.name.toLowerCase().includes(query) ||
        serviceTypeNames[serviceData.type].toLowerCase().includes(query) ||
        serviceData.version.toLowerCase().includes(query)
      )
    }) ?? []
  )

  // 拖拽结束处理
  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!selectedEnvironment) return;
    // 只在没有搜索过滤时允许排序
    if (active.id !== over?.id && isDragEnabled) {
      const oldIndex = (selectedServiceDatas || []).findIndex((item) => item.id === active.id);
      const newIndex = (selectedServiceDatas || []).findIndex((item) => item.id === over?.id);

      const newServiceDatas = arrayMove(selectedServiceDatas || [], oldIndex, newIndex);
      for (let i = 0; i < newServiceDatas.length; i++) {
        newServiceDatas[i] = { ...newServiceDatas[i], sort: i }; // 更新排序字段
      }
      // 更新服务排序并持久化保存
      await updateServicesOrder(newServiceDatas);
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="relative p-2 border-b border-divider flex items-center justify-between w-full" ref={searchRef}>

        {/* Header Title */}
        <div className="flex items-center">
          {onOpen && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onOpen()
              }}
              className="h-7 w-7 p-0 hover:bg-content2"
              title={t('service_list.close_nav')}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 onClick={onTitleClick} className="text-base font-semibold ml-2 text-foreground">{t('service_list.servs')}</h2>
        </div>

        {/* 搜索框 - 绝对定位覆盖在右侧 */}
        <div className={cn(
          "absolute right-[4px] w-[calc(100%-8px)] top-1/2 -translate-y-1/2 z-10",
          "transition-all duration-300 ease-in-out",
          "flex items-center",
          isSearchExpanded
            ? "opacity-100 scale-100 translate-x-0"
            : "opacity-0 scale-95 translate-x-4 pointer-events-none"
        )}>
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('service_list.search_services')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-8 w-full text-sm shadow-none rounded-lg"
            autoFocus={isSearchExpanded}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearchQuery('')
              setIsSearchExpanded(false)
            }}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Header Button */}
        <div className="relative flex items-center">
          {/* 搜索按钮 */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsSearchExpanded(true)}
            className={cn(
              "h-7 w-7 p-0 hover:bg-content2 transition-opacity duration-300",
              isSearchExpanded && "opacity-0 pointer-events-none"
            )}
            title={t('service_list.search_services_title')}
          >
            <Search className="h-4 w-4" />
          </Button>
          {/* 新增服务菜单 */}
          <AddServiceMenu />
        </div>

      </div>

      {/* ServiceData List */}
      <ScrollArea className="flex-1">
        <div className="p-[10px]">
          {filteredServices.length === 0 ? (
            <div className="text-center pt-[77px] text-muted-foreground">
              <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('service_list.no_services')}</p>
              <AddServiceMenu buttonType='button' />
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={filteredServices.map(serviceData => serviceData.id)} strategy={verticalListSortingStrategy}>
                {!!selectedEnvironmentId && filteredServices.map((serviceData) => {
                  return (
                    <SortableServiceItem
                      key={serviceData.id}
                      selectedEnvironmentId={selectedEnvironmentId}
                      serviceData={serviceData}
                      isSelected={selectedServiceDataId === serviceData.id}
                      isDragEnabled={isDragEnabled}
                    />
                  )
                })}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
