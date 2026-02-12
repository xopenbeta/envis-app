'use client'
import { ServiceData } from '@/types/index'
import { atom } from 'jotai'

export const shouldDownloadServiceAtom = atom<ServiceData | null>(null) // 专门用于触发下载的service
