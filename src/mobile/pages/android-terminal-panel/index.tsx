import { FormEvent, useEffect, useRef } from 'react'
import type { SessionInitResult, TerminalOutputLine } from '../../types/terminal'

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
  })
}

const statusClassNameMap: Record<string, string> = {
  idle: 'text-muted-foreground',
  connecting: 'text-warning',
  connected: 'text-success',
  reconnecting: 'text-warning',
  disconnected: 'text-muted-foreground',
  error: 'text-danger',
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

  // 恒定深色子树：根挂 dark 类（global.css 的 .dark 是普通类选择器，子树上重声明变量生效）
  return (
    <div className="dark h-full w-full bg-background text-foreground flex flex-col">
      <div className="px-4 py-3 border-b border-divider bg-content1/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-wide">Android SSH Terminal</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Session ID: {props.session?.sessionId || '-'}
            </p>
          </div>
          <span className={`text-xs font-semibold ${statusClassNameMap[statusKey] || 'text-muted-foreground'}`}>
            {props.statusText}
          </span>
        </div>
      </div>

      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-5 bg-background"
      >
        {props.outputs.length === 0 ? (
          <p className="text-muted-foreground">No terminal output yet.</p>
        ) : (
          props.outputs.map((line) => (
            <div key={line.id} className="whitespace-pre-wrap break-words">
              <span className="text-muted-foreground">[{formatTimestamp(line.timestamp)}]</span>{' '}
              <span
                className={
                  line.kind === 'stderr'
                    ? 'text-danger'
                    : line.kind === 'stdin'
                      ? 'text-focus'
                      : line.kind === 'system'
                        ? 'text-warning'
                        : 'text-foreground'
                }
              >
                {line.kind === 'stdin' ? `$ ${line.text}` : line.text}
              </span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={props.onSubmit} className="border-t border-divider bg-content1 px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-md border border-default bg-background px-3 py-2 font-mono text-sm outline-none focus:border-focus"
            value={props.command}
            onChange={(event) => props.onCommandChange(event.target.value)}
            placeholder="Type command and press Enter"
          />
          <button
            type="submit"
            className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-success-foreground disabled:opacity-50"
            disabled={!props.command.trim()}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
