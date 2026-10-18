# Pista C · notas de trabajo

> Se actualiza con cada push. Referencia: PLAN.md §9.

## Deploy

- **Producción:** https://nibble-eight-vert.vercel.app (proyecto `nibble` de Vercel, cuenta de la pista C, plan Hobby).
- **Cómo se despliega:** todavía no con cada push (el repo es de IgTondo y Vercel no está conectado a GitHub). Plan B de §13: **la pista C corre `npm run deploy`**. Avisen en el grupo cuando quieran ver algo en producción.
- **Para que despliegue solo**, IgTondo carga en el repo (Settings → Secrets → Actions) `VERCEL_TOKEN` (se lo pasa C por privado), `VERCEL_ORG_ID=team_ekrauFrt3XXmjZ9CszBjDlpj` y `VERCEL_PROJECT_ID=prj_b2AXoi50UoDQU1hksfRZTIOHwxKj`, y C suma el workflow.
- **Variables en Vercel (17/10, 21 h): todas cargadas** (Anthropic, Groq, Cloudflare, Mongo, Neo4j). `/api/salud` en producción: los 5 servicios en verde. Para cambiar una: `.env.local` → `npm run env:vercel` (no imprime valores) → `npm run deploy`.
- **La red de la sede bloquea los puertos de las bases** (27017 y 7687; también SSH, el 22: para pushear, `git -c url."https://github.com/".insteadOf="git@github.com:" push`). Los scripts que hablan directo con Mongo o Neo4j (`seed-grafo.ts`, `cargar-sinteticos.ts`, `usda.ts --subir`) no corren desde acá: hace falta otra red (hotspot del celular). Lo que sí anda es cargar por la API de producción.
- **Datos en producción:** `sint-tomas` y `sint-lucia` (los sintéticos de §10.5, simulación declarada), cargados por la API con los algoritmos reales de B. Falta el seed del grafo y `alimentos_fdc` (sin red; no bloquean: la receta real funcionó).
- **MongoDB Atlas (B2):** https://vercel.com/integrations/mongodbatlas sobre el proyecto `nibble`, o el `MONGODB_URI` de un cluster Free (permitir 0.0.0.0/0, §13). **Si Neo4j no está listo, pasar `MOTOR_GRAFO=mongo`.**
- **Antes de la demo:** crear al Tomás de la demo con id `tomas` (`crearPerfil({ ninoId: 'tomas', … })`) y abrir una vez `/?nino=tomas` en el celular de la demo (queda en `localStorage`). Desde la v5 la app ya no abre a Tomás por defecto: sin chico activo va al alta por voz (`/perfil/nuevo`).

## Hecho (en main)

| Tarea | Qué |
|---|---|
| C1 | Scaffold, contratos + `ErrorApi`, 12 stubs con `x-nibble-stub: 1`, fixtures, API local, CI |
| C2 + C5 + C9 | Registrar: foto, foto movida, ítems con cajas, "¿cómo le fue?" con voz o texto, guardar, resultado |
| C3 + C14 | Tablero completo + switch grafo/base. Si la semana de hoy está vacía y hay historial, pide `hasta` con la última comida |
| C6 | (v5) Alta desde cero por voz (`/perfil/nuevo`, §5.2): bienvenida → audio de hasta 3 min con la guía → texto editable → "Esto entendí" con citas, alergias a confirmar tocándolas y lo que falta → crear → registrar. Sin chico activo, las pantallas van al alta. Vista del perfil con "Lo que sabemos de <nombre>" (le gusta, está probando, lo que notamos), sin "Agregar otro chico" |
| C10 | Descartado en la v5: se sacó el modo jurado (`?demo=1`, relato de ejemplo, QR, avisos de "perfil de ejemplo") |
| C7 | Receta con food chaining e imagen aparte |
| C8 | `/api/resumen`: números de `obtenerProgreso` y `obtenerPerfil` de B (fixtures sin Mongo), texto por Claude Haiku con chequeo de números, plantilla de respaldo |
| C9 | Aviso global "Datos de ejemplo" mientras un endpoint siga en stub; 404 de un chico inexistente con un estado calmo |
| C11 / C12 | README para el jurado y guion del pitch (`pitch/guion.md`) |
| C13 | **Sacado de la vista del padre**: ya no hay `/grafo` ni `react-force-graph-2d`. Lo que sabemos del chico se muestra simple en el Perfil (le gusta, está probando, lo que notamos). Para el pitch, captura de Neo4j. `GET /api/perfil?vista=grafo` y `fixtures/perfil-grafo.json` quedan en el back |

**Cómo probar:** ver [`PROBAR.md`](../PROBAR.md).

