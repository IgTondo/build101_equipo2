import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// En desarrollo, /api va al servidor local de scripts/dev-api.ts (npm run dev levanta los dos).
const PUERTO_API = Number(process.env.PUERTO_API ?? 3001)

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // para abrirlo desde el celular en la misma red
    proxy: { '/api': `http://localhost:${PUERTO_API}` },
    watch: { ignored: ['**/.claude/**'] },
  },
  // Los worktrees de los agentes (.claude/worktrees) tienen su propia copia del repo: no son tests de este.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
})
