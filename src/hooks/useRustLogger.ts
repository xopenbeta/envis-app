import { useEffect } from 'react';
import { attachConsole } from '@tauri-apps/plugin-log';

/**
 * 将 Rust 后端日志附加到浏览器 DevTools Console
 * 使用 tauri-plugin-log 插件
 */
export function useRustLogger() {
  useEffect(() => {
    // 附加控制台，将 Rust 日志显示到浏览器 DevTools
    const detachPromise = attachConsole();

    // 清理函数：分离控制台
    return () => {
      detachPromise.then(detach => {
        if (detach) {
          detach();
        }
      });
    };
  }, []);
}
