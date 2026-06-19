import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import AndroidTerminalPanel from '../android-terminal-panel'
import { fetchHostEnvironments, tryEnterEnvironment } from '../../api/environment'
import { useTerminalSession } from '../../hooks/useTerminalSession'
import type { MobileEnvironmentItem, MobileHostItem } from '../../types/home'

interface ContentPageProps {
  host: MobileHostItem
  token: string
  targetEnvironment?: MobileEnvironmentItem | null
  onBack: () => void
  onSyncEnvironments: (hostId: string, environments: MobileEnvironmentItem[]) => void
  onEnvironmentMissing: (hostId: string, environmentId: string) => void
}

export default function ContentPage(props: ContentPageProps): JSX.Element {
  const {
    status,
    session,
    outputs,
    connect,
    disconnect,
    sendCommand,
    clearOutput,
    appendOutput,
  } = useTerminalSession()

  const [command, setCommand] = useState('')

  useEffect(() => {
    let cancelled = false

    const openSession = async () => {
      let connectEnvironmentName: string | undefined
      let fallbackMessage = ''

      if (props.targetEnvironment) {
        const enterRes = await tryEnterEnvironment(props.host, props.targetEnvironment.name, props.token)
        if (enterRes.ok) {
          connectEnvironmentName = props.targetEnvironment.name
          fallbackMessage = `已进入环境 ${props.targetEnvironment.name}`
        } else {
          fallbackMessage = `环境 ${props.targetEnvironment.name} 不可用，已降级为普通 SSH 连接`
          props.onEnvironmentMissing(props.host.id, props.targetEnvironment.id)
        }
      }

      await connect({
        host: props.host,
        token: props.token,
        targetEnvironmentName: connectEnvironmentName,
      })

      if (fallbackMessage) {
        appendOutput('system', fallbackMessage)
      }

      const environments = await fetchHostEnvironments(props.host, props.token)
      if (!cancelled) {
        props.onSyncEnvironments(props.host.id, environments)
      }
    }

    openSession()

    return () => {
      cancelled = true
      disconnect()
    }
  }, [props.host.id])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!command.trim()) return
    sendCommand(command)
    setCommand('')
  }

  const statusText = useMemo(() => status.toUpperCase(), [status])

  return (
    <div className="h-full flex flex-col bg-slate-100 dark:bg-[#030303]">
      <div className="px-3 py-2 border-b border-slate-200 bg-white/95 flex items-center justify-between gap-2 dark:border-white/5 dark:bg-[#0a0a0a]/95">
        <button
          type="button"
          onClick={props.onBack}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm dark:border-white/10 dark:bg-[#111111] dark:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 返回
        </button>

        <div className="text-right">
          <p className="text-xs text-slate-800 dark:text-slate-200">{props.host.name}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-500">
            {props.host.username}@{props.host.host}:{props.host.port}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            clearOutput()
            sendCommand('status')
          }}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm dark:border-white/10 dark:bg-[#111111] dark:text-slate-200"
        >
          <RefreshCw className="h-3.5 w-3.5" /> 状态
        </button>
      </div>

      <div className="flex-1 p-2 sm:p-3">
        <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-[#030303]">
          <AndroidTerminalPanel
            statusText={statusText}
            session={session}
            outputs={outputs}
            command={command}
            onCommandChange={setCommand}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  )
}
