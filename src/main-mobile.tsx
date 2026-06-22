import React from 'react'
import ReactDOM from 'react-dom/client'
import './global.css'
import MobileApp from './mobile/App'

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

suppressConsoleInProduction()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>
)