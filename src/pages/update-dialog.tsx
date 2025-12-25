import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { check, Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { useAtom } from 'jotai'
import { updateAvailableAtom } from '@/store/appSettings'

export function UpdateDialog() {
  const [update, setUpdate] = useState<Update | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [, setUpdateAvailable] = useAtom(updateAvailableAtom)

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const updateResult = await check()
        if (updateResult?.available) {
          setUpdate(updateResult)
          setIsDialogOpen(true)
          setUpdateAvailable(true)
        }
      } catch (error) {
        console.error('Failed to check for updates:', error)
      }
    }

    checkForUpdates()
  }, [])

  const handleRestart = async () => {
    if (!update) return
    
    setIsUpdating(true)
    try {
      await update.downloadAndInstall()
      await relaunch()
    } catch (error) {
      console.error('Failed to install update:', error)
      setIsUpdating(false)
    }
  }

  const handleRemindLater = () => {
    setIsDialogOpen(false)
    setUpdate(null)
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>发现新版本</DialogTitle>
        </DialogHeader>
        <div>
          <p>新版本 {update?.version} 已发布，是否立即更新？</p>
          {update?.body && (
            <div className="mt-2 text-sm text-muted-foreground max-h-40 overflow-y-auto whitespace-pre-wrap">
              {update.body}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="default" onClick={handleRestart} disabled={isUpdating}>
            {isUpdating ? '更新中...' : '立即更新'}
          </Button>
          <Button variant="outline" onClick={handleRemindLater} disabled={isUpdating}>
            稍后
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
