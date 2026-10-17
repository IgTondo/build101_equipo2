# Pista C · notas de trabajo

> Se actualiza con cada push. Referencia: PLAN.md §9.

## Deploy

- **Producción:** https://nibble-eight-vert.vercel.app (proyecto `nibble` de Vercel, en la cuenta de la pista C, plan Hobby).
- **Cómo se despliega:** todavía no con cada push. El repo es de IgTondo y la app de Vercel para GitHub no está instalada en esa cuenta, así que hoy aplica el plan B de §13: **un solo dueño (pista C) corre `npm run deploy`**. Avisen en el grupo cuando pusheen algo que quieran ver en producción.
- **Para que despliegue solo con cada push**, IgTondo (dueño del repo) puede elegir una de dos:
  1. Cargar en el repo (Settings → Secrets → Actions) `VERCEL_TOKEN`, `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID` (se los pasa C), y C suma el workflow de deploy.
  2. Transferir el repo a una organización de GitHub donde C pueda instalar la app de Vercel.
- **Variables en Vercel:** `PROVEEDOR_IA=claude` y `MOTOR_GRAFO=neo4j` ya están. Faltan todas las keys. Cuando las tengan, pásenselas a C (por privado, nunca en el repo): C las pone en su `.env.local` y corre `npm run env:vercel`, que las sube a production, preview y development sin imprimirlas, y después `npm run deploy`.
- **MongoDB Atlas (B2):** la integración del Marketplace se instala desde el navegador sobre el proyecto `nibble`: https://vercel.com/integrations/mongodbatlas. Alternativa: B crea el cluster Free en Atlas y le pasa a C el `MONGODB_URI` (permitir 0.0.0.0/0, §13).
- `/estado` en producción muestra qué endpoints siguen en stub.

## Hecho (en main)

| Tarea | Qué |
|---|---|
| C1 | Scaffold, contratos + `ErrorApi`, 12 stubs con `x-nibble-stub: 1`, fixtures, API local, CI |
| C2 + C5 + C9 | Registrar: foto, foto movida, ítems con cajas, "¿cómo le fue?" con voz o texto, guardar, resultado |
| C3 + C14 | Tablero completo + switch de recomendador grafo/base |
| C6 + C10 | Perfil inicial (datos, relato, "esto entendí"), vista del perfil y modo jurado (`/perfil/nuevo?demo=1`) |
| C7 | Receta con food chaining e imagen aparte |
| C8 | `/api/resumen` real (números por código, texto por Claude Haiku, plantilla de respaldo) + pantalla |
| C11 / C12 | README para el jurado y guion del pitch (`pitch/guion.md`) |

## Pendiente

- **C4:** probar en iPhone y Android sobre producción (cámara, HEIC, micrófono, `audio/mp4`) y calibrar `UMBRAL_MOVIDA` (hoy 60) con fotos reales.
- **C8:** pasar `server/resumen/texto.ts` a `generarTexto` de `server/ia/modelo.ts` cuando A4 esté implementado, y `server/resumen/datos.ts` a las funciones reales de B7 y B8 (hoy lee fixtures y responde con `x-nibble-stub: 1`).
- **C12:** diapositivas y QR (esperan los resultados de las evals y la URL final).
- **C13 (P2):** visualización del grafo. No hay lugar para un `/api/grafo` (sería la función 13); propuesta: que B lo sirva con `GET /api/perfil?ninoId&vista=grafo`.

## Para A y B

- **B:** si el padre renombra un ítem en Registrar o en el perfil, llega `preparacionId: null` y hay que resolverlo por nombre.
- **B:** las reglas escritas a mano en el perfil llegan con `condiciones: []` y `efecto: 'rechaza'`.
- **B:** los textos de patrones dicen "lo rechaza"; con los padres conviene "todavía no lo acepta" (la vista del perfil muestra "Todavía no").
- **B:** el stub de `POST /api/perfil` siempre devuelve `tomas`; hasta que esté el real, el modo jurado termina en Tomás.
- **A:** propuesta aditiva para contratos: `excluir?: string[]` en `RecetaReq`, para que "Otra opción" no repita recetas cuando se agotan los candidatos de la evidencia.
