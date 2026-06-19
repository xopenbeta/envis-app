import { requestWithFallback } from './http'
import type { MobileEnvironmentItem, MobileHostItem } from '../types/home'

const ENV_LIST_PATH = '/api/mobile/hosts/environments'
const ENTER_ENV_PATH = '/api/mobile/hosts/enter-environment'

const createMockEnvironments = (host: MobileHostItem): MobileEnvironmentItem[] => {
  return [
    { id: `${host.id}-dev`, name: 'dev' },
    { id: `${host.id}-test`, name: 'test' },
    { id: `${host.id}-prod`, name: 'prod' },
  ]
}

export const fetchHostEnvironments = async (
  host: MobileHostItem,
  token: string,
): Promise<MobileEnvironmentItem[]> => {
  const requestResult = await requestWithFallback(ENV_LIST_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      host: host.host,
      port: host.port,
      username: host.username,
    }),
  })

  if (requestResult.response && requestResult.response.ok && requestResult.body) {
    const items = requestResult.body?.data?.environments
    if (Array.isArray(items)) {
      return items
        .map((item: any, index: number) => ({
          id: item?.id ? String(item.id) : `${host.id}-remote-${index}`,
          name: item?.name ? String(item.name) : `env-${index + 1}`,
        }))
        .filter((item: MobileEnvironmentItem) => item.name)
    }
  }

  return createMockEnvironments(host)
}

export const tryEnterEnvironment = async (
  host: MobileHostItem,
  environmentName: string,
  token: string,
): Promise<{ ok: boolean; message?: string }> => {
  const normalized = environmentName.trim().toLowerCase()
  if (!normalized) {
    return { ok: false, message: '环境名不能为空' }
  }

  const requestResult = await requestWithFallback(ENTER_ENV_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      host: host.host,
      port: host.port,
      username: host.username,
      environmentName,
    }),
  })

  if (requestResult.response && requestResult.response.ok && requestResult.body) {
    const success = !!requestResult.body?.data?.success
    return {
      ok: success,
      message: requestResult.body?.message,
    }
  }

  if (normalized.includes('invalid') || normalized.includes('deleted') || normalized.includes('missing')) {
    return {
      ok: false,
      message: '目标环境在电脑端不存在',
    }
  }

  return {
    ok: true,
    message: 'mock enter environment success',
  }
}
