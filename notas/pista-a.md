# Pista A · notas de trabajo

> Se actualiza con cada push. Referencia: PLAN.md §7. Estado al 17/10, 20:00: **todas las tareas de A (A1–A12) están en main**; falta probarlas en vivo con keys.

## Hecho (en main)

| Tarea | Qué | Dónde |
|---|---|---|
| A1 | `npx tsx scripts/probar-ia.ts`: dice qué keys faltan y prueba Claude visión (3 fotos), FLUX y Whisper (iPhone y Android) con las que haya; < USD 0,01 | `scripts/probar-ia.ts` |
| A2, A5, A6 | Prompt y schema de visión; `analizarComida()` con post-proceso por código (catálogo, `otro_<grupo>` + pregunta, confianza baja, máx. 3 preguntas, cajas, gramos, `sinComida`) y el contexto del chico de `obtenerContexto()` (B). **`/api/analizar-comida` real** | `server/ia/vision.ts`, `prompts/vision.ts` |
| A3 | `data/alimentos.json`: 96 alimentos + 6 genéricos `otro_<grupo>`, con los 9 nutrientes de USDA (80 FNDDS, 15 SR Legacy, 7 del equipo: fortificados sin equivalente y genéricos), porciones y alérgenos conservadores. Están los 26 `alimentoId` del dataset sintético | `scripts/usda.ts` (+ `scripts/usda/`) |
| A4 | `generarJSON` / `generarTexto` con Claude (schema propio que conserva los `enum`, validación Zod + 1 reintento, `limiteMs`), respaldo Gemini → Groq; `transcribir` con Whisper en Groq → Workers AI (filtra lo que inventa con silencio); `generarImagen` con FLUX en Workers AI; `estadoIA()` para `/api/salud` | `server/ia/modelo.ts`, `proveedores/`, `voz.ts`, `imagen.ts`, `salud.ts` |
| A7 | `interpretarRelato()`: la cita se comprueba por código; lo no mencionado va a `sinMencion`. **`/api/relato-comida` y `/api/transcribir` reales** | `server/ia/relato.ts`, `prompts/relato.ts` |
| A8 | `extraerPerfil()`: las alergias nunca salen de la IA. **`/api/perfil-inicial` real** | `server/ia/perfil.ts`, `prompts/perfil.ts` |
| A9 | `validarReceta()` por código (alérgenos en ingredientes y en texto, reglas, un solo cambio con `cambios()` de `cadena.ts`, mezclas, gramos, lenguaje prohibido, aporte recalculado) y `generarReceta()` (evidencia → Sonnet 5.5 → validación → 1 reintento → siguiente candidato, corte a los 55 s). **`/api/receta` real** con `armarEvidencia()` y `obtenerPerfil()` de B y `?motor=`; "Más nutritiva" encuentra su candidato aunque no esté en el top 3; el alimento seguro puede ser algo que comió fuera del catálogo si la visión lo vio completo | `server/validacion/receta.ts`, `server/ia/receta.ts`, `candidato.ts`, `prompts/receta.ts` |
| A10 | `imagenPlato()`: prompt en inglés (cenital, separado, porción chica, sin texto ni personas; plato con divisiones si una regla lo pide). **`/api/imagen-plato` real** | `server/ia/imagen-plato.ts` |
| A11 | `eval-vision.ts` (Haiku y Sonnet) y `eval-voz.ts` (`--texto` sin Whisper); 8 fotos CC0 o de dominio público (`fuente: 'internet'`); 40 relatos del dataset sintético (`fuente: 'sintetico'`) | `scripts/eval-*.ts`, `scripts/eval/`, `eval/` |
| A12 | `eval-recetas.ts` (§11.3): 12 casos (Tomás y Lucía con `evidenciaDe()` de B sobre los sintéticos; Bruno, con leche y gluten, inventado y declarado): primera salida del LLM contra la validación y resultado final. Foto de la indicación del nutricionista → `objetivosNutricionista` (unidades por código; **los suplementos nunca se convierten en objetivos**) | `scripts/eval-recetas.ts`, `eval/recetas/`, `server/ia/perfil.ts` |

