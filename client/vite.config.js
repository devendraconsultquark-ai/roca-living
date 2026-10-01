import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  // Fixed port so admin and client never swap (Xero sign-in and reset links
  // point at a known address: admin 5174, client 5173).
  server: { port: 5173, strictPort: true },
})
