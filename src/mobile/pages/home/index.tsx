import { FormEvent, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  LogIn,
  LogOut,
  Plus,
  Server,
  TerminalSquare,
} from 'lucide-react'
import type { MobileAuthSession, MobileEnvironmentItem, MobileHostItem } from '../../types/home'

interface HomePageProps {
  auth: MobileAuthSession
  hosts: MobileHostItem[]
  environmentCache: Record<string, MobileEnvironmentItem[]>
  onLogin: (account: string, password: string) => Promise<void>
  onLogout: () => void
  onAddHost: (payload: { name: string; host: string; port: number; username: string }) => void
  onOpenHost: (host: MobileHostItem) => void
  onOpenEnvironment: (host: MobileHostItem, environment: MobileEnvironmentItem) => void
}

export default function HomePage(props: HomePageProps): JSX.Element {
  const [expandedHostIds, setExpandedHostIds] = useState<string[]>([])
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [pendingAddAfterLogin, setPendingAddAfterLogin] = useState(false)
  const [pendingOpenAction, setPendingOpenAction] = useState<
    | { type: 'host'; host: MobileHostItem }
    | { type: 'environment'; host: MobileHostItem; environment: MobileEnvironmentItem }
    | null
  >(null)
  const [loginError, setLoginError] = useState('')
  const [addError, setAddError] = useState('')

  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')

  const [hostName, setHostName] = useState('')
  const [hostAddress, setHostAddress] = useState('')
  const [hostPort, setHostPort] = useState(22)
  const [hostUsername, setHostUsername] = useState('envis')

  const hostCountText = useMemo(() => {
    return `${props.hosts.length} hosts`
  }, [props.hosts.length])

  const toggleHostExpanded = (hostId: string) => {
    setExpandedHostIds((current) => {
      if (current.includes(hostId)) {
        return current.filter((item) => item !== hostId)
      }
      return [...current, hostId]
    })
  }

  const handleClickAdd = () => {
    if (!props.auth.isLoggedIn) {
      setPendingAddAfterLogin(true)
      setShowLoginDialog(true)
      return
    }
    setShowAddDialog(true)
  }

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginError('')
    try {
      await props.onLogin(account, password)
      setShowLoginDialog(false)
      setPassword('')
      if (pendingAddAfterLogin) {
        setPendingAddAfterLogin(false)
        setShowAddDialog(true)
      }
      if (pendingOpenAction) {
        if (pendingOpenAction.type === 'host') {
          props.onOpenHost(pendingOpenAction.host)
        } else {
          props.onOpenEnvironment(pendingOpenAction.host, pendingOpenAction.environment)
        }
        setPendingOpenAction(null)
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : String(error))
    }
  }

  const openHostWithGuard = (host: MobileHostItem) => {
    if (props.auth.isLoggedIn) {
      props.onOpenHost(host)
      return
    }
    setPendingOpenAction({ type: 'host', host })
    setShowLoginDialog(true)
  }

  const openEnvironmentWithGuard = (host: MobileHostItem, environment: MobileEnvironmentItem) => {
    if (props.auth.isLoggedIn) {
      props.onOpenEnvironment(host, environment)
      return
    }
    setPendingOpenAction({ type: 'environment', host, environment })
    setShowLoginDialog(true)
  }

  const submitAddHost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAddError('')

    const name = hostName.trim()
    const host = hostAddress.trim()
    const username = hostUsername.trim()
    if (!name || !host || !username) {
      setAddError('请填写完整的主机信息')
      return
    }

    props.onAddHost({
      name,
      host,
      port: hostPort || 22,
      username,
    })

    setHostName('')
    setHostAddress('')
    setHostPort(22)
    setHostUsername('envis')
    setShowAddDialog(false)
  }

  return (
    <div className="h-full w-full bg-background text-foreground flex flex-col dark:bg-background dark:text-foreground">
      <div className="px-4 py-3 border-b border-divider bg-content1/95 dark:border-divider dark:bg-content2/95">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-wide">Envis</h1>
            <p className="text-xs text-muted-foreground mt-1 dark:text-muted-foreground">Mobile SSH Console for your Envis hosts</p>
            <p className="text-[11px] text-muted-foreground mt-1 dark:text-muted-foreground">{hostCountText}</p>
          </div>
          <div className="flex items-center gap-2">
            {props.auth.isLoggedIn ? (
              <button
                className="inline-flex items-center gap-1 rounded-md border border-divider bg-content1 px-3 py-1.5 text-xs text-foreground  dark:border-divider dark:bg-content2 dark:text-foreground"
                onClick={props.onLogout}
                type="button"
              >
                <LogOut className="h-3.5 w-3.5" />
                退出
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-1 rounded-md border border-focus/30 bg-primary/10 px-3 py-1.5 text-xs text-focus"
                onClick={() => setShowLoginDialog(true)}
                type="button"
              >
                <LogIn className="h-3.5 w-3.5" />
                登录
              </button>
            )}

            <button
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground "
              onClick={handleClickAdd}
              type="button"
            >
              <Plus className="h-3.5 w-3.5" />
              添加
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-background dark:bg-background">
        {props.hosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-divider bg-content1 p-5 text-center  dark:border-divider dark:bg-content1">
            <p className="text-sm text-foreground dark:text-foreground">还没有主机，先点击右上角添加</p>
            <p className="text-xs text-muted-foreground mt-1 dark:text-muted-foreground">添加后即可在这里展开查看环境缓存</p>
          </div>
        ) : (
          props.hosts.map((host) => {
            const environments = props.environmentCache[host.id] || []
            const expanded = expandedHostIds.includes(host.id)
            return (
              <div key={host.id} className="rounded-2xl border border-divider bg-content1  dark:border-divider dark:bg-content1">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    className="rounded p-1 text-muted-foreground hover:bg-content2"
                    onClick={() => toggleHostExpanded(host.id)}
                    type="button"
                  >
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  <button
                    className="flex-1 text-left"
                    onClick={() => openHostWithGuard(host)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-focus" />
                      <span className="text-sm font-medium text-foreground dark:text-foreground">{host.name}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 dark:text-muted-foreground">
                      {host.username}@{host.host}:{host.port}
                    </div>
                  </button>

                  <button
                    className="rounded-md border border-success/30 bg-success/10 px-2 py-1 text-[11px] text-success"
                    onClick={() => openHostWithGuard(host)}
                    type="button"
                  >
                    连接
                  </button>
                </div>

                {expanded && (
                  <div className="border-t border-divider px-2 py-2 space-y-1.5 dark:border-divider">
                    {environments.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground px-2 py-1 dark:text-muted-foreground">暂无缓存环境，连接后会自动同步</p>
                    ) : (
                      environments.map((env) => (
                        <button
                          key={env.id}
                          className="w-full rounded-xl border border-divider bg-background px-3 py-2 text-left hover:border-focus hover:bg-focus/10 dark:border-divider dark:bg-content2 dark:hover:border-focus/70 dark:hover:bg-content2"
                          onClick={() => openEnvironmentWithGuard(host, env)}
                          type="button"
                        >
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-2 text-sm text-foreground dark:text-foreground">
                              <TerminalSquare className="h-3.5 w-3.5 text-warning" />
                              {env.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground dark:text-muted-foreground">进入环境</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {showLoginDialog && (
        <div className="fixed inset-0 z-30 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-divider bg-content1 p-4 shadow-pop dark:border-divider dark:bg-content1">
            <h3 className="text-sm font-semibold">账号登录</h3>
            <p className="text-xs text-muted-foreground mt-1 dark:text-muted-foreground">添加主机前需要先登录</p>
            <form className="mt-3 space-y-2" onSubmit={submitLogin}>
              <input
                className="w-full rounded-md border border-divider bg-content1 px-3 py-2 text-sm outline-none focus:border-focus dark:border-divider dark:bg-content2"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="账号"
              />
              <input
                className="w-full rounded-md border border-divider bg-content1 px-3 py-2 text-sm outline-none focus:border-focus dark:border-divider dark:bg-content2"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="密码"
              />
              {loginError && <p className="text-xs text-danger">{loginError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="rounded-md border border-divider px-3 py-1.5 text-xs text-foreground dark:border-divider dark:text-foreground"
                  type="button"
                  onClick={() => {
                    setShowLoginDialog(false)
                    setPendingAddAfterLogin(false)
                    setPendingOpenAction(null)
                  }}
                >
                  取消
                </button>
                <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground " type="submit">
                  登录
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddDialog && (
        <div className="fixed inset-0 z-30 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-divider bg-content1 p-4 shadow-pop dark:border-divider dark:bg-content1">
            <h3 className="text-sm font-semibold">添加主机</h3>
            <p className="text-xs text-muted-foreground mt-1 dark:text-muted-foreground">保存后会出现在首页第一层列表</p>
            <form className="mt-3 space-y-2" onSubmit={submitAddHost}>
              <input
                className="w-full rounded-md border border-divider bg-content1 px-3 py-2 text-sm outline-none focus:border-focus dark:border-divider dark:bg-content2"
                value={hostName}
                onChange={(event) => setHostName(event.target.value)}
                placeholder="主机名称，例如 我的办公机"
              />
              <input
                className="w-full rounded-md border border-divider bg-content1 px-3 py-2 text-sm outline-none focus:border-focus dark:border-divider dark:bg-content2"
                value={hostAddress}
                onChange={(event) => setHostAddress(event.target.value)}
                placeholder="主机地址，例如 192.168.1.12"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full rounded-md border border-divider bg-content1 px-3 py-2 text-sm outline-none focus:border-focus dark:border-divider dark:bg-content2"
                  type="number"
                  value={hostPort}
                  onChange={(event) => setHostPort(Number(event.target.value) || 22)}
                  placeholder="端口"
                />
                <input
                  className="w-full rounded-md border border-divider bg-content1 px-3 py-2 text-sm outline-none focus:border-focus dark:border-divider dark:bg-content2"
                  value={hostUsername}
                  onChange={(event) => setHostUsername(event.target.value)}
                  placeholder="用户名"
                />
              </div>
              {addError && <p className="text-xs text-danger">{addError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="rounded-md border border-divider px-3 py-1.5 text-xs text-foreground dark:border-divider dark:text-foreground"
                  type="button"
                  onClick={() => setShowAddDialog(false)}
                >
                  取消
                </button>
                <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground " type="submit">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
