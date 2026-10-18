# Nibble

**Nibble ayuda a mejorar la alimentación de chicos con autismo y selectividad alimentaria**: que les lleguen los nutrientes que necesitan y que su repertorio crezca de a poco, sin conflicto en la mesa.

Después de cada comida, el padre saca una foto del plato y cuenta en una nota de voz cómo le fue. Nibble reconoce lo que había, calcula los nutrientes con una tabla real (USDA), aprende en un grafo cómo come ese chico y propone **el paso más chico posible** hacia lo que le falta: una receta que parte de algo que ya acepta y cambia una sola cosa (*food chaining*).

> Nibble no te dice qué cocinar a partir de una foto: aprende de cada comida cómo come tu hijo.

El plan completo, con las decisiones y su porqué, está en [`PLAN.md`](PLAN.md). La evidencia clínica que siguen las reglas del motor está en [`Selectividad alimentaria en niños autistas…`](Selectividad%20alimentaria%20en%20ni%C3%B1os%20autistas_%20patrones%2C%20evidencia%20y%20reglas%20de%20dise%C3%B1o%20para%20la%20app.md).

## El ciclo

| Paso | Qué pasa | Quién |
|---|---|---|
| 1. Registrar | Foto del plato + "¿cómo le fue?": por alimento, la **escalera de exposición** (lo apartó → lo dejó en el plato → lo tocó → lo probó → comió un poco, la mitad, todo) y la conducta en la mesa. Por voz o con botones | El padre, en 30 s |
| 2. Entender | Visión: alimentos, porción, gramos, atributos sensoriales (textura, forma, color, sabor, temperatura, cocción, presentación). Voz: transcripción y respuestas por alimento, cada una con su **cita textual** | IA |
| 3. Aprender | La comida entra al grafo del chico: aceptación por preparación, exposiciones, patrones combinados ("lo crocante y separado lo acepta") | Código |
| 4. Mostrar | Tablero "¿está comiendo bien?": cobertura **semanal** de 8 nutrientes, repertorio, grupos que faltan, exposiciones en curso y señales de alerta | Código |
| 5. Actuar | Tres sugerencias (*va a gustarle*, *un pasito*, *más nutritiva*) y la receta de food chaining, validada por código, con la imagen de cómo servirla | Grafo + IA + código |

## Arquitectura

```
Celular (React + Vite) ──► Vercel Functions (api/*, 12) ──► server/
                                                         ├─ ia/          Claude (visión, relato, perfil, receta, resumen) · Whisper (Groq) · FLUX (Workers AI)
                                                         ├─ validacion/  la receta: alergias, un solo cambio, lenguaje (código, nunca IA)
                                                         ├─ datos/       MongoDB Atlas: lo que pasó (cada comida, tal cual)
                                                         ├─ grafo/       Neo4j: lo que sabemos del chico
                                                         ├─ nutricion/   cobertura, objetivos y alertas (funciones puras)
                                                         ├─ aprendizaje/ aceptación, patrones, propagación, food chaining (funciones puras)
                                                         └─ resumen/     el resumen para el nutricionista
```

- **Contratos:** [`shared/contratos.ts`](shared/contratos.ts) es la fuente de verdad entre el front y las funciones.
- **Capas:** bronze (cada comida en Mongo, nunca se reescribe), silver (el grafo y las funciones puras), gold (lo que ve el padre). Silver y gold se recalculan desde el bronze.
- **Motores enchufables:** el grafo vive en Neo4j o en Mongo (`MOTOR_GRAFO`), y el recomendador puede ser `grafo` o `base` (`?motor=` en la API, para comparar; la app no lo muestra).
- **La IA nunca decide lo delicado:** las alergias se cargan a mano y se validan por código; los nutrientes salen de la tabla, no del modelo; los números del resumen los arma el código y el modelo solo los redacta.

## Componentes de IA

| Componente | Modelo | Para qué |
|---|---|---|
| Visión del plato | Claude Haiku 5.5 | Alimentos, gramos, atributos, cajas y preguntas cuando duda |
| Relato | Whisper large-v3-turbo (Groq) + Claude Haiku 5.5 | Nota de voz → respuestas por alimento con su cita; si no lo nombró, no se inventa |
| Perfil inicial (alta por voz) | Whisper + Claude Haiku 5.5 | Un audio del padre → sus datos (cada uno con la frase de la que salió), lo que acepta, lo que rechaza y sus reglas, que el padre confirma; las alergias solo se guardan si el padre las toca |
| Receta | Claude Sonnet 5.5 | Escribe la receta **solo** con los candidatos que le pasa el grafo (~20 líneas de evidencia) |
| Imagen de cómo servir | FLUX.1 schnell (Cloudflare Workers AI) | Ilustración del plato: su alimento seguro y el nuevo, separados |
| Resumen | Claude Haiku 5.5 | Redacta con los números que calculó el código; si menciona un número que no está, se usa la plantilla |

## Real, simulado y pendiente

<!-- Actualizar antes del pitch (§12). -->

