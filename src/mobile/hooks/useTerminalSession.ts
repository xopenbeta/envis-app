import { useRef, useState } from 'react'
import { createTerminalSession } from '../api/session'
import type {
  ConnectionStatus,
  SessionInitPayload,
  TerminalOutputEvent,
  TerminalOutputKind,
  TerminalOutputLine,
  SessionInitResult,
  TerminalTransport,
} from '../types/terminal'
import { MockTerminalTransport } from '../terminal/transports/mock'
import type { MobileHostItem } from '../types/home'

const createOutputLine = (kind: TerminalOutputKind, text: string): TerminalOutputLine => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  timestamp: Date.now(),
  kind,
  text,
})

export const useTerminalSession = () => {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [session, setSession] = useState<SessionInitResult | null>(null)
  const [outputs, setOutputs] = useState<TerminalOutputLine[]>([])
  const transportRef = useRef<TerminalTransport | null>(null)

  const appendOutput = (kind: TerminalOutputKind, text: string) => {
    setOutputs((current) => [...current, createOutputLine(kind, text)])
  }

  const clearOutput = () => {
    setOutputs([])
  }

  const disconnect = () => {
    transportRef.current?.disconnect()
    transportRef.current = null
    setSession(null)
    setStatus('disconnected')
  }

  const connect = async (params: {
    host: MobileHostItem
    token: string
    targetEnvironmentName?: string
    forceBusiness301?: boolean
  }) => {
    const normalizedToken = params.token.trim()
    if (!normalizedToken) {
      appendOutput('stderr', 'Bearer token is required before connecting.')
      setStatus('error')
      return
    }

    if (transportRef.current) {
      disconnect()
    }

    setStatus('connecting')
    setOutputs([])
    appendOutput('system', 'Initializing terminal session...')

    const payload: SessionInitPayload = {
      host: params.host.host,
      port: params.host.port,
      username: params.host.username,
      targetEnvironmentName: params.targetEnvironmentName,
      forceBusiness301: params.forceBusiness301,
    }

    try {
      const sessionResult = await createTerminalSession(payload, normalizedToken)
      setSession(sessionResult)
      appendOutput(
        'system',
        `Session initialized via ${sessionResult.baseUrl}${sessionResult.mocked ? ' (mocked)' : ''}`,
      )

      const transport = new MockTerminalTransport()
      transportRef.current = transport

      await transport.connect(sessionResult, {
        onStatusChange: (nextStatus) => setStatus(nextStatus),
        onOutput: (event: TerminalOutputEvent) => {
          if (event.text === '__CLEAR__') {
            setOutputs([])
            return
          }
          appendOutput(event.kind, event.text)
        },
        onError: (message: string) => {
          appendOutput('stderr', message)
          setStatus('error')
        },
      })
    } catch (error) {
      setStatus('error')
      appendOutput('stderr', `Failed to initialize session: ${String(error)}`)
    }
  }

  const sendCommand = (command: string) => {
    if (!command.trim()) return
    if (!transportRef.current) {
      appendOutput('stderr', 'No active terminal session. Please connect first.')
      return
    }

    transportRef.current.send(command)
  }

  return {
    status,
    session,
    outputs,
    connect,
    disconnect,
    sendCommand,
    clearOutput,
    appendOutput,
  }
}
