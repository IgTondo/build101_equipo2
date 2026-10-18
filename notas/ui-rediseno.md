# Rediseño de la UI · dirección visual

> Para quien toque `src/`. La base (Tailwind v4 + shadcn/ui + motion, fondo blanco) está en la rama `ui-base`; cada
> pantalla se rediseña sobre ella. Lo que no está acá lo decide la skill `frontend-design` con la marca (`brand/GUIA.md`).

## La idea: un bocado por vez

Nibble acompaña a un padre que, con el celular en la mano y en la cocina, quiere saber qué darle a su hijo mañana.
La pantalla tiene que sentirse como **un plato limpio**: blanca, clara y tranquila, con color solo donde dice algo.

1. **Blanco de fondo.** Nada de crema ni de beige: el blanco es el plato. Las superficies se separan con un borde
   finito o con un tinte suave, no con sombras grises en todo.
2. **El color dice algo.** Verde de marca para actuar; el color de cada **grupo de alimentos** para la comida; el del
   **momento del día** para cada comida; Zapallo para **lo que le falta**. Nunca rojo y verde para decir bien o mal.
3. **Una sola protagonista por pantalla.** Es lo que se recuerda: la próxima comida en el inicio, la foto en el
   registro, la receta en la receta. Lleva el **mordisco** (`mordisco`, la muesca de la n del logo) y la única sombra
   (`shadow-flotante`). Lo demás queda callado.
4. **Los alimentos se ven.** Cada alimento lleva su `IconoAlimento` (su glifo en un círculo del color de su grupo)
   al lado del nombre. Es el único lugar con emoji.
5. **El movimiento responde.** Se anima lo que el padre hace (tocar, guardar, abrir, grabar) y los datos se revelan una
   vez (anillos, barras, números). No hay entradas escalonadas por sección ni hover en cada tarjeta.

## Tokens (src/index.css)

| Para | Clases |
|---|---|
| Fondo, texto, texto suave | `bg-background` (blanco) · `text-foreground` (Pino) · `text-musgo` / `text-muted-foreground` |
| Acción | `bg-primary` (Verde hondo) · hover `bg-verde-noche` · `text-primary` |
| Marca | `bg-verde` · `bg-hoja` · `bg-brote` · `text-verde-hondo` |
| Lo que falta | `bg-zapallo` · `bg-zapallo-claro` (Zapallo nunca como color de texto) |
| Grupos (`Grupo`) | `bg-grupo-{cereal,proteina,verdura,fruta,lacteo,otro}` y `-claro` · en JS: `COLOR_GRUPO` de `src/lib/colores.ts` |
| Momentos (`Momento`) | `bg-momento-{desayuno,almuerzo,merienda,cena,colacion}` y `-claro` · en JS: `VISUAL_MOMENTO` (con su ícono) |
| Gráficos | `--chart-1..5` / `SERIES` |

- **Tipografía:** `font-titulo` (Nunito 800–900) para titular y para los números grandes; el resto en Atkinson
  Hyperlegible Next (`font-sans`, por defecto). Escala: `text-xs` 13 · `sm` 15 · `base` 17 · `lg` 19 · `xl` 22 ·
  `2xl` 26 · `3xl` 32 · `4xl` 40 · `5xl` 52 px. Números con `tabular-nums`.
- **Radios, de mayor a menor jerarquía:** protagonista `rounded-3xl` · tarjeta `rounded-2xl` · bloque interno
  `rounded-xl` · botones y chips `rounded-full`.
- **Superficies:** *protagonista* (color pleno o tinte fuerte, mordisco, `shadow-flotante`) · *tarjeta* (`bg-card`
  con `border`) · *teñida* (`bg-brote`, `bg-grupo-*-claro`, `bg-momento-*-claro`, sin borde) · *plana* (sin caja).
- **Táctil:** 48 px como mínimo (los `Button` ya vienen así: `default` 48, `lg` 56).

## Piezas que ya existen

- **shadcn/ui** en `src/componentes/ui/`: accordion, alert, avatar, badge, button, card, chart (Recharts), checkbox,
  collapsible, dialog, drawer, input, label, popover, progress, radio-group, scroll-area, separator, sheet, skeleton,
  slider, sonner (`toast` de `sonner`; el `<Toaster>` ya está montado), switch, tabs, textarea, toggle, toggle-group,
  tooltip. Estilo `radix-maia`. `import { cn } from 'cn'`.
- **Nibble** en `src/componentes/`:
  - `IconoAlimento({ nombre, grupo?, tamano: 'sm'|'md'|'lg'|'xl' })`
  - `Anillo({ valor (1 = 100 %), tamano, grosor, color, pista, retraso, children })`: se llena al aparecer.
  - `NumeroAnimado({ valor, formato, duracion })`: sube una vez, accesible.
  - `Celebracion({ activo })`: ráfaga de bocaditos dentro de un padre `relative` (para guardar una comida, crear el perfil).
  - `PlatoVacio` (en `Ilustraciones.tsx`) · `Cargando({ texto })` con `Bocaditos` · `ErrorConReintento` · `Vacio`.
  - `NavInferior` y `TransicionPantalla` (shell, ya montados en `App.tsx`).
- **Íconos de interfaz:** `lucide-react`, trazo 2–2.25, `aria-hidden` si hay texto al lado.
- **Movimiento:** `motion/react`. `MotionConfig reducedMotion="user"` ya envuelve la app. Resortes:
  `{ type: 'spring', stiffness: 420, damping: 34 }` para UI y `ease: [0.22, 1, 0.36, 1]` para revelar datos.
  Las animaciones CSS llevan `motion-reduce:`.

## Lo que no va (se ve hecho por una IA)

- Fondo crema o beige; degradés de decoración; vidrio esmerilado (`backdrop-blur`); violetas.
- Etiquetas en MAYÚSCULAS con tracking arriba de los títulos ("PARA EL DESAYUNO" → "Para el desayuno", con el ícono
  del momento).
- Todo metido en tarjetas iguales con la misma sombra gris. Una sola sombra por pantalla.
- Emoji en títulos, botones o textos (solo en `IconoAlimento`). Flechas `→` pegadas al texto de un botón.
- Números 01 / 02 / 03 si no es una secuencia de verdad (la escalera y los pasos del alta sí lo son).
- Resaltar una sola palabra de un título con otro color o cursiva.
- Fade-and-slide en cada sección al cargar.

## Reglas de código

- **Solo presentación.** No cambiar lógica, pedidos a la API, contratos (`shared/`) ni funciones exportadas que usan
  los tests. Los textos los escribió la pista C con cuidado (nunca "rechaza", tono calmo): se conservan; si el diseño
  pide menos texto, se acorta sin cambiar el sentido.
- **Tailwind.** Al migrar una pantalla, su CSS propio se borra. Si algo no sale con utilidades, va en un `.css` chico
  dentro de `@layer components` (fuera de una capa le gana a las utilidades). Lo nuevo no usa las clases `.nb-*` de
  `src/legado.css`; `nb-oculto` pasa a `sr-only`.
- **`cn` y sombras:** `cn` no sabe pisar las sombras propias (`shadow-flotante` + `shadow-none` quedan las dos).
- **Accesibilidad:** se mantienen los `aria-*`, roles y textos para lectores; foco visible; 48 px táctiles;
  contraste AA (Musgo es el gris más claro para texto).
- **Mobile first:** se diseña a 390 × 844 y se revisa a 360 de ancho.
- Antes de cada commit: `npm run typecheck`, `npm test` y `npm run build`.
