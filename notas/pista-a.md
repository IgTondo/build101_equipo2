# Pista A · notas de trabajo

> Se actualiza con cada push. Referencia: PLAN.md §7. Estado al 17/10, 21:00: **todas las tareas de A (A1–A12) están en main y probadas en vivo** con las keys reales (local), salvo Whisper con notas reales.

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
| A10 | `imagenPlato()`: prompt en inglés (cenital, separado, porción chica, sin texto ni personas; plato con divisiones si una regla lo pide). **`/api/imagen-plato` real**. La imagen la genera **Nano Banana 2.1** (`gemini-nano-banana-2.1`), con FLUX.1 schnell de respaldo | `server/ia/imagen-plato.ts`, `imagen.ts`, `proveedores/nano-banana.ts` |
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
- `effort` dentro de `output_config`: `low` en visión, relato y resumen; `medium` en perfil y receta. **Visión y perfil van con `thinking: disabled`** por latencia (medido en vivo; `CLAUDE_SIN_THINKING` lo pisa); relato y receta piensan.
- `MODELO_<TAREA>` por env pisa el modelo de una tarea (la eval de visión compara Haiku y Sonnet). Respaldos: `MODELO_GEMINI` (Gemini 3.5 Flash-Lite) y `MODELO_GROQ` (Llama 4 Scout).
- **El SDK 0.135 saca los `enum` del JSON Schema** (`lib/transform-json-schema.mjs` los pasa a la `description`). Por eso `proveedores/claude.ts` arma su propio schema (`schemaClaude`), que conserva `enum` y `const`. En los schemas: `z.enum` restringe la salida; `.min`/`.max` viajan como pista y los valida Zod; `z.record` no se puede usar.
- **Validador de receta sin aflojar**: papas fritas en bastones → bastones de queso al horno da **2 cambios** (ingrediente + cocción frito → horno, por la v4). El test que lo muestra quedó como pendiente (`it.skip` en `server/validacion/receta.test.ts`). El tablero de B ya parte de las papas al horno en bastones. Alérgenos en el texto: ante la duda, se detectan (un falso positivo cuesta un reintento). El alimento seguro fuera del catálogo solo vale si se observó con todos sus atributos.
- **Imagen con Nano Banana 2.1** (`gemini-nano-banana-2.1`, API `interactions` de `@google/genai`), 1K cuadrada en JPEG. Cuesta USD 0,0336 por imagen y **no tiene free tier**: la `GEMINI_API_KEY` necesita billing. La primera Nano Banana (`gemini-2.5-flash-image`) se dio de baja el 2/10/2026. FLUX queda de respaldo: entra si Nano Banana falla por cupo, por la key o por error del proveedor (no con timeout), y es el único camino si no hay `GEMINI_API_KEY`. `MODELO_IMAGEN` cambia el modelo (`gemini-3.1-flash-lite-image` es más rápido, al mismo precio). **Probada en vivo el 18/10, con billing: anda, 14,1 s por imagen** y mucho más fiel al prompt que FLUX (bastones de verdad, separado, sin texto). Sin `delivery` en `response_format`: la API lo rechaza con 400. Si la key vuelve al free tier, `/api/salud` no lo detecta (leer la ficha del modelo anda sin billing) y la imagen sale por FLUX.
- **Cupo de Cloudflare:** el free tier de Workers AI (10.000 neuronas por día) se agotó el 18/10 con las pruebas y evals. Mientras tanto, no hay FLUX ni Whisper de respaldo; se renueva solo cada día. Si el jurado va a probar mucho, conviene el plan Workers Paid.
- **Prompt de la imagen fiel a la receta** (18/10). Antes salían papas en **cubos** con "papas al horno en bastones", la tostada con queso sin queso, la milanesa con un tercer alimento inventado y la chocolatada "en el plato" (que FLUX rechazaba como contenido NSFW: 400 sin imagen). Ahora el prompt se arma por código: un catálogo visual escrito a mano (`server/ia/prompts/imagen-plato.ts`, las 57 preparaciones) con la forma exacta ("long thin sticks shaped exactly like French fries, about 8 cm long and 1 cm thick"), el color y la cocción; las bebidas van en vaso y el yogur en bol; la cantidad del nuevo sale de la presentación ("2 bastones", "media tostada", "un pedacito"); lo que no está en el catálogo, de los atributos y de `seMantiene`. Sin LLM en el camino: 0 ms y 0 USD. Con un prompt así, FLUX schnell pasó de cubos a bastones (en `scripts/probar-imagen.ts` están las 5 recetas para comparar).
- **Modelos de imagen en Workers AI** (medido el 18/10, 1024², neuronas por imagen): FLUX.1 schnell, 4 pasos: 2,2 s y ≈ 58 neuronas (8 pasos: 3,1 s, ≈ 96, sin mejora visible); FLUX.2 klein 4B: muy realista, ≈ 104 (27 s en frío); FLUX.2 klein 9B: la mejor (fotográfica, cuenta y forma exactas), 2,6 s pero ≈ 1.364 (USD 0,015): con las 10.000 gratis por día alcanza para ~7; FLUX.2 dev: 15 s y miles de neuronas; Lucid Origin: 4,7 s, ≈ 2.600. **Queda FLUX schnell con 4 pasos**; con el Workers Paid (USD 5 por mes), klein 9B vale la pena. **El cupo gratis es de la cuenta**: si se termina, Workers AI responde 429 con el código 4006 hasta las 00:00 UTC, y `/api/imagen-plato` sale enseguida con `limite_proveedor` y un mensaje de "vuelve mañana".
- Sin el respaldo del lado del servidor para Sonnet (`fallbacks`): para Sonnet 5.5 solo cubre rechazos `cyber` y `frontier_llm`, que no aplican a recetas, y no se puede probar sin keys.
- `sinComida` responde 200 con `sinComida: true` (lo que ya maneja la pantalla Registrar).
- El prompt de visión se itera con la API de Claude, no con AI Studio.

