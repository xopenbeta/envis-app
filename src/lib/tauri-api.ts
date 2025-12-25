/**
 * Tauri API 统一封装
 * 用于替换 Electron 的 ipcRenderer 调用
 */

import { invoke } from '@tauri-apps/api/core';

// 通用的 IPC 调用封装
export async function invokeCommand<T = any>(command: string, args?: any): Promise<T> {
  try {
    const result = await invoke(command, args);
    return result as T;
  } catch (error) {
    console.error(`Tauri command "${command}" failed:`, error);
    throw error;
  }
}

// 打开外部链接或文件
export async function openExternal(path: string): Promise<void> {
  await invoke('plugin:opener|open', { path });
}

// 类型定义
export interface TauriResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 通用的结果包装器
export function wrapResult<T>(data: T): TauriResult<T> {
  return {
    success: true,
    data
  };
}

export function wrapError(error: string | Error): TauriResult {
  return {
    success: false,
    error: error instanceof Error ? error.message : error
  };
}
