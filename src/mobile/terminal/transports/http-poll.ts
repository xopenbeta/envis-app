import { fetchSessionEvents, postTerminalCommand } from '../../api/terminal'
import type {
  ConnectionStatus,
  SessionEventsResult,
  SessionInitResult,
  TerminalOutputEvent,
  TerminalTransport,
  TerminalTransportCallbacks,
} from '../../types/terminal'

const POLL_INTERVAL_MS = 1200

const mapServerStatus = (status?: string): ConnectionStatus => {
  switch (status) {
    case 'connected':
      return 'connected'
    case 'connecting':
      return 'connecting'
    case 'disconnected':
      return 'disconnected'
    case 'error':
      return 'error'
    default:
      return 'reconnecting'
  }
}

export class HttpPollingTerminalTransport implements TerminalTransport {
  private callbacks: TerminalTransportCallbacks | null = null
  private session: SessionInitResult | null = null
  private token = ''
  private disposed = false
  private cursor = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private activeRequest: Promise<void> | null = null

  async connect(
    session: SessionInitResult,
    callbacks: TerminalTransportCallbacks,
    options?: { token: string },
  ): Promise<void> {
    if (!options?.token.trim()) {
      throw new Error('token is required for terminal polling transport')
    }

    this.callbacks = callbacks
    this.session = session
    this.token = options.token.trim()
    this.cursor = 0
    this.disposed = false

    callbacks.onStatusChange('connecting')
    callbacks.onOutput({
      kind: 'system',
      text: `Connected to ${session.baseUrl} with session ${session.sessionId}`,
    })
    if (session.targetEnvironmentName) {
      callbacks.onOutput({
        kind: 'system',
        text: `Environment: ${session.targetEnvironmentName}`,
      })
    }

    this.schedulePoll(0)
  }

  send(input: string): void {
    const command = input.trim()
    if (!command || !this.callbacks || !this.session) {
      return
    }

    this.callbacks.onOutput({ kind: 'stdin', text: command })

    const session = this.session
    const token = this.token
    void postTerminalCommand(session.baseUrl, session.sessionId, token, command).catch((error) => {
      this.callbacks?.onError(`Failed to send command: ${String(error)}`)
    })
  }

  disconnect(): void {
    this.disposed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.session = null
    this.token = ''

    const callbacks = this.callbacks
    this.callbacks = null
    callbacks?.onStatusChange('disconnected')
  }

  private schedulePoll(delay: number): void {
    if (this.disposed) {
      return
    }

    this.timer = setTimeout(() => {
      this.activeRequest = this.pollOnce().finally(() => {
        this.activeRequest = null
      })
    }, delay)
  }

  private async pollOnce(): Promise<void> {
    if (!this.callbacks || !this.session || this.disposed) {
      return
    }

    try {
      const eventsResult = await fetchSessionEvents(
        this.session.baseUrl,
        this.session.sessionId,
        this.token,
        this.cursor,
      )
      this.consumeEvents(eventsResult)
      this.callbacks.onStatusChange(mapServerStatus(eventsResult.status))
      this.schedulePoll(POLL_INTERVAL_MS)
    } catch (error) {
      this.callbacks.onStatusChange('reconnecting')
      this.callbacks.onOutput({
        kind: 'system',
        text: `Bridge polling interrupted: ${String(error)}`,
      })
      this.schedulePoll(POLL_INTERVAL_MS * 2)
    }
  }

  private consumeEvents(result: SessionEventsResult): void {
    this.cursor = Math.max(this.cursor, result.cursor)
    result.events.forEach((event) => {
      const output: TerminalOutputEvent = {
        kind: event.kind,
        text: event.text,
      }
      this.callbacks?.onOutput(output)
    })
  }
}
