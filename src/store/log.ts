'use client'
import { atom } from 'jotai'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  id: string
  time: number // epoch ms
  level: LogLevel
  message: string
  meta?: Record<string, any>
}

export const isLogPanelOpenAtom = atom(false)
export const autoScrollLogAtom = atom(true)
export const enableConsoleLogAtom = atom(true) // 控制是否在console中输出日志

// 限制日志条目数量，防止内存占用过高
const MAX_LOG_ENTRIES = 10000

export const logEntriesAtom = atom<LogEntry[]>([])

// 追加日志的派生写入 atom（便于在任何地方以事务方式添加）
export const appendLogAtom = atom(null, (get, set, entry: Omit<LogEntry, 'id' | 'time'> & { time?: number }) => {
  const list = get(logEntriesAtom)
  const newEntry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: entry.time ?? Date.now(),
    level: entry.level,
    message: entry.message,
    meta: entry.meta,
  }
  const next = [...list, newEntry]
  // 截断
  const trimmed = next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next
  set(logEntriesAtom, trimmed)
})