Tests: 625 en verde, sin llamadas reales (`vite.config.ts` vacía las keys en los tests). Salteados: los guardas de stub de los endpoints que ya son reales, el caso pendiente de las papas y los de integración de B que necesitan base.

## Cómo se usa `server/ia/` (para B y C)

```ts
import { z } from 'zod'
import { generarJSON, generarTexto } from '../server/ia/modelo.js'

const { datos, modelo, ms } = await generarJSON({
  tarea: 'resumen',                  // vision | relato | perfil | resumen | receta → elige el modelo
  sistema: 'Usá solo estos números…',
  partes: [{ tipo: 'texto', texto }],  // o { tipo: 'imagen', base64, mime: 'image/jpeg' }
  schema: z.object({ texto: z.string() }),
  limiteMs: 20_000,                  // opcional: presupuesto total, reintentos incluidos
})
const { texto } = await generarTexto({ tarea: 'resumen', partes: [{ tipo: 'texto', texto: '…' }] })
```

Los errores son `ErrorIA`, que extiende `ErrorNibble` (`server/http.ts`): si el handler está envuelto en `manejar()`, sale solo como `ErrorApi` (`timeout`, `limite_proveedor`, `proveedor_caido`, `audio_no_entendido`…). La causa fina (`sin_clave`, `json_invalido`, `rechazo`…) queda en `detalle.motivo`. Para `/api/salud` (B): `estadoIA()` de `server/ia/salud.ts` devuelve `{ claude, transcripcion, imagen }` como `EstadoServicio`, sin gastar tokens.

## Decisiones

- Modelos: `claude-haiku-5-5` para visión, relato, perfil y resumen; `claude-sonnet-5-5` para la receta. Sin `temperature`. SDK con timeout de 25 s y `maxRetries: 1`; `limiteMs` acota el total de una llamada para no pasar los 60 s de Vercel.
- `effort` dentro de `output_config`: `low` en visión, relato y resumen; `medium` en perfil y receta (la receta, por latencia; si pasa de 55 s en vivo, bajarla a `low`).
- `MODELO_<TAREA>` por env pisa el modelo de una tarea (la eval de visión compara Haiku y Sonnet). Respaldos: `MODELO_GEMINI` (Gemini 3.5 Flash-Lite) y `MODELO_GROQ` (Llama 4 Scout).
- **El SDK 0.135 saca los `enum` del JSON Schema** (`lib/transform-json-schema.mjs` los pasa a la `description`). Por eso `proveedores/claude.ts` arma su propio schema (`schemaClaude`), que conserva `enum` y `const`. En los schemas: `z.enum` restringe la salida; `.min`/`.max` viajan como pista y los valida Zod; `z.record` no se puede usar.
- **Validador de receta sin aflojar**: papas fritas en bastones → bastones de queso al horno da **2 cambios** (ingrediente + cocción frito → horno, por la v4). El test que lo muestra quedó como pendiente (`it.skip` en `server/validacion/receta.test.ts`). El tablero de B ya parte de las papas al horno en bastones. Alérgenos en el texto: ante la duda, se detectan (un falso positivo cuesta un reintento). El alimento seguro fuera del catálogo solo vale si se observó con todos sus atributos.
- Sin el respaldo del lado del servidor para Sonnet (`fallbacks`): para Sonnet 5.5 solo cubre rechazos `cyber` y `frontier_llm`, que no aplican a recetas, y no se puede probar sin keys.
- `sinComida` responde 200 con `sinComida: true` (lo que ya maneja la pantalla Registrar).
- El prompt de visión se itera con la API de Claude, no con AI Studio.

## Falta probar en vivo (nada se corrió contra un proveedor real)

