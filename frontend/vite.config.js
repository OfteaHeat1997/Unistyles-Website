import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages',
      '@styles': '/src/styles',
      '@assets': '/src/assets',
      '@config': '/src/config',
      '@stores': '/src/stores',
      '@utils': '/src/utils'
    }
  }
})
