# Cómo probar Nibble

> Para el equipo. Producción: **https://nibble-eight-vert.vercel.app** · Estado de los servicios: [`/api/salud`](https://nibble-eight-vert.vercel.app/api/salud) (todo `"ok": true`) y [`/estado`](https://nibble-eight-vert.vercel.app/estado).

## 1. En el celular, sobre producción (lo recomendado)

No hay que instalar nada, y es la única forma de probar la cámara y el micrófono: el navegador solo los habilita con HTTPS.

**Antes:** abrila en una **pestaña privada** (o borrá los datos del sitio). La app recuerda el último chico que usaste; en privado arranca como la primera vez.

### A · Alta desde cero por voz (PLAN §5.2)
1. Abrí la URL: sin ningún chico, te lleva sola a **"Contanos de tu hijo"**.
2. **Empezar** → **Contalo con tu voz** → leé en voz alta el audio de ejemplo de abajo (o contá de un chico inventado) → **Listo, terminé**.
3. Revisá el texto que transcribió y tocá **Ver qué entendimos**.
4. Mientras la pista A no termine A8b, la app te pide **nombre, edad y sexo** en un paso aparte. Después ya no.
5. En **"Esto entendimos"** revisá lo que come, lo que no y sus reglas. **No te deja crear el perfil hasta que contestes las alergias**: tocá las que tiene, o "No tiene alergias".
6. **Listo, crear** → te lleva a Registrar con el chico nuevo.

**Audio de ejemplo (Valentina el primer día, ~45 s):**
> Hola, te cuento de Valentina. Tiene ocho años, pesa veinticinco kilos y mide un metro veintisiete. Es alérgica al pescado, eso es lo más importante. No tiene ninguna dieta especial ni toma suplementos. Come pocas cosas, pero las que come las come siempre: la leche chocolatada fría a la mañana, la Conaprole; las galletitas de agua Maestro Cubano; tostadas de pan blanco; la milanesa de carne al horno; el puré de papa; y las papas fritas en bastones. Lo que no come son los fideos con salsa de tomate, porque está todo mezclado, y el brócoli, por el olor. Come solo en su plato con divisiones y no quiere que las comidas se toquen. Verduras, ninguna. No tiene arcadas ni se atraganta.

Tiene que entender 6 cosas que acepta, 2 que rechaza (los fideos con salsa por estar mezclados, el brócoli por el olor) y 3 reglas: "plato con divisiones", "que no se toquen" y "no come verduras".

### B · Registrar una comida (el ciclo principal)
1. En el inicio, **Registrar comida** (ya viene marcada la comida que corresponde por la hora) → sacale una foto a un plato de verdad (la del catering sirve).
2. Tienen que aparecer los alimentos con sus **cajas** sobre la foto. Podés renombrar, borrar o cambiar la porción.
3. **¿Cómo le fue?** → **Contame cómo le fue** y hablá, por ejemplo: *"Las papas se las comió todas; la milanesa la probó y la dejó; estuvo tranquila"*. Los botones se marcan solos y cada uno muestra la frase que dijiste. Lo que no nombraste queda sin marcar.
4. **Guardar** → nutrientes con su rango, **"Qué aprendí"** y al final la **próxima comida** (después del almuerzo, "Para la cena").
5. **Volver al inicio** → "Hoy" tiene que contar la comida (las barras del día y "Desayuno y almuerzo") y el botón grande sugiere la comida que sigue. Tocalo: abre la receta "Para la cena".
6. **Semana** (abajo) → el tablero completo tiene que mostrar la comida en "Últimas comidas" ("Hoy · Almuerzo").

### C · Tablero, receta, perfil y resumen (con datos ya cargados)
Valentina (`sint-valentina`, del dataset sintético de §10.5: simulación declarada) tiene 181 comidas en 6 semanas, cargadas con el flujo real y corridas para que la última caiga hoy (`scripts/cargar-sinteticos.ts valentina --hasta=<hoy>`). 8 años, alérgica al pescado, come en su plato con divisiones y la familia dice que no come verduras:
- **Tablero:** https://nibble-eight-vert.vercel.app/tablero?nino=sint-valentina. Cargada con `--hasta` del mismo día, dice "cubrió 3 de 8 nutrientes" (le faltan calcio y vitamina D) y "Come 19 preparaciones (2 más que la semana pasada)". Tocá una barra de nutrientes para ver el detalle.
- **Receta:** en el tablero, **Un pasito** o **Más nutritiva** → **Ver la receta**. Tarda unos 10 s; la imagen carga aparte (unos 3 s).
- **Generar receta → Cena:** inventa un plato nuevo a partir de lo que ya come (19 alimentos seguros), sin pescado y con cada cosa en su lugar.
- **Perfil:** https://nibble-eight-vert.vercel.app/perfil?nino=sint-valentina → "Lo que sabemos de Valentina": le gusta, está probando y lo que notamos. Fijate que lo dulce lo acepta aunque sea verdura (contradice "no come verduras"): el puré de zapallo, que al principio ni tocaba, llegó a aceptarlo, igual que los bastones de zanahoria. El brócoli sigue trabado: 11 veces sin pasar de tocarlo.
- **Resumen para el nutricionista:** https://nibble-eight-vert.vercel.app/resumen?nino=sint-valentina → **Copiar**.

Al entrar con `?nino=…`, ese chico queda como activo. Para volver a uno tuyo, entrá con su `?nino=`.

### Qué reportar
Mandá en el grupo: **qué celular y navegador** (iPhone Safari / Android Chrome), **en qué paso**, **qué esperabas y qué pasó**, y una captura. Lo más valioso: si la cámara o el micrófono fallan, si una foto buena aparece como "movida" (o al revés), y si la IA marca algo que no dijiste.

## 2. En tu compu

```bash
git pull                          # si el wifi bloquea SSH: git -c url."https://github.com/".insteadOf="git@github.com:" pull
npm install                       # Node 22
npm run dev                       # front en http://localhost:5173 + API local en :3001
```

- **Sin `.env.local`** la app anda igual con **datos de ejemplo** (los endpoints de B y la receta responden fixtures y la app muestra el aviso "Datos de ejemplo"). La IA no funciona sin keys.
- **Con keys:** pedile el `.env.local` a Joaquín **por privado** (nunca por el grupo ni en el repo).
- **Ojo con el wifi de la sede:** bloquea los puertos de Mongo (27017) y Neo4j (7687). Con keys, la API local no llega a las bases: usá el **hotspot del celular**, o sacá `MONGODB_URI` de tu `.env.local` y trabajá con los fixtures. Producción no tiene este problema.
- `npm run typecheck` y `npm test` antes de pushear.

## 3. Deploy

Cada **push a `main`** corre el CI (tipos, tests y build) y, si pasa, **despliega solo a producción** en 1–2 minutos (GitHub → Actions → **Deploy**). Si el CI falla, no se despliega.
