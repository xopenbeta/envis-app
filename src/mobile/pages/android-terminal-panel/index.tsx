import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useTerminalSession } from '../../hooks/useTerminalSession'
import {
  FALLBACK_SERVER_BASE_URL,
  PRIMARY_SERVER_BASE_URL,
} from '../../store/terminal'

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
  })
}

const statusClassNameMap: Record<string, string> = {
  idle: 'text-slate-400',
  connecting: 'text-amber-400',
  connected: 'text-emerald-400',
  reconnecting: 'text-yellow-400',
  disconnected: 'text-slate-400',
  error: 'text-rose-400',
}

export default function AndroidTerminalPanel(): JSX.Element {
  const {
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
  } = useTerminalSession()

  const [command, setCommand] = useState('')
  const outputRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
  }, [outputs])

  const isConnected = status === 'connected' || status === 'connecting'
  const currentServer = session?.baseUrl ?? PRIMARY_SERVER_BASE_URL

  const statusText = useMemo(() => {
    return status.toUpperCase()
  }, [status])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!command.trim()) return
    sendCommand(command)
    setCommand('')
  }

  return (
    <div className="h-full w-full bg-slate-950 text-slate-100 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-wide">Android SSH Terminal</h2>
            <p className="text-xs text-slate-400 mt-1">
              Primary: {PRIMARY_SERVER_BASE_URL} | Fallback: {FALLBACK_SERVER_BASE_URL}
            </p>
          </div>
          <span className={`text-xs font-semibold ${statusClassNameMap[status] || 'text-slate-400'}`}>
            {statusText}
          </span>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-slate-800 bg-slate-900/70">
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs text-slate-300">
            Remote Host
            <input
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              value={config.host}
              onChange={(event) => applyConfig({ host: event.target.value })}
              placeholder="192.168.1.100"
              disabled={isConnected}
            />
          </label>

          <label className="text-xs text-slate-300">
            Port
            <input
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              type="number"
              min={1}
              max={65535}
              value={config.port}
              onChange={(event) => applyConfig({ port: Number(event.target.value) || 22 })}
              disabled={isConnected}
            />
          </label>

          <label className="text-xs text-slate-300">
            Username
            <input
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              value={config.username}
              onChange={(event) => applyConfig({ username: event.target.value })}
              placeholder="envis"
              disabled={isConnected}
            />
          </label>

          <label className="col-span-2 text-xs text-slate-300">
            Bearer Token
            <input
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              type="password"
              value={config.token}
              onChange={(event) => applyConfig({ token: event.target.value })}
              placeholder="Paste token"
              disabled={isConnected}
            />
          </label>

          <label className="col-span-2 inline-flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={config.simulateFallback}
              onChange={(event) => applyConfig({ simulateFallback: event.target.checked })}
              disabled={isConnected}
            />
            Simulate code=301 to test fallback switch
          </label>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canConnect || isConnected}
            onClick={connect}
            type="button"
          >
            Connect
          </button>
          <button
            className="rounded-md border border-rose-400 px-4 py-2 text-sm font-semibold text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isConnected && status !== 'error'}
            onClick={disconnect}
            type="button"
          >
            Disconnect
          </button>
          <button
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-200"
            onClick={clearOutput}
            type="button"
          >
            Clear
          </button>
        </div>

        <p className="mt-2 text-[11px] text-slate-400">
          Current server: {currentServer} {session?.mocked ? '(mock stream)' : ''}
        </p>
      </div>

      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-5 bg-slate-950"
      >
        {outputs.length === 0 ? (
          <p className="text-slate-500">No terminal output yet.</p>
        ) : (
          outputs.map((line) => (
            <div key={line.id} className="whitespace-pre-wrap break-words">
              <span className="text-slate-500">[{formatTimestamp(line.timestamp)}]</span>{' '}
              <span
                className={
                  line.kind === 'stderr'
                    ? 'text-rose-300'
                    : line.kind === 'stdin'
                      ? 'text-cyan-300'
                      : line.kind === 'system'
                        ? 'text-amber-300'
                        : 'text-slate-100'
                }
              >
                {line.kind === 'stdin' ? `$ ${line.text}` : line.text}
              </span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-slate-800 bg-slate-900 px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm outline-none focus:border-cyan-400"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="Type command and press Enter"
          />
          <button
            type="submit"
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            disabled={!command.trim()}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
