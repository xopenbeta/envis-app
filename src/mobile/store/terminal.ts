import { atom } from 'jotai'
import type {
  ConnectionStatus,
  SessionInitResult,
  TerminalConnectionConfig,
  TerminalOutputLine,
} from '../types/terminal'

export const PRIMARY_SERVER_BASE_URL = 'https://daji.chat'
export const FALLBACK_SERVER_BASE_URL = 'https://envis.app'

export const terminalConfigAtom = atom<TerminalConnectionConfig>({
  host: '127.0.0.1',
  port: 22,
  username: 'envis',
  token: '',
  simulateFallback: false,
})

export const terminalStatusAtom = atom<ConnectionStatus>('idle')
export const terminalSessionAtom = atom<SessionInitResult | null>(null)
export const terminalOutputsAtom = atom<TerminalOutputLine[]>([])
