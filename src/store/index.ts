import { atom } from "jotai"

export const isNavPanelOpenAtom = atom(true)
export const navPanelWidthRatioAtom = atom(30) // 默认 20%
export const isEnvPanelOpenAtom = atom(true)
export const envPanelWidthRatioAtom = atom(70) // 默认 60%
export const isAIPanelOpenAtom = atom(false)
export const aiPanelWidthRatioAtom = atom(20) // 默认 20%
