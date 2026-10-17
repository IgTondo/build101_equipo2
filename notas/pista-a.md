# Pista A · notas de trabajo

> Se actualiza con cada push. Referencia: PLAN.md §7.

## Hecho (en main)

- **Firmas de `server/ia/`** (A4): `generarJSON`, `generarTexto` (`modelo.ts`), `generarImagen` (`imagen.ts`), `transcribir` (`voz.ts`) y `ErrorIA` (`errores.ts`). Por ahora tiran `ErrorIA('no_implementado')`; la implementación llega en los próximos commits sin cambiar las firmas.

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

Los errores son `ErrorIA`, que extiende `ErrorNibble` (`server/http.ts`): si el handler está envuelto en `manejar()`, sale solo como `ErrorApi` (`timeout`, `limite_proveedor`, `proveedor_caido`…). La causa fina (`sin_clave`, `json_invalido`, `rechazo`…) queda en `error.motivo` y en `detalle`.

## Decisiones

- Modelos: `claude-haiku-5-5` para visión, relato, perfil y resumen; `claude-sonnet-5-5` para la receta. `effort` dentro de `output_config` (`low` en visión y relato), sin `temperature`. SDK con timeout de 25 s y `maxRetries: 1`.
- El prompt de visión se itera con la API de Claude, no con AI Studio.
- Imports relativos con extensión `.js` (sirve con `moduleResolution` Bundler y NodeNext).

## Bloqueado

- **No hay `.env.local` ni keys** (Anthropic, Groq, Cloudflare, Mongo). Todo se prueba con mocks; A1 queda listo para correr.

## Para avisar al grupo

- `contratos:` `nombreIngles?: string` en `ItemDetectado` (7c7fed0). Aditivo: la visión lo devuelve solo cuando un ingrediente cae en `otro_<grupo>`.
