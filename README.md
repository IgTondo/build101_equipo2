# Nibble

Nibble ayuda a mejorar la alimentación de chicos con autismo y selectividad alimentaria: después de cada comida, el padre sube la foto y cuenta cómo le fue; la app calcula los nutrientes, aprende el perfil del chico en un grafo y propone el paso más chico posible hacia lo que le falta. El plan completo está en [`PLAN.md`](PLAN.md).

> README provisorio (C1). La versión para el jurado, con la tabla real / simulado / pendiente, llega con C11.

## Correrlo

```bash
npm install
cp .env.example .env.local   # completar las keys que tengas; los stubs andan sin ninguna
npm run dev                  # front en http://localhost:5173 y API local en :3001 (Vite le pasa /api por proxy)
```

`npm run dev` no necesita acceso al proyecto de Vercel: `scripts/dev-api.ts` monta cada `api/<nombre>.ts` en `/api/<nombre>`, con el mismo límite de body (4,5 MB). Para probar desde el celular en la misma red, abrí la URL "Network" que imprime Vite.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Front + API local |
| `npm run typecheck` | `tsc` del front (`tsconfig.app.json`) y de api/server/scripts (`tsconfig.json`) |
| `npm test` | Vitest (incluye la guarda de 12 funciones y los stubs) |
| `npm run build` | Build del front (lo que corre Vercel) |
| `npm run fixtures` | Regenera `fixtures/*.json` desde `scripts/generar-fixtures.ts` |
| `npm run sinteticos` | Regenera `data/sinteticos/` (§10.5) |

`/estado` en la app muestra cuáles de los 12 endpoints siguen en stub y cuáles ya son reales.

## Convenciones para las pistas

- **Contratos:** `shared/contratos.ts` (§5). Solo cambios aditivos y avisando en el grupo.
- **Máximo 12 archivos en `api/`** (límite de funciones de Vercel Hobby; hay un test que lo controla). La lógica va en `server/`, nunca en `api/`.
- **ESM en Node:** en `api/`, `server/`, `scripts/` y `test/`, los imports relativos llevan `.js` aunque el archivo sea `.ts` (`import { manejar } from '../server/http.js'`). `npm run typecheck` lo exige.
- **Errores:** toda respuesta que no sea 2xx tiene el cuerpo `ErrorApi`. Usá `manejar()`, `permitir()`, `enviarError()` o tirá `new ErrorNibble(codigo, mensaje)` desde `server/http.ts`; un `ZodError` se convierte solo en `400 entrada_invalida`.
- **Stubs:** cada endpoint arranca devolviendo `fixtures/<nombre>.json` con el header `x-nibble-stub: 1`. Para reemplazarlo, sacá la llamada a `responderStub()` y devolvé lo real con el mismo tipo del contrato; el header desaparece solo.
- **Archivos en runtime:** las funciones pueden leer `fixtures/**/*.json` y `data/**/*.json` con `join(process.cwd(), …)` (`vercel.json` → `includeFiles`).
- **Secretos:** en `.env.local`, nunca en el repo. La app desplegada usa siempre `ANTHROPIC_API_KEY`, nunca la suscripción de Claude (§4.1).

## CI

`.github/workflows/ci.yml` corre typecheck, tests y build en cada push a `main`. `evals.yml` corre las evals a pedido (Actions → Evals). Para usar los runners de Tenki, definí la variable del repo `RUNNER` con su etiqueta; si no está, usa `ubuntu-latest`.
