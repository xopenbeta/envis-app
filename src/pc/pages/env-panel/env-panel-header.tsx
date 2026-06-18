import { Button } from "@/components/ui/button"
import { Bot } from 'lucide-react'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { isAIPanelOpenAtom } from "@/store"
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function EnvPanelHeader() {
  const { t } = useTranslation()
  const [, setIsAIPanelOpen] = useAtom(isAIPanelOpenAtom)
  const { selectedServiceData } = useEnvironmentServiceData()

  if (!selectedServiceData) {
    return null
  }

  return (
    <div className="p-2 border-b border-divider flex items-center justify-between">
      <div className="flex items-center ml-2">
        <div className="flex flex-col">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white cursor-default hover:underline underline-offset-4">
                  {selectedServiceData.name}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    &nbsp;&nbsp;{selectedServiceData.version}
                  </span>
                </h2>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{t('base_service.serv_id')}{selectedServiceData.id}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
