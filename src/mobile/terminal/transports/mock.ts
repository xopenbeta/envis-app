import type {
  SessionInitResult,
  TerminalOutputEvent,
  TerminalTransport,
  TerminalTransportCallbacks,
} from '../../types/terminal'

export class MockTerminalTransport implements TerminalTransport {
  private callbacks: TerminalTransportCallbacks | null = null
  private timers: ReturnType<typeof setTimeout>[] = []
  private connected = false

  async connect(session: SessionInitResult, callbacks: TerminalTransportCallbacks): Promise<void> {
    this.callbacks = callbacks
    this.connected = false
    callbacks.onStatusChange('connecting')

    this.pushTimer(() => {
      this.connected = true
      callbacks.onStatusChange('connected')
      callbacks.onOutput({
        kind: 'system',
        text: `Connected to ${session.baseUrl} with session ${session.sessionId}`,
      })
      callbacks.onOutput({
        kind: 'stdout',
        text: 'Mock SSH shell ready. Type help to view commands.',
      })
    }, 450)
  }

  send(input: string): void {
    if (!this.callbacks || !this.connected) {
      this.callbacks?.onError('session not connected')
      return
    }

    const command = input.trim()
    if (!command) return

    this.callbacks.onOutput({ kind: 'stdin', text: command })

    const lowerCommand = command.toLowerCase()

    if (lowerCommand === 'help') {
      this.emitStdout('Commands: help, status, ls, whoami, clear, exit')
      return
    }

    if (lowerCommand === 'status') {
      this.emitStdout('SSH tunnel: connected (mock) | latency: 12ms | mode: websocket')
      return
    }

    if (lowerCommand === 'ls') {
      this.emitStdout('envis.log  projects/  services/  .env  README.md')
      return
    }

    if (lowerCommand === 'whoami') {
      this.emitStdout('envis-mobile-user')
      return
    }

    if (lowerCommand === 'clear') {
      this.emitStdout('__CLEAR__')
      return
    }

    if (lowerCommand === 'exit') {
      this.emitStdout('Session closing...')
      this.pushTimer(() => {
        this.disconnect()
      }, 120)
      return
    }

    this.emitStdout(`Mock output: command \"${command}\" executed on remote envis host.`)
  }

  disconnect(): void {
    this.clearTimers()
    const callbacks = this.callbacks
    this.callbacks = null

    if (this.connected) {
      callbacks?.onOutput({ kind: 'system', text: 'Session disconnected' })
    }

    this.connected = false
    callbacks?.onStatusChange('disconnected')
  }

  private emitStdout(text: string): void {
    this.pushTimer(() => {
      this.emitOutput({ kind: 'stdout', text })
    }, 80)
  }

  private emitOutput(event: TerminalOutputEvent): void {
    this.callbacks?.onOutput(event)
  }

  private pushTimer(handler: () => void, delay: number): void {
    const timer = setTimeout(handler, delay)
    this.timers.push(timer)
  }

  private clearTimers(): void {
    this.timers.forEach((timer) => clearTimeout(timer))
    this.timers = []
  }
}
