export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

export type TerminalOutputKind = 'system' | 'stdin' | 'stdout' | 'stderr'

export interface TerminalConnectionConfig {
  host: string
  port: number
  username: string
  token: string
  simulateFallback: boolean
}

export interface SessionInitPayload {
  host: string
  port: number
  username: string
  targetEnvironmentName?: string
  forceBusiness301?: boolean
}

export interface SessionInitResult {
  sessionId: string
  wsUrl: string
  baseUrl: string
  mocked: boolean
  transport?: 'mock' | 'http-poll'
  targetEnvironmentName?: string
  message?: string
}

export interface SessionInitServerResponse {
  code?: number
  message?: string
  data?: {
    sessionId?: string
    wsUrl?: string
    transport?: 'mock' | 'http-poll'
  }
}

export interface TerminalOutputLine {
  id: string
  timestamp: number
  kind: TerminalOutputKind
  text: string
}

export interface TerminalOutputEvent {
  kind: TerminalOutputKind
  text: string
}

export interface TerminalTransportCallbacks {
  onStatusChange: (status: ConnectionStatus) => void
  onOutput: (event: TerminalOutputEvent) => void
  onError: (message: string) => void
}

export interface TerminalTransport {
  connect: (
    session: SessionInitResult,
    callbacks: TerminalTransportCallbacks,
    options?: { token: string },
  ) => Promise<void>
  send: (input: string) => void
  disconnect: () => void
}

export interface SessionEventItem {
  id: number
  kind: TerminalOutputKind
  text: string
  timestamp: number
}

export interface SessionEventsResult {
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  cursor: number
  events: SessionEventItem[]
}

export interface SessionEventsServerResponse {
  code?: number
  message?: string
  data?: SessionEventsResult
}

export interface TerminalCommandResponse {
  accepted: boolean
}

export interface TerminalCommandServerResponse {
  code?: number
  message?: string
  data?: TerminalCommandResponse
}
