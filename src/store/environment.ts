'use client'
import { Environment, ServiceData } from '@/types/index'
import { atom } from 'jotai'

export const environmentsAtom = atom<Environment[]>([]) // 所有环境
export const selectedEnvironmentIdAtom = atom<string>('') // 当前正在focus的环境
export const selectedServiceDatasAtom = atom<ServiceData[]>([]) // 当前选中环境的服务列表
export const selectedServiceDataIdAtom = atom<string>('') // 当前正在focus的service
export const isCreateEnvDialogOpenAtom = atom<boolean>(false)
// 环境激活/停用事件通知，值为时间戳，变化时通知所有监听者刷新状态
export const envActivationEventAtom = atom<number>(0)
