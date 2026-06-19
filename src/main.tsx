import React from 'react'
import ReactDOM from 'react-dom/client'
import './global.css'
import './pc/i18n/config'
import PcApp from './pc/App'
import MobileApp from './mobile/App.tsx'

const isMobilePlatform = () => {
  if (typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent || ''
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
}

const App = isMobilePlatform() ? MobileApp : PcApp
// const App = MobileApp

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
