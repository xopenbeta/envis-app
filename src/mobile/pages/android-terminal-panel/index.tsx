import { FormEvent, useEffect, useRef } from 'react'
import type { SessionInitResult, TerminalOutputLine } from '../../types/terminal'

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

interface AndroidTerminalPanelProps {
  statusText: string
  session: SessionInitResult | null
  outputs: TerminalOutputLine[]
  command: string
  onCommandChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export default function AndroidTerminalPanel(props: AndroidTerminalPanelProps): JSX.Element {
  const outputRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' })
  }, [props.outputs])

  const statusKey = props.statusText.toLowerCase()

  return (
    <div className="h-full w-full bg-slate-950 text-slate-100 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-wide">Android SSH Terminal</h2>
            <p className="text-xs text-slate-400 mt-1">
              Session ID: {props.session?.sessionId || '-'}
            </p>
          </div>
          <span className={`text-xs font-semibold ${statusClassNameMap[statusKey] || 'text-slate-400'}`}>
            {props.statusText}
          </span>
        </div>
      </div>

      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-5 bg-slate-950"
      >
        {props.outputs.length === 0 ? (
          <p className="text-slate-500">No terminal output yet.</p>
        ) : (
          props.outputs.map((line) => (
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

      <form onSubmit={props.onSubmit} className="border-t border-slate-800 bg-slate-900 px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm outline-none focus:border-cyan-400"
            value={props.command}
            onChange={(event) => props.onCommandChange(event.target.value)}
            placeholder="Type command and press Enter"
          />
          <button
            type="submit"
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            disabled={!props.command.trim()}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
