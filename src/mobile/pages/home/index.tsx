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
    <div className="h-full w-full bg-slate-100 text-slate-900 flex flex-col dark:bg-[#030303] dark:text-slate-100">
      <div className="px-4 py-3 border-b border-slate-200 bg-white/95 dark:border-white/5 dark:bg-[#0a0a0a]/95">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-wide">Envis</h1>
            <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">Mobile SSH Console for your Envis hosts</p>
            <p className="text-[11px] text-slate-500 mt-1 dark:text-slate-500">{hostCountText}</p>
          </div>
          <div className="flex items-center gap-2">
            {props.auth.isLoggedIn ? (
              <button
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm dark:border-white/10 dark:bg-[#111111] dark:text-slate-200"
                onClick={props.onLogout}
                type="button"
              >
                <LogOut className="h-3.5 w-3.5" />
                退出
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-700 dark:text-cyan-300"
                onClick={() => setShowLoginDialog(true)}
                type="button"
              >
                <LogIn className="h-3.5 w-3.5" />
                登录
              </button>
            )}

            <button
              className="inline-flex items-center gap-1 rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm shadow-cyan-500/20"
              onClick={handleClickAdd}
              type="button"
            >
              <Plus className="h-3.5 w-3.5" />
              添加
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50 dark:bg-[#030303]">
        {props.hosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center shadow-sm dark:border-white/10 dark:bg-[#0b0b0b]">
            <p className="text-sm text-slate-700 dark:text-slate-300">还没有主机，先点击右上角添加</p>
            <p className="text-xs text-slate-500 mt-1 dark:text-slate-500">添加后即可在这里展开查看环境缓存</p>
          </div>
        ) : (
          props.hosts.map((host) => {
            const environments = props.environmentCache[host.id] || []
            const expanded = expandedHostIds.includes(host.id)
            return (
              <div key={host.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-[#0b0b0b]">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
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
                      <Server className="h-4 w-4 text-cyan-300" />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{host.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 dark:text-slate-400">
                      {host.username}@{host.host}:{host.port}
                    </div>
                  </button>

                  <button
                    className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300"
                    onClick={() => openHostWithGuard(host)}
                    type="button"
                  >
                    连接
                  </button>
                </div>

                {expanded && (
                  <div className="border-t border-slate-200 px-2 py-2 space-y-1.5 dark:border-white/5">
                    {environments.length === 0 ? (
                      <p className="text-[11px] text-slate-500 px-2 py-1 dark:text-slate-500">暂无缓存环境，连接后会自动同步</p>
                    ) : (
                      environments.map((env) => (
                        <button
                          key={env.id}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-cyan-400 hover:bg-cyan-50/60 dark:border-white/5 dark:bg-[#111111] dark:hover:border-cyan-600/70 dark:hover:bg-slate-900"
                          onClick={() => openEnvironmentWithGuard(host, env)}
                          type="button"
                        >
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
                              <TerminalSquare className="h-3.5 w-3.5 text-amber-300" />
                              {env.name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">进入环境</span>
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
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/5 dark:bg-[#101010]">
            <h3 className="text-sm font-semibold">账号登录</h3>
            <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">添加主机前需要先登录</p>
            <form className="mt-3 space-y-2" onSubmit={submitLogin}>
              <input
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-[#050505]"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="账号"
              />
              <input
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-[#050505]"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="密码"
              />
              {loginError && <p className="text-xs text-rose-500">{loginError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 dark:border-white/10 dark:text-slate-200"
                  type="button"
                  onClick={() => {
                    setShowLoginDialog(false)
                    setPendingAddAfterLogin(false)
                    setPendingOpenAction(null)
                  }}
                >
                  取消
                </button>
                <button className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm shadow-cyan-500/20" type="submit">
                  登录
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddDialog && (
        <div className="fixed inset-0 z-30 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/5 dark:bg-[#101010]">
            <h3 className="text-sm font-semibold">添加主机</h3>
            <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">保存后会出现在首页第一层列表</p>
            <form className="mt-3 space-y-2" onSubmit={submitAddHost}>
              <input
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-[#050505]"
                value={hostName}
                onChange={(event) => setHostName(event.target.value)}
                placeholder="主机名称，例如 我的办公机"
              />
              <input
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-[#050505]"
                value={hostAddress}
                onChange={(event) => setHostAddress(event.target.value)}
                placeholder="主机地址，例如 192.168.1.12"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-[#050505]"
                  type="number"
                  value={hostPort}
                  onChange={(event) => setHostPort(Number(event.target.value) || 22)}
                  placeholder="端口"
                />
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-[#050505]"
                  value={hostUsername}
                  onChange={(event) => setHostUsername(event.target.value)}
                  placeholder="用户名"
                />
              </div>
              {addError && <p className="text-xs text-rose-500">{addError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 dark:border-white/10 dark:text-slate-200"
                  type="button"
                  onClick={() => setShowAddDialog(false)}
                >
                  取消
                </button>
                <button className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm shadow-cyan-500/20" type="submit">
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
