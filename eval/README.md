# Evals de visión y de voz

Comprobación de calidad de la pista A (PLAN.md §11.1 y §11.2). Las dos evals llaman a **las mismas funciones que los endpoints** (`analizarComida()` y `interpretarRelato()`), comparan contra lo que etiquetamos a mano y escriben una tabla en Markdown para la diapositiva y para la sección "Calidad" del README.

| Archivo | Qué es |
|---|---|
| `etiquetas.json` | Una entrada por foto: de dónde salió, qué alimentos tiene y sus atributos |
| `fotos/` | Las fotos, en JPEG de 1024 px como máximo |
| `voz/relatos.json` | Una entrada por relato: lo que "pasó" (escrito antes de grabar), los ítems del plato y lo que se espera |
| `voz/` | Las notas de voz (`.m4a`, `.webm`…) |
| `../scripts/eval-vision.ts`, `../scripts/eval-voz.ts` | Las evals |
| `../scripts/eval/` | Métricas puras (`metricas.ts`, con tests), lectura y validación de estos archivos (`datos.ts`) y el generador del set sintético |

## Qué hay hoy

- **8 fotos de internet**, declaradas (`fuente: "internet"`): CC0 o dominio público, de Wikimedia Commons. La licencia se verificó en la página de cada archivo y está en `etiquetas.json` junto con la URL y el autor. Dos están recortadas: se sacó una botella del fondo en una y el pan y el té de al lado en otra. Son platos típicos de chicos: milanesa con papas fritas (de un restorán de Montevideo), nuggets, pollo a la plancha con papas, arroz blanco, carne picada con puré y arvejas, fideos con salsa, una bandeja escolar con fruta cortada y milanesa de pollo con salsa. Suman 18 alimentos etiquetados.
- **40 relatos de texto sintéticos**, declarados (`fuente: "sintetico"`). Salen de las 20 comidas de Tomás y las 20 de Lucía (`data/sinteticos/`), con su relato, sus respuestas y su conducta. En las 15 comidas de 3 ítems se borra la frase de uno de ellos, que pasa a `sinMencion`: así se miden los ítems inventados. Son relatos de plantilla, más fáciles que una nota real, y sirven para ver que la extracción anda. **El número para el pitch tiene que salir de las notas de voz del equipo.**
- **Faltan:** las fotos del equipo (el plan pide 15 a 20, con el catering de hoy y fotos de casa) y de 5 a 8 notas de voz.

## Cómo correrlas

Las dos usan la API real: con los créditos de Claude cuestan centavos. El progreso sale por stderr y la tabla por stdout.

**Local** (las keys van en `.env.local`, ver `.env.example`):

```bash
npx tsx scripts/eval-vision.ts > eval-vision.md                 # Haiku 5.5 y Sonnet 5.5 (16 llamadas con 8 fotos)
npx tsx scripts/eval-vision.ts --modelo haiku                   # un solo modelo: haiku | sonnet | ambos
npx tsx scripts/eval-voz.ts --texto > eval-voz.md               # relatoEscrito como texto: solo la extracción, sin Whisper
npx tsx scripts/eval-voz.ts > eval-voz.md                       # los casos con audio van por Whisper; los demás, como texto
```

- `eval-vision` necesita `ANTHROPIC_API_KEY`. Antes de cada pasada fija `MODELO_VISION` (`claude-haiku-5-5` o `claude-sonnet-5-5`), que pisa el modelo de la tarea de visión en `generarJSON()`. Si respondió otro modelo, por ejemplo el de respaldo, lo avisa al final.
- `eval-voz` necesita `ANTHROPIC_API_KEY`, y `GROQ_API_KEY` para los audios.
- Corren con `ninoId: "eval"`: sin perfil del chico, la visión usa solo el catálogo semilla.

**Desde GitHub:** Actions → **Evals** → *Run workflow* → elegir `vision` o `voz`. La tabla queda en el log y en el artefacto `eval-<nombre>`. Las keys son los secretos del repo (`ANTHROPIC_API_KEY`, `GROQ_API_KEY`). Desde Actions corren sin flags: la de visión con los dos modelos, y la de voz con audio donde haya y con texto en el resto.

## Qué mide cada una

**Visión** (por modelo):
- **Recall:** de los alimentos etiquetados, cuántos reconoció. Un alimento cuenta como reconocido si hay un ítem cuyo ingrediente de más gramos es ese `alimentoId`.
- **Precisión:** de los alimentos que dijo, cuántos estaban. Un `otro_<grupo>` cuenta como "no reconocido", no como error, salvo que la etiqueta sea ese mismo genérico.
- **Atributos:** textura, forma, color y cocción (esta última solo si está etiquetada), en los alimentos reconocidos.
- **Latencia:** media, p95 y % de fotos en menos de 8 s.
- **Recomendación:** el modelo que más alimentos reconoce en fotos analizadas en menos de 8 s.

