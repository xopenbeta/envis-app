import { useMemo, useState } from 'react'
import { detectMobilePlatform } from './platform/adapter'
import HomePage from './pages/home'
import ContentPage from './pages/content'
import { useMobileHome } from './hooks/useMobileHome'
import type { MobileEnvironmentItem, MobileHostItem } from './types/home'

type ActivePage = 'home' | 'content'

function App(): JSX.Element {
  const platform = detectMobilePlatform()
  const {
    auth,
    hosts,
    environmentCache,
    login,
    logout,
    addHost,
    updateHostEnvironments,
    removeEnvironmentCache,
  } = useMobileHome()

  const [activePage, setActivePage] = useState<ActivePage>('home')
  const [activeHost, setActiveHost] = useState<MobileHostItem | null>(null)
  const [activeEnvironment, setActiveEnvironment] = useState<MobileEnvironmentItem | null>(null)

  const canOpenContent = useMemo(() => {
    return activePage === 'content' && !!activeHost && !!auth.token
  }, [activePage, activeHost, auth.token])

  const openHost = (host: MobileHostItem) => {
    setActiveHost(host)
    setActiveEnvironment(null)
    setActivePage('content')
  }

  const openEnvironment = (host: MobileHostItem, environment: MobileEnvironmentItem) => {
    setActiveHost(host)
    setActiveEnvironment(environment)
    setActivePage('content')
  }

  const goHome = () => {
    setActivePage('home')
    setActiveEnvironment(null)
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-100 text-slate-900 dark:bg-[#020202] dark:text-slate-100">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col border-x border-slate-200 bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(15,23,42,0.28)] dark:border-white/5 dark:bg-[#030303]">
        <div className="border-b border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500 dark:border-white/5 dark:bg-[#0a0a0a] dark:text-slate-400">
          Mobile platform: {platform.platform} | Touch: {platform.isTouchDevice ? 'yes' : 'no'}
        </div>

        <div className="flex-1 min-h-0 bg-slate-100 p-2 sm:p-3 dark:bg-[#020202]">
          <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-[#030303]">
            {canOpenContent && activeHost ? (
              <ContentPage
                host={activeHost}
                token={auth.token}
                targetEnvironment={activeEnvironment}
                onBack={goHome}
                onSyncEnvironments={updateHostEnvironments}
                onEnvironmentMissing={removeEnvironmentCache}
              />
            ) : (
              <HomePage
                auth={auth}
                hosts={hosts}
                environmentCache={environmentCache}
                onLogin={login}
                onLogout={logout}
                onAddHost={addHost}
                onOpenHost={openHost}
                onOpenEnvironment={openEnvironment}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
