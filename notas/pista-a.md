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
| A1 | `npx tsx scripts/probar-ia.ts`: dice qué keys faltan y prueba Claude visión (3 fotos), FLUX y Whisper (iPhone y Android) con las que haya; < USD 0,01 | `scripts/probar-ia.ts` |
| A9 | `validarReceta()` por código (alérgenos, reglas, un solo cambio, mezclas, gramos, lenguaje prohibido, aporte recalculado) y `generarReceta()` (evidencia → Sonnet 5.5 → validación → 1 reintento → siguiente candidato, con corte por tiempo). **`/api/receta` real** desde e73c9b2, con `armarEvidencia()` y `obtenerPerfil()` de B y `?motor=` | `server/validacion/receta.ts`, `server/ia/receta.ts`, `prompts/receta.ts` |
| A10 | `imagenPlato()`: prompt en inglés (cenital, separado, sin texto ni personas; plato con divisiones si una regla lo pide); **`/api/imagen-plato` real** | `server/ia/imagen-plato.ts` |
| A12 (parte) | Foto de la indicación del nutricionista → `objetivosNutricionista`: se lee en paralelo con el relato; el código convierte unidades (vitamina D: 1 µg = 40 UI), descarta lo fuera de rango y **nunca convierte suplementos en objetivos** | `server/ia/perfil.ts` |
| — | `limiteMs` en `generarJSON`/`generarTexto`: presupuesto total por llamada (reintentos incluidos), para no pasar los 60 s de Vercel; Whisper descarta las frases que inventa con silencio ("Subtítulos realizados por la comunidad de Amara.org"…) | `server/ia/modelo.ts`, `voz.ts` |
| A12 | `eval-recetas.ts` (§11.3): 12 casos (Tomás y Lucía con `evidenciaDe()` de B sobre los sintéticos; Bruno, con leche y gluten, inventado y declarado). Mide la primera salida del LLM contra la validación (alergias, un solo cambio, lenguaje) y el resultado final, más el % que cubre ≥ 20% de lo que falta. "Más nutritiva" encuentra su candidato aunque no esté en el top 3 de la evidencia | `scripts/eval-recetas.ts`, `eval/recetas/`, `server/ia/candidato.ts` |
| A11 | `eval-vision.ts` (Haiku y Sonnet) y `eval-voz.ts` (`--texto` sin Whisper); 8 fotos CC0 o de dominio público (`fuente: 'internet'`); 40 relatos del dataset sintético (`fuente: 'sintetico'`) | `scripts/eval-*.ts`, `scripts/eval/`, `eval/` |
| — | `server/ia/catalogo.ts` (lee `data/alimentos.json`) y `ErrorIA` como `ErrorNibble` | `server/ia/` |

Tests: 434 en verde (6 salteados: los guardas de stub de los endpoints que ya son reales y el caso pendiente de las papas), sin llamadas reales (`vite.config.ts` vacía las keys en los tests).

## En curso (un worktree de Orca y una rama por carril; integra solo el coordinador)

- **receta**: que el punto de partida de la cadena pueda ser una preparación que el chico comió y no está en el catálogo, siempre que la visión la haya visto con todos sus atributos (lo declarado incompleto se sigue descartando: no se afloja el conteo de cambios). Riesgo que cubre: un chico nuevo del modo jurado que termine en `sin_candidatos`.

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
- **El SDK 0.135 saca los `enum` del JSON Schema** (`lib/transform-json-schema.mjs` los pasa a la `description`). Por eso `proveedores/claude.ts` arma su propio schema (`schemaClaude`), que conserva `enum` y `const`. En los schemas: `z.enum` restringe la salida; `.min`/`.max` viajan como pista y los valida Zod; `z.record` no se puede usar.
- **Validador de receta sin aflojar**: papas fritas en bastones → bastones de queso al horno da **2 cambios** (ingrediente + cocción frito → horno, por la v4). El test que lo muestra quedó como pendiente (`it.skip` en `server/validacion/receta.test.ts`). Para la demo: partir de las papas al horno en bastones (como `fixtures/receta.json`), o que B decida en `cadena.ts` que la cocción no cuenta cuando cambia el ingrediente, y se usa ese criterio.
- Sin el respaldo del lado del servidor para Sonnet (`fallbacks`): para Sonnet 5.5 solo cubre rechazos `cyber` y `frontier_llm`, que no aplican a recetas, y no se puede probar sin keys.
- `sinComida` responde 200 con `sinComida: true` (lo que ya maneja la pantalla Registrar).
- El prompt de visión se itera con la API de Claude, no con AI Studio.
- La visión recibe el contexto del chico con `obtenerContexto()` de B (b3f289d); sin chico o sin base, sigue con contexto vacío.

## Bloqueado

- **No hay `.env.local` ni keys** (Anthropic, Groq, Cloudflare, Mongo): nada se probó en vivo. Con las keys, los endpoints de arriba ya responden de verdad; sin ellas, 502 `proveedor_caido` con `motivo: sin_clave`.
- El validador cuenta los cambios con `cambios()` de `cadena.ts` (0bf966c): el tablero y la receta cuentan igual.
- `alimentos_fdc` en Mongo: `npx tsx scripts/usda.ts --subir` cuando haya `MONGODB_URI` (los CSV se bajan a `data/usda/`).
- `nombreIngles`: la visión lo devuelve, pero nadie lo busca todavía en `alimentos_fdc` (es del registro, B).

## Para avisar al grupo

- **B**: los ids de `data/alimentos.json` ya están (y los nutrientes); usalos en `preparaciones.json`. La colección `alimentos_fdc` la crea `scripts/usda.ts --subir` (borra y recrea, con índice de texto): no la creen aparte. `api/salud.ts` puede sumar `estadoIA()`. Para `/api/receta` necesitamos `armarEvidencia(ninoId, nutriente?)` → `Evidencia`; con eso, el handler es de 5 líneas (`generarReceta(req, { armarEvidencia, … })`). `estadoIA()` para `/api/salud`. El borrador del perfil puede traer reglas con `condiciones: []` (solo texto) y `acepta` con atributos parciales.
- **C**: `fixtures/receta.json` no pasaría el validador: el aceite va en 2 g (mínimo 5) y el segundo candidato (leche chocolatada → yogur de vainilla) está declarado como un cambio de `forma`, pero cambian la forma y el ingrediente. Sugerencia: aceite en 5 g y otro segundo candidato.
- **B**: `cadena.ts` tiene que contar los cambios con el mismo criterio que `server/validacion/receta.ts` (`cambiosEntre()`, con un `TODO(B12)` para usar el de B): textura, forma, sabor, temperatura, cocción e ingrediente principal. Si no, el tablero va a sugerir candidatos que la receta descarta. Con ese criterio, leche chocolatada → yogur da 2 cambios.
- **C**: `/api/relato-comida` responde 400 sin audio ni texto y 422 `audio_no_entendido` si la transcripción viene vacía; solo devuelve respuestas con cita verificada y `sinMencion` no se cruza con `respuestas`.
- Cambios de contrato (todos aditivos):
  - `contratos:` `nombreIngles?: string` en `ItemDetectado` (fff4e2b): la visión lo devuelve solo cuando un ingrediente cae en `otro_<grupo>`.
  - `contratos:` `faltantes?: Nutriente[]` en `Alimento` (15c30cd): nutrientes sin dato en USDA, que van en 0 (§10.1).
