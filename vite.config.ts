import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from 'path'

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
