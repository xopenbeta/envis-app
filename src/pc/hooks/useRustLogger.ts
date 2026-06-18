import { useEffect } from 'react';
import { attachConsole } from '@tauri-apps/plugin-log';
import { listen } from '@tauri-apps/api/event';
import { useSetAtom } from 'jotai';
import { appendLogAtom, LogLevel } from '../store/log';

interface RustLogEvent {
  level: number | string;
  message: string;
}

/**
 * 将 Rust 后端日志附加到浏览器 DevTools Console
 * 并同步记录到应用内的 Log Panel
 */
export function useRustLogger() {
  const appendLog = useSetAtom(appendLogAtom);

  useEffect(() => {
    // 1. 附加控制台，将 Rust 日志显示到浏览器 DevTools
    const detachConsolePromise = attachConsole();

    // 2. 监听 Rust 'log://log' 事件，并添加到 LogStore
    const unlistenPromise = listen<RustLogEvent>('log://log', (event) => {
      const { level, message } = event.payload;

      let logLevel: LogLevel = 'info';

      // Tauri Plugin Log v2 默认 level 类型为 number (1=Error, 2=Warn, 3=Info, 4=Debug, 5=Trace)
      // 但为了鲁棒性也处理 string 情况
      if (typeof level === 'number') {
        if (level <= 1) logLevel = 'error';
        else if (level === 2) logLevel = 'warn';
        else if (level === 3) logLevel = 'info';
        else if (level >= 4) logLevel = 'debug';
      } else if (typeof level === 'string') {
        const lower = level.toLowerCase();
        if (lower.includes('error')) logLevel = 'error';
        else if (lower.includes('warn')) logLevel = 'warn';
        else if (lower.includes('debug') || lower.includes('trace')) logLevel = 'debug';
        else logLevel = 'info';
      }

      appendLog({
        level: logLevel,
        message: message,
        meta: { source: 'rust' }
      });
    });

    // 清理函数
    return () => {
      detachConsolePromise.then(detach => {
        if (detach) {
          detach();
        }
      });
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [appendLog]);
}
