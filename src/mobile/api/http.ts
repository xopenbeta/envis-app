import { FALLBACK_SERVER_BASE_URL, PRIMARY_SERVER_BASE_URL } from '../store/terminal'

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '')

const joinUrl = (baseUrl: string, path: string): string => {
  const normalizedBase = normalizeBaseUrl(baseUrl)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

const shouldFallback = (response: Response, body: any): boolean => {
  const businessCode = body && typeof body === 'object' ? body.code : undefined
  return response.status === 301 || businessCode === 301
}

const tryParseJson = async (response: Response): Promise<any> => {
  try {
    return await response.json()
  } catch (_error) {
    return null
  }
}

export interface FallbackRequestResult {
  response: Response | null
  body: any
  baseUrl: string
  usedFallback: boolean
}

export const requestWithFallback = async (
  path: string,
  options: RequestInit,
): Promise<FallbackRequestResult> => {
  const primaryBaseUrl = normalizeBaseUrl(PRIMARY_SERVER_BASE_URL)
  const fallbackBaseUrl = normalizeBaseUrl(FALLBACK_SERVER_BASE_URL)

  try {
    const primaryResponse = await fetch(joinUrl(primaryBaseUrl, path), options)
    const primaryBody = await tryParseJson(primaryResponse)
    if (!shouldFallback(primaryResponse, primaryBody)) {
      return {
        response: primaryResponse,
        body: primaryBody,
        baseUrl: primaryBaseUrl,
        usedFallback: false,
      }
    }

    const fallbackResponse = await fetch(joinUrl(fallbackBaseUrl, path), options)
    const fallbackBody = await tryParseJson(fallbackResponse)
    return {
      response: fallbackResponse,
      body: fallbackBody,
      baseUrl: fallbackBaseUrl,
      usedFallback: true,
    }
  } catch (_error) {
    return {
      response: null,
      body: null,
      baseUrl: primaryBaseUrl,
      usedFallback: false,
    }
  }
}
