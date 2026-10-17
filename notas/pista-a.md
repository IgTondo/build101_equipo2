# Pista A · notas de trabajo

> Se actualiza con cada push. Referencia: PLAN.md §7.

## Hecho (en main)

- **Firmas de `server/ia/`** (A4): `generarJSON`, `generarTexto` (`modelo.ts`), `generarImagen` (`imagen.ts`), `transcribir` (`voz.ts`). Por ahora tiran `ErrorIA('no_implementado')`; la implementación llega sin cambiar las firmas.
- **`ErrorIA`** (`errores.ts`) extiende el `ErrorNibble` de C1: dentro de `manejar()` sale solo como `ErrorApi`.
- **`server/ia/catalogo.ts`**: lee `data/alimentos.json` (`alimentos()`, `alimentoPorId()`, `idsAlimentos()`, `idGenerico()`, `esGenerico()`). Lo comparten la visión y la validación de recetas.

## En curso (un worktree de Orca y una rama por carril; integra solo el coordinador)

| Carril | Rama | Tareas |
|---|---|---|
| datos | `IgTondo/pista-a-datos` | A3: ids primero, después USDA → `alimentos.json` + `alimentos_fdc` |
| núcleo | `IgTondo/pista-a-nucleo` | A4 completo (Claude, Gemini/Groq de respaldo, Whisper, FLUX, salud) + A1 |
| visión | `IgTondo/pista-a-vision` | A2, A5, A6 · `/api/analizar-comida` |
| voz | `IgTondo/pista-a-voz` | A7 (`/api/relato-comida`, `/api/transcribir`), después A8 (`/api/perfil-inicial`) |
| receta | `IgTondo/pista-a-receta` | `server/validacion/receta.ts`, A9, A10 (`/api/imagen-plato`) |
| evals | `IgTondo/pista-a-evals` | A11: `eval-vision`, `eval-voz` y el formato de `eval/` |

## Cómo se usa `server/ia/` (para B y C)

```ts
import { z } from 'zod'
import { generarJSON, generarTexto } from '../server/ia/modelo.js'

const { datos, modelo, ms } = await generarJSON({
  tarea: 'resumen',                  // vision | relato | perfil | resumen | receta → elige el modelo
  sistema: 'Usá solo estos números…',
  partes: [{ tipo: 'texto', texto }],  // o { tipo: 'imagen', base64, mime: 'image/jpeg' }
  schema: z.object({ texto: z.string() }),
})
const { texto } = await generarTexto({ tarea: 'resumen', partes: [{ tipo: 'texto', texto: '…' }] })
```

Los errores son `ErrorIA`, que extiende `ErrorNibble` (`server/http.ts`): si el handler está envuelto en `manejar()`, sale solo como `ErrorApi` (`timeout`, `limite_proveedor`, `proveedor_caido`…). La causa fina (`sin_clave`, `json_invalido`, `rechazo`…) queda en `detalle.motivo`.

## Decisiones

- Modelos: `claude-haiku-5-5` para visión, relato, perfil y resumen; `claude-sonnet-5-5` para la receta. Sin `temperature`. SDK con timeout de 25 s y `maxRetries: 1`, porque la receta encadena reintentos y la función corta a los 60 s.
- `effort` dentro de `output_config`: `low` en visión, relato y resumen; `medium` en perfil y receta (la receta, por latencia).
- `MODELO_<TAREA>` por env pisa el modelo de una tarea (la eval de visión compara Haiku y Sonnet).
- El prompt de visión se itera con la API de Claude, no con AI Studio.
- `/api/receta` sigue como stub hasta que B suba `armarEvidencia()`; la lógica queda lista en `server/ia/receta.ts`.

## Bloqueado

- **No hay `.env.local` ni keys** (Anthropic, Groq, Cloudflare, Mongo). Todo se prueba con mocks; A1 (`scripts/probar-ia.ts`) queda listo para correr.
- **De B**: `obtenerContexto()` (visión), `armarEvidencia()` y `cadena.ts` (receta), `data/preparaciones.json`.

## Para avisar al grupo (cambios de contrato, todos aditivos)

- `contratos:` `nombreIngles?: string` en `ItemDetectado` (fff4e2b). La visión lo devuelve solo cuando un ingrediente cae en `otro_<grupo>`.
- `contratos:` `faltantes?: Nutriente[]` en `Alimento` (15c30cd). Nutrientes sin dato en USDA, que van en 0 (§10.1).
