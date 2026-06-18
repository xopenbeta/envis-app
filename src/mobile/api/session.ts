import {
  FALLBACK_SERVER_BASE_URL,
  PRIMARY_SERVER_BASE_URL,
} from '../store/terminal'
import type {
  SessionInitPayload,
  SessionInitResult,
  SessionInitServerResponse,
} from '../types/terminal'

const SESSION_INIT_PATH = '/api/mobile/terminal/session'

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '')

const shouldFallback = (httpStatus: number, businessCode?: number): boolean => {
  return httpStatus === 301 || businessCode === 301
}

const buildRequestBody = (payload: SessionInitPayload): Record<string, unknown> => {
  return {
    target: {
      host: payload.host,
      port: payload.port,
      username: payload.username,
    },
    code: payload.forceBusiness301 ? 301 : undefined,
  }
}

const parseJsonSafe = async (response: Response): Promise<SessionInitServerResponse | null> => {
  try {
    return (await response.json()) as SessionInitServerResponse
  } catch (_error) {
    return null
  }
}

const createMockResult = (baseUrl: string, message: string): SessionInitResult => {
  const sessionId = `mock-${Date.now()}`
  return {
    sessionId,
    wsUrl: 'mock://terminal',
    baseUrl,
    mocked: true,
    message,
  }
}

const requestSession = async (
  baseUrl: string,
  payload: SessionInitPayload,
  token: string,
): Promise<{ response: Response; body: SessionInitServerResponse | null }> => {
  const url = `${normalizeBaseUrl(baseUrl)}${SESSION_INIT_PATH}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(buildRequestBody(payload)),
  })

  const body = await parseJsonSafe(response)
  return { response, body }
}

const resolveServerResult = (
  baseUrl: string,
  body: SessionInitServerResponse | null,
): SessionInitResult | null => {
  if (!body) return null

  const sessionId = body.data?.sessionId ?? `mock-${Date.now()}`
  const wsUrl = body.data?.wsUrl ?? 'mock://terminal'

  return {
    sessionId,
    wsUrl,
    baseUrl,
    mocked: !body.data?.sessionId || !body.data?.wsUrl,
    message: body.message,
  }
}

export const createTerminalSession = async (
  payload: SessionInitPayload,
  token: string,
): Promise<SessionInitResult> => {
  const primaryBase = normalizeBaseUrl(PRIMARY_SERVER_BASE_URL)
  const fallbackBase = normalizeBaseUrl(FALLBACK_SERVER_BASE_URL)

  try {
    const primaryResult = await requestSession(primaryBase, payload, token)
    if (
      shouldFallback(primaryResult.response.status, primaryResult.body?.code) ||
      payload.forceBusiness301
    ) {
      const fallbackResult = await requestSession(fallbackBase, payload, token)
      return (
        resolveServerResult(fallbackBase, fallbackResult.body) ??
        createMockResult(fallbackBase, 'fallback server did not return a session, use mocked stream')
      )
    }

    return (
      resolveServerResult(primaryBase, primaryResult.body) ??
      createMockResult(primaryBase, 'primary server did not return a session, use mocked stream')
    )
  } catch (_error) {
    return createMockResult(primaryBase, 'session API unavailable, use mocked stream')
  }
}
