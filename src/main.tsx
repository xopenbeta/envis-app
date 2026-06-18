import React from 'react'
import ReactDOM from 'react-dom/client'
import './global.css'
import './pc/i18n/config'
import App from './pc/App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