| Parte | Estado |
|---|---|
| Visión, preguntas, transcripción y extracción del relato, perfil, receta, imagen, resumen | IA real (Claude, Whisper en Groq, FLUX en Workers AI) |
| Nutrientes | Código + USDA FoodData Central (descarga completa; cada valor muestra su `fdcId`) |
| Grafo, aceptación, exposiciones, patrones, propagación, food chaining, alertas | Código propio + Neo4j y MongoDB |
| Tomás | Caso ficticio, cargado con el flujo real; historial con fechas retroactivas |
| Catálogo semilla de preparaciones | Curado por el equipo (borrador asistido por LLM, revisado a mano) |
| Dataset sintético de Tomás y Lucía (`data/sinteticos/`) | Simulación, para desarrollar y testear el aprendizaje |
| Fixtures (`fixtures/`) | Datos de ejemplo derivados del dataset sintético. Mientras un endpoint responde con fixture, manda el header `x-nibble-stub: 1` y la app muestra "Datos de ejemplo" |
| Foto de lo que quedó en el plato, comunidad, notificaciones, login | Pendiente |

**Alcance declarado:** comidas caseras o comunes en Uruguay, un plato por foto, alimentos del catálogo (los demás se aproximan por grupo y la app pregunta). Relatos en español. **Nibble detecta y deriva; no diagnostica ni trata, y no reemplaza al nutricionista.**

## Calidad

<!-- Completar con las tablas de §11 cuando corran las evals. -->

| Qué | Cómo se mide | Resultado |
|---|---|---|
| Visión | 15–20 fotos etiquetadas (`eval/`), recall y precisión por alimento, atributos, latencia | Pendiente |
| Voz | 5–8 notas reales (iPhone y Android): `cuanto` correcto, ítems inventados (tiene que dar 0) | Pendiente |
| Recetas | 12 recetas: alergias, un solo cambio y lenguaje, sin y con validación por código | Pendiente |
| Aprendizaje | Dataset sintético: los tests tienen que encontrar las reglas ocultas de Tomás y Lucía | Pendiente |

## Correrlo

```bash
npm install
cp .env.example .env.local   # completar las keys que tengas; los stubs andan sin ninguna
npm run dev                  # front en http://localhost:5173 y API local en :3001 (Vite le pasa /api por proxy)
```

`npm run dev` no necesita acceso al proyecto de Vercel: `scripts/dev-api.ts` monta cada `api/<nombre>.ts` en `/api/<nombre>`, con el mismo límite de body (4,5 MB). Para probar desde el celular en la misma red, abrí la URL "Network" que imprime Vite (la cámara y el micrófono piden HTTPS fuera de `localhost`: en el celular, probá sobre el deploy).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Front + API local |
| `npm run typecheck` | `tsc` del front (`tsconfig.app.json`) y de api/server/scripts (`tsconfig.json`) |
| `npm test` | Vitest (incluye la guarda de 12 funciones y los stubs) |
| `npm run build` | Build del front (lo que corre Vercel) |
| `npm run fixtures` | Regenera `fixtures/*.json` desde `scripts/generar-fixtures.ts` |
| `npm run sinteticos` | Regenera `data/sinteticos/` |
| `npm run deploy` | `vercel --prod` (solo el dueño del proyecto) |

En la app, `/estado` muestra cuáles de los 12 endpoints siguen en stub y cuáles ya son reales.

## Convenciones para el equipo

- **Contratos:** `shared/contratos.ts`. Solo cambios aditivos y avisando en el grupo.
- **Máximo 12 archivos en `api/`** (límite de funciones de Vercel Hobby; hay un test que lo controla). La lógica va en `server/`, nunca en `api/`.
- **ESM en Node:** en `api/`, `server/`, `scripts/` y `test/`, los imports relativos llevan `.js` aunque el archivo sea `.ts` (`import { manejar } from '../server/http.js'`). `npm run typecheck` lo exige.
- **Errores:** toda respuesta que no sea 2xx tiene el cuerpo `ErrorApi`. Usá `manejar()`, `permitir()`, `enviarError()` o tirá `new ErrorNibble(codigo, mensaje)` desde `server/http.ts`; un `ZodError` se convierte solo en `400 entrada_invalida`.
- **Stubs:** cada endpoint arranca devolviendo `fixtures/<nombre>.json` con el header `x-nibble-stub: 1`. Para reemplazarlo, sacá la llamada a `responderStub()` y devolvé lo real con el mismo tipo del contrato; el header desaparece solo.
- **Archivos en runtime:** las funciones pueden leer `fixtures/**/*.json` y `data/**/*.json` con `join(process.cwd(), …)` (`vercel.json` → `includeFiles`).
- **Secretos:** en `.env.local`, nunca en el repo. La app desplegada usa siempre `ANTHROPIC_API_KEY`, nunca la suscripción de Claude.
- **Front:** las pantallas viven en `src/pantallas/<pantalla>/`; lo compartido, en `src/lib/` (cliente de la API, vocabulario, grabador de voz, chico activo) y `src/componentes/`.

## CI

`.github/workflows/ci.yml` corre typecheck, tests y build en cada push a `main`. `evals.yml` corre las evals a pedido (Actions → Evals). Para usar los runners de Tenki, definí la variable del repo `RUNNER` con su etiqueta; si no está, usa `ubuntu-latest`.
