import { useEffect, useMemo, useState } from 'react'
import { setAppTheme } from '../theme'
import { detectMobilePlatform } from './platform/adapter'
import HomePage from './pages/home'
import ContentPage from './pages/content'
import { useMobileHome } from './hooks/useMobileHome'
import type { MobileEnvironmentItem, MobileHostItem } from './types/home'

type ActivePage = 'home' | 'content'

function App(): JSX.Element {
  const platform = detectMobilePlatform()

  // 跟随系统主题（激活全局 dark: 变体）
  useEffect(() => {
    setAppTheme('system')
  }, [])
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
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground dark:bg-background dark:text-foreground">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col border-x border-divider bg-content1  dark:border-divider dark:bg-background">
        <div className="border-b border-divider bg-content1 px-4 py-2 text-[11px] text-muted-foreground dark:border-divider dark:bg-content2 dark:text-muted-foreground">
          Mobile platform: {platform.platform} | Touch: {platform.isTouchDevice ? 'yes' : 'no'}
        </div>

        <div className="flex-1 min-h-0 bg-background p-2 sm:p-3 dark:bg-background">
          <div className="h-full overflow-hidden rounded-2xl border border-divider bg-content1  dark:border-divider dark:bg-background">
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
