# Plan de implementación · build 101 · Nibble

> v4 · sábado 17/10 · v2 (15:05): reenfocada en el objetivo (mejorar la alimentación del chico) e integrando el research `Selectividad alimentaria en niños autistas… .md`. Reemplaza la v1 de las 14:45. **v3: stack de costo casi cero (§4.1).** **v4 (después de la charla con el mentor): cocción como atributo, cita textual en cada respuesta, capas de datos y motores enchufables (§4.3), tres sugerencias en el tablero y dataset sintético de 2 chicos (§10.5).** **v5 (17/10, noche): alta desde cero por voz (§5.2) y se descarta el modo jurado.** Lo nuevo o cambiado en los contratos lleva `// v2`, `// v3`, `// v4` o `// v5`.
> **Regla de oro:** antes de las 18:15 tiene que andar en el deploy, desde un celular, el ciclo **después de comer: foto + cómo le fue → análisis → grafo → tablero**. Todo lo demás viene después y, si no llega, se declara como pendiente.

---

## 0. TL;DR

**Para qué existe Nibble.** Para **mejorar la alimentación de chicos con autismo y selectividad alimentaria**: que les lleguen los nutrientes que necesitan y que su repertorio crezca de a poco, sin conflicto en la mesa. Todo lo que construimos es un medio para eso.

**Qué no es.** No es "subís la foto de un plato y te devuelve una receta". La foto y el relato del padre **alimentan el perfil del chico**. Las recetas **salen del perfil**, no de una foto.

**Cómo funciona: un ciclo que se repite después de cada comida.**

| Paso | Qué pasa | Quién lo hace |
|---|---|---|
| **1. Registrar** | Después de comer, el padre sube la foto del plato que sirvió y cuenta **cómo le fue**: hasta dónde llegó con cada alimento (lo dejó en el plato, lo tocó, lo probó, comió la mitad…) y cómo estuvo en la mesa. Habla en una **nota de voz** o toca botones | El padre, en 30 segundos |
| **2. Entender** | La visión reconoce alimentos, porción, gramos, atributos sensoriales y distribución en el plato. La voz se transcribe (Whisper) y se convierte en respuestas por alimento. Los nutrientes salen de una **tabla real (USDA)** | IA multimodal y de voz + código para los números |
| **3. Aprender** | La comida entra al **grafo de conocimiento del chico**: aceptación de cada preparación, exposiciones, patrones combinados ("acepta lo crocante si está separado"). El perfil se amplía con cada registro | Código propio sobre Neo4j |
| **4. Mostrar** | **Tablero: ¿está comiendo bien?** Cobertura semanal de nutrientes, calorías aproximadas, evolución, repertorio, grupos que faltan, exposiciones en curso y señales de alerta | Código |
| **5. Actuar** | **Recetas con food chaining**: parten de un alimento que ya acepta, cambian una sola cosa y apuntan al nutriente que más falta. Traen la **imagen de cómo servirlas**. Lo que se sirve se registra con el paso 1 y el ciclo sigue | GraphRAG + LLM + generación de imagen, validado por código |

**Tres pistas en paralelo, cada una dueña de sus carpetas:**

| Pista | Foco | Dueña de |
|---|---|---|
| **A · Percepción e IA** | Todo lo que convierte fotos, voz y texto en JSON, y la evidencia del grafo en recetas e imágenes | visión + preguntas, **voz (transcripción + extracción del relato)**, cliente de modelos (Claude, con respaldo gratis), catálogo de alimentos (USDA completo), perfil inicial con IA, receta (LLM + validación) e imagen, evaluaciones de visión y voz |
| **B · Grafo y nutrición** | El cerebro: guardar, calcular y aprender | MongoDB (eventos) y Neo4j (conocimiento), escritura de comidas, nutrición por código, aceptación y exposiciones, patrones, propagación, candidatos de food chaining, paquete de evidencia, objetivos, **alertas**, catálogo de preparaciones |
| **C · Producto y demo** | Lo que ve el padre y lo que ve el jurado | scaffold y deploy, contratos y fixtures, pantallas (registro **con grabación**, tablero, perfil, receta, resumen), README, pitch y video |

**Cómo no pisarnos:** todos programan contra los **contratos de la sección 5** y contra **fixtures**. Cada endpoint arranca como stub y su dueño lo reemplaza. Commits chicos a `main` cada 30–45 min: el jurado revisa el historial y hoy el repo está vacío.

---

## 1. Objetivo e indicadores (el punto B)

**Objetivo:** que el chico **cubra sus nutrientes clave para la edad** y **amplíe su repertorio**, sin presión en la mesa. No buscamos que coma más, sino que coma bien.

**El tablero contesta una pregunta: ¿está comiendo bien?** Todos los indicadores se calculan con código.

| Indicador | Cómo se calcula | Por qué |
|---|---|---|
| **Cobertura semanal de nutrientes** (principal) | Promedio diario de los últimos 7 días ÷ objetivo por edad y sexo, para 8 nutrientes (la energía va aparte) | Una comida tiene ±35% de error en gramos; la semana compensa. El research pide promediar por semana, no por día |
| **Qué le falta, en orden** | Entre los que están por debajo del 70% de cobertura semanal: vitamina C si casi no hay ninguna fuente (riesgo de escorbuto) → calcio y vitamina D → hierro → fibra → omega-3 → B12 y proteína | Prioridad por gravedad del research. Se ataca uno o dos por vez |
| **Energía aproximada** | kcal por día, como dato | **Sin meta de calorías**: no se le cuentan calorías al chico |
| **Repertorio** | Preparaciones en estado `acepta`, con la tendencia contra la semana anterior | Menos de 10–20 alimentos, o un repertorio que se achica, es señal de alerta |
| **Grupos presentes** | Días desde la última fruta, verdura, lácteo y proteína | Eliminar grupos enteros es señal de alerta |
| **Exposiciones en curso** | Por cada alimento nuevo: escalón al que llegó y cuántas veces se ofreció (la referencia es de 8 a 15) | En terapia de alimentación, cada escalón cuenta como avance |
| **Evolución** | Cobertura semanal de las últimas 4 semanas | Mostrar si mejora |
| **Señales de alerta** | Reglas por código (§10.4) | Derivar al profesional, no tratar |

Arriba de todo, una frase armada con una plantilla, sin LLM: *"Esta semana Tomás cubrió 5 de 8 nutrientes. Lo que más le falta: calcio (48%) y vitamina D (20%). Come 14 preparaciones (1 más que la semana pasada)."*

---

## 2. Alcance por prioridad

| Prior. | Feature | Pista | Listo cuando… |
|---|---|---|---|
| **P0** | Foto → visión → ítems con cajas, gramos, atributos y distribución + preguntas a medida | A (+ C pantalla) | Una foto nueva devuelve JSON válido en < 8 s |
| **P0** | **"¿Cómo le fue?"**: por ítem, la escalera de exposición (7 botones); por comida, la conducta en la mesa | C (+ B) | Se puede contestar todo en menos de 30 s |
| **P0** | Registrar la comida en el grafo + nutrientes con rangos | B (+ C pantalla) | Se crea la Comida y vuelven sus nutrientes |
| **P0** | **Tablero "¿está comiendo bien?"**: frase de resumen, cobertura semanal y del día, energía aproximada, qué le falta | B + C | El tablero cambia después de registrar |
| **P0** | Deploy en Vercel usable desde el celular | C | Anda en iPhone y Android con 3 fotos distintas seguidas |
| **P1 (el primero)** | **Nota de voz**: "contame cómo le fue" → transcripción (Whisper) → la IA marca los botones → el padre confirma | A + C | Una nota de voz nueva completa bien las respuestas, en iPhone y en Android |
| **P1** | (v5) **Alta desde cero por voz** (§5.2): la primera vez, un solo audio con todo lo vital del chico → transcripción → la IA llena los datos y el perfil → "esto entendí" (las alergias se confirman tocándolas) → grafo inicial | A + B + C | Un audio nuevo crea un chico completo, sin formulario previo |
| **P1** | Aprendizaje: aceptación por preparación, exposiciones, patrones combinados + "qué aprendí" | B | Después de registrar aparecen aprendizajes reales |
| **P1** | **Receta con food chaining** (GraphRAG): parte de un alimento seguro, cambia una sola cosa, apunta a lo que falta; validación por código + imagen de cómo servirla | B + A + C | Receta con su porqué (camino del grafo), un solo cambio y alergias 100% respetadas |
| **P1** | Tablero completo: evolución de 4 semanas, repertorio, grupos, exposiciones, **alertas**, tarjeta "próximo paso" | B + C | Con el historial de Tomás se ven todos los bloques |
| **P1** | (v4) **Tres sugerencias**: *va a gustarle* · *un pasito* · *más nutritiva* (§8) | B + C | Con el dataset sintético salen tres distintas, cada una con su porqué |
| **P1** | (v4) Tests de aprendizaje contra el **dataset sintético** (§10.5) | B | Encuentran las reglas ocultas de los 2 chicos |
| **P1** | Resumen para el nutricionista (números por código, texto por LLM) | C | Texto con los números correctos |
| **P1** | Evaluación de visión (15–20 fotos) y de voz (5–8 notas) | A | Tablas con % de acierto para la diapositiva |
| **P1** | README con "real / simulado / pendiente" y alcance declarado | C | Lo puede leer el jurado en la revisión técnica |
| **P2** | Curva del chico simulado (grafo contra base α/β) | B | Gráfica para la diapositiva |
| **P2** | Evaluación de recetas (alergias, un solo cambio y lenguaje, sin y con validación) | A | % antes y después |
| **P2** | Visualización del grafo del chico | C + B | Pantalla, o captura de Neo4j para el pitch |
| **P2** | (v4) Switch `base` / `grafo` en el tablero (§4.3) | C + B | En vivo se ve que las sugerencias cambian |
| **P2** | Contradicciones entre la regla del padre y lo aprendido ("¿actualizo la regla?") | B | Aparece en "qué aprendí" |
| **P2** | Patrones de conducta (mismo algoritmo con la conducta como resultado: "se angustia si hay más de 3 alimentos") | B | Aparece en "qué aprendí" |
| **P2** | Aviso de agotamiento: un alimento seguro servido igual casi todos los días → sugerir rotar la presentación | B | Aparece en el tablero |
| **P2** | Foto de la indicación del nutricionista → objetivos propios; suplementos que ya toma (solo registro) | A + B | Los objetivos se reemplazan |
| **P2** | Foto de lo que quedó en el plato (antes y después) | A | Se compara con lo que dijo el padre |
| **Fuera** | Segmentación propia, comunidad, login, notificaciones, plan semanal, pregunta de fin del día, app nativa, detección de emociones | — | Se declara como pendiente |

---

## 3. Qué cambia en la v2, la v3 y la v4

1. **El objetivo manda.** Nueva §1 con el punto B y sus indicadores. El tablero contesta "¿está comiendo bien?" y usa **la semana** como unidad principal.
2. **Registrar es foto + cómo le fue.** El registro se hace **después de comer**. Por ítem, "¿cuánto comió?" pasa a ser la **escalera de exposición** del research (se agrega `aparto`, y "lo dejó en el plato" cuenta como un escalón). Por comida, la **conducta en la mesa** (nuevo `CONDUCTA`). Las arcadas y el atragantamiento alimentan las alertas.
3. **La voz entra (P1, la primera).** Nota de voz → transcripción → extracción a respuestas estructuradas que el padre confirma. El mismo módulo de transcripción sirve para el relato del perfil inicial. Plan B: el dictado del teclado escribe en el mismo campo y pasa por la misma extracción.
4. **Las recetas son food chaining con las reglas del research:** un solo cambio por vez desde un alimento que ya acepta; primero fortificar lo que ya come; presentación por defecto separada, en porción mínima, al lado de su alimento seguro y con las salsas aparte; nada escondido; nada de lenguaje de presión; "ofrecelo igual de 8 a 15 veces". Reemplaza la regla de la v1 ("al menos 2 atributos compartidos").
5. **Se suma la vitamina C** (hay casos de escorbuto en chicos con TEA). Los objetivos usan la referencia uruguaya (MSP 2020) donde la hay.
6. **"Rechaza" recién después de 10 exposiciones** (el research habla de 8 a 15). Antes queda `en_proceso`.
7. **Patrones de investigación recalibrados:** más peso para textura, mezcla y forma; "que se toquen" y el color quedan como preferencias de cada chico, porque no distinguieron a los chicos con TEA de los demás (Hubbard 2014).
8. **Alertas por código** (§10.4): repertorio chico o que se achica, grupos ausentes, sin fuente de vitamina C, arcadas o atragantamiento, dieta sin gluten ni caseína.
9. **(v3) Stack de costo casi cero** (§4.1): Claude por API (centavos) en lugar de Gemini, Whisper gratis en Groq, imagen gratis con FLUX en Cloudflare, MongoDB Atlas para los eventos y Neo4j para el conocimiento, y los datos completos de USDA descargados (sin API key).

**v4 (17/10, después de la charla con el mentor).** Para el mentor, lo difícil era definir el plato y la reacción antes de programar; casi todo eso ya estaba en el plan. Estos son los cambios:

