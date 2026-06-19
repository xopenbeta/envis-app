import { useEffect, useMemo, useState } from 'react'
import { loginWithPassword } from '../api/auth'
import type {
  AddHostPayload,
  MobileAuthSession,
  MobileEnvironmentItem,
  MobileHostItem,
} from '../types/home'

const AUTH_STORAGE_KEY = 'envis-mobile-auth-session'
const HOST_STORAGE_KEY = 'envis-mobile-hosts'
const ENV_CACHE_STORAGE_KEY = 'envis-mobile-env-cache'

const MOCK_AUTH: MobileAuthSession = {
  isLoggedIn: true,
  account: 'demo',
  token: 'mock-token-demo',
}

const MOCK_HOSTS: MobileHostItem[] = [
  {
    id: 'host-demo-office',
    name: '办公主机',
    host: '192.168.1.12',
    port: 22,
    username: 'envis',
  },
  {
    id: 'host-demo-lab',
    name: '实验主机',
    host: '10.0.0.24',
    port: 22,
    username: 'root',
  },
]

const MOCK_ENVIRONMENT_CACHE: EnvironmentCache = {
  'host-demo-office': [
    { id: 'host-demo-office-dev', name: 'dev' },
    { id: 'host-demo-office-stage', name: 'stage' },
    { id: 'host-demo-office-prod', name: 'prod' },
  ],
  'host-demo-lab': [
    { id: 'host-demo-lab-sandbox', name: 'sandbox' },
    { id: 'host-demo-lab-hotfix', name: 'hotfix' },
  ],
}

type EnvironmentCache = Record<string, MobileEnvironmentItem[]>

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch (_error) {
    return fallback
  }
}

const writeJson = (key: string, value: unknown): void => {
  localStorage.setItem(key, JSON.stringify(value))
}

const createHostId = (): string => {
  return `host-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useMobileHome = () => {
  const [auth, setAuth] = useState<MobileAuthSession>({
    isLoggedIn: false,
    account: '',
    token: '',
  })
  const [hosts, setHosts] = useState<MobileHostItem[]>([])
  const [environmentCache, setEnvironmentCache] = useState<EnvironmentCache>({})

  useEffect(() => {
    const storedAuth = readJson<MobileAuthSession>(AUTH_STORAGE_KEY, {
      isLoggedIn: false,
      account: '',
      token: '',
    })
    const storedHosts = readJson<MobileHostItem[]>(HOST_STORAGE_KEY, [])
    const storedCache = readJson<EnvironmentCache>(ENV_CACHE_STORAGE_KEY, {})

    if (storedHosts.length === 0) {
      persistAuth(MOCK_AUTH)
      persistHosts(MOCK_HOSTS)
      persistEnvironmentCache(MOCK_ENVIRONMENT_CACHE)
      return
    }

    setAuth(storedAuth)
    setHosts(storedHosts)
    setEnvironmentCache(storedCache)
  }, [])

  const persistAuth = (next: MobileAuthSession) => {
    setAuth(next)
    writeJson(AUTH_STORAGE_KEY, next)
  }

  const persistHosts = (next: MobileHostItem[]) => {
    setHosts(next)
    writeJson(HOST_STORAGE_KEY, next)
  }

  const persistEnvironmentCache = (next: EnvironmentCache) => {
    setEnvironmentCache(next)
    writeJson(ENV_CACHE_STORAGE_KEY, next)
  }

  const login = async (account: string, password: string) => {
    const result = await loginWithPassword({ account, password })
    persistAuth({
      isLoggedIn: true,
      account: result.account,
      token: result.token,
    })
  }

  const logout = () => {
    persistAuth({
      isLoggedIn: false,
      account: '',
      token: '',
    })
  }

  const addHost = (payload: AddHostPayload) => {
    const nextHost: MobileHostItem = {
      id: createHostId(),
      name: payload.name,
      host: payload.host,
      port: payload.port,
      username: payload.username,
    }
    persistHosts([nextHost, ...hosts])
  }

  const removeHost = (hostId: string) => {
    persistHosts(hosts.filter((host) => host.id !== hostId))
    const nextCache = { ...environmentCache }
    delete nextCache[hostId]
    persistEnvironmentCache(nextCache)
  }

  const updateHostEnvironments = (hostId: string, environments: MobileEnvironmentItem[]) => {
    persistEnvironmentCache({
      ...environmentCache,
      [hostId]: environments,
    })
  }

  const removeEnvironmentCache = (hostId: string, environmentId: string) => {
    const current = environmentCache[hostId] || []
    const next = current.filter((item) => item.id !== environmentId)
    persistEnvironmentCache({
      ...environmentCache,
      [hostId]: next,
    })
  }

  const hostMap = useMemo(() => {
    const map = new Map<string, MobileHostItem>()
    hosts.forEach((item) => map.set(item.id, item))
    return map
  }, [hosts])

  return {
    auth,
    hosts,
    hostMap,
    environmentCache,
    login,
    logout,
    addHost,
    removeHost,
    updateHostEnvironments,
    removeEnvironmentCache,
  }
}