## Probado en vivo (17/10, keys reales, API local contra Atlas en una base aparte `nibble_prueba_a`)

- **A1** (`probar-ia.ts`): visión con Haiku en 1,7–3,0 s por foto y FLUX en 3,5 s; los pings de salud de Claude, Groq y Cloudflare, OK.
- **Ciclo completo** con un chico de prueba (alergia al huevo): relato → `/api/perfil-inicial` → `/api/perfil` → foto → `/api/analizar-comida` (milanesa y papas fritas) → `/api/relato-comida` (papas `todo` y milanesa `probo`, cada una con su cita) → `/api/registrar-comida` ("qué aprendí") → `/api/progreso` (frase y las 3 sugerencias) → `/api/receta` (bastones de queso rebozados **sin huevo**, validada a la primera, 7,5 s) → `/api/imagen-plato` (separado, sin texto, 2,9 s).
- **Evals** (`eval/resultados/`):
  - Visión con 8 fotos: Haiku 15/18 alimentos, 88% de atributos, 4,1 s, 100% en < 8 s; le gana a Sonnet.
  - Voz por texto con 40 relatos sintéticos: 100% de `cuanto` y conducta, 0 inventados, 1,7 s.
  - Recetas con 12 casos: el LLM erró 2 de 13 salidas por alergias, el código las atrapó, 0 inválidas, USD 0,34.
- **`alimentos_fdc`** cargada en Mongo (base `nibble`): 13.694 alimentos con índice de texto.
- **Latencia → sin thinking en visión y perfil** (`f6b309a`). Con el contexto del chico, la visión tardaba 7–10 s pensando y 2,4–3,7 s sin pensar, con la misma precisión. El perfil bajó de 16,7 s a 4–6 s.

## Falta probar en vivo

1. Whisper con notas reales de iPhone (`audio/mp4`) y Android (`audio/webm`): `probar-ia.ts` y `eval-voz.ts` sin `--texto`.
2. El ciclo en producción, cuando C cargue las variables en Vercel.
3. Groq y Gemini como respaldo del LLM (no se forzó la caída de Claude).
4. **Red de la sede**: bloquea la salida al puerto 27017, así que desde ese wifi no conecta Mongo; con el hotspot del celular, sí. Neo4j (7687) seguramente tenga el mismo problema. Vercel no tiene esa restricción.

## Bloqueado

- **Producción sin variables**: las carga C en Vercel (ver abajo). Las keys locales están en `.env.local`, que no se commitea.
- Notas de voz reales y fotos del equipo: no hay; las de `eval/` son de internet y relatos sintéticos (declarados).
- Neo4j: en `.env.local` están `AURA_INSTANCEID`/`AURA_INSTANCENAME`, pero B lee `NEO4J_URI`, `NEO4J_USERNAME` y `NEO4J_PASSWORD`. Hasta que estén, `MOTOR_GRAFO=mongo`.

## Para C: variables en Vercel (proyecto `nibble`)

El proyecto está en la cuenta Hobby de C y la de IgTondo no lo ve (403), así que lo configura C. Producción ya corre el código de A; el 17/10 a las 20:05, `GET /api/salud` decía que faltan **todas**:

