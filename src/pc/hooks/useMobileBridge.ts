import { useEffect, useRef } from 'react'
import { ipcGetAllEnvironments, ipcSwitchEnvironmentAndServices } from '../ipc/environment'
import { ipcExecuteCustomServiceAlias } from '../ipc/services/custom'
import { ipcGetSystemInfo } from '../ipc/system-info'
import { PRIMARY_SERVER_BASE_URL } from '../../mobile/store/terminal'
import type { Environment } from '../types'

type BridgeIdentity = {
  hostname: string
  ipAddresses: string[]
}

type BridgeCommand = {
  commandId: string
  sessionId: string
  command: string
  targetEnvironmentName?: string
}

const REGISTER_INTERVAL_MS = 10_000
const POLL_INTERVAL_MS = 1_500

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '')

const getServerUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizeBaseUrl(PRIMARY_SERVER_BASE_URL)}${normalizedPath}`
}

const parseJsonSafe = async <T,>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T
  } catch (_error) {
    return null
  }
}

const fetchBridgeIdentity = async (): Promise<BridgeIdentity | null> => {
  const result = await ipcGetSystemInfo()
  const payload =
    result && typeof result === 'object' && 'success' in result
      ? (result.success ? result.data : null)
      : result

  if (!payload || typeof payload !== 'object') {
    return null
  }

  const systemInfo = payload as {
    hostname?: unknown
    ip_addresses?: unknown
  }

  const hostname = typeof systemInfo.hostname === 'string' ? systemInfo.hostname.trim() : ''
  const ipAddresses = Array.isArray(systemInfo.ip_addresses)
    ? systemInfo.ip_addresses
        .map((item: unknown) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    : []

  if (!hostname && ipAddresses.length === 0) {
    return null
  }

  return {
    hostname: hostname || 'unknown-pc',
    ipAddresses,
  }
}

const fetchEnvironments = async (): Promise<Environment[]> => {
  const result = await ipcGetAllEnvironments()
  if (!result.success || !result.data?.environments) {
    return []
  }
  return result.data.environments
}

const registerBridgeDevice = async (
  identity: BridgeIdentity,
  environments: Environment[],
  deviceId?: string,
): Promise<string | null> => {
  const response = await fetch(getServerUrl('/api/mobile/pc/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceId,
      hostname: identity.hostname,
      ipAddresses: identity.ipAddresses,
      port: 22,
      environments: environments.map((environment) => ({
        id: environment.id,
        name: environment.name,
        status: environment.status,
      })),
    }),
  })

  const body = await parseJsonSafe<{ data?: { deviceId?: string } }>(response)
  if (!response.ok) {
    return null
  }

  return body?.data?.deviceId || null
}

const pullBridgeCommands = async (deviceId: string): Promise<BridgeCommand[]> => {
  const response = await fetch(getServerUrl('/api/mobile/pc/commands/pull'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deviceId }),
  })
  const body = await parseJsonSafe<{ data?: { commands?: BridgeCommand[] } }>(response)
  if (!response.ok || !Array.isArray(body?.data?.commands)) {
    return []
  }
  return body.data.commands
}

const submitBridgeCommandResult = async (payload: {
  deviceId: string
  sessionId: string
  commandId: string
  success: boolean
  exitCode: number
  outputs: Array<{ kind: 'system' | 'stdout' | 'stderr'; text: string }>
}) => {
  await fetch(getServerUrl('/api/mobile/pc/commands/result'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

const resolveEnvironmentByName = (
  environments: Environment[],
  targetEnvironmentName?: string,
): Environment | null => {
  const normalizedName = targetEnvironmentName?.trim().toLowerCase()
  if (!normalizedName) {
    return null
  }

  return (
    environments.find((environment) => environment.name.trim().toLowerCase() === normalizedName) ||
    null
  )
}

const executeBridgeCommand = async (
  command: BridgeCommand,
  environments: Environment[],
): Promise<{
  success: boolean
  exitCode: number
  outputs: Array<{ kind: 'system' | 'stdout' | 'stderr'; text: string }>
}> => {
  const outputs: Array<{ kind: 'system' | 'stdout' | 'stderr'; text: string }> = []

  if (command.targetEnvironmentName) {
    const targetEnvironment = resolveEnvironmentByName(environments, command.targetEnvironmentName)
    if (!targetEnvironment) {
      return {
        success: false,
        exitCode: 1,
        outputs: [
          {
            kind: 'stderr',
            text: `Target environment "${command.targetEnvironmentName}" was not found on this PC.`,
          },
        ],
      }
    }

    const switchResult = await ipcSwitchEnvironmentAndServices(targetEnvironment.id)
    outputs.push({
      kind: switchResult.success ? 'system' : 'stderr',
      text: switchResult.success
        ? `Environment switched to ${targetEnvironment.name}`
        : switchResult.message || `Failed to switch environment to ${targetEnvironment.name}`,
    })

    if (!switchResult.success) {
      return {
        success: false,
        exitCode: 1,
        outputs,
      }
    }
  }

  const trimmedCommand = command.command.trim()
  if (!trimmedCommand) {
    return {
      success: true,
      exitCode: 0,
      outputs,
    }
  }

  if (trimmedCommand.toLowerCase() === 'status') {
    outputs.push({
      kind: 'stdout',
      text: `PC bridge online. Environments loaded: ${environments.length}.`,
    })
    return {
      success: true,
      exitCode: 0,
      outputs,
    }
  }

  const result = await ipcExecuteCustomServiceAlias('mobile-bridge', trimmedCommand)
  const stdout = typeof result.data?.stdout === 'string' ? result.data.stdout.trim() : ''
  const stderr = typeof result.data?.stderr === 'string' ? result.data.stderr.trim() : ''
  const exitCode =
    typeof result.data?.exitCode === 'number' ? result.data.exitCode : result.success ? 0 : 1

  if (stdout) {
    outputs.push({ kind: 'stdout', text: stdout })
  }
  if (stderr) {
    outputs.push({ kind: 'stderr', text: stderr })
  }
  if (!stdout && !stderr) {
    outputs.push({
      kind: result.success ? 'system' : 'stderr',
      text: result.message || `Command finished with exit code ${exitCode}`,
    })
  }

  return {
    success: !!result.success,
    exitCode,
    outputs,
  }
}

export const useMobileBridge = (enabled: boolean) => {
  const deviceIdRef = useRef<string | null>(null)
  const lastRegisterAtRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let disposed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let busy = false

    const schedule = (delay: number) => {
      if (disposed) {
        return
      }
      timer = setTimeout(() => {
        void tick()
      }, delay)
    }

    const tick = async () => {
      if (disposed || busy) {
        schedule(POLL_INTERVAL_MS)
        return
      }

      busy = true
      try {
        const identity = await fetchBridgeIdentity()
        if (!identity) {
          schedule(REGISTER_INTERVAL_MS)
          return
        }

        const environments = await fetchEnvironments()
        const now = Date.now()
        if (
          !deviceIdRef.current ||
          now - lastRegisterAtRef.current >= REGISTER_INTERVAL_MS
        ) {
          const nextDeviceId = await registerBridgeDevice(
            identity,
            environments,
            deviceIdRef.current || undefined,
          )
          if (nextDeviceId) {
            deviceIdRef.current = nextDeviceId
            lastRegisterAtRef.current = now
          }
        }

        if (!deviceIdRef.current) {
          schedule(REGISTER_INTERVAL_MS)
          return
        }

        const commands = await pullBridgeCommands(deviceIdRef.current)
        for (const command of commands) {
          const result = await executeBridgeCommand(command, environments)
          await submitBridgeCommandResult({
            deviceId: deviceIdRef.current,
            sessionId: command.sessionId,
            commandId: command.commandId,
            success: result.success,
            exitCode: result.exitCode,
            outputs: result.outputs,
          })
        }

        schedule(POLL_INTERVAL_MS)
      } catch (_error) {
        schedule(REGISTER_INTERVAL_MS)
      } finally {
        busy = false
      }
    }

    void tick()

    return () => {
      disposed = true
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [enabled])
}
