// AI相关类型定义
export type AIProvider = 'openai' | 'deepseek'

export type AISettings = {
  provider: AIProvider
  apiKey: string
  baseUrl: string
  model: string
  enabled: boolean
}