10. **La cocción pasa a ser un atributo** (`coccion`). Papas fritas, al horno y hervidas dejan de ser "la misma papa", y `cadena.ts` cuenta la cocción como una dimensión más. La textura sigue aparte, porque una papa al horno puede quedar blanda o crocante.
11. **El aprendizaje es por ítem, nunca por plato** (§5.1). Con hamburguesa + papas fritas (rechazo) y milanesa + papas fritas (comió todo), la respuesta de cada alimento ya dice cuál fue el problema, sin tener que inferirlo.
12. **Cada respuesta del relato guarda su cita textual** (`cita`, lo que el mentor llamó *highlight*). Si no hay cita, no hay respuesta: el ítem va a `sinMencion`.
13. **Capas bronze, silver y gold, y motores enchufables** (§4.3). El grafo puede vivir en Neo4j o en Mongo, y el recomendador puede ser `grafo` o `base`, con un switch para la demo. GBrain y Cognee quedan fuera del camino crítico: son memoria para agentes, no el motor del chico. GBrain puede servir como memoria compartida del equipo.
14. **Tres sugerencias en el tablero**: *va a gustarle* (explotar), *un pasito* (explorar de a un cambio) y *más nutritiva* (§8). Nunca se explora con un plato entero nuevo.
15. **Dataset sintético de 2 chicos con reglas ocultas** (§10.5) para desarrollar y testear antes de tener datos reales. Ya encontró un error: la minería de patrones comparaba contra la media global, y un patrón que cubre casi todo lo que come el chico nunca pasaba el umbral. Ahora compara contra la media del resto (§8).

**v5 (17/10, noche).**

16. **Alta desde cero por voz (§5.2).** El primer uso de la app ya no es un formulario: el padre graba un solo audio con todo lo vital del chico (datos, seguridad, lo que come y lo que no, sus reglas), se transcribe con el mismo Whisper y la IA llena los datos básicos y el borrador del perfil, que siembra el grafo inicial. El formulario queda solo para corregir.
17. **Las alergias las escucha la IA, pero las confirma el padre.** Una alergia mencionada aparece marcada como sugerencia y no se guarda hasta que el padre la toca; "no tiene alergias" también se confirma. Sigue valiendo que la validación de recetas usa solo las alergias confirmadas.
18. **Se descarta el modo jurado (C10).** No hay QR ni relato de ejemplo precargado: el jurado ve la demo en vivo. El caso de ejemplo pasa a ser el audio de alta de Tomás (§5.2), que también sirve de eval.

**Se mantiene de la v1:** visión y preguntas en una sola llamada; normalización por enum contra `data/alimentos.json`; catálogo semilla de preparaciones; nutrición calculada en código al registrar; algoritmos como funciones puras; miniatura dentro de la comida en lugar de Storage (ahora en el documento de Mongo); repo público; Tomás con una alergia (huevo) para que la validación filtre algo en vivo.

---

## 4. Arquitectura y repo

### 4.1 Stack y costos (v3)

**Regla:** costo casi cero. Todo corre en planes gratuitos, salvo los modelos de Claude, que cuestan centavos. **Decidido (17/10): Claude por API, con los USD 200 de créditos que el equipo ya tiene cargados.** Igual conviene poner un límite de gasto en la consola. Los free tiers quedan como respaldo.

| Pieza | Qué usamos | Costo | Plan B |
|---|---|---|---|
| Front + API | **Vercel Hobby**: el front (React) y las funciones `api/*` salen del mismo repo, y cada push a `main` despliega solo. Las funciones **son** el backend: no hace falta otro servidor | 0 | Un único dueño hace `vercel --prod` |
| Eventos y documentos | **MongoDB Atlas Free** (512 MB), conectado con la integración de Vercel Marketplace, que crea `MONGODB_URI` y habilita el acceso desde Vercel | 0 | — |
| Conocimiento del chico | **Neo4j Aura Free** | 0 | Colecciones `nodos` y `relaciones` en Mongo, con la misma interfaz |
| Visión, relato, perfil, resumen | **Claude Haiku 5.5** por API (`claude-haiku-5-5`: USD 0,10 por millón de tokens de entrada y 0,50 de salida) | ≈ USD 0,001 por foto | Gemini Flash-Lite o Llama 4 Scout en Groq, los dos en free tier |
| Receta (razonamiento) | **Claude Sonnet 5.5** (`claude-sonnet-5-5`: USD 2 y 10) | ≈ USD 0,03 por receta | Claude Opus 5.5 (≈ USD 0,05) si la eval muestra que vale la pena; Haiku 5.5 para ahorrar |
| Transcripción | **Whisper large-v3-turbo en Groq**, free tier (unos 2.000 pedidos y 28.800 s de audio por día, según fuentes secundarias: mirarlo en la consola) | 0 | Whisper turbo en **Cloudflare Workers AI** (10.000 neuronas gratis por día ≈ 3,5 h de audio) → faster-whisper propio en un sandbox de **Tenki** → dictado del teclado |
| Imagen de cómo servir | **FLUX.1 schnell en Cloudflare Workers AI**, dentro de las neuronas gratis | 0 | Nano Banana con billing (según reportes, la generación de imágenes no entra en el free tier de Gemini) |
| Nutrientes | **USDA FoodData Central descargado completo** (CSV, dominio público): Foundation, SR Legacy y FNDDS 2021–2023 | 0 | — |
| CI, evals y agentes | **Tenki** (USD 250): runners de GitHub Actions para tests y evals, y sandboxes para los agentes del equipo | De los créditos | GitHub Actions comunes |
| Desarrollo | **Suscripción de Claude** (Claude Code) para programar, armar catálogos y etiquetar la eval | Ya paga | — |

**Total estimado del fin de semana:** USD 0 de infraestructura y unos USD 5 de Claude (500 registros + 100 recetas + evals), muy por debajo de los USD 200 de créditos. Con los free tiers como principal también se puede hacer en USD 0, pero con menos calidad y con el riesgo de quedarse sin cupo cuando el jurado pruebe a la vez.

**Por qué no usar la suscripción de Claude como API.** La documentación del Agent SDK dice que, salvo aprobación previa, Anthropic no permite que terceros ofrezcan el login de claude.ai o sus límites de uso en sus productos, incluidos los agentes hechos con el SDK, y pide usar API key. La app que prueba el jurado es un producto nuestro: alimentarla con la suscripción (por `claude -p` o el Agent SDK) incumple esa regla y arriesga la cuenta en pleno pitch. Además, cada llamada levanta el binario de Claude Code (segundos de más) y comparte límites con el trabajo del equipo. **La suscripción es para desarrollar; la app usa una API key.**

**Por qué Mongo y Neo4j juntos.** Mongo guarda **lo que pasó**: cada comida es un documento con la foto chica, el análisis, el relato y los nutrientes ya calculados. Neo4j guarda **lo que sabemos** del chico (preparaciones, atributos, aceptación, patrones, reglas) y responde las consultas de food chaining. El tablero suma documentos de Mongo; las recetas recorren el grafo. Si Neo4j se cae, el grafo se reconstruye desde Mongo con `scripts/reconstruir-grafo.ts`.

**Tenki, en concreto.** Los sandboxes son VMs Linux completas, cobradas por segundo (la más chica, 2 vCPU y 4 GiB, sale ≈ USD 0,17 por hora), y pueden exponer puertos. Con USD 250 alcanza para: (1) runners de CI que corren los tests en cada push y las evals a pedido (`workflow_dispatch`), lo que además deja evidencia de calidad en el historial que revisa el jurado; (2) sandboxes donde corran los agentes de Claude Code de cada pista; y (3) el plan C de transcripción, un servidor de faster-whisper (`small` en int8, sobre CPU). No encontramos que ofrezca GPU, así que no sirve para correr un modelo de visión propio.

### 4.2 Flujo

```
Celular (React + Vite, en Vercel)
  │ foto a 1024 px + miniatura de 200 px + chequeo de foto movida · nota de voz (MediaRecorder, máx. 90 s)
  ▼
/api/analizar-comida (A) ──► Claude Haiku 5.5 (visión): ítems, gramos, atributos, distribución, cajas, preguntas
  │                         contexto del chico ◄── obtenerContexto() (B)
  ▼
UI "¿Cómo le fue?" (C): confirmar ítems → nota de voz o botones → conducta
  │   /api/relato-comida (A) ──► Whisper (Groq) ──► Claude Haiku 5.5: respuestas por ítem, motivos, conducta
  │                                └─ vuelve con los botones marcados; el padre corrige y confirma
  ▼
/api/registrar-comida (B) ──► Mongo: documento de la comida ──► Neo4j: Preparaciones, Atributos, Contexto, aceptación
  ├─► nutrición (código + data/alimentos.json) ─► cobertura del día y de la semana vs. data/objetivos.json
  ├─► aprendizaje (código): aceptación · exposiciones · α/β · patrones combinados ─► "qué aprendí"
  └─► alertas (código) ─► "conviene consultar a un profesional"
        ▼
Tablero (C) ◄── /api/progreso (B): frase, cobertura semanal, energía, evolución, repertorio, grupos, exposiciones, alertas, próximo paso
        ▼
/api/receta (A) ◄── armarEvidencia() (B): lo que falta → candidatos a UN cambio de un alimento seguro → propagación + patrones → ~20 líneas
  ├─► Claude Sonnet 5.5: receta en JSON, solo con esos candidatos ─► validación por código (A) ─► nutrientes (B)
  └─► /api/imagen-plato (A) ─► FLUX en Workers AI: cómo servirla (su alimento seguro y el nuevo, separados)
/api/resumen (C) ◄── progreso + perfil (B) ─► Claude Haiku 5.5 escribe usando solo los números que recibe
```

```
/                               dueño
├─ api/                         handlers finitos: validan la entrada, llaman a server/, devuelven JSON
│  ├─ analizar-comida.ts        A
│  ├─ relato-comida.ts          A   v2 · audio o texto + análisis → respuestas sugeridas
│  ├─ transcribir.ts            A   v2 · audio → texto (lo usa el perfil inicial)
│  ├─ perfil-inicial.ts         A   texto (+ foto de indicación) → PerfilBorrador · v5: sin datos, los extrae del relato (§5.2)
│  ├─ receta.ts                 A
│  ├─ imagen-plato.ts           A
│  ├─ perfil.ts                 B   POST crea el chico desde el borrador · GET devuelve el Perfil
│  ├─ registrar-comida.ts       B
│  ├─ nutricion.ts              B   ?ninoId&dia=YYYY-MM-DD
│  ├─ progreso.ts               B   ?ninoId&dias=28
│  ├─ salud.ts                  B   ping a Mongo, Neo4j, Claude y transcripción
│  └─ resumen.ts                C
├─ server/
│  ├─ ia/                       A   modelo.ts (generarJSON / generarTexto), imagen.ts (generarImagen), voz.ts (transcribir), prompts/
│  ├─ validacion/               A   receta.ts (alergias, reglas, un solo cambio, lenguaje)
│  ├─ datos/                    B   mongo.ts, comidas.ts, alimentos.ts (MongoDB)
│  ├─ grafo/                    B   cliente.ts, escritura.ts, consultas.ts, evidencia.ts (Neo4j)
│  ├─ nutricion/                B   calcular.ts, objetivos.ts, alertas.ts                (puras)
│  └─ aprendizaje/              B   aceptacion.ts, patrones.ts, propagacion.ts, cadena.ts, recomendador.ts (v4: grafo | base) (puras)
├─ shared/contratos.ts          C lo crea · todos lo leen · cambios solo aditivos y avisando
├─ data/                        alimentos.json (A) · preparaciones.json (B) · objetivos.json (B) · patrones-investigacion.json (B) · sinteticos/ (v4, §10.5: lo genera un script) · usda/ (CSV descargados, en .gitignore)
├─ fixtures/                    C   un JSON de ejemplo por endpoint (incluye relato-comida)
├─ scripts/                     usda.ts, eval-vision.ts, eval-voz.ts, eval-recetas.ts (A) · seed-grafo.ts, reconstruir-grafo.ts, simular-nino.ts (B) · generar-sinteticos.mjs (v4, ya está)
├─ eval/                        fotos/ + etiquetas.json · voz/ + relatos.json (A)
├─ .github/workflows/           C   tests en cada push y evals a pedido, en runners de Tenki
├─ src/                         C
└─ README.md                    C
```

**Config.** `vercel.json` con `maxDuration: 60` para `api/*` (Hobby permite hasta 300 s). El body máximo es 4,5 MB: una foto a 1024 px pesa ~200 KB y 90 s de audio (AAC u Opus) entre 0,7 y 1,5 MB, que en base64 entran. Variables: `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` (Workers AI), `MONGODB_URI` (la crea la integración de Vercel), `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` y, opcional, `GEMINI_API_KEY` para el respaldo. `PROVEEDOR_IA=claude|gemini|groq` cambia el modelo sin tocar código, y `MOTOR_GRAFO=neo4j|mongo` cambia dónde vive el grafo (v4, §4.3). El cliente de Mongo y el driver de Neo4j se crean a nivel de módulo, para reusar la conexión entre invocaciones. USDA ya no necesita key: los datos se descargan.

### 4.3 Capas de datos y motores enchufables (v4)

El mentor pidió definir primero **cómo se consume** la información, porque eso define la estructura. Nosotros la consumimos de dos formas: el **tablero** (¿está comiendo bien?) y las **sugerencias de la próxima comida**. Para llegar ahí, los datos pasan por tres capas (la arquitectura *medallion*):

| Capa | Qué guarda | Dónde | Tareas |
|---|---|---|---|
| **Bronze**: lo que pasó | Cada comida tal cual llegó: análisis de la IA, respuestas por ítem con su cita, conducta, relato | Mongo `comidas` | B6 |
| **Silver**: lo que sabemos | Observaciones por ítem, aceptación por preparación, α/β por atributo, patrones, exposiciones | Neo4j (o Mongo) + funciones puras | B6, B10, B12 |
| **Gold**: lo que ve el padre | Cobertura, frase, alertas, sugerencias, receta | `/api/progreso`, `/api/receta` | B7, B12, A9 |

**Regla:** el bronze nunca se reescribe. Silver y gold se pueden recalcular de cero desde el bronze (`scripts/reconstruir-grafo.ts`), así que cambiar de motor no hace perder nada.

