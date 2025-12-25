import { AppSettings } from "@/types/index"

// 用于存储当前的系统主题监听器
let systemThemeListener: ((event: MediaQueryListEvent) => void) | null = null

export const setAppTheme = (theme: AppSettings['theme']) => {
    // 应用主题到 document
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    
    // 清除之前的监听器
    if (systemThemeListener) {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemThemeListener)
        systemThemeListener = null
    }
    
    if (theme === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const systemTheme = mediaQuery.matches ? 'dark' : 'light'
        root.classList.add(systemTheme)
        
        // 添加系统主题变化监听器
        systemThemeListener = (event: MediaQueryListEvent) => {
            root.classList.remove('light', 'dark')
            root.classList.add(event.matches ? 'dark' : 'light')
            console.log('系统主题已自动切换到:', event.matches ? 'dark' : 'light')
        }
        
        mediaQuery.addEventListener('change', systemThemeListener)
    } else {
        root.classList.add(theme)
    }
}