**Integración con B real (17/10):** con Mongo en memoria, `MOTOR_GRAFO=mongo` y los sintéticos cargados, todas las pantallas funcionan contra B. **El CP2 pasa:** perfil nuevo → tablero vacío → registrar (real) → el tablero cambia. Solo se simularon los endpoints de IA (no hay keys).

## Pendiente

- **C4:** probar en iPhone y Android con las keys cargadas (cámara, HEIC, micrófono, `audio/mp4`) y calibrar `UMBRAL_MOVIDA` (hoy 60) con fotos reales.
- **C8:** pasar `server/resumen/texto.ts` a `generarTexto` de `server/ia/modelo.ts` (A4 ya está).
- **C12:** diapositivas (esperan las evals).
- **Fixtures:** `scripts/generar-fixtures.ts` puede leer `data/alimentos.json` y usar un segundo candidato válido (`leche_chocolatada → yogur_bebible`, cambia el ingrediente), pero los tests de A (`server/ia/receta.test.ts`, `server/validacion/receta.test.ts`, `server/ia/prompts/receta.test.ts`) tienen fijados los números del fixture actual. Lo hacemos juntos con A cuando convenga.

## Para B

000. ✓ (hecho por C, e16c256) **"Qué aprendí" que confunde al padre** (visto en producción, 17/10): *"Ya no se cumple: lo mezclado todavía no lo acepta"* (parece decir que ahora sí acepta lo mezclado) y *"Con lo que registraste, no se cumple lo que dice la investigación: lo que se sirve cuando los alimentos se tocan todavía no lo acepta"*. Los `patron_borrado` y las contradicciones con la investigación son para el equipo, no para el padre: mejor no mostrarlos, o con una frase positiva ("Esta vez comió bien aunque los alimentos se tocaban"). Ahora: los borrados de "lo acepta" no se muestran; de los "todavía no lo acepta", uno por comida y solo si esta comida lo explica ("Lo mezclado ya no parece costarle tanto (esta vez comió arroz con pollo)"; de la investigación: "… no parece costarle, aunque a muchos chicos les cuesta (…)"). La contradicción con la regla del padre queda: "Contaste: "No come nada mezclado". Pero esta vez comió arroz con pollo, y ya van 3 veces que come algo así. ¿Actualizo la regla?".
00. ✓ (hecho por C, b601302) `server/datos/cargar.ts:35` (`cargarNino`): en el `Promise.all`, si `col.comidas()` tira sincrónico (sin `MONGODB_URI`), la promesa de `leerNino` queda rechazada sin atrapar y **Node mata la API local**. C le puso a `obtenerContexto()` un `if (!hayMongo()) return null` (en producción no cambia nada); conviene arreglar el origen (por ejemplo, `const comidas = col.comidas()` antes del `Promise.all`).
0. **v5.1, la próxima comida (PLAN §9, "La pantalla principal"):** la pantalla pide `GET /api/progreso?…&momento=almuerzo` (la comida que sigue). Pedido: (a) con `momento`, ordenar las `sugerencias` para esa comida (que para la cena no salga un yogur bebible) y que `segura` saltee lo servido en la última comida de ese momento; (b) llenar `Sugerencia.grupo`. Mientras no esté, el front elige entre las tres según el grupo de `data/preparaciones.json`. La receta ya recibe `RecetaReq.momento` (A lo puede sumar al prompt).
1. ✓ (hecho por C, e16c256; fixture en 4d06077) `server/aprendizaje/aprendi.ts:29,31,35`: el padre ve "aceptación 0,97 → 0,68 (lo apartó)". Mejor sin el número ("le está costando más que antes"). Ahora: "le está gustando más (comió todo)" / "le está costando más que antes (lo apartó)"; si no cambia, no se dice.
2. ✓ (hecho por C, 8e1270d) `server/aprendizaje/textos.ts:86`: "lo rechaza" → "todavía no lo acepta" (C ya lo reescribe en pantalla, pero conviene en el origen). Concordancia: "Los cereales, panes y papas servido**s** separado**s** los acepta". `fraseParaPadres` (sabemos.ts) entiende el texto nuevo y el viejo; `textoParaPadres` queda como red.
3. ✓ (hecho por C, e13d45b y ac1092e) `server/nutricion/alertas.ts`: no disparar `repertorio_baja` si no hay comidas en la ventana (l. 67); "en los 19 días registrados" cuenta días de calendario (l. 54); "Dejar grupos enteros…" se repite por grupo (l. 55). Ahora `grupo_ausente` es una sola alerta y tampoco salta sin comidas en la semana.
4. ✓ (hecho por C, 1e295e3) `server/nutricion/progreso.ts:104`: un chico creado hoy dice "igual que la semana pasada"; omitir la comparación si no hay semana anterior.
5. `/api/progreso?motor=base` devuelve las mismas tres sugerencias que `grafo` (solo cambia `probAcepta`): en la demo el switch no muestra diferencia.
6. ✓ (hecho por C, b601302) `server/datos/cargar.ts:19`: el mensaje de error del 404 incluye el id del chico.
7. ✓ (hecho por C, 5e086b8) `server/datos/validar.ts` (`item()`) descarta `nombreIngles`; si se va a buscar en `alimentos_fdc` al registrar, hay que conservarlo.
8. ~~Grafo (`vista=grafo`)~~ (ya no lo usa el front, se sacó `/grafo`): mandar `confianza` y `apoyo` en las props de los patrones (hoy C los saca del texto "(n de m)").
9. Si el padre renombra un ítem llega `preparacionId: null` (B ya lo acepta); las reglas escritas a mano llegan con `condiciones: []`.
- ✓ (v5.3, hecho por C) **El plato de una comida** (PLAN §5.3): `server/aprendizaje/plato.ts` (`armarPlato`, función pura, sin I/O) y `obtenerProgreso` lo devuelve en `Progreso.plato` solo con `?momento=` (reusa la entrada y las sugerencias del recomendador y `Progreso.dias` de hoy: sin lecturas nuevas; sin momento, nada cambia). Reglas: lo seguro es lo que está en `acepta`, del catálogo con ese `momentos`, sin alérgenos (`esSegura`) ni reglas violadas (`reglaQueViola`); orden por p × aporte al nutriente (porción mediana); uno por grupo (3 en almuerzo y cena si hay tres grupos; 2 en el resto; 2 del mismo grupo solo si no hay otro; nunca 3); si todo lo seguro ya estuvo en la última comida de ese momento, rota el de menos puntaje por otro que acepta (mismo grupo primero). El pasito es la sugerencia `un_paso` (si no, `mas_nutritiva`), igual a la del tablero (su `aporte` sigue por porción mediana; `cubre` lo cuenta en chica, ×0,6) y **no va si no hay nada seguro** (lo nuevo va al lado de lo que ya come, §7). `nutriente` = `hoy.faltan[0]` (de menor a mayor cobertura) o, sin comidas hoy, el de la semana; `cubre` = (seguros + pasito chico) ÷ (objetivo − consumido hoy), con tope 1. Ojo B: si cambian `recomendar()` o las sugerencias, el pasito cambia con ellas; con el `faltan` del día, la vitamina D suele ir primera y el `cubre` sale bajo (es lo que pide §5.3, pero se puede discutir usar el orden de §1).
- ✓ (hecho por C, bac5bf0) Las suites de integración (`server/datos/integracion.test.ts`, `server/grafo/neo4j.test.ts`) tienen 60 s por test: "vista=grafo, y el grafo se reconstruye…" tarda ~30 s contra Atlas.