| Variable | Para qué | De dónde |
|---|---|---|
| `ANTHROPIC_API_KEY` | Visión, relato, perfil, receta y resumen | console.anthropic.com (con límite de gasto) |
| `GROQ_API_KEY` | Whisper (notas de voz y `/api/transcribir`) | console.groq.com |
| `GEMINI_API_KEY` | **Nano Banana (imagen del plato), con billing activado**; respaldo del LLM | aistudio.google.com |
| `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` | FLUX (respaldo de la imagen) y Whisper de respaldo | dash.cloudflare.com; token de **usuario** (My Profile → API Tokens, plantilla Workers AI). Con un token de cuenta FLUX anda igual, pero `/api/salud` lo marca como caído |
| `MONGODB_URI` | Todo lo de B (registrar, tablero, perfil, evidencia de la receta) y el contexto de la visión | Integración de MongoDB Atlas del Marketplace, o un cluster Free con 0.0.0.0/0 |
| `MOTOR_GRAFO` | `mongo` mientras Neo4j no esté (hoy vale `neo4j`) | — |
| `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` | Solo si se usa Neo4j | Aura Free |

Pasos: completar `.env.local` (copia de `.env.example`) → `npm run env:vercel` (sube sin imprimir los valores) → `npm run deploy` → `GET /api/salud` tiene que dar `ok: true`. Con el mismo `.env.local`, A corre `npx tsx scripts/probar-ia.ts`, las evals y `npx tsx scripts/usda.ts --subir` (carga `alimentos_fdc`). Para las evals desde Actions, las mismas keys de IA van como secretos del repo.

## Para avisar al grupo

- **B**: la colección `alimentos_fdc` la crea `scripts/usda.ts --subir` (borra y recrea, con índice de texto). `api/salud.ts` puede sumar `estadoIA()`. `nombreIngles`: la visión lo devuelve; buscarlo en `alimentos_fdc` al registrar es de B. El borrador del perfil puede traer reglas con `condiciones: []` (solo texto) y `acepta` con atributos parciales.
- **C**: `fixtures/receta.json` no pasaría el validador: el aceite va en 2 g (mínimo 5) y el segundo candidato (leche chocolatada → yogur de vainilla) son 2 cambios (forma e ingrediente). `/api/relato-comida` responde 400 sin audio ni texto y 422 `audio_no_entendido` si la transcripción viene vacía; solo devuelve respuestas con cita verificada.
- Cambios de contrato (todos aditivos):
  - `contratos:` `nombreIngles?: string` en `ItemDetectado` (fff4e2b): la visión lo devuelve solo cuando un ingrediente cae en `otro_<grupo>`.
  - `contratos:` `faltantes?: Nutriente[]` en `Alimento` (15c30cd): nutrientes sin dato en USDA, que van en 0 (§10.1).

## v5.10 · Variedad de las recetas creativas (18/10)

Problema: recetas poco variadas (9 de 12 con queso, 4 de 6 cenas "milanesa de X") y un LLM que ignoraba el foco. Cuatro corridas de `scripts/eval-variedad.ts` (Valentina, 6 cenas y 6 desayunos) en `eval/resultados/variedad-*.md`:

| | 1 · Antes | 2 · Foco y ricos | 3 · + 245 alimentos y afinidades | 4 · + coherencia de grupo |
|---|---|---|---|---|
| Con queso | 75% | 42% | 18% | 40% |
| Principales distintos | 9/12 | 9/12 | 10/12 | 10/10 |
| Combinaciones absurdas | — | 3 | 3 | 0 |
| Sin candidatos | 0 | 0 | 1 | 2 |

Qué cambió:
- **Foco obligatorio** en el primer intento: el schema solo acepta el alimento de partida sorteado y el ingrediente sorteado (`Foco.ingrediente`); el reintento relaja. Lo que ya vio la familia (`anteriores`) llega al conocimiento como `recientes` y no se repite.
- **Ricos** uno por familia, por porción, como máximo 2 por grupo, sin golosinas, rellenos ni condimentos.
- **Catálogo**: de 96 a 239 alimentos curados (más los 6 genéricos), con 18 condimentos para variar el sabor, que no cuentan como lo nuevo.
- **Afinidades** (`data/afinidades.json`, `server/ia/afinidades.ts`): co-ocurrencia en las 57.320 recetas de Ahn et al. 2011 (CC BY 4.0), 2.762 pares entre 150 alimentos, y relación `COMBINA` en el grafo. El ingrediente sorteado tiene que combinar con lo que queda del plato y, al cambiar el principal, ser del mismo grupo o de uno compatible.

Pendiente: (1) si el primer intento falla, sortear otro foco en vez de solo relajar (hoy 2 de 12 terminan en "sin candidatos"); (2) no repetir el alimento de partida de las recetas recientes (la cena de Valentina sale casi siempre de su milanesa). Fuentes evaluadas y descartadas, con licencias: ver el historial (RecipeNLG y Recipe1M+ son no comerciales; BEDCA, Argenfood y la tabla uruguaya no tienen descarga en bloque).
