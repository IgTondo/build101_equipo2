# Pista B · notas de trabajo

> Grafo y nutrición (PLAN.md §8). Se actualiza con cada push.

## Hecho

| # | Qué | Dónde |
|---|---|---|
| B1–B3 | Mongo (cliente a nivel de módulo, índices) y Neo4j (driver con `disableLosslessIntegers`, constraints). Grafo enchufable: `MOTOR_GRAFO=neo4j\|mongo` (sin la variable: neo4j si hay `NEO4J_URI`) | `server/datos/mongo.ts`, `server/grafo/` |
| B4 | Nutrición por código: objetivos por edad y sexo (MSP 2020 + IOM), gramos × fracción × tabla, rango ±35%, cobertura del día y de la semana, qué falta en el orden del research | `data/objetivos.json`, `server/nutricion/` |
| B5 | Seed del grafo con el catálogo | `scripts/seed-grafo.ts` |
| B6 | `registrarComida()`: primero Mongo (bronze), después el grafo en una transacción. Nutrientes, qué aprendí y alertas | `server/datos/comidas.ts`, `api/registrar-comida.ts` |
| B7 | `/api/nutricion`, `/api/progreso` (frase, semana, energía, evolución, repertorio, grupos, exposiciones, alertas, sugerencias) y `obtenerContexto()` | `server/datos/tablero.ts`, `server/datos/contexto.ts` |
| B8 | `/api/perfil` POST y GET | `server/datos/perfiles.ts`, `api/perfil.ts` |
| B9 | Alertas de §10.4 | `server/nutricion/alertas.ts` |
| B10 | Patrones combinados + "qué aprendí" (y la contradicción de P2: "¿actualizo la regla?") | `server/aprendizaje/patrones.ts`, `aprendi.ts` |
| B11 | 59 preparaciones (las 28 de los sintéticos + 31 puentes y fortificadas) | `data/preparaciones.json` |
| B12 | Propagación, `cadena.ts`, recomendador `grafo`/`base`, las tres sugerencias y `armarEvidencia()` | `server/aprendizaje/`, `server/grafo/evidencia.ts` |
| B13 (P2) | Vista del grafo, reconstrucción desde Mongo, carga de los sintéticos y la curva | `api/perfil.ts?vista=grafo`, `scripts/` |
| B14 | Tests contra el dataset sintético: encuentran las 8 reglas ocultas | `server/aprendizaje/sinteticos.test.ts` |

## Cómo se usa (para A y C)

```ts
// A5 · visión: el catálogo del chico primero, sus reglas y alergias. Si falla, devuelve null.
import { obtenerContexto } from '../server/datos/contexto.js'
const ctx = await obtenerContexto(ninoId) // { nombre, edad, alergias, reglas, preparaciones: [{ id, nombre, estado }], catalogo: [{ id, nombre }] }
// Es compatible con ContextoVision de server/ia/vision.ts; el enganche es una línea (en api/analizar-comida.ts):
fijarFuenteContexto(async (ninoId) => (await obtenerContexto(ninoId)) ?? CONTEXTO_VACIO)

// A9 · receta: el paquete de evidencia (~20 líneas en `texto`, lo único que ve el LLM).
import { armarEvidencia } from '../server/grafo/evidencia.js'
const ev = await armarEvidencia(ninoId, nutriente?, motor?) // Evidencia (§5). Con 0 candidatos, tirar ErrorNibble('sin_candidatos').
// Si llega RecetaReq.preparacionId que no está en ev.candidatos (top 3), está en recomendar(...).candidatos.

// A · validación de la receta: cuántas dimensiones cambian (textura, forma, sabor, temperatura, cocción, ingrediente principal).
import { cambios, esSegura, reglaQueViola } from '../server/aprendizaje/cadena.js'
cambios(desde, receta) // Cambio[]: tiene que dar exactamente [receta.cambio] (o 'fortificar' si es la versión fortificada)

// C8 · resumen: lo mismo que los endpoints, llamado directo (tiran ErrorNibble('no_encontrado') si no existe el chico).
import { obtenerProgreso } from '../server/datos/tablero.js'
import { obtenerPerfil } from '../server/datos/perfiles.js'
const progreso = await obtenerProgreso(ninoId, { dias: 7 })
const perfil = await obtenerPerfil(ninoId)
```

- **Sin `MONGODB_URI`** los endpoints de B responden su fixture con `x-nibble-stub: 1`, para poder desarrollar sin base. El contrato del POST se valida siempre (400 con `entrada_invalida`).
- **`/api/progreso`** acepta además `hasta=YYYY-MM-DD` (fija "hoy", para historiales cargados con fecha pasada).
- **`/api/perfil?ninoId&vista=grafo`** devuelve el subgrafo para C13: `{ motor, nodos: [{ id, tipo, nombre, props }], aristas: [{ desde, hasta, tipo, props }] }`. Va en `/api/perfil` porque Vercel Hobby permite 12 funciones.
- **`ALIMENTOS_ARCHIVO`** apunta a otro catálogo de alimentos. Mientras no esté `data/alimentos.json` (A3) se puede usar `server/datos/prueba/alimentos-prueba.json` (valores aproximados de USDA, solo para desarrollar y testear).

## Scripts

