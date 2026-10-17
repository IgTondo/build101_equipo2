# Pista C · notas de trabajo

> Se actualiza con cada push. Referencia: PLAN.md §9.

## Deploy

- **Producción:** https://nibble-eight-vert.vercel.app (proyecto `nibble` de Vercel, cuenta de la pista C, plan Hobby).
- **Cómo se despliega:** todavía no con cada push (el repo es de IgTondo y Vercel no está conectado a GitHub). Plan B de §13: **la pista C corre `npm run deploy`**. Avisen en el grupo cuando quieran ver algo en producción.
- **Para que despliegue solo**, IgTondo carga en el repo (Settings → Secrets → Actions) `VERCEL_TOKEN` (se lo pasa C por privado), `VERCEL_ORG_ID=team_ekrauFrt3XXmjZ9CszBjDlpj` y `VERCEL_PROJECT_ID=prj_b2AXoi50UoDQU1hksfRZTIOHwxKj`, y C suma el workflow.
- **Variables en Vercel:** hoy solo `PROVEEDOR_IA=claude` y `MOTOR_GRAFO=neo4j`. `/api/salud` en producción dice qué falta. Las keys se las pasan a C por privado: van a `.env.local`, `npm run env:vercel` (las sube sin imprimirlas) y `npm run deploy`.
- **MongoDB Atlas (B2):** https://vercel.com/integrations/mongodbatlas sobre el proyecto `nibble`, o el `MONGODB_URI` de un cluster Free (permitir 0.0.0.0/0, §13). **Si Neo4j no está listo, pasar `MOTOR_GRAFO=mongo`.**
- **Antes de la demo:** crear al Tomás de la demo con id `tomas` (`crearPerfil({ ninoId: 'tomas', … })`): la app lo abre por defecto (`NINO_DEMO` en `src/lib/nino.ts`). Sin eso, la primera apertura sin `?nino` muestra "No encontramos este perfil".

## Hecho (en main)

| Tarea | Qué |
|---|---|
| C1 | Scaffold, contratos + `ErrorApi`, 12 stubs con `x-nibble-stub: 1`, fixtures, API local, CI |
| C2 + C5 + C9 | Registrar: foto, foto movida, ítems con cajas, "¿cómo le fue?" con voz o texto, guardar, resultado |
| C3 + C14 | Tablero completo + switch grafo/base. Si la semana de hoy está vacía y hay historial, pide `hasta` con la última comida |
| C6 + C10 | Perfil inicial, vista del perfil y modo jurado (`/perfil/nuevo?demo=1`) |
| C7 | Receta con food chaining e imagen aparte |
| C8 | `/api/resumen`: números de `obtenerProgreso` y `obtenerPerfil` de B (fixtures sin Mongo), texto por Claude Haiku con chequeo de números, plantilla de respaldo |
| C9 | Aviso global "Datos de ejemplo" mientras un endpoint siga en stub; 404 de un chico inexistente con un estado calmo |
| C11 / C12 | README para el jurado y guion del pitch (`pitch/guion.md`) |
| C13 | Grafo del chico en `/grafo` (sobre `GET /api/perfil?vista=grafo`; sin Mongo, `fixtures/perfil-grafo.json`) |

**Integración con B real (17/10):** con Mongo en memoria, `MOTOR_GRAFO=mongo` y los sintéticos cargados, todas las pantallas funcionan contra B. **El CP2 pasa:** perfil nuevo → tablero vacío → registrar (real) → el tablero cambia. Solo se simularon los endpoints de IA (no hay keys).

## Pendiente

- **C4:** probar en iPhone y Android con las keys cargadas (cámara, HEIC, micrófono, `audio/mp4`) y calibrar `UMBRAL_MOVIDA` (hoy 60) con fotos reales.
- **C8:** pasar `server/resumen/texto.ts` a `generarTexto` de `server/ia/modelo.ts` (A4 ya está).
- **C12:** diapositivas y QR (esperan las evals y la URL final).
- **Fixtures:** `scripts/generar-fixtures.ts` puede leer `data/alimentos.json` y usar un segundo candidato válido (`leche_chocolatada → yogur_bebible`, cambia el ingrediente), pero los tests de A (`server/ia/receta.test.ts`, `server/validacion/receta.test.ts`, `server/ia/prompts/receta.test.ts`) tienen fijados los números del fixture actual. Lo hacemos juntos con A cuando convenga.

## Para B

1. `server/aprendizaje/aprendi.ts:29,31,35`: el padre ve "aceptación 0,97 → 0,68 (lo apartó)". Mejor sin el número ("le está costando más que antes").
2. `server/aprendizaje/textos.ts:86`: "lo rechaza" → "todavía no lo acepta" (C ya lo reescribe en pantalla, pero conviene en el origen). Concordancia: "Los cereales, panes y papas servido**s** separado**s** los acepta".
3. `server/nutricion/alertas.ts`: no disparar `repertorio_baja` si no hay comidas en la ventana (l. 67); "en los 19 días registrados" cuenta días de calendario (l. 54); "Dejar grupos enteros…" se repite por grupo (l. 55).
4. `server/nutricion/progreso.ts:104`: un chico creado hoy dice "igual que la semana pasada"; omitir la comparación si no hay semana anterior.
5. `/api/progreso?motor=base` devuelve las mismas tres sugerencias que `grafo` (solo cambia `probAcepta`): en la demo el switch no muestra diferencia.
6. `server/datos/cargar.ts:19`: el mensaje de error del 404 incluye el id del chico.
7. `server/datos/validar.ts` (`item()`) descarta `nombreIngles`; si se va a buscar en `alimentos_fdc` al registrar, hay que conservarlo.
8. Grafo (`vista=grafo`): mandar `confianza` y `apoyo` en las props de los patrones (hoy C los saca del texto "(n de m)").
9. Si el padre renombra un ítem llega `preparacionId: null` (B ya lo acepta); las reglas escritas a mano llegan con `condiciones: []`.

## Para A

- `api/receta.ts`: C le sumó el respaldo de B (sin `MONGODB_URI` responde el fixture con `x-nibble-stub: 1`), porque sin base daba 500 `interno` en producción. Una línea después de validar; cámbienlo si prefieren otra cosa.
- Propuesta aditiva para contratos: `excluir?: string[]` en `RecetaReq`, para que "Otra opción" no repita recetas.
