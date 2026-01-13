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
            {/* Content */}
            <div className="flex-1 min-h-0 overflow-auto p-4 space-y-6">
                {children}
            </div>
        </div>
    )
}
