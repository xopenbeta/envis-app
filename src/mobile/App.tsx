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

  // 移动端是终端客户端：整个应用恒定深色。
  // 此前这里是 setAppTheme('system')，而只有 AndroidTerminalPanel 自己挂了 dark 类，
  // 于是浅色手机上会出现「浅色外壳包着深色终端」的硬接缝。
  // 写到 documentElement（而不是某个 div）也让 Radix 的 portal（toast/弹窗）继承到深色 token。
  useEffect(() => {
    setAppTheme('dark')
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
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col border-x border-divider bg-content1">
        <div className="flex-1 min-h-0 bg-background p-2 sm:p-3">
          <div className="h-full overflow-hidden rounded-2xl border border-divider bg-content1">
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