```bash
npx tsx --env-file=.env.local scripts/seed-grafo.ts            # constraints + catálogo (idempotente)
npx tsx --env-file=.env.local scripts/cargar-sinteticos.ts     # sint-tomas y sint-lucia con el flujo real (simulación declarada)
npx tsx --env-file=.env.local scripts/reconstruir-grafo.ts [ninoId] [--motor=neo4j|mongo]
npx tsx scripts/simular-nino.ts [--modo=cadena|prediccion]     # la curva de §11.4 (simulación declarada)
```

Tests que necesitan servicios (se saltean si no se piden): `MONGODB_URI_PRUEBA=mongodb://… npm test` (usa una base propia y la borra) y `NEO4J_PRUEBA=1` + `NEO4J_URI/USERNAME/PASSWORD` (solo toca lo de "prueba-tomas").

## Decisiones (y dónde nos apartamos del plan)

- **Se aprende de cero desde el bronze en cada cálculo** (son milisegundos con menos de 100 comidas). El grafo guarda el silver (ACEPTA / EN_PROCESO / RECHAZA con su puntaje, patrones con sus condiciones) y se puede reconstruir.
- **Cada escritura a Neo4j es una sola consulta** con `CALL () { UNWIND … }` y siempre el mismo texto (se planifica una vez): ~20 ms por comida en caliente. Si el grafo falla o tarda más de 8 s, la comida igual queda en Mongo.
- **Patrones**: también se minan las reglas de una sola condición (las ocultas T2–T5 y L1 lo son); la poda de §8 se aplica a las de 3 contra las de 2. Un patrón con condiciones de contexto (plato, momento, junto a un seguro) solo vale si el efecto aparece dentro de las mismas preparaciones. Se muestran hasta 12 (6 de cada lado) sin redundantes.
- **Orden de los candidatos**: propagación + 0,3·(el patrón a favor más fuerte − el en contra más fuerte) − 0,05·dificultad. El plan suma todas las confianzas, pero los patrones mostrados se pisan entre sí.
- **La versión fortificada** solo cuenta para el nutriente que agrega (≥ 5% del objetivo más que el original): la leche con vitamina D no se sugiere "para el calcio".
- **Lo que el padre dijo que rechaza** queda en `rechaza` hasta que se ofrece por primera vez; desde ahí es una exposición más (y `rechaza` recién después de 10).
- **La semana** se promedia sobre los días con alguna comida registrada: un día sin registro es un dato que falta, no un día sin comer.
- **"Un pasito"** sigue con la misma exposición en curso (1 a 9 veces) aunque haya otro candidato mejor, como pide el research.

## Curva (simulación declarada, 30 corridas × 20 comidas, con los valores de USDA de A3)

| Chico virtual | Modo | grafo | base | azar |
|---|---|---|---|---|
| Tomás | cadena (el producto) | 62% | 62% | 57% |
| Tomás | predicción | 90% | 86% | 56% |
| Lucía | cadena | 36% | 36% | 36% |
| Lucía | predicción | 31% | 35% | 17% |

Los dos modelos le ganan al azar por mucho cuando eligen entre todo el catálogo. El grafo arranca mejor con Tomás porque usa lo que contó el padre y la investigación (83% en la primera comida contra 3% de la base); con Lucía, el patrón de investigación "lo crocante lo acepta" la engaña las primeras comidas (ella es al revés). En modo cadena el catálogo es chico (Lucía tiene 7 candidatos a un cambio): no alcanza para separar los motores. Más preparaciones en el catálogo harían la comparación más justa.

## Respuestas a los avisos de A

- **`armarEvidencia(ninoId, nutriente?)`** ya está en main con esa firma: el handler de `/api/receta` es `generarReceta(req, { armarEvidencia, perfil: obtenerPerfil })`.
- **El criterio de `cadena.ts`** es el mismo que el de `cambiosEntre()` de `server/validacion/receta.ts`: textura, forma, sabor, temperatura, cocción e ingrediente principal (el color no cuenta). Se mantiene la v4, la cocción cuenta: papas fritas → bastones de queso al horno son 2 cambios, por eso el tablero parte de las papas al horno en bastones (1 cambio). Además, si todo coincide pero los ingredientes no son los mismos, cuenta como cambio de ingrediente. Para que no se separen, `validarReceta()` puede usar `cambios()` de `cadena.ts` (el `TODO(B12)`).
- **`alimentos_fdc`**: B ya no le crea índices; solo la lee por `_id`.
- **`data/preparaciones.json`** usa solo ids de `data/alimentos.json` (un test lo controla).

## Pendiente / para avisar
- **C8**: `server/resumen/datos.ts` puede pasar a `obtenerProgreso(ninoId, { dias: 7 })` y `obtenerPerfil(ninoId)`.
- **`nombreIngles`** (aviso de A): cuando un ingrediente cae en `otro_<grupo>`, buscarlo en `alimentos_fdc` al registrar. Falta definir con C cómo confirma el padre que es ese alimento; mientras tanto cuenta con los valores del genérico.
- **Vercel**: `MONGODB_URI` (integración de Marketplace), `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` y, opcional, `MOTOR_GRAFO`. Aura Free en una región cerca de `iad1`, y abrir la consola el domingo antes del pitch (se pausa).
- Los valores de vitamina D, C, B12 y proteína de `data/objetivos.json` son los estándar del IOM; falta confirmarlos en las fichas del NIH ODS como pide §10.1.
