import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useState, useEffect } from 'react'
import { check, Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { useAtom } from 'jotai'
import { updateAvailableAtom } from '@/store/appSettings'
import { useTranslation } from 'react-i18next'
import { Download, Loader2 } from 'lucide-react'

export function UpdateDialog() {
  const { t } = useTranslation()
  const [update, setUpdate] = useState<Update | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [, setUpdateAvailable] = useAtom(updateAvailableAtom)

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const updateResult = await check()
        console.log('检查更新结果:', updateResult)
        if (updateResult?.available) {
          setUpdate(updateResult)
          setIsDialogOpen(true)
          setUpdateAvailable(true)
          console.log('发现新版本:', updateResult.version)
          console.log('更新内容:', updateResult.body)
        }
      } catch (error) {
        console.error('检查更新失败:', error)
      }
    }

    // 冷启动时检查更新
    checkForUpdates()
  }, [])

  const handleRestart = async () => {
    if (!update) return
    
    setIsUpdating(true)
    try {
      console.log('开始下载并安装更新...')
      await update.downloadAndInstall()
      console.log('更新已安装，重启应用...')
      await relaunch()
    } catch (error) {
      console.error('安装更新失败:', error)
      setIsUpdating(false)
    }
  }

  const handleRemindLater = () => {
    setIsDialogOpen(false)
    // 不清空 update，保持 updateAvailable 状态，用户可以从导航栏看到更新提示
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            {t('update_dialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('update_dialog.description', { version: update?.version || '' })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {update?.body && (
            <div>
              <h4 className="text-sm font-medium mb-2">{t('update_dialog.whats_new')}</h4>
              <ScrollArea className="h-48 rounded-md border border-border p-3">
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {update.body}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleRemindLater} 
            disabled={isUpdating}
            className="shadow-none"
          >
            {t('update_dialog.later')}
          </Button>
          <Button 
            onClick={handleRestart} 
            disabled={isUpdating}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('update_dialog.updating')}
              </>
            ) : (
              t('update_dialog.install')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
