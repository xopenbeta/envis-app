import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 安全的 JSON 序列化函数，处理循环引用
 */
export function safeStringify(value: any, space?: number): string {
  const cache = new WeakSet()
  try {
    return JSON.stringify(
      value,
      (_k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (cache.has(v)) return '[Circular]'
          cache.add(v)
        }
        return v
      },
      space ?? 0
    )
  } catch (error) {
    return '[Stringify Error: ' + (error instanceof Error ? error.message : String(error)) + ']'
  }
}
