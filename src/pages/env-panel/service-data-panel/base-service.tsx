import { Button } from "@/components/ui/button"
import { ServiceData } from "@/types/index"
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import {
    Bot,
    Save
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { isAIPanelOpenAtom } from "@/store";
// import { useServiceData } from "../../../hooks/env-serv-data"

interface BaseServiceProps {
    service: ServiceData
    children?: React.ReactNode
}

export function BaseService({ service, children }: BaseServiceProps) {
    const { t } = useTranslation()
    const [, setIsAIPanelOpen] = useAtom(isAIPanelOpenAtom)

    const [isEditing, setIsEditing] = useState(false)

    // Reserved for future editable form state

    // 保存配置
    const handleSave = () => {

        setIsEditing(false)
        toast.success(t('base_service.config_saved'))
    }

    // 取消编辑
    const handleCancel = () => {
        setIsEditing(false)
    }

    return (
        <div className="flex flex-col h-screen">
            {/* Header */}
            <div className="p-1 border-b border-divider flex items-center justify-between">
                <div className="flex items-center ml-2">
                    <div className="flex flex-col">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{service.name} <span className="text-xs text-gray-500 dark:text-gray-400">{service.version}</span></h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('base_service.serv_id')}{service.id}</p>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsAIPanelOpen(true)}
                        className={"h-7 w-7 p-0 mr-1 hover:bg-content2"}
                        title={t('dashboard.ai_assistant')}
                    >
                        <Bot className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-auto p-4 space-y-6">
                {children}
            </div>
        </div>
    )
}
