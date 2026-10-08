import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5000',
      // Same-origin socket.io in dev (production gateway proxies this path).
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
})
