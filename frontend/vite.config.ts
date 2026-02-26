import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const additionalAllowedHosts = (env.VITE_DEV_ALLOWED_HOSTS || '')
    .split(',')
    .map(host => host.trim())
    .filter(Boolean)

  return {
    plugins: [
      vue(),
      vueDevTools(),
    ],
    esbuild: {
      drop: ['console', 'debugger'],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: ['localhost', '127.0.0.1', ...additionalAllowedHosts]
    },
    build: {
      // 生产构建优化
      minify: 'terser',
      // 启用源码映射用于调试
      sourcemap: false,
      // 分块策略
      rollupOptions: {
        output: {
          // 使用可读的文件名，方便调试
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          // 手动分块
          manualChunks: {
            'vendor': ['vue', 'vue-router', 'pinia'],
            // Remove explicit UI chunking to avoid potential loading/initialization issues
            // 'ui': ['@radix-icons/vue', 'radix-vue', 'lucide-vue-next']
          }
        }
      },
      // 启用 CSS 代码分割
      cssCodeSplit: true,
      // 构建时的块大小警告限制
      chunkSizeWarningLimit: 500
    }
  }
})