**Motores enchufables.** Dos interfaces que el resto del código usa sin saber qué hay detrás:
- **Almacén del grafo** (`server/grafo/`): `neo4j` o `mongo`, según `MOTOR_GRAFO`. Ya era el plan B de §13; ahora es explícito.
- **Recomendador** (`server/aprendizaje/recomendador.ts`): `recomendar(observaciones, perfil, catalogo, nutriente) → { candidatos, sugerencias }`. Tiene dos implementaciones: `grafo` (patrones + propagación, la de producción) y `base` (α/β por atributo, la misma base de la curva de §11.4). Se elige con `?motor=base|grafo` en `/api/progreso` y `/api/receta`; por defecto, `grafo`. En la demo, un switch en el tablero (C14) muestra en vivo la diferencia.
- **GBrain y Cognee: fuera del camino crítico.** Los dos son memoria para agentes: guardan conocimiento como texto, arman un grafo de relaciones y lo consultan con búsqueda semántica. Lo que Nibble necesita es otra cosa: aristas con datos (`o`, `cuanto`, escalón) y cálculos exactos sobre ellas (aceptación, patrones, propagación). Eso lo resuelve nuestro código, que es además lo que se puede medir en la curva.
  - **GBrain** ([gbrain.io](https://gbrain.io/), de Garry Tan, licencia MIT): páginas Markdown con tipo (persona, empresa…), un grafo armado con los links `[[...]]` entre páginas y búsqueda híbrida (vectores + palabras clave) sobre PGLite o Postgres. Corre como servidor propio en Bun y se usa por MCP o por la línea de comandos; no tiene API REST ni SDK. **Para el producto no conviene:** necesita un servidor siempre prendido fuera de Vercel, y sus relaciones salen de links entre páginas, así que no están pensadas para guardar en la arista cuánto comió ni en qué escalón quedó. **Donde sí sirve es en el equipo**, que es para lo que está hecho: una memoria compartida con `PLAN.md`, el research y las decisiones, a la que se conectan por MCP los Claude Code de cada pista. Es opcional, porque el plan en el repo ya cumple ese papel.
  - **Cognee:** el mentor lo dijo claro: sirve para millones de nodos y recorridos exhaustivos, y un chico tiene cientos de observaciones.
  - **Si alguien los quiere probar, después del CP2:** entran por las mismas interfaces, como un tercer `MOTOR_GRAFO` o en lugar de `armarEvidencia()` para buscar evidencia (por ejemplo, que la receta cite el research). Se sirven desde un sandbox de Tenki (`gbrain serve --http`) y se prueban contra el dataset sintético (§10.5). Para el pitch alcanza con decir que la arquitectura permite enchufarlos.

---

## 5. Contratos (`shared/contratos.ts`)

> Se congelan en el CP0 (15:30). Después, solo cambios aditivos (campos opcionales nuevos). Si hay que romper algo, se avisa en el grupo antes de pushear.

```ts
// ---------- Vocabulario cerrado ----------
export const TEXTURA = ['crocante', 'blando', 'cremoso', 'masticable', 'jugoso', 'mixto'] as const
export const FORMA = ['baston', 'redondo', 'plano', 'trozos', 'pure', 'granos', 'entero'] as const
export const COLOR = ['blanco', 'beige', 'amarillo', 'naranja', 'rojo', 'verde', 'marron', 'mixto'] as const
export const SABOR = ['salado', 'dulce', 'acido', 'neutro'] as const
export const TEMPERATURA = ['frio', 'tibio', 'caliente'] as const
export const PRESENTACION = ['separado', 'mezclado', 'con_salsa'] as const
export const COCCION = ['frito', 'horno', 'hervido', 'plancha', 'crudo', 'listo'] as const // v4 · 'listo' = se come como viene (yogur, pan, galletitas)
export const GRUPO = ['cereal_almidon', 'proteina', 'verdura', 'fruta', 'lacteo', 'otro'] as const
export const DISTRIBUCION = ['separados', 'tocandose', 'mezclados'] as const
export const PLATO = ['hondo', 'playo', 'con_divisiones', 'otro'] as const
export const MOMENTO = ['desayuno', 'almuerzo', 'merienda', 'cena', 'colacion'] as const
export const NUTRIENTE = ['energia_kcal', 'proteina_g', 'calcio_mg', 'vitamina_d_ug', 'hierro_mg', 'fibra_g', 'omega3_g', 'b12_ug', 'vitamina_c_mg'] as const // v2: + vitamina_c_mg
export const ALERGENO = ['leche', 'huevo', 'gluten', 'mani', 'frutos_secos', 'soja', 'pescado', 'mariscos', 'sesamo'] as const
export const CUANTO = ['todo', 'mitad', 'poco', 'probo', 'toco', 'nada', 'aparto'] as const // v2: + aparto · es la escalera de exposición (tabla abajo)
export const PORCION = ['chica', 'mediana', 'grande'] as const
export const CONDUCTA = ['tranquilo', 'se_levanto', 'angustia', 'pidio_otra_cosa', 'arcadas', 'atragantamiento'] as const // v2
export const MOTIVO = ['textura', 'sabor_olor', 'mezcla', 'marca', 'forma', 'color', 'temperatura', 'se_tocaban', 'cantidad', 'otro'] as const // v2 · perfil y relato
export const CAMBIO = ['fortificar', 'coccion', 'forma', 'sabor', 'ingrediente', 'temperatura', 'textura'] as const // v2 · de menor a mayor dificultad · v4: + coccion (nuggets fritos → al horno)
export const DIETA = ['ninguna', 'sin_gluten_caseina', 'otra'] as const // v2

type De<T extends readonly string[]> = T[number]
export type Textura = De<typeof TEXTURA>
export type Forma = De<typeof FORMA>
export type Color = De<typeof COLOR>
export type Sabor = De<typeof SABOR>
export type Temperatura = De<typeof TEMPERATURA>
export type Presentacion = De<typeof PRESENTACION>
export type Coccion = De<typeof COCCION>     // v4
export type Grupo = De<typeof GRUPO>
export type Distribucion = De<typeof DISTRIBUCION>
export type Plato = De<typeof PLATO>
export type Momento = De<typeof MOMENTO>
export type Nutriente = De<typeof NUTRIENTE>
export type Alergeno = De<typeof ALERGENO>
export type Cuanto = De<typeof CUANTO>
export type Porcion = De<typeof PORCION>
export type Conducta = De<typeof CONDUCTA>   // v2
export type Motivo = De<typeof MOTIVO>       // v2
export type Cambio = De<typeof CAMBIO>       // v2
export type Dieta = De<typeof DIETA>         // v2
export type Nutrientes = Record<Nutriente, number>

export interface Atributos {
  textura: Textura; forma: Forma; color: Color; sabor: Sabor
  temperatura: Temperatura; presentacion: Presentacion; grupo: Grupo
  coccion?: Coccion                      // v4 · opcional para no romper el contrato; la visión lo devuelve siempre
}
export type Caja = [number, number, number, number] // [ymin, xmin, ymax, xmax] de 0 a 1000 (si con Claude salen corridas, la UI muestra solo las etiquetas)

// ---------- Datos ----------
export interface Alimento {              // data/alimentos.json (curado) · colección alimentos_fdc en Mongo (completa)
  id: string; nombre: string; alias: string[]; fdcId: number | null; grupo: Grupo
  por100g: Nutrientes; alergenos: Alergeno[]; porcionMedianaG: number
  fuente: 'USDA' | 'TCAU' | 'equipo'     // v2 · se muestra al usuario
  dataset?: 'foundation' | 'sr_legacy' | 'fndds'           // v3
  porciones?: { descripcion: string; gramos: number }[]    // v3 · pesos reales por unidad ("1 nugget = 16 g"), de FNDDS o SR Legacy
}
export interface PreparacionCatalogo {   // data/preparaciones.json · catálogo semilla curado
  id: string; nombre: string; atributos: Atributos
  ingredientes: { alimentoId: string; gramos: number }[]   // por porción; el de más gramos es el ingrediente principal
  fortificadaDe?: string                 // v2 · id de la preparación de la que es versión fortificada (yogur → yogur con vitamina D)
}

// ---------- POST /api/analizar-comida (A) ----------
export interface AnalizarComidaReq { ninoId: string; imagenBase64: string; mime: 'image/jpeg'; comentario?: string }
export interface ItemDetectado {
  idTmp: string
  preparacion: string                    // "papas fritas en bastones"
  preparacionId: string | null           // si coincide con una conocida del chico o del catálogo
  ingredientes: { alimentoId: string; gramosEst: number }[]
  conteo?: { cantidad: number; unidad: string }   // v3 · "6 nuggets": si la unidad está en `porciones`, el código usa ese peso real
  porcion: Porcion
  atributos: Atributos
  caja: Caja | null
  confianza: number                      // de 0 a 1
}
export interface Pregunta {
  id: string; texto: string; opciones: string[]
  itemIdTmp?: string; caja?: Caja; origen: 'duda' | 'regla' | 'contexto'
}
export interface AnalisisComida {
  analisisId: string
  sinComida: boolean
  items: ItemDetectado[]
  distribucion: { estado: Distribucion; cantidadItems: number; plato: Plato }
  preguntas: Pregunta[]                  // máx. 3, de la IA. El "¿cómo le fue?" por ítem lo arma la UI.
  modelo: string; ms: number
}

// ---------- POST /api/relato-comida (A) · v2 ----------
export interface RelatoComidaReq {
  ninoId: string
  analisis: AnalisisComida               // para conocer los ítems (idTmp) y las preguntas
  audioBase64?: string; mime?: string    // 'audio/mp4' (iPhone) o 'audio/webm' (Android)
  texto?: string                         // plan B: dictado del teclado o texto escrito
}
export interface RelatoComida {
  transcripcion: string
  respuestas: { itemIdTmp: string; cuanto: Cuanto; porcion?: Porcion; motivo?: Motivo; confianza: number
    cita?: string                        // v4 · el fragmento textual de la transcripción que la justifica; sin cita, el ítem va a sinMencion
  }[]
  respuestasPreguntas: { preguntaId: string; respuesta: string }[]
  conducta: Conducta[]
  comentario: string                     // una línea neutra para el registro
  sinMencion: string[]                   // idTmp de los ítems de los que no dijo nada: la UI los deja sin marcar
  ms: number
}
// POST /api/transcribir (A) · v2 · { audioBase64, mime, pista?: string } → { texto, ms } · lo usa el perfil inicial

// ---------- POST /api/registrar-comida (B) ----------
export interface RegistrarComidaReq {
  ninoId: string
  dia: string                            // 'YYYY-MM-DD' en hora de Uruguay; lo calcula el cliente (Vercel corre en UTC)
  fechaISO: string                       // permite cargar historial con fecha pasada (se declara)
  momento: Momento
  thumbBase64?: string
  comentario?: string
  analisis: AnalisisComida               // ya corregido por el padre (ítems borrados o renombrados)
  respuestas: { itemIdTmp: string; cuanto: Cuanto; porcion: Porcion; motivo?: Motivo; cita?: string }[]  // v2: + motivo · v4: + cita (se guarda en el bronze)
  respuestasPreguntas: { preguntaId: string; respuesta: string }[]
  conducta: Conducta[]                   // v2
  relato?: { transcripcion: string; fuente: 'voz' | 'texto' }   // v2
}
export interface Rango { valor: Nutrientes; min: Nutrientes; max: Nutrientes }
export interface Aprendizaje {
  tipo: 'aceptacion' | 'exposicion' | 'patron_nuevo' | 'patron_reforzado' | 'patron_borrado' | 'contradiccion'
  texto: string
}
export interface Alerta {                // v2 · reglas en server/nutricion/alertas.ts (§10.4)
  tipo: 'repertorio_chico' | 'repertorio_baja' | 'grupo_ausente' | 'sin_vitamina_c' | 'arcadas' | 'atragantamiento' | 'dieta_eliminacion' | 'declarada'
  texto: string
}
export interface RegistrarComidaRes {
  comidaId: string; nutrientesComida: Rango; dia: CoberturaDia; aprendi: Aprendizaje[]
  alertas: Alerta[]                      // v2 · las que disparó esta comida
}

// ---------- GET /api/nutricion · GET /api/progreso (B) ----------
export interface ComidaResumen {
  id: string; fechaISO: string; momento: Momento; thumbBase64?: string
  items: { nombre: string; cuanto: Cuanto }[]
  conducta?: Conducta[]                  // v2
}
export interface CoberturaDia {
  dia: string; consumido: Rango; objetivo: Nutrientes
  cobertura: Nutrientes                  // consumido / objetivo (puede pasar de 1)
  faltan: Nutriente[]                    // de menor a mayor cobertura, sin energía
  comidas: ComidaResumen[]
}
export interface PatronVista {
  texto: string; resultado: 'acepta' | 'rechaza'; apoyo: number; confianza: number
  fuente: 'aprendido' | 'investigacion'
}
export interface Progreso {
  dias: CoberturaDia[]
  semana: { cobertura: Nutrientes; faltan: Nutriente[]; energiaPromedioKcal: number } // v2: + energía; faltan en el orden de prioridad de §1
  aceptadas: number; enProceso: number; patrones: PatronVista[]
  frase: string                                              // v2 · "Esta semana cubrió 5 de 8…" (plantilla)
  semanas: { desde: string; cobertura: Nutrientes }[]        // v2 · evolución, últimas 4
  repertorioTendencia: number                                // v2 · aceptadas ahora − hace 7 días
  grupos: { grupo: Grupo; diasSinComer: number | null }[]    // v2 · null = nunca registrado
  exposiciones: { preparacionId: string; nombre: string; veces: number; mejorPaso: Cuanto; ultimaISO: string }[] // v2
  alertas: Alerta[]                                          // v2
  proximoPaso?: Candidato                                    // v2 · el mejor candidato del grafo, sin LLM, para la tarjeta del tablero
  sugerencias?: Sugerencia[]                                 // v4 · siempre en el orden segura, un_paso, mas_nutritiva (§8); proximoPaso = la de un_paso
}
export interface Sugerencia {            // v4 · las tres opciones del tablero: explotar, explorar de a un cambio, priorizar lo que falta
  tipo: 'segura' | 'un_paso' | 'mas_nutritiva'
  preparacionId: string; nombre: string
  probAcepta: number                     // de 0 a 1: la aceptación (segura) o el puntaje del candidato llevado a 0–1
  aporte: Partial<Nutrientes>            // por porción
  porQue: string                         // plantilla, sin LLM: "La come 8 de cada 8 veces" · "Se parece a sus papas fritas: cambia solo el ingrediente"
  candidato?: Candidato                  // en un_paso y mas_nutritiva; abre la receta
}

// ---------- Perfil ----------
export interface DatosBasicos {
  nombre: string; edad: number; sexo: 'masculino' | 'femenino'; pesoKg?: number; tallaCm?: number
  alergias: Alergeno[]                   // a mano, nunca por IA
  alertas: ('bajo_peso' | 'arcadas_vomitos' | 'menos_15_alimentos')[]
  dieta: Dieta                           // v2
  suplementos?: string                   // v2 · solo registro; la app nunca sugiere suplementos
}
export interface Regla {
  texto: string
  condiciones: { tipo: keyof Atributos | 'distribucion' | 'plato'; valor: string }[]
  efecto: 'rechaza' | 'requiere'
}
// POST /api/perfil-inicial (A) · la pantalla transcribe primero con /api/transcribir y deja editar el texto
export interface PerfilInicialReq {
  datos?: Partial<DatosBasicos>          // v5 · opcional: en el alta por voz (§5.2) no viene y se extrae del relato; si viene, manda sobre lo extraído
  texto: string; fotoIndicacionBase64?: string
}
export interface DatoCitado<T> { valor: T; cita: string }   // v5 · como en el relato (v4): sin cita textual, no hay dato
export interface DatosExtraidos {         // v5 · lo que dijo del chico; el padre lo confirma o lo corrige en "esto entendí"
  nombre?: DatoCitado<string>; edad?: DatoCitado<number>; sexo?: DatoCitado<'masculino' | 'femenino'>
  pesoKg?: DatoCitado<number>; tallaCm?: DatoCitado<number>
  alergiasMencionadas: DatoCitado<Alergeno>[]       // NUNCA pasan solas a DatosBasicos.alergias: el padre las toca una por una
  sinAlergias?: DatoCitado<true>                     // dijo explícitamente que no tiene; igual se confirma
  alertas: DatoCitado<'bajo_peso' | 'arcadas_vomitos' | 'menos_15_alimentos'>[]
  atragantamiento?: DatoCitado<true>                 // se muestra como alerta (§10.4) desde el alta
  dieta?: DatoCitado<Dieta>; suplementos?: DatoCitado<string>
}
export const CAMPO_VITAL = ['nombre', 'edad', 'sexo', 'alergias', 'acepta', 'rechaza'] as const // v5
export type CampoVital = De<typeof CAMPO_VITAL>
export interface PerfilBorrador {
  acepta: { nombre: string; preparacionId: string | null; marca?: string; atributos: Partial<Atributos> }[]
  rechaza: { nombre: string; preparacionId: string | null; motivo: Motivo }[]   // v2: el motivo usa MOTIVO
  reglas: Regla[]
  objetivosNutricionista?: Partial<Nutrientes>
  datos?: DatosExtraidos                 // v5 · solo si el pedido no trajo datos (alta por voz)
  faltan?: CampoVital[]                  // v5 · lo vital que no mencionó: la pantalla lo pregunta antes de crear el perfil
}
// POST /api/perfil (B) { datos, borrador } → { ninoId }
// GET  /api/perfil?ninoId (B) → Perfil
export interface Perfil {
  ninoId: string; datos: DatosBasicos; reglas: Regla[]; patrones: PatronVista[]
  preparaciones: { id: string; nombre: string; estado: 'acepta' | 'en_proceso' | 'rechaza'; puntaje: number; veces: number }[]
}

// ---------- GraphRAG y receta ----------
export interface Candidato {
  preparacionId: string; nombre: string; puntaje: number
  camino: { desde: string; aceptacion: string; atributos: string[] } // "papas fritas", "8/8", ["forma=baston", "textura=crocante"]
  desdeId: string                        // v2 · el alimento seguro del que parte
  cambio: Cambio                         // v2 · lo único que cambia
  seMantiene: string[]                   // v2 · ["forma=baston", "textura=crocante", "sabor=salado", "temperatura=caliente"]
  patrones: string[]
  aportePorcion: Partial<Nutrientes>
}
export interface Evidencia {             // armarEvidencia(ninoId, nutriente?) en server/grafo/evidencia.ts (B)
  nutriente: Nutriente; coberturaSemana: number; faltaHoy: number
  candidatos: Candidato[]; reglas: string[]; alergias: Alergeno[]
  texto: string                          // ~20 líneas: lo ÚNICO que ve el LLM
}
// POST /api/receta (A) { ninoId, nutriente? } → Receta
export interface Receta {
  nombre: string; preparacionBaseId: string           // el candidato del catálogo sobre el que se escribe la receta
  desde: { preparacionId: string; nombre: string }   // v2 · su alimento seguro (el punto de partida de la cadena)
  cambio: Cambio; seMantiene: string[]               // v2
  ingredientes: { alimentoId: string; nombre: string; gramos: number }[]
  pasos: string[]; porQue: string
  presentacion: string                   // separado, porción mínima, al lado de su alimento seguro
  comoOfrecer: string                    // v2 · sin presión; repetir igual de 8 a 15 veces
  transparencia: string | null           // v2 · si un ingrediente va adentro, se dice y se ofrece también a la vista
  aporte: Nutrientes                     // recalculado con la tabla, nunca el del LLM
  coberturaDeLoQueFalta: number
  validacion: { ok: boolean; problemas: string[]; reintentos: number }
  evidencia: Evidencia
}
// POST /api/imagen-plato (A) { receta, reglas } → { imagenBase64, mime, ilustrativa: true }
// GET  /api/resumen?ninoId (C) → { texto, progreso: Progreso, generadoISO }
```

### 5.1 "¿Cómo le fue?": la escalera de exposición

Una sola tabla que usan la UI, la nutrición, el aprendizaje y el prompt del relato. Se basa en la escalera del enfoque SOS que cita el research (tolerarlo en el plato → tocarlo → olerlo → llevarlo a la boca → probarlo → comerlo), donde **cada escalón cuenta como avance**.

| `cuanto` | Botón | Fracción comida (nutrición) | `o` (aceptación) | Escalón |
|---|---|---|---|---|
| `todo` | Comió todo | 1,0 | 1,0 | comió |
| `mitad` | La mitad | 0,5 | 0,7 | comió |
| `poco` | Un poco | 0,25 | 0,4 | comió |
| `probo` | Lo probó (mordió o lamió) | 0,05 | 0,3 | probó |
| `toco` | Lo tocó u olió | 0 | 0,15 | tocó |
| `nada` | Lo dejó en el plato | 0 | 0,05 | lo toleró |
| `aparto` | Lo apartó o pidió sacarlo | 0 | 0 | rechazo |

**Se aprende por ítem, nunca por plato (v4).** El ejemplo del mentor: hamburguesa + papas fritas (no le gustó) y milanesa + papas fritas (comió todo). Con un solo puntaje por plato habría que adivinar si el problema fue la carne o las papas. Como cada ítem tiene su escalón, el dato ya lo dice: las papas, `todo` en los dos platos; la hamburguesa, `aparto`. Si hace falta un "puntaje del plato" para mostrar, es el promedio de `o` ponderado por gramos, y el aprendizaje nunca lo usa.

**Porción:** chica ×0,6 · mediana ×1 · grande ×1,5. Si el padre corrige la porción, `gramos = gramosEst × factor(padre) / factor(visión)`. **Rango mostrado:** ±35% (el error medio de gramos que reporta la literatura).

**Conducta en la mesa** (por comida, varias a la vez):

| `conducta` | Chip | Para qué |
|---|---|---|
| `tranquilo` | Estuvo tranquilo | Contexto |
| `se_levanto` | Se levantó de la mesa | Contexto y patrones de conducta (P2) |
| `angustia` | Lloró o se angustió | Contexto y patrones de conducta (P2) |
| `pidio_otra_cosa` | Pidió su comida de siempre | Contexto |
| `arcadas` | Arcadas o vómitos | Alerta si se repite (§10.4) |
| `atragantamiento` | Tos o atragantamiento | Alerta desde la primera vez (§10.4) |

---

### 5.2 Alta desde cero: el primer audio (v5)

**Cuándo.** La primera vez que se abre la app (no hay chico activo en la URL ni en `localStorage`), y cada vez que el padre toca "Agregar otro chico". La app arranca con una sola pregunta: *"Contanos de tu hijo"*.

**Qué pasa.**
1. **Grabar.** Un solo audio de hasta **3 minutos** (el registro de comidas sigue en 90 s). Mientras graba, la pantalla muestra la guía de abajo como una lista que no hace falta seguir en orden. Sin micrófono, el mismo campo de texto con el dictado del teclado (§13).
2. **Transcribir** con el mismo método de siempre: `POST /api/transcribir` (Whisper large-v3-turbo en Groq, idioma `es`), con la pista de nombres de alimentos comunes. El texto queda editable.
3. **Entender.** `POST /api/perfil-inicial` **solo con `texto`** (sin `datos`). La IA devuelve el `PerfilBorrador` de siempre (qué acepta y con qué atributos, qué rechaza y por qué, reglas) **más** `datos` (lo que dijo del chico, cada dato con su cita) y `faltan` (lo vital que no dijo).
4. **"Esto entendí".** Una sola pantalla para confirmar y corregir: los datos básicos ya completos, las **alergias como sugerencias que hay que tocar**, lo que come, lo que no y sus reglas. Lo que está en `faltan` se pregunta ahí mismo, con un control simple (no otro audio).
5. **Crear.** `POST /api/perfil` con `{ datos, borrador }`, igual que hoy. B8 siembra el **grafo inicial** del chico: `Nino`, `ALERGICO_A`, `ACEPTA` y `RECHAZA` con su puntaje inicial (0,8 y 0,1, §8) y los atributos que contó, `SIGUE` para sus reglas, `OBJETIVO` según edad y sexo, y los patrones de investigación (§10.2). Desde ahí el tablero arranca vacío con "Registrá su primera comida".

**La guía: lo vital, y para qué lo usa Nibble.**

| Qué contar | Para qué | Si no lo dice |
|---|---|---|
| Nombre, edad y sexo | Los objetivos de nutrientes dependen de la edad y, desde los 9 años, del sexo (§10.1) | Se pregunta: es obligatorio |
| Peso y talla (si los sabe) | Señal de bajo peso (§10.4) | Queda vacío |
| **Alergias** | La validación de recetas por código (§7) | Se pregunta "¿Tiene alguna alergia?" con los 9 alérgenos y "No tiene": obligatorio |
| Dieta especial (sin gluten ni caseína) y suplementos | Alerta `dieta_eliminacion`; los suplementos son solo registro | "Ninguna" |
| Arcadas, vómitos, atragantamiento, que coma menos de 15 alimentos | Alertas que derivan al profesional (§10.4) | Ninguna |
| **Lo que come seguro**, con marca y cómo se lo sirven (crocante o blando, frito o al horno, en bastones, frío…) | Los alimentos seguros son el punto de partida de toda cadena (§8) | Se pregunta: hace falta al menos uno |
| Lo que no come y por qué (la textura, el olor, que esté mezclado…) | Puntaje inicial bajo y el motivo (`MOTIVO`) | Se puede seguir sin esto |
| Sus reglas ("que no se toquen", "nada verde", "en su plato de siempre") | Filtro de reglas y preguntas de la visión | Ninguna |
| Lo que indicó su nutricionista (opcional) | Reemplaza los objetivos de la tabla | La tabla de §10.1 |

**Reglas (en el prompt; las marcadas con ✓ también se controlan por código).**
- Cada dato lleva su **cita** textual de la transcripción; sin cita, no hay dato. ✓ (misma comprobación que el relato, §7)
- **Alergias:** solo las que el padre llama alergia o reacción ("es alérgico al huevo", "le da ronchas el maní"). "No le gusta el huevo" es un rechazo, no una alergia. Ninguna alergia pasa a `DatosBasicos.alergias` sin que el padre la toque. ✓
- No inventar edad, sexo ni alimentos: lo que no dijo va a `faltan`. ✓
- Un alimento seguro que no está en el catálogo queda con `preparacionId: null` y los atributos que el padre describió.
- Tono de la pantalla: "Contanos como se lo contarías a su pediatra"; nunca juzgar lo que come.

**Caso de ejemplo: el audio de alta de Tomás** (unos 80 segundos; es el guion de la demo y uno de los audios de la eval de voz):

> *"Hola, te cuento de Tomás. Tiene seis años, pesa veintiún kilos y mide un metro dieciséis. Es alérgico al huevo, eso es lo más importante. No tiene ninguna dieta especial ni toma suplementos. Come pocas cosas, pero las que come las come siempre: papas fritas en bastones, bien crocantes; la milanesa de carne al horno, que se la hacemos sin huevo; tostadas de pan blanco; las galletitas de agua, las de siempre; y la leche chocolatada fría a la mañana. Lo que no come es nada mezclado: el arroz con pollo, por ejemplo, no lo toca. El puré de papa tampoco, por la textura, dice que es raro. No tiene arcadas ni se atraganta."*

Con ese audio, "esto entendí" tiene que mostrar: Tomás, 6 años, masculino, 21 kg, 116 cm; **huevo como alergia sugerida** (a confirmar); dieta ninguna; acepta 5 preparaciones (papas fritas en bastones, milanesa de carne al horno sin huevo, tostadas de pan blanco, galletitas de agua, leche chocolatada); rechaza puré de papa (`textura`) y arroz con pollo (`mezcla`); una regla, "nada mezclado" (`presentacion=mezclado → rechaza`); `faltan` vacío. Es lo mismo que `data/sinteticos/tomas.json` (`datos` y `borrador`), así que el test compara contra ese archivo. A propósito, el audio **no** cuenta lo de la salsa ni lo blando: son reglas ocultas de Tomás (§10.5) que el sistema tiene que descubrir solo con las comidas.

**Tareas.**

| # | Quién | Qué |
|---|---|---|
| A8b | A | `/api/perfil-inicial` sin `datos`: extraer `DatosExtraidos` con citas y `faltan`; comprobar las citas por código; alergias solo como sugerencia. Eval: el audio de Tomás (arriba) y 2 o 3 más grabados por el equipo, con la tabla de lo esperado |
| B8b | B | Nada nuevo en la API: `POST /api/perfil` ya siembra el grafo inicial. Revisar que los atributos parciales de `acepta` entren al α/β inicial |
| C6 | C | La pantalla de alta por voz (reemplaza el formulario previo): bienvenida → audio con la guía → texto editable → "esto entendí" con alergias a confirmar y lo que falta → crear → registrar |

## 6. Cronograma y checkpoints

| Hora | Hito / todos | A | B | C |
|---|---|---|---|---|
| **15:05–15:30** | Leer §0–§3 y §4.1 | Keys de Anthropic, Groq y Cloudflare; probar **visión con 3 fotos reales**, **FLUX** y **una nota de voz grabada en un iPhone y otra en un Android** | Crear Neo4j Aura Free y **MongoDB Atlas** (integración de Vercel); `server/grafo/cliente.ts`, `server/datos/mongo.ts` + `/api/salud` **desde Vercel**; constraints e índices | Repo público (o definir dueño de deploys); scaffold + **contratos v2** + fixtures (incluido `relato-comida`) + stubs + deploy |
| **15:30 · CP0** | Deploy vivo con stubs · Mongo y Neo4j responden desde Vercel (si Neo4j no, el grafo va a Mongo) · Claude, FLUX y transcripción probados · contratos congelados | | | |
| **15:30–16:45** | Cada uno contra fixtures | Prompt de visión con 5–6 fotos reales; `server/ia/modelo.ts`; `/api/analizar-comida` real; bajar los CSV de USDA y lanzar con Claude Code `scripts/usda.ts` → `alimentos.json` + `alimentos_fdc` | `objetivos.json` v2, nutrición pura, seed, `registrarComida()` + aceptación y exposiciones; lanzar `preparaciones.json` en segundo plano | Pantalla Registrar completa contra fixtures, **con el grabador** (botón, contador, permisos) y los botones de la escalera; esqueleto del tablero |
| **16:45 · CP1** | **Integración en el deploy:** foto real → análisis → "¿cómo le fue?" con botones → registrar → nutrientes | | | |
| **16:45–18:15** | | `server/ia/voz.ts`, **`/api/relato-comida`** y `/api/transcribir`; ajustes del prompt de visión con fotos nuevas | `/api/nutricion`, `/api/progreso` (frase, semana, energía, grupos), `/api/perfil`, `obtenerContexto()`, `alertas.ts` | Tablero real; voz integrada; pruebas en iPhone y Android (cámara y micrófono) |
| **18:15 · CP2** | **Ciclo principal estable en producción** (ver abajo). Si no está, todos a arreglarlo antes de seguir | | | |
| **18:15–20:00** | | `/api/perfil-inicial`; `/api/receta` (LLM + validación + reintento) e `/api/imagen-plato` | Patrones combinados + "qué aprendí"; propagación + `cadena.ts` + `armarEvidencia()` + `proximoPaso` | Pantallas de perfil (con voz) y receta, `/api/resumen`, errores y estados vacíos, README |
| **20:00 · CP3** | **Feature freeze** | | | |
| **20:00–21:00** | Crear a Tomás con el flujo real (relato por voz) y registrarle 10–15 comidas con fechas de los últimos 7–10 días. **Grabar el video de respaldo.** Tag `v-sabado` | | | |
| Noche (opcional) | Solo P2 y diapositivas; no tocar el ciclo principal | Eval de visión y de voz; eval de recetas | Chico simulado + curva | Diapositivas y guion |
| Domingo 9:00 → pitch | Solo bugs. Ensayar 5 veces. Probar en el celular de alguien de afuera del equipo | | | |

**Checkpoint:** 5 minutos, los tres juntos, mirando el deploy en un celular. Si un checkpoint falla, la pista atrasada recibe ayuda antes de que nadie siga con features nuevas.

**Definición de listo del CP2:** desde un celular cualquiera, en la URL de producción, 3 fotos nuevas seguidas → cada una analizada en < 10 s → "¿cómo le fue?" (con botones; con voz si ya llegó) → guardar → nutrientes con rango y "qué aprendí" → el tablero refleja las 3 y la frase de "¿está comiendo bien?" cambia.

---

## 7. Pista A · Percepción e IA

**Objetivo:** que cualquier foto de comida se convierta en JSON confiable en < 8 s, que lo que cuenta el padre (voz o texto) se convierta en respuestas estructuradas, y que la evidencia del grafo se convierta en una receta de food chaining segura, con su imagen.

| # | Tarea | Entregable | Prior. |
|---|---|---|---|
| A1 | Keys y pruebas: Claude Haiku 5.5 con 3 fotos reales (¿reconoce bien?, ¿las cajas sirven?), FLUX en Workers AI y **una nota de voz grabada en iPhone (`audio/mp4`) y otra en Android (`audio/webm`)** contra Whisper en Groq. Anotar los límites reales del free tier que muestra cada consola. Si algo falla, avisar ya | 5 llamadas OK | P0 |
| A2 | Prompt de visión en AI Studio con fotos reales | Prompt + schema que andan con 5 fotos | P0 |
| A3 | **Bajar los CSV completos de FoodData Central** (fdc.nal.usda.gov/download-datasets: Foundation, SR Legacy y FNDDS 2021–2023; dominio público, sin key ni límite de pedidos). `scripts/usda.ts` lee `food`, `food_nutrient`, `nutrient` y `food_portion`, se queda con los 9 nutrientes y los pesos por unidad, y genera (1) `data/alimentos.json`, el catálogo curado de 80–100 alimentos + 6 genéricos `otro_<grupo>` que usa el enum de visión, y (2) la colección `alimentos_fdc` en Mongo con el resto (unos pocos MB), para buscar lo que no está en el catálogo. Incluye **vitamina C** y **versiones fortificadas** (leche y yogur con vitamina D, cereal fortificado, huevo enriquecido, aceite de canola). Prioridad de fuente: FNDDS (comidas tal como se comen, con porciones) → SR Legacy → Foundation. **Commitear primero solo los ids** (B y el prompt los necesitan) | JSON con valores reales, fuente y `fdcId` | P0 |
| A4 | `server/ia/modelo.ts`: `generarJSON({ tarea, partes, schema })` y `generarTexto`, con el SDK oficial `@anthropic-ai/sdk`, salida estructurada (`output_config.format` con JSON Schema) + validación con Zod + 1 reintento pasando el error; timeout de 25 s. `tarea` elige el modelo (visión, relato, perfil y resumen → Haiku 5.5; receta → Sonnet 5.5). `PROVEEDOR_IA` cambia a Gemini o Groq sin tocar los handlers. `server/ia/imagen.ts`: `generarImagen` con FLUX en Workers AI | Módulo que usan todos | P0 |
| A5 | `/api/analizar-comida` con el contexto del chico (`obtenerContexto()` de B; si falla, vacío) | curl con foto → `AnalisisComida` | P0 |
| A6 | Robustez: `sinComida`; alimento fuera del catálogo → `otro_<grupo>` + pregunta; confianza < 0,6 → pregunta; JSON inválido → reintento | 3 fotos raras no rompen nada | P0 |
| A7 | **`server/ia/voz.ts` + `/api/relato-comida`**: transcribir → LLM con los ítems, las preguntas y la transcripción → `RelatoComida`. Si llega `texto`, se saltea la transcripción. `/api/transcribir` expone solo el primer paso | Nota de voz → botones marcados en < 8 s | P1 (el primero) |
| A8 | `/api/perfil-inicial`: texto del relato (+ foto de indicación) → `PerfilBorrador`. (v5) Sin `datos`, también extrae los datos básicos con sus citas y lo que falta (A8b, §5.2). Las pantallas las hace C | Chico nuevo desde un audio nuevo, sin formulario | P1 |
| A9 | `/api/receta`: `armarEvidencia()` → prompt (solo candidatos del paquete) → `validarReceta()` → 1 reintento con los problemas → si sigue mal, siguiente candidato | Receta válida con porqué y un solo cambio | P1 |
| A10 | `/api/imagen-plato` con FLUX.1 schnell en Workers AI (Nano Banana si hay billing): prompt de presentación funcional, sin texto, marcada como ilustrativa | Imagen en < 20 s | P1 |
| A11 | Eval de visión y de voz (§11.1 y §11.2). La de visión corre con Haiku 5.5 y con Sonnet 5.5 (con los créditos cuesta centavos), y se queda el que acierte más en menos de 8 s | Tablas de resultados | P1 |
| A12 | Eval de recetas (§11.3) · foto de la indicación del nutricionista → `objetivosNutricionista` | — | P2 |

**Prompt de visión: puntos clave**
- Responder solo el JSON del schema; textos en español rioplatense.
- **Pasar primero el catálogo personal del chico** (`id: nombre`) y después el del catálogo semilla. Los chicos selectivos comen pocos alimentos, casi siempre los mismos y separados: reconocerlos contra un catálogo de 10 a 30 ítems es mucho más fácil.
- Cada ingrediente → un `alimentoId` del enum; si no está, `otro_<grupo>`.
- Gramos: usar el plato y los cubiertos como escala (plato playo ≈ 26 cm, cuchara ≈ 15 cm).
- Cajas en `[ymin, xmin, ymax, xmax]`, normalizadas de 0 a 1000.
- Confianza < 0,6 → no adivinar: pregunta con 2–4 opciones.
- Si una regla del chico aplica a lo que se ve (por ejemplo, "que no se toquen" y hay alimentos tocándose), preguntar si le molestó (`origen: 'regla'`).
- Máximo 3 preguntas, cortas y con opciones. Sin comida → `sinComida: true`.
- `effort: 'low'` para bajar la latencia, y sin `temperature`: los modelos actuales de Claude rechazan valores distintos del predeterminado.
- Si un alimento no está en el catálogo, devolver también su nombre en inglés: el código lo busca en `alimentos_fdc` y le pregunta al padre si es ese.
- Si se puede contar (nuggets, bastones, galletitas), devolver `conteo`: el peso por unidad de FNDDS es más preciso que estimar gramos a ojo.
- (v4) Devolver la `coccion` de cada ítem. Papas fritas, papas al horno y papa hervida son preparaciones distintas aunque compartan alimento, y una misma cocción puede dar texturas distintas: papas al horno blandas o crocantes.

**Transcripción:** idioma `es`, y como pista (`prompt` en Whisper) los nombres de los alimentos del plato y del perfil del chico: mejora palabras como "dambo", "milanesa" o "boniato". Grabación de 90 s como máximo.

**Prompt del relato: puntos clave**
- Entrada: ítems (`idTmp: nombre`), preguntas (`id: texto [opciones]`), la tabla de §5.1 y la transcripción.
- Mapear lo que cuenta el padre a `cuanto` según la tabla. Ejemplos: "ni lo miró, quedó ahí" → `nada`; "lo sacó del plato" → `aparto`; "lo chupó y lo dejó" → `probo`; "comió unos bocados" → `poco`.
- **Si no menciona un ítem, va a `sinMencion`. No inventar.** El padre siempre confirma antes de guardar.
- (v4) Cada respuesta lleva su `cita`: el fragmento textual de la transcripción que la justifica. Sin cita, no hay respuesta. El código comprueba que la cita esté en la transcripción; si no está, la respuesta se descarta y el ítem pasa a `sinMencion`. La UI muestra la cita al lado del botón marcado.
- Motivo solo si lo dice ("no lo quiso porque estaba mezclado con la salsa" → `mezcla`). Conducta solo si la menciona; arcadas o atragantamiento, siempre que aparezcan.
- `comentario`: una línea neutra, sin juzgar al chico ni a la familia.

**Reglas de la receta (en el prompt; las marcadas con ✓ también se validan por código)**
- Parte de `desde` (su alimento seguro) y cambia **solo** `cambio`. Dice qué se mantiene. ✓
- **Primero fortificar lo que ya come** (misma preparación o misma marca, versión fortificada), después cambiar forma, sabor, ingrediente, temperatura y, al final, la textura, que es el principal motivo de rechazo.
- **Presentación por defecto:** separado (o en plato con divisiones si el perfil lo pide), porción mínima ("del tamaño de una arveja o de un bastón"), al lado de su alimento seguro, con las salsas aparte. Un solo alimento nuevo por comida; la mayor parte del plato es lo que ya come.
- **Sin mezclas** (guisos, rellenos, salsa por encima) salvo que el chico ya las acepte. ✓
- **Transparencia:** nada escondido. Si un ingrediente va adentro (queso en la masa), se dice en `transparencia` y se propone ofrecerlo también a la vista.
- **`comoOfrecer`:** sin presión. "Ofrecelo sin pedirle que lo coma; que esté en el plato ya es un avance." Repetir con la misma presentación de 8 a 15 veces antes de cambiarla.
- **Nunca** sugerir suplementos, dosis ni dietas de eliminación. Si falta vitamina D, decirlo y sugerir que lo consulten con el pediatra o el nutricionista. ✓
- **Nunca** sugerir sacarle un alimento seguro ni juzgarlo, aunque sea ultraprocesado.

**Validación de receta (código, nunca IA):** ningún ingrediente con un alérgeno del chico (según `alimentos.json`) · ninguna regla `rechaza` violada · el `cambio` declarado coincide con el que calcula `cadena.ts` entre `desde` y la receta, y hay uno solo · presentación `separado` salvo que el chico acepte mezclas · todos los `alimentoId` existen · gramos razonables (5–300 g por ingrediente) · **lenguaje:** ninguna frase de la lista prohibida (por ejemplo, "que termine", "una probadita más", "premio", "si come", "escondé", "disimulá", "que no se dé cuenta", "suplemento") · nutrientes recalculados con la tabla (se ignoran los que diga el LLM).

**Prompt de imagen (ejemplo):** "Foto cenital realista de un plato playo blanco sobre una mesa de madera. A la izquierda, sus papas fritas en bastones (porción normal). A la derecha, separados y sin tocarlas, 2 bastones de queso horneados (porción chica). Sin salsa, sin texto, sin personas, sin decoración."

---

## 8. Pista B · Grafo y nutrición

**Objetivo:** guardar cada comida como un evento del grafo, calcular los nutrientes con la tabla, aprender patrones, detectar alertas y entregar el paquete de evidencia para food chaining.

| # | Tarea | Entregable | Prior. |
|---|---|---|---|
| B1 | Neo4j Aura Free en la región más cercana a EE. UU. Este (Vercel corre en `iad1`). Guardar el archivo de credenciales: se descarga una sola vez. Driver a nivel de módulo con `disableLosslessIntegers: true`; usar `driver.executeQuery`. Una instancia Free sin uso puede pausarse: abrir la consola el domingo antes del pitch | `/api/salud` OK desde Vercel | P0 |
| B2 | **MongoDB Atlas Free** con la integración de Vercel Marketplace; `server/datos/mongo.ts` con el cliente a nivel de módulo; colecciones `ninos`, `comidas`, `recetas` y `alimentos_fdc`, con índices (`comidas`: `{ ninoId, dia }`; `alimentos_fdc`: índice de texto sobre nombre y alias). **15:30: decisión.** Si Neo4j no escribe y lee desde Vercel, el grafo pasa a colecciones `nodos` y `relaciones` en Mongo. La interfaz de `server/grafo` no cambia | `/api/salud` OK y decisión | P0 |
| B3 | Constraints de unicidad: `Nino.id`, `Comida.id`, `Preparacion.id`, `Ingrediente.id` (= `alimentoId`), `Nutriente.nombre`, `Atributo.id` (`"textura:crocante"`) | — | P0 |
| B4 | `data/objetivos.json` (§10.1: 8 nutrientes con meta; la energía, sin meta) + `server/nutricion/`: `calcularComida()`, `objetivosPara(edad, sexo, override?)`, `cobertura()` del día y **de la semana** | Funciones puras con 3 tests | P0 |
| B5 | `scripts/seed-grafo.ts`: Nutrientes, Ingredientes + `APORTA {por100g}`, Atributos, Preparaciones del catálogo + `TIENE` + `CONTIENE` | Grafo base | P0 |
| B6 | `registrarComida()` en una transacción (con conducta, motivos y relato) + aceptación + exposiciones + α/β | `RegistrarComidaRes` real | P0 |
| B7 | `/api/nutricion`, `/api/progreso` (frase, semana, energía, grupos; después semanas, repertorio y exposiciones), `obtenerContexto(ninoId)` para A | — | P0 |
| B8 | `/api/perfil` POST (crea `Nino`, `ACEPTA`/`RECHAZA` iniciales, `SIGUE` reglas, `ALERGICO_A`, `OBJETIVO`, patrones de investigación) y GET. (v5) Es el grafo inicial del alta por voz (§5.2) | — | P1 |
| B9 | `server/nutricion/alertas.ts` (§10.4) | Alertas en `registrar` y en `progreso` | P1 |
| B10 | Patrones combinados + persistencia + diff → "qué aprendí" | Aprendizajes reales | P1 |
| B11 | `data/preparaciones.json` (50–60, con `fortificadaDe` donde aplique): lanzarlo con Claude Code a las 15:45 en segundo plano y revisar los atributos a mano | Catálogo | P1 |
| B12 | Propagación + `cadena.ts` (candidatos a un cambio) + camino + `armarEvidencia()` + `proximoPaso` + **`sugerencias`** (v4) detrás de la interfaz del recomendador (§4.3) | `Evidencia` real y las 3 sugerencias | P1 |
| B14 | (v4) **Tests contra el dataset sintético** (§10.5): aceptación, exposiciones y patrones combinados sobre `data/sinteticos/*.json` tienen que encontrar las reglas ocultas de Tomás y Lucía. Se pueden escribir desde las 15:30, antes de tener datos reales | Test que pasa en el CI | P1 |
| B13 | `scripts/simular-nino.ts` (§11.4) · contradicciones · patrones de conducta · aviso de agotamiento · `/api/grafo` para visualizar · suplementos | — | P2 |

**Escritura de una comida (primero Mongo, después Neo4j).**
- **Mongo, la fuente de verdad:** un documento en `comidas` con todo: `ninoId`, `dia`, `fechaISO`, `momento`, `thumbBase64`, `analisis` tal como vino de la IA, `respuestas`, `conducta`, `relato`, `items` ya resueltos (gramos, fracción, atributos) y `nutrientes` con su rango. El tablero suma estos documentos.
- **Neo4j, el conocimiento:** `(:Nino)-[:COMIO]->(:Comida {id, dia, momento, conducta})`, con el mismo `id` que el documento; la foto y los nutrientes quedan en Mongo. Si esta escritura falla, la comida no se pierde: `scripts/reconstruir-grafo.ts` rehace el grafo desde Mongo.
- `(:Comida)-[:INCLUYE]->(:Item {gramos, fraccion, o, cuanto, motivo, cita, confianza, textura, forma, color, sabor, temperatura, presentacion, grupo, coccion})` (v4: + `cita` y `coccion`; el atributo es `Atributo {id: "coccion:frito"}`). Los atributos **observados** van en el Item, porque son los que usa la minería de patrones.
- `(:Item)-[:ES]->(:Preparacion)` con MERGE por id (si `preparacionId` es null, id = slug del nombre) y `(:Preparacion)-[:TIENE]->(:Atributo)`.
- `(:Item)-[:CONTIENE {gramos}]->(:Ingrediente)`, `(:Comida)-[:EN_CONTEXTO]->(:Contexto)` (distribución, plato, momento) y `(:Comida)-[:RESULTADO]->(:Reaccion)`.

**Algoritmos (funciones puras sobre observaciones)**

Observación = un ítem de una comida: `{ prepId, atributos (8, con la cocción), contexto: { distribucion, plato, momento, juntoASeguro }, o, cuanto, fecha }`. Se cargan todas con una sola consulta a `comidas` en Mongo. `juntoASeguro` = en el mismo plato había una preparación en estado `acepta`.

- **Aceptación por preparación (más peso a lo reciente):** `p ← p + 0,3·(o − p)`. Valor inicial: lo que el padre dijo que acepta, 0,8; lo que rechaza, 0,1; lo nuevo, 0,5. Estado: `acepta` si p ≥ 0,6 y veces ≥ 2; **`rechaza` solo si p < 0,2 y veces ≥ 10** (configurable; el research habla de 8 a 15 exposiciones); si no, `en_proceso`. Un rechazo no descarta la preparación. El peso de lo reciente importa: el perfil cambia con los años (en Bandini 2017, el rechazo por textura bajó de 94% a 39%).
- **Exposiciones:** para cada preparación `en_proceso`, `veces` y el mejor escalón alcanzado (`mejorPaso`, según el orden de §5.1). Alimentan el tablero y el "qué aprendí".
- **α/β por atributo (base de comparación):** prior 1/1; `α += o`, `β += 1 − o`; `p = α / (α + β)`.
- **Patrones combinados:** las condiciones de cada observación son sus atributos y su contexto. Se enumeran las combinaciones de 2 y de 3 condiciones y, por cada una, se calculan `n` y la media de `o`. Se guarda si `n ≥ 3`, la media es ≥ 0,75 (acepta) o ≤ 0,25 (rechaza) y además se aleja al menos 0,2 de la **media del resto**, es decir, de las observaciones que no cumplen esa combinación. (v4: antes era la media global. El dataset sintético mostró que así no anda: en Tomás, "crocante y separado" es el 65% de lo que come, arrastra la media global a 0,60 y su 0,79 nunca se aleja 0,2. Contra el resto, que da 0,24, el patrón aparece claro.) Se podan las de 3 condiciones que no mejoran a su sub-combinación de 2 (diferencia < 0,1) y quedan las 10 mejores por `n·|media − 0,5|`. Las que dejan de cumplirse se borran. Con menos de 100 comidas tarda milisegundos.
- **Propagación (PageRank personalizado):** grafo bipartito Preparación ↔ Atributo (catálogo + preparaciones del chico). Semilla positiva `s(p) = max(0, puntaje − 0,5)`; semilla negativa `r(p) = max(0, 0,5 − puntaje)`. Peso de arista por tipo de atributo: `w = 1 + importancia` (sale de los patrones). 20 iteraciones de `x ← 0,15·s + 0,85·W·x` normalizado. `puntaje = PPR(s) − 0,5·PPR(r)`.
- **Food chaining en código (`cadena.ts`):** para cada preparación que el chico acepta (`desde`) y cada preparación del catálogo (`cand`), `cambios(desde, cand)` = cuántas de estas dimensiones difieren: textura, forma, sabor, temperatura, **cocción** (v4) e ingrediente principal. Sin la cocción, las papas al horno en bastones crocantes daban 0 cambios con las papas fritas, como si fueran la misma preparación. **El color no se cuenta aparte:** cambia junto con el ingrediente y no distinguió a los chicos con TEA de los demás (Hubbard 2014); si el chico tiene una regla de color, la aplica el filtro de reglas. Un candidato entra si:
  - `cambios = 1` (el `cambio` es esa dimensión), o es la versión fortificada de algo que acepta (`fortificadaDe`, `cambio = 'fortificar'`);
  - su presentación es `separado`, salvo que el chico ya acepte lo mezclado o con salsa;
  - no tiene alérgenos del chico ni viola una regla `rechaza`;
  - aporta al menos el 15% del objetivo diario del nutriente por porción.
- **Orden de los candidatos:** `propagación + 0,3·Σ(±confianza de los patrones que aplican) − 0,05·dificultad(cambio)`, con la dificultad según el orden de `CAMBIO`. Los 3 primeros van al paquete de evidencia; el primero es el `proximoPaso` del tablero.
- **Sugerencias: explotar o explorar (v4).** El mentor lo comparó con un DJ: el próximo tema sale de lo que vino sonando, distinto para no repetirse, pero no tanto como para cortar. Si solo explotamos, el chico queda atado a sus papas fritas; si exploramos con un plato entero nuevo, no come nada y la familia deja la app. Por eso el tablero muestra tres opciones (`Progreso.sugerencias`), cada una con su porqué:
  - **`segura` (explotar): *va a gustarle*.** Entre las preparaciones en `acepta`, la de mayor `p × aporte al nutriente que más falta`, salteando la que se sirvió en la última comida del mismo momento (no repetir el mismo tema).
  - **`un_paso` (explorar con sentido): *un pasito*.** El `proximoPaso`: el mejor candidato a **un solo cambio** según el orden de arriba. Mientras está `en_proceso` y lleva menos de 10 exposiciones, **se sigue sugiriendo el mismo y servido igual**, porque el research pide de 8 a 15. Lo que rota es la presentación de lo seguro, no la del alimento nuevo.
  - **`mas_nutritiva`: *más nutritiva*.** Entre los candidatos a un cambio, el que más aporta al nutriente que más falta, aunque tenga menos puntaje. Si coincide con `un_paso`, va el siguiente.
  - **Cuánto se explora:** como máximo un alimento nuevo por comida, y la mayor parte del plato es lo que ya come (reglas de la receta, §7).
  - **Cómo converge:** cuando un candidato llega a `acepta`, pasa a ser un `desde` nuevo y abre candidatos que antes estaban a dos cambios. La cadena avanza sola, de a un paso, y con cada comida registrada el sistema se equivoca menos (la curva de aprendizaje del mentor).

**"Qué aprendí" (plantillas, sin LLM):**
- "Papas fritas: aceptación 0,82 → 0,87 (comió todo)."
- "Brócoli: 3.ª exposición. Esta vez lo tocó (antes lo dejaba en el plato). Cada paso cuenta."
- "Nuevo patrón: lo crocante servido separado lo acepta (5 de 5)."
- "Contaste que no come nada verde, pero aceptó 3 veces arvejas en puré. ¿Actualizo la regla?"

---

## 9. Pista C · Producto y demo

**Objetivo:** que el padre registre en 30 segundos después de comer, que entienda de un vistazo si su hijo está comiendo bien, que el jurado lo pueda probar desde su celular y que el pitch cuente la historia en 3 minutos.

| # | Tarea | Entregable | Prior. |
|---|---|---|---|
| C1 | Scaffold: Vite + React + TS; `api/` con stubs que devuelven `fixtures/*.json`; `server/`, `shared/contratos.ts` (§5, v2), `data/`, `scripts/`; `npm run dev` levanta el front y la API local (`vercel dev`, o un mini servidor Express que monte `api/*`, para que nadie dependa de tener acceso al proyecto de Vercel); `vercel.json`; `.env.example`; CSS mínimo (por ejemplo, Pico.css); `.github/workflows/` con runners de Tenki (tests en cada push, evals a pedido) | Deploy vivo + push | P0 |
| C2 | Pantalla **Registrar**: `<input type="file" accept="image/*" capture="environment">` → canvas a 1024 px JPEG 0,8 + miniatura de 200 px → chequeo de foto movida (varianza del laplaciano sobre 256 px; calibrar el umbral con fotos reales) → "Analizando la comida…" → foto con cajas y etiquetas → ítems editables (borrar, cambiar porción) → **"¿Cómo le fue?"** (ver abajo) → preguntas de la IA → Guardar → **Resultado**: nutrientes con rangos + "Qué aprendí" + alertas si hay + "Ver cómo viene" | Flujo completo contra el fixture | P0 |
| C3 | **Tablero "¿está comiendo bien?"** (ver abajo) | Contra el fixture y después real | P0 / P1 |
| C4 | Integración en el deploy; prueba en iPhone (Safari) y Android (Chrome): cámara **y micrófono** | CP1 y CP2 | P0 |
| C5 | Grabador de voz: `MediaRecorder` con el formato que diga `isTypeSupported` (`audio/mp4` en Safari, `audio/webm` en Chrome), máx. 90 s, contador, cancelar, "Escuchando tu nota…" → `/api/relato-comida` → marcar los botones; resaltar lo que completó la IA y dejar sin marcar lo de `sinMencion`. Sin permiso de micrófono → campo de texto (el dictado del teclado) que va al mismo endpoint | Nota de voz → botones marcados | P1 (el primero) |
| C6 | (v5) **Alta desde cero por voz** (§5.2): bienvenida → un audio de hasta 3 min con la guía de lo vital (`/api/transcribir` → texto editable) → `/api/perfil-inicial` sin datos → "Esto entendí" con los datos extraídos, **alergias a confirmar tocándolas** y lo que falta → `POST /api/perfil` → registrar. El formulario queda solo para corregir | Chico nuevo desde un audio nuevo | P1 |
| C7 | Pantalla **Receta**: nutriente (por defecto, el primero de `semana.faltan`) → progreso por etapas ("Buscando en el grafo de Tomás… Escribiendo la receta… Validando alergias…") → tarjeta: **"Parte de: sus papas fritas · Cambia: el ingrediente · Se mantiene: bastón, crocante, salado"**, por qué (camino), qué aporta y cuánto de lo que falta, ingredientes en gramos, pasos, **cómo servirlo** (la imagen carga aparte) y **cómo ofrecerlo** | — | P1 |
| C8 | `/api/resumen` + pantalla: números de `progreso` y `perfil` → texto del LLM ("usá solo estos números") → copiar. Contenido: repertorio y tendencia, grupos ausentes, nutrientes por debajo de la referencia, exposiciones en curso, conducta en la mesa y alertas. Aclaración: "valores aproximados, no es un diagnóstico" | — | P1 |
| C9 | Errores y estados vacíos: timeout con reintento, sin comida, foto movida, sin micrófono, audio que no se entendió, sin conexión | — | P1 |
| C10 | ~~Modo jurado~~ **Descartado (v5).** El caso de ejemplo es el audio de alta de Tomás (§5.2). Tomás vive en `?nino=tomas` | — | — |
| C11 | README: qué es, cómo correrlo, arquitectura, componentes de IA, **tabla real / simulado / pendiente**, alcance declarado, resultados de calidad | — | P1 |
| C12 | Pitch: guion, 5–6 diapositivas, video de respaldo | — | P1 |
| C13 | Visualización del grafo (`react-force-graph` con `/api/grafo`) o captura de Neo4j Explore para la diapositiva | — | P2 |
| C14 | (v4) Switch "recomendador: base / grafo" en el tablero (`?motor=`, §4.3), para mostrar en vivo que el grafo sugiere mejor | — | P2 |

**"¿Cómo le fue?" en la pantalla Registrar:** arriba, un botón grande "Contame cómo le fue" (voz). Abajo, por cada ítem, los 7 botones de la escalera (§5.1) y, por comida, los chips de conducta. Con voz, la IA los marca y el padre solo corrige. Sin voz, se tocan los botones. Nunca se guarda sin que el padre confirme.

**Tablero, de arriba hacia abajo:**
1. **La frase** de "¿está comiendo bien?" (§1) y el banner de alertas, si hay ("conviene consultar a su pediatra o nutricionista").
2. **Cobertura semanal** por nutriente (barras contra el objetivo; la del día, como detalle al tocar). Energía aproximada como dato, sin meta.
3. **Próximo paso:** (v4) tres tarjetas con las `sugerencias`: *Va a gustarle* (segura), *Un pasito* ("Probá bastones de queso: se parecen a sus papas fritas") y *Más nutritiva*. Cada una dice su porqué, y las dos últimas abren la receta. Si `sugerencias` no llegó, una sola tarjeta con el `proximoPaso`.
4. **Evolución** de las últimas 4 semanas.
5. **Repertorio** (cuántas preparaciones acepta y la tendencia), **grupos** ("hace 5 días que no come verdura") y **exposiciones en curso** (la escalera de cada alimento nuevo).
6. **Lo que aprendimos** (patrones) y las últimas comidas.

- El chico activo se guarda en `localStorage` (con try/catch) y en la URL (`?nino=`).
- **Tono de la app:** se celebra explorar (lo dejó en el plato, lo tocó, lo probó); nunca se premia "comer todo"; sin metas de calorías; nunca se sugiere esconder alimentos; nunca se juzga un alimento seguro ni a la familia. Frase modelo: "Ofrecelo sin pedirle que lo coma; que esté en el plato ya es un avance."

---

## 10. Datos de referencia

### 10.1 Objetivos diarios por edad

Calcio, hierro y fibra salen de las *Recomendaciones de ingesta de energía y nutrientes para la población uruguaya* (MSP, 2020), que coinciden con las DRI del IOM. El resto, de las DRI del IOM (fichas del NIH ODS). **Antes de cargarlos, confirmar en las fichas del NIH ODS los de vitamina D, vitamina C, B12 y proteína** (el research no los pudo verificar en línea). Si el chico tiene nutricionista, su indicación reemplaza la tabla. La energía se muestra, pero no tiene meta.

| Nutriente | 1–3 | 4–8 | 9–13 masc. | 9–13 fem. | 14–18 masc. | 14–18 fem. |
|---|---|---|---|---|---|---|
| Proteína (g) | 13 | 19 | 34 | 34 | 52 | 46 |
| Calcio (mg) | 700 | 1000 | 1300 | 1300 | 1300 | 1300 |
| Vitamina D (µg) | 15 | 15 | 15 | 15 | 15 | 15 |
| Hierro (mg) | 7 | 10 | 8 | 8 | 11 | 15 |
| Fibra (g) | 19 | 25 | 31 | 26 | 38 | 26 |
| Omega-3, ALA (g) | 0,7 | 0,9 | 1,2 | 1,0 | 1,6 | 1,1 |
| B12 (µg) | 0,9 | 1,2 | 1,8 | 1,8 | 2,4 | 2,4 |
| **Vitamina C (mg)** | 15 | 25 | 45 | 45 | 75 | 65 |

**Ids de nutrientes en FDC:** energía 1008 · proteína 1003 · calcio 1087 · hierro 1089 · fibra 1079 · vitamina D (D2 + D3, µg) 1114 · B12 1178 · **vitamina C 1162** · omega-3 = ALA (1404, o 1270 si figura como "18:3" sin diferenciar) + EPA 1278 + DPA 1280 + DHA 1272. Si falta un valor, va 0 y se marca.

**Tablas de composición:** USDA FoodData Central como fuente principal (abierta y con API; es la más usada por los nutricionistas uruguayos). La Tabla de Composición de Alimentos de Uruguay (2002, 400 alimentos) para algún alimento local si hace falta. **Cada valor muestra de qué tabla sale.**

**Descarga, no API:** los CSV de FoodData Central se bajan una sola vez (dominio público). No hace falta key, no hay límite de pedidos (con `DEMO_KEY` eran 30 por hora por IP, compartida en la sede) y la app nunca depende de que la API de USDA responda. Para porciones de chicos, vale la pena mirar también la Child Nutrition Database de FNS, que está dentro de FoodData Central.

### 10.2 Patrones de investigación

Fuente `investigacion`; se confirman o se borran con los datos del chico.

| Patrón | Confianza inicial | Evidencia (research) |
|---|---|---|
| `textura=mixto → rechaza` | 0,4 | La textura es el motivo de rechazo dominante: 77% contra 36% en chicos sin autismo (Hubbard 2014); el 70% elige la comida por textura |
| `presentacion=mezclado → rechaza` | 0,4 | Rechazo de mezclas: 45% contra 26% |
| `presentacion=con_salsa → rechaza` | 0,35 | Misma evidencia; por defecto, las salsas van aparte |
| `textura=crocante → acepta` | 0,3 | "Lo crocante es un éxito"; es la preferencia más citada |
| `sabor=neutro ∧ color=beige → acepta` | 0,3 | Más del 90% prefiere textura uniforme, sabor suave y color neutro |
| `distribucion=tocandose → rechaza` | 0,15 | Lo reportan los padres, pero no distinguió a los chicos con TEA de los demás: se pregunta en el perfil |
| Color | No se carga | Ídem. Solo si el padre lo declara como regla |

La **marca** no es un atributo del vocabulario: se guarda en la preparación aceptada (`marca`) y la receta de tipo `fortificar` prefiere la misma marca.

### 10.3 Catálogo semilla de preparaciones

Puentes de food chaining desde lo típico (beige, crocante, neutro) hacia lo que suele faltar. Cada uno, a un solo cambio de algún alimento seguro típico.
- **Fortificar lo que ya come:** leche y yogur con vitamina D (de la misma marca si existe), cereal de desayuno fortificado, huevo enriquecido, pan con una parte de harina integral (avisando), aceite de canola en sus preparaciones.
- **Calcio:** bastones de queso horneados, chips de queso al horno, grisines con queso gratinado, yogur bebible, licuado de banana con leche, arroz con leche, pizza de muzzarella, panqueques.
- **Vitamina D y omega-3:** nuggets mitad pollo y mitad merluza (con aviso) → palitos de merluza al horno con el mismo apanado, croquetas de atún, huevo revuelto.
- **Hierro y proteína:** nuggets de pollo caseros con el mismo apanado que los que acepta, hamburguesa casera, milanesa de carne al horno, hamburguesa de lentejas crocante, garbanzos tostados, cereal fortificado.
- **Vitamina C:** papas al horno o puré, jugo de naranja colado y sin pulpa, frutillas o kiwi licuados y colados (con aviso), manzana en bastones.
- **Fibra:** chips de boniato al horno, bastones de zanahoria horneados, bastones de zapallo, galletitas integrales del mismo formato que las que acepta, galletitas de avena, pan integral, arvejas en puré.

### 10.4 Señales de alerta (código, `server/nutricion/alertas.ts`)

La app **detecta y deriva; no diagnostica ni trata.** Mensajes calmos, sin alarmar.

| Alerta | Regla | Mensaje |
|---|---|---|
| `repertorio_chico` | Menos de 10 preparaciones `acepta` (perfil + aprendidas), o declarado "menos de 15 alimentos" | "Tomás come pocos alimentos distintos. Vale la pena comentarlo con su pediatra o nutricionista." |
| `repertorio_baja` | Una preparación `acepta` no aparece en 14 días y no se sumó ninguna nueva | "Dejó de comer X y no apareció nada nuevo…" |
| `grupo_ausente` | Ninguna fruta ni verdura en 7 días, o ningún lácteo, o ninguna proteína | "Hace 7 días que no come frutas ni verduras…" |
| `sin_vitamina_c` | Cobertura semanal de vitamina C por debajo del 30% | "Casi no está recibiendo vitamina C. Su falta prolongada puede traer problemas: conviene consultar." |
| `arcadas` | Arcadas o vómitos en 2 o más comidas en 7 días | "Consultá con su pediatra." |
| `atragantamiento` | Desde la primera vez | "Si tose o se atraganta al comer, conviene consultar con su pediatra o con fonoaudiología." |
| `dieta_eliminacion` | Dieta `sin_gluten_caseina` declarada | "En esta dieta, el calcio y la vitamina D se vuelven prioridad. Conviene que la supervise un profesional." |
| `declarada` | Bajo peso, arcadas o vómitos, o menos de 15 alimentos, marcados en el perfil | "Recomendamos consultar a un profesional." |

### 10.5 Dataset sintético: 2 chicos con reglas ocultas (v4)

**Para qué.** No hay datos reales de chicos, y el mentor recomendó armar **2 o 3 chicos bien pensados** en lugar de 100 al azar: cada uno con su historia y sus patrones. Sirve para tres cosas: que B pruebe el aprendizaje desde ya (B14), que C tenga fixtures realistas para el tablero, y tener una **verdad de base** para la curva de §11.4. Cada chico tiene **reglas ocultas**, y el sistema tiene que descubrirlas solo a partir de las comidas.

**Archivos.** `node scripts/generar-sinteticos.mjs` escribe en `data/sinteticos/`:
- `tomas.json` y `lucia.json`: `{ datos, borrador, reglasOcultas, comidas }`. `datos` es un `DatosBasicos`, `borrador` un `PerfilBorrador` (lo que contó el padre), y `comidas` son 20 `RegistrarComidaReq` del 7 al 16 de octubre, con su relato y su `cita` por respuesta. `reglasOcultas` son solo para tests y evals: la app nunca las lee.
- `preparaciones.json`: las 28 preparaciones que usan, en formato `PreparacionCatalogo` y con la cocción. B11 las suma al catálogo.
- `indice.json`: los `alimentoId` que usan. **A3: tienen que existir en `alimentos.json`; si no, renombrarlos en el generador.**

El script controla el vocabulario, que las citas estén en la transcripción, que no haya alérgenos del chico y que cada regla oculta pase los umbrales de la minería (§8). Si algo no cierra, sale con error. Los JSON no se editan a mano: se cambia el generador y se vuelve a correr.

| | **Tomás** (6 años, alergia al huevo) | **Lucía** (10 años) |
|---|---|---|
| Perfil | Lo crocante y beige; 5 alimentos seguros | Lo blando y cremoso; 5 alimentos seguros |
| Lo que dijo el padre | "No come nada mezclado" | "No come nada verde" |
| Reglas ocultas | T1 crocante y separado → acepta · T2 blando → rechaza · T3 jugoso → rechaza · T4 mezclado → rechaza · T5 con salsa → rechaza | L1 crocante → rechaza · L2 verde en puré → acepta · L3 verde blando → rechaza |
| Lo que muestra | **La papa del mentor:** las papas al horno en bastones crocantes las come como las fritas, y las de cubos blandos no. Manda la textura, no la cocción. **La hamburguesa del mentor:** la hamburguesa no, la milanesa sí, las dos con papas fritas. **Su milanesa, con salsa (napolitana), no** | **Mismo alimento, otro chico:** las papas fritas que Tomás come siempre, ella las saca del plato. **Contradicción:** dijo "nada verde", pero las arvejas en puré las acepta (P2, "¿actualizo la regla?") |
| Exposiciones en curso | Bastones de queso: nada → toco → probó → poco → mitad (calcio) | Puré de zapallo: nada → … → mitad · Lentejas: nada → toco → probó (hierro) |
| Repertorio al final | 6 preparaciones en `acepta` → dispara `repertorio_chico` | 7 en `acepta` → también la dispara |

**Control actual** (media del patrón contra la del resto): T1 0,79 contra 0,24 · T2 0,03 contra 0,68 · T3 0,05 contra 0,63 · T4 0,03 contra 0,64 · T5 0,02 contra 0,64 · L1 0,07 contra 0,71 · L2 0,90 contra 0,66 · L3 0,00 contra 0,73. Las 8 pasan.

**Para B:** las primeras exposiciones de un alimento nuevo bajan la media del atributo, aunque el atributo le guste (los bastones de queso son crocantes y arrancan en `nada`). Si un patrón esperado no aparece con datos reales, probar sacar de la minería las preparaciones con menos de 3 exposiciones.

**Qué se declara:** es una simulación. Tomás, el de la demo, se sigue cargando a las 20:00 con el flujo real (§6), y este historial le sirve de guion para saber qué registrarle.

---

## 11. Comprobación de calidad (20% de la nota)

1. **Visión (A, P1).** 15–20 fotos: catering de hoy y fotos de casa (si alguna es de internet, se declara). `eval/etiquetas.json` lleva los `alimentoId` presentes y la textura, forma y color de cada uno. `scripts/eval-vision.ts` llama a la misma función que usa el endpoint y mide el % de alimentos reconocidos (recall y precisión por `alimentoId`), el % de atributos correctos y la latencia media. Sale una tabla para la diapositiva.
2. **Voz (A, P1).** 5–8 notas de voz grabadas por el equipo sobre fotos del punto anterior, con lo que "pasó" escrito antes de grabar (`eval/voz/relatos.json`). Al menos 2 en iPhone y 2 en Android. `scripts/eval-voz.ts` mide el % de ítems con el `cuanto` correcto, el % de conducta correcta, los **ítems inventados (tiene que dar 0)** y la latencia.
3. **Recetas (A, P2).** 12 recetas (3 perfiles con alergias × 4 nutrientes). Medir cuántas respetó el LLM por sí solo y cuántas quedan bien después de la validación por código (debería dar 12/12) en alergias, un solo cambio y lenguaje, y el % que cubre al menos el 20% de lo que falta. Frase para el pitch: "el LLM se equivocó X veces; el código lo atrapó siempre".
4. **Aprendizaje (B, P2, simulación declarada).** Chico virtual con reglas ocultas combinadas (por ejemplo, acepta lo verde solo en puré y separado, y rechaza todo lo mezclado). 20 comidas × 50 corridas. Recomendador base (α/β por atributo) contra grafo (patrones + propagación), los dos sobre el mismo catálogo y con las mismas funciones puras de producción. Curva de % de aceptación. (v4) Las reglas ocultas de Tomás y Lucía (§10.5) pueden ser dos de los chicos virtuales, y los dos recomendadores son los mismos del switch de §4.3.
5. **Gramos (P2).** 5 productos con peso conocido (yogur, alfajor, banana): error % de los gramos estimados.

---

## 12. Demo, pitch y qué declarar

**Guion (3:00)**

| Tiempo | Qué |
|---|---|
| 0:00–0:25 | **Problema:** entre el 45% y el 63% de los chicos con autismo tiene selectividad alimentaria. En los casos severos, el 97% está en riesgo de quedarse corto en vitamina D, el 91% en fibra y el 71% en calcio, y **el peso normal lo esconde** (Sharp 2018) |
| 0:25–0:40 | **Hoy:** registro en papel y una consulta cada 2 a 4 semanas. Una revisión de las tiendas de apps encontró solo 2 apps para la alimentación en autismo. El usuario: la familia de Tomás (caso ficticio) |
| 0:40–1:50 | **En vivo:** foto del plato de un juez o del catering → cajas y atributos → nota de voz ("comió las papas, el queso lo tocó y lo dejó") → los botones se marcan solos → guardar → nutrientes con rango + "qué aprendí" → **el tablero cambia: "¿está comiendo bien?"** |
| 1:50–2:20 | **Próximo paso:** la receta de food chaining ("parte de sus papas fritas, cambia solo el ingrediente: bastón y crocante, como siempre") + la imagen de cómo servirla, al lado de su alimento seguro |
| 2:20–2:45 | **Calidad:** % de reconocimiento medido, voz sin ítems inventados, alergias 12/12, curva si llegó |
| 2:45–3:00 | "Nibble no te dice qué cocinar a partir de una foto: aprende de cada comida cómo come tu hijo y te propone el paso más chico posible hacia lo que le falta. Si le sacás la IA, no hay lectura del plato, ni relato que se entiende, ni perfil que aprende, ni recetas a su medida" |

**Preguntas probables del jurado**

| Pregunta | Respuesta |
|---|---|
| ¿En qué se diferencia de FamEats o EatPal? | Ellos piden registrar a mano. Nosotros leemos la foto y la voz, calculamos la nutrición con una tabla real y aprendemos patrones combinados en un grafo. La revisión de apps no encontró ninguna que junte nutrición con tabla real, perfil sensorial, cadenas de alimentos y reporte para el profesional |
| ¿Por qué voz? | Después de comer, el padre tiene las manos ocupadas y al chico al lado: hablar 20 segundos cuesta menos que tocar 10 botones. Registrar tiene que costar casi nada |
| ¿Por qué un grafo y no un prompt? | Las relaciones combinadas no entran en el contexto y el modelo alucina. Al LLM le llegan unas 20 líneas de evidencia. Mostramos la curva grafo contra base |
| ¿Qué tan precisa es la nutrición? | Los gramos tienen ~35% de error por comida, por eso mostramos rangos y el indicador es semanal. Este es nuestro resultado medido: … |
| ¿Es seguro? | Alergias a mano y validadas por código, sin metas de calorías, sin esconder alimentos, sin lenguaje de presión, alertas que derivan al profesional. No reemplaza al nutricionista |

**Qué declarar (README + una diapositiva):**

| Parte | Estado |
|---|---|
| Visión, preguntas, transcripción y extracción del relato, extracción del perfil, receta, imagen, resumen | IA real: Claude (Haiku 5.5 y Sonnet 5.5), Whisper large-v3-turbo en Groq, FLUX en Cloudflare Workers AI |
| Nutrientes | Código + USDA FoodData Central (descarga completa; cada valor muestra su `fdcId`) |
| Grafo, aceptación, exposiciones, patrones, propagación, food chaining, alertas | Código propio + Neo4j (conocimiento) y MongoDB (eventos) |
| Tomás | Caso ficticio, cargado con el flujo real; historial con fotos de ejemplo y fechas retroactivas |
| Catálogo semilla de preparaciones | Curado por el equipo (borrador asistido por LLM, revisado a mano) |
| Chico virtual de la curva | Simulación |
| Dataset sintético de Tomás y Lucía (§10.5) | Simulación: se usa para desarrollar y testear; si aparece en la demo, se dice |
| Foto de lo que quedó, comunidad, notificaciones, login | Pendiente |

**Alcance declarado** (para cuando el jurado cambie el caso): comidas caseras o comunes en Uruguay, un plato por foto, alimentos del catálogo; los demás se aproximan por grupo y la app pregunta. Relatos en español.

**Hoy mismo:** saquen foto de todo lo que coman (merienda, cena, catering) y graben una nota de voz contando "cómo les fue". Es el dataset de evaluación y la reserva para la demo.

---

## 13. Riesgos y planes B

| Riesgo | Señal | Plan B | Dueño |
|---|---|---|---|
| Neo4j no conecta desde Vercel | 15:30 sin `/api/salud` OK | Colecciones `nodos` y `relaciones` en Mongo, misma interfaz | B |
| Mongo rechaza la conexión desde Vercel | `/api/salud` | Conectar con la integración de Vercel Marketplace; si no, permitir 0.0.0.0/0 en Atlas (prototipo, sin datos reales) | B |
| La imagen no sale (FLUX o cupo de Workers AI) | Error en A1 | Nano Banana con billing; si no, la imagen queda como pendiente declarado | A |
| Se acaba un free tier (Groq, Workers AI o el respaldo de Gemini) cuando el jurado prueba a la vez | Error 429 | Respaldo en cadena por env var; antes del pitch, mirar el cupo real en cada consola | A |
| Audio en iPhone: formato o permiso de micrófono | A1 o CP2 | `isTypeSupported` para elegir el formato; Whisper acepta mp4 y webm; si falla, el campo de texto con el dictado del teclado usa la misma extracción | A / C |
| Transcripción lenta o sin cupo | > 5 s, o error 401 o 429 | Workers AI y después faster-whisper en Tenki (§4.1); si no, texto | A |
| La IA marca ítems que el padre no mencionó | Eval de voz | `sinMencion` + confirmación obligatoria antes de guardar | A / C |
| Receta con presión, ingredientes escondidos o dos cambios | Validación | Lista prohibida + chequeo de `cambio` por código + reintento | A |
| Vercel bloquea los deploys de colaboradores | Deploy "blocked" | Repo público, o un solo dueño hace `vercel --prod` | C |
| La visión tarda | > 8 s | Razonamiento al mínimo, foto a 1024 px, mensajes de progreso | A / C |
| JSON inválido | Error de Zod | Salida estructurada + 1 reintento con el error | A |
| Foto rara (sin comida, movida, comida desconocida) | — | `sinComida`, chequeo de foto movida, `otro_<grupo>` + pregunta | A / C |
| iPhone: HEIC, orientación, cámara | CP1 | Todo pasa por canvas → JPEG; probar a las 16:45 en un iPhone real | C |
| Pocas comidas, ningún patrón | — | Patrones de investigación como base + historial de Tomás | B |
| Pocos candidatos a un solo cambio | `armarEvidencia()` vacío | Ampliar el catálogo; como último recurso, 2 cambios marcados como "salto más grande" | B |
| Se cae el wifi en el pitch | — | Hotspot del celular + video de respaldo | C |
| Conflictos de git | — | Carpetas por pista, `pull --rebase`, commits chicos | Todos |

---

## 14. Reglas de trabajo

- **Git:** todos a `main`, commits chicos cada 30–45 min con mensajes claros, `git pull --rebase` antes de cada push, nunca `--force`. Cada pista toca sus carpetas. `shared/contratos.ts`: solo cambios aditivos y avisando.
- **Secretos:** en `.env.local` (dentro de `.gitignore`), nunca en el repo. En Vercel los carga el dueño del proyecto.
- **La suscripción de Claude es solo para desarrollar:** Claude Code y los agentes del equipo la usan; la app desplegada usa siempre `ANTHROPIC_API_KEY` (§4.1).
- **Stubs primero:** cada endpoint existe desde el CP0 devolviendo su fixture; el dueño lo reemplaza sin cambiar el contrato.
- **Con Claude Code:** dale a tu agente "PLAN.md, pista X, tarea Y" como contexto, y el research para las reglas del motor. Lo mecánico (catálogos, scripts, pantallas contra fixture) va en segundo plano mientras vos iterás prompts o algoritmos.
- **Nada hardcodeado que parezca IA.** Si algo se simula, se nombra en el README.

---

## 15. Preguntas abiertas

1. ¿Quién toma cada pista? (A: el más cómodo con prompts; B: con backend y datos; C: con frontend y presentación.)
2. ¿Qué créditos dio la organización además de Tenki? ¿Qué incluyen exactamente los USD 250 de Tenki y cómo se expone el puerto de un sandbox?
3. ~~¿Ponemos unos USD 5 en la API de Claude?~~ **Decidido (17/10): Claude por API, con los USD 200 de créditos ya cargados.** Haiku 5.5 para visión, relato, perfil y resumen; Sonnet 5.5 para recetas. Gemini Flash-Lite y Llama 4 Scout en Groq quedan como respaldo gratis por `PROVEEDOR_IA`. La transcripción sigue gratis con Groq.
4. **¿Cuándo se saca la foto?** Supuesto del plan: es la del plato tal como se sirvió (se puede sacar al servir y subir después de comer). La de lo que quedó es P2.
5. ¿A qué hora son los pitches el domingo? ¿Van a trabajar de noche desde casa?
6. ¿Se puede hacer público el repo?
7. ¿Alguien ya maneja Neo4j/Cypher? Si nadie, el grafo puede arrancar en colecciones de Mongo y pasar a Neo4j cuando ande.
8. ¿Ya se les escribió a la nutricionista y a la psicopedagoga? Para la psicopedagoga, sumar la escalera de §5.1 y los chips de conducta: que los valide.
