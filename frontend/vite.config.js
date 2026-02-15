import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use Docker service names when running in container, localhost otherwise
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Backend API
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false
      },
      // Strapi CMS API
      '/cms': {
        target: STRAPI_URL,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/cms/, '/api')
      },
      // Strapi uploads
      '/uploads': {
        target: STRAPI_URL,
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    target: 'es2015',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'query': ['@tanstack/react-query']
        }
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
