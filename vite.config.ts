import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo, /api va al servidor local de scripts/dev-api.ts (npm run dev levanta los dos).
const PUERTO_API = Number(process.env.PUERTO_API ?? 3001)

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // para abrirlo desde el celular en la misma red
    proxy: { '/api': `http://localhost:${PUERTO_API}` },
  },
})
