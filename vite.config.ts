import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

// En desarrollo, /api va al servidor local de scripts/dev-api.ts (npm run dev levanta los dos).
const PUERTO_API = Number(process.env.PUERTO_API ?? 3001)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // "@/" es src/ (los componentes de shadcn/ui viven en src/components/ui).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: true, // para abrirlo desde el celular en la misma red
    proxy: { '/api': `http://localhost:${PUERTO_API}` },
    watch: { ignored: ['**/.claude/**'] },
  },
  // Los worktrees de los agentes (.claude/worktrees) tienen su propia copia del repo: no son tests de este.
  // Las keys de IA quedan vacías en los tests: ningún test llama a un modelo real aunque estén exportadas en la shell.
  test: {
    exclude: [...configDefaults.exclude, '.claude/**'],
    env: { ANTHROPIC_API_KEY: '', GROQ_API_KEY: '', GEMINI_API_KEY: '', CLOUDFLARE_API_TOKEN: '' },
  },
})
