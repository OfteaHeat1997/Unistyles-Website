import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local dev only. In production each service has its own subdomain so
// the frontend hits VITE_API_URL / VITE_DIRECTUS_URL directly (no proxy).
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false
      },
      // Directus REST/items endpoints, used when VITE_DIRECTUS_URL is empty
      // and the dev frontend wants to share the dev server origin.
      '/items': {
        target: DIRECTUS_URL,
        changeOrigin: true,
        secure: false
      },
      '/assets': {
        target: DIRECTUS_URL,
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
