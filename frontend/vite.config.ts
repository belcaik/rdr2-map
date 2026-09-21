import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.WEB_HOST || '127.0.0.1',
    port: Number(process.env.WEB_PORT || 5173),
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
})
