import type {
  SessionEventsResult,
  SessionEventsServerResponse,
  TerminalCommandResponse,
  TerminalCommandServerResponse,
} from '../types/terminal'

const parseJsonSafe = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T
  } catch (_error) {
    return null
  }
}

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '')

const buildSessionPath = (sessionId: string, suffix: 'command' | 'events'): string => {
  const normalizedSessionId = encodeURIComponent(sessionId)
  return `/api/mobile/terminal/session/${normalizedSessionId}/${suffix}`
}

export const postTerminalCommand = async (
  baseUrl: string,
  sessionId: string,
  token: string,
  command: string,
): Promise<TerminalCommandResponse> => {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${buildSessionPath(sessionId, 'command')}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ command }),
  })

  const body = await parseJsonSafe<TerminalCommandServerResponse>(response)
  if (!response.ok || body?.code !== 200 || !body?.data?.accepted) {
    throw new Error(body?.message || `Command request failed with status ${response.status}`)
  }

  return body.data
}

export const fetchSessionEvents = async (
  baseUrl: string,
  sessionId: string,
  token: string,
  cursor: number,
): Promise<SessionEventsResult> => {
  const url = new URL(
    `${normalizeBaseUrl(baseUrl)}${buildSessionPath(sessionId, 'events')}`,
  )
  url.searchParams.set('cursor', String(cursor))

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const body = await parseJsonSafe<SessionEventsServerResponse>(response)
  if (!response.ok || body?.code !== 200 || !body?.data) {
    throw new Error(body?.message || `Session events request failed with status ${response.status}`)
  }

  return body.data
}
