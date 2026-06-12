import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/i18n/locales/')) {
            return 'locales'
          }

          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('react-konva') || id.includes('/konva/')) {
            return 'konva'
          }

          if (id.includes('@supabase')) {
            return 'supabase'
          }

          if (id.includes('@tanstack/react-query')) {
            return 'react-query'
          }

          if (id.includes('i18next')) {
            return 'i18n'
          }

          if (id.includes('react-router')) {
            return 'router'
          }

          if (id.includes('@stripe')) {
            return 'stripe'
          }

          if (id.includes('@dnd-kit')) {
            return 'dnd-kit'
          }

          if (id.includes('/react/') || id.includes('react-dom') || id.includes('scheduler')) {
            return 'react-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
  server: {
    host: true,
  },
})
