import { Button } from "@/components/ui/button"
import { Bot } from 'lucide-react'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { isAIPanelOpenAtom } from "@/store"
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'

export function EnvPanelHeader() {
  const { t } = useTranslation()
  const [, setIsAIPanelOpen] = useAtom(isAIPanelOpenAtom)
  const { selectedServiceData } = useEnvironmentServiceData()

  if (!selectedServiceData) {
    return null
  }

  return (
    <div className="p-1 border-b border-divider flex items-center justify-between">
      <div className="flex items-center ml-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {selectedServiceData.name}{' '}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {selectedServiceData.version}
            </span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('base_service.serv_id')}{selectedServiceData.id}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsAIPanelOpen(true)}
          className="h-7 w-7 p-0 mr-1 hover:bg-content2"
          title={t('dashboard.ai_assistant')}
        >
          <Bot className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
