import { useSetAtom } from 'jotai'
import { appendLogAtom, isLogPanelOpenAtom, LogLevel } from '@/store/log'

export function useLogger() {
  const append = useSetAtom(appendLogAtom)
  const setOpen = useSetAtom(isLogPanelOpenAtom)

  const addLog = (level: LogLevel, message: string, meta?: Record<string, any>) => {
    append({ level, message, meta })
    console.log(`[${level}]`, message, meta)
  }

  const logInfo = (message: string, meta?: Record<string, any>) => addLog('info', message, meta)
  const logWarn = (message: string, meta?: Record<string, any>) => addLog('warn', message, meta)
  const logError = (message: string, meta?: Record<string, any>) => addLog('error', message, meta)
  const logDebug = (message: string, meta?: Record<string, any>) => addLog('debug', message, meta)

  const openLogPanel = () => setOpen(true)

  return { addLog, logInfo, logWarn, logError, logDebug, openLogPanel }
}
