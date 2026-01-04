'use client'
import { AppSettings, SystemSettings } from '@/types/index'
import { atom } from 'jotai'

export const defaultAppSettings: AppSettings = {
  theme: 'system',
  language: 'zh-CN',
  ai: {
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    enabled: false
  }
}

export const appSettingsAtom = atom<AppSettings | undefined>(undefined)
export const systemSettingsAtom = atom<SystemSettings | undefined>(undefined)
export const isAppLoadingAtom = atom(true)
export const updateAvailableAtom = atom(false)
export const isUpdateDialogOpenAtom = atom(false)