1. `npx tsx scripts/probar-ia.ts` con las keys (A1): visión, FLUX y Whisper con una nota de iPhone y otra de Android.
2. Las evals: `npx tsx scripts/eval-vision.ts`, `eval-voz.ts` (con y sin `--texto`) y `eval-recetas.ts` (< USD 1 en total), o desde Actions → Evals. Las tablas van a la diapositiva y al README.
3. Latencias: visión < 8 s, relato < 8 s, receta < 55 s, imagen < 20 s.
4. Que la API acepte los schemas propios (los `enum` grandes de `alimentoId`), Groq con `json_schema` y Gemini con `responseJsonSchema`.
5. El ciclo completo en el deploy con Mongo: foto → relato → registrar → tablero → receta → imagen.

## Bloqueado

- **No hay `.env.local` ni keys** (Anthropic, Groq, Cloudflare, Mongo). Con las keys, los endpoints de A ya responden de verdad; sin ellas, 502 `proveedor_caido` con `motivo: sin_clave`.
- `alimentos_fdc` en Mongo: `npx tsx scripts/usda.ts --subir` cuando haya `MONGODB_URI` (los CSV se bajan a `data/usda/`).
- Notas de voz reales y fotos del equipo: no hay; las de `eval/` son de internet y relatos sintéticos (declarados).

## Para C: variables en Vercel (proyecto `nibble`)

El proyecto está en la cuenta Hobby de C y la de IgTondo no lo ve (403), así que lo configura C. Producción ya corre el código de A; el 17/10 a las 20:05, `GET /api/salud` decía que faltan **todas**:

| Variable | Para qué | De dónde |
|---|---|---|
| `ANTHROPIC_API_KEY` | Visión, relato, perfil, receta y resumen | console.anthropic.com (con límite de gasto) |
| `GROQ_API_KEY` | Whisper (notas de voz y `/api/transcribir`) | console.groq.com |
| `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` | FLUX (imagen del plato) y Whisper de respaldo | dash.cloudflare.com; token de **usuario** (My Profile → API Tokens, plantilla Workers AI). Con un token de cuenta FLUX anda igual, pero `/api/salud` lo marca como caído |
| `MONGODB_URI` | Todo lo de B (registrar, tablero, perfil, evidencia de la receta) y el contexto de la visión | Integración de MongoDB Atlas del Marketplace, o un cluster Free con 0.0.0.0/0 |
| `MOTOR_GRAFO` | `mongo` mientras Neo4j no esté (hoy vale `neo4j`) | — |
| `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` | Solo si se usa Neo4j | Aura Free |
| `GEMINI_API_KEY` | Opcional: respaldo del LLM | aistudio.google.com |

Pasos: completar `.env.local` (copia de `.env.example`) → `npm run env:vercel` (sube sin imprimir los valores) → `npm run deploy` → `GET /api/salud` tiene que dar `ok: true`. Con el mismo `.env.local`, A corre `npx tsx scripts/probar-ia.ts`, las evals y `npx tsx scripts/usda.ts --subir` (carga `alimentos_fdc`). Para las evals desde Actions, las mismas keys de IA van como secretos del repo.

## Para avisar al grupo

- **B**: la colección `alimentos_fdc` la crea `scripts/usda.ts --subir` (borra y recrea, con índice de texto). `api/salud.ts` puede sumar `estadoIA()`. `nombreIngles`: la visión lo devuelve; buscarlo en `alimentos_fdc` al registrar es de B. El borrador del perfil puede traer reglas con `condiciones: []` (solo texto) y `acepta` con atributos parciales.
- **C**: `fixtures/receta.json` no pasaría el validador: el aceite va en 2 g (mínimo 5) y el segundo candidato (leche chocolatada → yogur de vainilla) son 2 cambios (forma e ingrediente). `/api/relato-comida` responde 400 sin audio ni texto y 422 `audio_no_entendido` si la transcripción viene vacía; solo devuelve respuestas con cita verificada.
- Cambios de contrato (todos aditivos):
  - `contratos:` `nombreIngles?: string` en `ItemDetectado` (fff4e2b): la visión lo devuelve solo cuando un ingrediente cae en `otro_<grupo>`.
  - `contratos:` `faltantes?: Nutriente[]` en `Alimento` (15c30cd): nutrientes sin dato en USDA, que van en 0 (§10.1).
