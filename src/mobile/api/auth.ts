import { requestWithFallback } from './http'
import type { LoginPayload, LoginResult } from '../types/home'

const AUTH_LOGIN_PATH = '/api/mobile/auth/login'

const buildMockToken = (account: string): string => {
  const safeAccount = account.replace(/\s+/g, '-').toLowerCase()
  return `mock-token-${safeAccount}-${Date.now()}`
}

export const loginWithPassword = async (payload: LoginPayload): Promise<LoginResult> => {
  const account = payload.account.trim()
  const password = payload.password.trim()

  if (!account || !password) {
    throw new Error('账号和密码不能为空')
  }

  const requestResult = await requestWithFallback(AUTH_LOGIN_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (requestResult.response && requestResult.response.ok && requestResult.body) {
    const token = requestResult.body?.data?.token
    if (typeof token === 'string' && token.trim()) {
      return {
        token,
        account,
      }
    }
  }

  return {
    token: buildMockToken(account),
    account,
  }
}
