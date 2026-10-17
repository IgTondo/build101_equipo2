# Pista A · notas de trabajo

> Se actualiza con cada push. Referencia: PLAN.md §7.

## Hecho (en main)

| Tarea | Qué | Dónde |
|---|---|---|
| A3 | `data/alimentos.json`: 96 alimentos + 6 genéricos `otro_<grupo>`, con los 9 nutrientes de USDA (80 FNDDS, 15 SR Legacy, 7 del equipo: fortificados sin equivalente y genéricos), porciones y alérgenos conservadores. Están los 26 `alimentoId` del dataset sintético | `scripts/usda.ts` (+ `scripts/usda/`) |
| A4 | `generarJSON` / `generarTexto` con Claude (`messages.parse` + validación Zod + 1 reintento), respaldo Gemini → Groq; `transcribir` con Whisper en Groq → Workers AI; `generarImagen` con FLUX en Workers AI; `estadoIA()` para `/api/salud` | `server/ia/modelo.ts`, `proveedores/`, `voz.ts`, `imagen.ts`, `salud.ts` |
| A2, A5, A6 | Prompt y schema de visión, `analizarComida()` con post-proceso por código; **`/api/analizar-comida` real** | `server/ia/vision.ts`, `prompts/vision.ts` |
| A7 | `interpretarRelato()`: la cita se comprueba por código; **`/api/relato-comida` y `/api/transcribir` reales** | `server/ia/relato.ts`, `prompts/relato.ts` |
| A8 | `extraerPerfil()`: las alergias nunca salen de la IA; **`/api/perfil-inicial` real** | `server/ia/perfil.ts`, `prompts/perfil.ts` |
| A11 | `eval-vision.ts` (Haiku y Sonnet) y `eval-voz.ts` (`--texto` sin Whisper); 8 fotos CC0 o de dominio público (`fuente: 'internet'`); 40 relatos del dataset sintético (`fuente: 'sintetico'`) | `scripts/eval-*.ts`, `scripts/eval/`, `eval/` |
| — | `server/ia/catalogo.ts` (lee `data/alimentos.json`) y `ErrorIA` como `ErrorNibble` | `server/ia/` |

Tests: 286 en verde, sin llamadas reales (`vite.config.ts` vacía las keys en los tests).

## En curso (un worktree de Orca y una rama por carril; integra solo el coordinador)

- **núcleo**: el JSON Schema que mandamos a Claude tiene que conservar los `enum` (ver Decisiones); falta `scripts/probar-ia.ts` (A1).
- **receta**: `validarReceta()` está en la rama; faltan A9 (`generarReceta`) y A10 (`/api/imagen-plato`).

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

Los errores son `ErrorIA`, que extiende `ErrorNibble` (`server/http.ts`): si el handler está envuelto en `manejar()`, sale solo como `ErrorApi` (`timeout`, `limite_proveedor`, `proveedor_caido`…). La causa fina (`sin_clave`, `json_invalido`, `rechazo`…) queda en `detalle.motivo`. Para `/api/salud` (B): `estadoIA()` de `server/ia/salud.ts` devuelve `{ claude, transcripcion, imagen }` como `EstadoServicio`, sin gastar tokens.

## Decisiones

- Modelos: `claude-haiku-5-5` para visión, relato, perfil y resumen; `claude-sonnet-5-5` para la receta. Sin `temperature`. SDK con timeout de 25 s y `maxRetries: 1`, porque la receta encadena reintentos y la función corta a los 60 s.
- `effort` dentro de `output_config`: `low` en visión, relato y resumen; `medium` en perfil y receta (la receta, por latencia).
- `MODELO_<TAREA>` por env pisa el modelo de una tarea (la eval de visión compara Haiku y Sonnet). Respaldos: `MODELO_GEMINI` (Gemini 3.5 Flash-Lite) y `MODELO_GROQ` (Llama 4 Scout).
- **El SDK 0.135 saca los `enum` del JSON Schema** (`lib/transform-json-schema.mjs` los pasa a la `description`), así que con `zodOutputFormat` el vocabulario no restringe la salida. Lo corrige el núcleo armando el schema a mano; mientras tanto, Zod sigue validando y un valor fuera de vocabulario cuesta el reintento.
- `sinComida` responde 200 con `sinComida: true` (lo que ya maneja la pantalla Registrar).
- El prompt de visión se itera con la API de Claude, no con AI Studio.
- `/api/receta` sigue como stub hasta que B suba `armarEvidencia()`; la lógica queda lista en `server/ia/receta.ts`.

## Bloqueado

- **No hay `.env.local` ni keys** (Anthropic, Groq, Cloudflare, Mongo): nada se probó en vivo. Con las keys, los endpoints de arriba ya responden de verdad; sin ellas, 502 `proveedor_caido` con `motivo: sin_clave`.
- **De B**: `obtenerContexto()` para la visión (hoy, contexto vacío: el enganche es `fijarFuenteContexto()` en `server/ia/vision.ts`), `armarEvidencia()` y `cadena.ts` para la receta, y `data/preparaciones.json` (hasta que esté, se usa `data/sinteticos/preparaciones.json`).
- `alimentos_fdc` en Mongo: `npx tsx scripts/usda.ts --subir` cuando haya `MONGODB_URI` (los CSV se bajan a `data/usda/`).
- `nombreIngles`: la visión lo devuelve, pero nadie lo busca todavía en `alimentos_fdc` (es del registro, B).

## Para avisar al grupo

- **B**: los ids de `data/alimentos.json` ya están (y los nutrientes); usalos en `preparaciones.json`. `estadoIA()` para `/api/salud`. El borrador del perfil puede traer reglas con `condiciones: []` (solo texto) y `acepta` con atributos parciales.
- **C**: `/api/relato-comida` responde 400 sin audio ni texto y 422 `audio_no_entendido` si la transcripción viene vacía; solo devuelve respuestas con cita verificada y `sinMencion` no se cruza con `respuestas`.
- Cambios de contrato (todos aditivos):
  - `contratos:` `nombreIngles?: string` en `ItemDetectado` (fff4e2b): la visión lo devuelve solo cuando un ingrediente cae en `otro_<grupo>`.
  - `contratos:` `faltantes?: Nutriente[]` en `Alimento` (15c30cd): nutrientes sin dato en USDA, que van en 0 (§10.1).