Por foto, la tabla dice qué faltó y qué sobró: sirve para iterar el prompt.

**Voz** (por dispositivo cuando hay audios): % de ítems con el `cuanto` correcto, % de casos con la conducta exacta, **ítems inventados** (respuestas para ítems que el padre no nombró: **tiene que dar 0**), % de citas que están en la transcripción, y latencia (media, p95 y % en menos de 8 s). Un caso con error cuenta entero como mal.

## Sumar fotos del equipo

1. **Sacá la foto** del plato tal como se sirvió, desde arriba o en diagonal, con el plato entero y un plato por foto. Sirven el catering, la merienda y la cena de casa.
2. **Pasala a JPEG de 1024 px como máximo y sin metadatos** (la ubicación del GPS, por ejemplo). Ponele un nombre corto que diga qué es: `fotos/catering-milanesa-pure.jpg`.
   ```bash
   magick IMG_1234.HEIC -auto-orient -resize '1024x1024>' -quality 80 -strip eval/fotos/catering-milanesa-pure.jpg
   ```
   Si no tenés ImageMagick, cualquier editor que exporte JPEG sirve. Tiene que pesar 300 KB como máximo.
3. **Etiquetala** en `etiquetas.json` con `"fuente": "equipo"` (url, autor y licencia van solo en las de internet):
   ```json
   {
     "archivo": "catering-milanesa-pure.jpg",
     "fuente": "equipo",
     "descripcion": "Catering del sábado: milanesa de carne y puré, separados",
     "alimentos": [
       { "alimentoId": "carne_vacuna", "textura": "crocante", "forma": "plano", "color": "marron", "coccion": "frito" },
       { "alimentoId": "papa", "textura": "cremoso", "forma": "pure", "color": "amarillo", "coccion": "hervido" }
     ]
   }
   ```
4. **Validala:** `npx vitest run scripts/eval` controla el vocabulario, que cada `alimentoId` exista en `data/alimentos.json` y el tamaño de la foto.

### Cómo etiquetar

- **Un alimento por ítem del plato**, con el `alimentoId` de su ingrediente principal (el de más gramos): milanesa → `carne_vacuna` (o `pollo`), papas fritas o puré → `papa`, fideos con salsa → `fideos`, nuggets → `nuggets_pollo`. Los ids están en `data/alimentos.json`. Si no está, usá el genérico `otro_<grupo>` (`otro_verdura`, `otro_proteina`…).
- **Lo que va mezclado o con salsa por encima es un solo ítem**: los fideos con salsa bolognesa son `fideos`, no `fideos` más `carne_picada`. Si los alimentos están separados en el plato, cada uno es un ítem.
- **Bebidas o postres que son parte de la comida** (el cartón de leche de la bandeja) cuentan. **Lo que está fuera del plato** (el pan de la panera, la manteca) no.
- **Atributos** con el vocabulario cerrado de `shared/contratos.ts`, con los mismos criterios que `data/sinteticos/preparaciones.json`:
  - textura: `crocante` `blando` `cremoso` `masticable` `jugoso` `mixto`
  - forma: `baston` `redondo` `plano` `trozos` `pure` `granos` `entero`
  - color: `blanco` `beige` `amarillo` `naranja` `rojo` `verde` `marron` `mixto` (el que domina a la vista)
  - cocción (opcional): `frito` `horno` `hervido` `plancha` `crudo` `listo`

  Ejemplos: papas fritas = crocante, baston, amarillo, frito; puré = cremoso, pure; arroz = blando, granos, blanco, hervido. **Poné la cocción solo si estás seguro**, porque una milanesa puede ser frita o al horno. Si no está, no se mide.

## Sumar notas de voz (§11.2)

Hacen falta **de 5 a 8 notas, al menos 2 grabadas en iPhone y 2 en Android**, sobre fotos de `fotos/` (mejor si son del equipo).

