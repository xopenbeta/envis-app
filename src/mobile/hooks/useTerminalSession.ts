import { useAtom } from 'jotai'
import { useMemo, useRef } from 'react'
import { createTerminalSession } from '../api/session'
import {
  terminalConfigAtom,
  terminalOutputsAtom,
  terminalSessionAtom,
  terminalStatusAtom,
} from '../store/terminal'
import type {
  SessionInitPayload,
  TerminalConnectionConfig,
  TerminalOutputEvent,
  TerminalOutputKind,
  TerminalOutputLine,
  TerminalTransport,
} from '../types/terminal'
import { MockTerminalTransport } from '../terminal/transports/mock'

const createOutputLine = (kind: TerminalOutputKind, text: string): TerminalOutputLine => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  timestamp: Date.now(),
  kind,
  text,
})

export const useTerminalSession = () => {
  const [config, setConfig] = useAtom(terminalConfigAtom)
  const [status, setStatus] = useAtom(terminalStatusAtom)
  const [session, setSession] = useAtom(terminalSessionAtom)
  const [outputs, setOutputs] = useAtom(terminalOutputsAtom)
  const transportRef = useRef<TerminalTransport | null>(null)

  const canConnect = useMemo(() => {
    return !!config.host.trim() && !!config.username.trim() && !!config.token.trim()
  }, [config.host, config.username, config.token])

  const appendOutput = (kind: TerminalOutputKind, text: string) => {
    setOutputs((current) => [...current, createOutputLine(kind, text)])
  }

  const applyConfig = (next: Partial<TerminalConnectionConfig>) => {
    setConfig((current) => ({ ...current, ...next }))
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

  const connect = async () => {
    if (!canConnect) {
      appendOutput('stderr', 'Please fill host, username and bearer token before connecting.')
      return
    }

    if (transportRef.current) {
      disconnect()
    }

    setStatus('connecting')
    setOutputs([])
    appendOutput('system', 'Initializing terminal session...')

    const payload: SessionInitPayload = {
      host: config.host,
      port: config.port,
      username: config.username,
      forceBusiness301: config.simulateFallback,
    }

    try {
      const sessionResult = await createTerminalSession(payload, config.token)
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
    config,
    status,
    session,
    outputs,
    canConnect,
    connect,
    disconnect,
    sendCommand,
    clearOutput,
    applyConfig,
  }
}
