import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    exclude: ['@mysten/walrus-wasm'],
  },
  // 配置靜態資源目錄
  publicDir: 'public',
  // 配置構建輸出目錄
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  // 配置服務器，允許加載 WASM 文件
  server: {
  },
})

