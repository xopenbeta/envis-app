import React from 'react'
import ReactDOM from 'react-dom/client'
import './global.css'
import './pc/i18n/config'
import PcApp from './pc/App'
import MobileApp from './mobile/App.tsx'

function suppressConsoleInProduction() {
  if (!import.meta.env.PROD || typeof console === 'undefined') {
    return
  }

  const noop = () => {}
  const methods: Array<keyof Console> = [
    'log',
    'info',
    'debug',
    'warn',
    'error',
    'trace',
  ]

  for (const method of methods) {
    try {
      ;(console[method] as (...args: unknown[]) => void) = noop
    } catch {
      // Ignore non-writable console methods in some runtimes.
    }
  }
}

const isMobilePlatform = () => {
  if (typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent || ''
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
}

const isTauriRuntime = () => {
  if (typeof window === 'undefined') return false
  const runtimeWindow = window as typeof window & {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }
  return '__TAURI__' in runtimeWindow || '__TAURI_INTERNALS__' in runtimeWindow
}

const isMobile = isMobilePlatform()
if (!isMobile) {
  suppressConsoleInProduction()
}

const App = !isMobile && isTauriRuntime() ? PcApp : MobileApp

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
