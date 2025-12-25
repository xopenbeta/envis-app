'use client'
import { Environment } from '@/types/index'
import { atom } from 'jotai'

export const environmentsAtom = atom<Environment[]>([]) // 所有环境
export const selectedEnvironmentIdAtom = atom<string>('') // 当前正在focus的环境
