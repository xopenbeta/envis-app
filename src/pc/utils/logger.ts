import { IPCResult } from "@/types/ipc"
import { logEntriesAtom, LogEntry, LogLevel, enableConsoleLogAtom } from "../store/log"
import { getDefaultStore } from 'jotai'
import { safeStringify } from '@/lib/utils'

// 获取 jotai 的默认 store
const store = getDefaultStore()

/**
 * 添加日志条目的辅助函数
 */
function addLogEntry(level: LogLevel, message: string, meta?: Record<string, any>) {
  const entries = store.get(logEntriesAtom)
  const enableConsole = store.get(enableConsoleLogAtom)
  
  const newEntry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: Date.now(),
    level,
    message,
    meta,
  }
  
  // 如果启用了console输出，则同时在console中打印
  if (enableConsole) {
    const timestamp = new Date(newEntry.time).toLocaleTimeString()
    const logMessage = `[${timestamp}] ${message}`
    
    switch (level) {
      case 'error':
        console.error(logMessage, meta || '')
        break
      case 'warn':
        console.warn(logMessage, meta || '')
        break
      case 'info':
        console.info(logMessage, meta || '')
        break
      case 'debug':
        console.debug(logMessage, meta || '')
        break
      default:
        console.log(logMessage, meta || '')
    }
  }
  
  const MAX_LOG_ENTRIES = 10000
  const next = [...entries, newEntry]
  const trimmed = next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next
  store.set(logEntriesAtom, trimmed)
}

/**
 * 设置是否在console中输出日志
 */
export function setConsoleLogEnabled(enabled: boolean) {
  store.set(enableConsoleLogAtom, enabled)
}

/**
 * 获取当前console日志输出状态
 */
export function getConsoleLogEnabled(): boolean {
  return store.get(enableConsoleLogAtom)
}

async function createLogFunc<T>(
  functionName: string,
  ipcCall: () => Promise<IPCResult<T>>,
  params?: Record<string, any>,
  closeLog?: boolean
): Promise<IPCResult<T>> {
  // 构造参数字符串（用于日志显示）
  const paramsStr = params 
    ? ` | 参数: ${safeStringify(params)}`
    : ''

  // 记录开始
  !closeLog && addLogEntry('debug', `[IPC] ${functionName}${paramsStr}`)

  try {
    const startTime = Date.now()
    const result = await ipcCall()
    const duration = Date.now() - startTime

    if (result.success) {
      // 成功
      !closeLog && addLogEntry(
        'info',
        `[IPC] ✓ ${functionName} 成功 (${duration}ms)`,
        { result: result.data, params }
      )
    } else {
      // IPC 调用返回了错误
      !closeLog && addLogEntry(
        'error',
        `[IPC] ✗ ${functionName} 失败: ${result.message || '未知错误'} (${duration}ms)`,
        { message: result.message, params }
      )
    }

    return result
  } catch (error) {
    // 异常捕获
    const errorMsg = error instanceof Error ? error.message : String(error)
    !closeLog && addLogEntry(
      'error',
      `[IPC] ✗ ${functionName} 异常: ${errorMsg}`,
      { error, params }
    )
    throw error
  }
}

/**
 * 只需提供函数名和参数，自动从参数中提取日志信息
 */
export function ipcLogFunc<TParams extends any[], TResult>(
  functionName: string,
  ipcCall: (...args: TParams) => Promise<IPCResult<TResult>>,
  closeLog?: boolean
) {
  return async (...args: TParams): Promise<IPCResult<TResult>> => {
    // 将参数转换为对象（用于日志）
    const params = args.length > 0 ? { args } : undefined
    return createLogFunc(functionName, () => ipcCall(...args), params, closeLog)
  }
}

/**
 * 用于事件处理函数的日志装饰器，如按钮点击等
 */
export function eventLogFunc<TParams extends any[], TResult>(
  eventName: string,
  eventHandler: (...args: TParams) => TResult | Promise<TResult>
) {
  return async (...args: TParams): Promise<TResult> => {
    // 将参数转换为对象（用于日志）
    const params = args.length > 0 ? { args } : undefined
    
    // 构造参数字符串（用于日志显示）
    const paramsStr = ''

    // 记录事件开始
    addLogEntry('debug', `[Event] ${eventName}${paramsStr}`)

    try {
      const startTime = Date.now()
      const result = await eventHandler(...args)
      const duration = Date.now() - startTime

      // 事件执行成功
      addLogEntry(
        'info',
        `[Event] ✓ ${eventName} 完成 (${duration}ms)`,
        { result, params }
      )

      return result
    } catch (error) {
      // 事件执行异常
      const errorMsg = error instanceof Error ? error.message : String(error)
      addLogEntry(
        'error',
        `[Event] ✗ ${eventName} 异常: ${errorMsg}`,
        { error, params }
      )
      throw error
    }
  }
}
