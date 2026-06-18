'use client'
import { atom } from 'jotai'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const STORAGE_KEY = 'envis_ai_chat_messages_v1'

const loadInitialMessages = (): ChatMessage[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ChatMessage[]
  } catch (e) {
    return []
  }
}

export const chatMessagesAtom = atom<ChatMessage[]>(typeof window !== 'undefined' ? loadInitialMessages() : [])
export const isAIResponseLoadingAtom = atom(false)

// 添加聊天消息的action
export const addChatMessageAtom = atom(
  null,
  (get, set, message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const currentMessages = get(chatMessagesAtom);
    const timestamp = new Date().toLocaleTimeString();
    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      ...message
    };
    const next = [...currentMessages, newMessage]
    set(chatMessagesAtom, next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }
)

// 清空聊天记录的action
export const clearChatMessagesAtom = atom(
  null,
  (_get, set) => {
    set(chatMessagesAtom, []);
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }
)
