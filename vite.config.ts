import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from 'path'
import fs from 'node:fs'

// esbuild 默认把临时产物写到系统临时目录。Windows 上安全软件会在写入后短暂
// 锁定该文件，导致构建时报 “remove ...: Access is denied” 而中断。
// 统一改用项目内的临时目录（已在 .gitignore 中忽略），规避系统临时目录的锁定。
const viteTempDir = path.resolve('.tmp', 'vite-temp')
try {
  fs.mkdirSync(viteTempDir, { recursive: true })
  process.env.TMPDIR = viteTempDir
  process.env.TEMP = viteTempDir
  process.env.TMP = viteTempDir
} catch {
  // 创建失败时退回系统临时目录，不阻断构建
}

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_APP_TARGET === 'mobile' ? 'mobile' : 'pc'
  const isMobileTarget = target === 'mobile'

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(isMobileTarget ? 'src/mobile' : 'src/pc'),
      },
    },

    build: {
      outDir: isMobileTarget ? 'build' : 'dist',
      rollupOptions: {
        input: isMobileTarget ? path.resolve('mobile.html') : path.resolve('index.html'),
      },
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        // 3. tell vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },
  }
});