## Para A

- **A8b (PLAN §5.2) es lo que falta para el alta por voz.** La pantalla ya manda `POST /api/perfil-inicial` con `{ texto }` solo; hoy responde 400 (`datos` obligatorio) y la app cae en la transición (pide nombre, edad y sexo y reenvía). Con A8b: `datos` opcional en el contrato y en el esquema, y la respuesta con `datos: DatosExtraidos` (cada valor con su `cita` literal; la app descarta lo que no la traiga) y `faltan`. Probado en producción con el audio de Tomás: el borrador ya sale idéntico a `data/sinteticos/tomas.json`.
- **Whisper con silencio:** un audio casi mudo devolvió `"Gracias. Gracias."` con 200. Tendría que ser 422 `audio_no_entendido` (`server/ia/voz.ts`, el filtro de frases que Whisper inventa).

- **Prueba en producción (17/10):** visión 5,8 s, relato 1,8 s, transcripción 1,8 s, receta 9,5 s (validación OK sin reintentos), imagen 3,0 s, resumen 8,7 s por LLM. Todo con una llamada por función.
- **Visión:** con `sint-tomas` (alérgico al huevo), la foto de milanesa con papas devolvió `milanesa_carne_con_huevo`. Su milanesa conocida es `milanesa_carne_horno` (sin huevo): con el contexto del chico, conviene preferir su preparación conocida y preguntar si duda.
- **Imagen del plato:** la receta "parte de papas al horno **en bastones**", pero FLUX dibujó las papas **en cubos**. En food chaining la forma del alimento seguro es justo lo que se mantiene: el prompt tendría que fijar la forma (y la textura) de `desde`.

- `api/receta.ts`: C le sumó el respaldo de B (sin `MONGODB_URI` responde el fixture con `x-nibble-stub: 1`), porque sin base daba 500 `interno` en producción. Una línea después de validar; cámbienlo si prefieren otra cosa.
- Propuesta aditiva para contratos: `excluir?: string[]` en `RecetaReq`, para que "Otra opción" no repita recetas.