1. **Primero escribí lo que "pasó"** con cada alimento del plato (`relatoEscrito`), **antes de grabar**. Por ejemplo: "Las papas se las comió todas. La milanesa la probó y la dejó. Estuvo tranquilo". En algunas notas dejá un ítem sin nombrar: es lo que mide los inventados.
2. **Grabá la nota** contándolo con tus palabras, como lo diría un padre (no lo leas), en 15 a 40 s. Tiene que durar menos de 90 s y pesar menos de 4,5 MB. No grabes a chicos ni digas nombres o datos reales: el repo es público.
   - **iPhone:** app Notas de voz → Compartir → Guardar en Archivos. Queda un `.m4a` (`audio/mp4`, el mismo formato que graba la app en Safari).
   - **Android:** lo ideal es `.webm` (`audio/webm`, el que graba la app en Chrome). Si tu grabadora no lo exporta, sirve una nota de voz de WhatsApp (`.opus` u `.ogg`, `audio/ogg`) o un `.m4a` (`audio/mp4`). Whisper acepta todos: lo que importa es que `mime` diga el formato real.
3. **Guardala** en `voz/` con un nombre como `iphone-01.m4a` o `android-01.webm`, y **sumá el caso** en `voz/relatos.json`:
   ```json
   {
     "id": "equipo-iphone-01",
     "audio": "iphone-01.m4a",
     "mime": "audio/mp4",
     "dispositivo": "iphone",
     "fuente": "equipo",
     "relatoEscrito": "Las papas se las comió todas. La milanesa la probó y la dejó. Estuvo tranquilo.",
     "items": [
       { "idTmp": "i1", "preparacion": "papas fritas en bastones" },
       { "idTmp": "i2", "preparacion": "milanesa de carne" },
       { "idTmp": "i3", "preparacion": "arvejas" }
     ],
     "esperado": {
       "respuestas": [{ "itemIdTmp": "i1", "cuanto": "todo" }, { "itemIdTmp": "i2", "cuanto": "probo" }],
       "sinMencion": ["i3"],
       "conducta": ["tranquilo"]
     }
   }
   ```
   - Cada ítem va **una sola vez**: en `esperado.respuestas` (con el `cuanto` de la escalera de PLAN.md §5.1: `todo` `mitad` `poco` `probo` `toco` `nada` `aparto`) o en `esperado.sinMencion`.
   - `conducta`: solo lo que se dice en la nota (`tranquilo` `se_levanto` `angustia` `pidio_otra_cosa` `arcadas` `atragantamiento`).
   - `preguntas` es opcional: va si el análisis de esa foto hizo preguntas, con el mismo formato que `Pregunta` en `shared/contratos.ts`.
4. **Validá** con `npx vitest run scripts/eval`.

Los casos sintéticos no se editan a mano: si cambia `data/sinteticos/`, se regeneran con `npx tsx scripts/eval/relatos-sinteticos.ts`, que reescribe solo los casos con `"fuente": "sintetico"` y deja los del equipo como están.

## Eval de variedad de las recetas creativas (v5.10)

¿Salen distintas las recetas cuando la familia pide una tras otra para la misma comida? `scripts/eval-variedad.ts` carga un chico sintético sin Mongo (los catálogos reales y su historial de `data/sinteticos/`, con `hoy` = el último día que registró) y llama a `generarRecetaCreativa()`, la misma función que `/api/receta` sin `preparacionId`. Por cada comida pide N recetas seguidas y manda en `anteriores` los nombres de las que ya salieron, como la app (`src/lib/recetaPrevia.ts`).

```bash
npx tsx scripts/eval-variedad.ts > eval-variedad.md                                   # Valentina, cena y desayuno, 6 por comida
npx tsx scripts/eval-variedad.ts --nino tomas --momentos almuerzo,cena --n 4          # valentina | tomas | lucia; n de 1 a 20
```

Necesita `ANTHROPIC_API_KEY` (Sonnet 5.5, ≈ USD 0,04 por receta: unos USD 0,5 con lo de por defecto). Por comida y en total mide:

- **Principales distintos sobre N** (el ingrediente de más gramos) y **familias** (el primer tramo del id: `queso_muzzarella` → `queso`).
- **Alimentos de partida distintos sobre N.**
- **Con queso:** recetas con algún `queso_*` o ricota.
- **Nombres repetidos** (sin tildes ni mayúsculas, como los compara la validación).
- **Siguieron el foco:** partió del alimento seguro que sorteó el código y, si el foco trae un ingrediente (v5.10), lo usó: de principal al cambiar el principal, entre los ingredientes al sumar uno.
- **Fallas** (`sin_candidatos`, timeouts, errores), **latencia** media y p95, y **costo**: con el uso de tokens que reporta la API (USD 2 y 10 por millón) o, si no lo reporta, USD 0,04 por receta, y lo dice.

Por receta, la tabla trae el nombre, de qué alimento parte, el cambio, el nutriente, el ingrediente principal, los ingredientes nuevos respecto del alimento de partida y el foco. Las métricas son funciones puras en `scripts/eval/metricas-variedad.ts`, con tests.
