import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The frontend calls `/api/...`; Vite proxies that to the FastAPI backend so
// there are no CORS headaches during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
