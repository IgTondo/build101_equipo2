# Pitch de Nibble · 3:00

> C12 (PLAN.md §12). Ensayar 5 veces con cronómetro. El que habla no toca el celular: la demo la maneja otra persona, con la pantalla del celular espejada.

## Antes de subir

- [ ] Abrir la consola de Neo4j Aura (una instancia Free sin uso se pausa) y `/api/salud` en verde.
- [ ] `/estado` en el deploy: ningún endpoint del ciclo principal en stub.
- [ ] Tomás con su historial: es `sint-tomas` (20 comidas del dataset sintético, cargadas con el flujo real; se dice en voz alta que es simulado). En el tablero tienen que verse el plato de cada comida y lo que le falta.
- [ ] Un plato de ejemplo listo para la foto (del catering, o el de un jurado). Plan B: foto ya sacada en la galería.
- [ ] Hotspot del celular prendido. Video de respaldo abierto en la compu, pausado en 0:00.
- [ ] **Celular 1 (la demo):** entrar una vez a `/?nino=sint-tomas` (queda guardado).
- [ ] **Celular 2 o pestaña privada (para "¿y desde cero?"):** la app abierta en "Contanos de tu hijo" y el guion del audio de alta a mano (`PROBAR.md`). Se hace en ~45 s: alta por voz → el plato del día cero ya sale con lo que contó el padre → una foto → el plato cambia.

## Guion

| Tiempo | Diapositiva / pantalla | Qué se dice |
|---|---|---|
| 0:00–0:25 | **1 · El problema** | "Entre el 45% y el 63% de los chicos con autismo tiene selectividad alimentaria. En los casos severos, el 97% está en riesgo de quedarse corto en vitamina D, el 91% en fibra y el 71% en calcio. Y el peso normal lo esconde: un chico puede pesar bien y estar comiendo mal (Sharp, 2018)." |
| 0:25–0:40 | **2 · Hoy** | "Hoy la familia anota en papel y ve al nutricionista cada 2 a 4 semanas. Una revisión de las tiendas de apps encontró solo 2 apps para la alimentación en autismo. Les presentamos a Tomás, un caso ficticio: 6 años, come 6 cosas, casi todas crocantes y beige, y es alérgico al huevo." |
| 0:40 | **Aviso honesto** | "Tomás es un caso simulado: le cargamos 20 comidas con el mismo flujo que van a ver ahora." |
| 0:40–1:50 | **Demo en vivo** (celular) | 1. "Terminó de comer. Saco la foto del plato." → cajas y atributos. 2. "Le cuento cómo le fue." Nota de voz: *"Las papas se las comió todas; el queso lo tocó y lo dejó en el plato"*. → "Los botones se marcan solos, y cada uno muestra la frase que lo justifica. Si no nombré un alimento, no inventa: queda sin marcar." 3. Guardar → nutrientes con rango y "qué aprendí": *"Bastones de queso: esta vez lo tocó. Cada paso cuenta."* 4. Tablero: "¿Está comiendo bien? Esta semana cubrió 4 de 8 nutrientes; lo que más le falta es calcio y vitamina D." |
| 1:50–2:20 | **Demo: el plato de la cena** | En la pantalla principal: "Para la cena" → lo que ya come (milanesa, papas) + **un pasito** (bastones de queso, porción chica). "Nibble no le cambia el plato: le propone el paso más chico, hacia el calcio que le falta." → Ver cómo servirlo (la imagen del plato completo) → la receta del pasito. "Ofrecelo sin pedirle que lo coma." |
| 2:20–2:45 | **3 · Calidad** | "Lo medimos: reconoce el X% de los alimentos; en la voz, cero alimentos inventados; las alergias se respetaron 12 de 12, porque las valida el código y no el modelo: el LLM se equivocó X veces y el código lo atrapó siempre." (+ la curva grafo contra base, si llegó) |
| 2:45–3:00 | **4 · Cierre** | "Nibble no te dice qué cocinar a partir de una foto: aprende de cada comida cómo come tu hijo y te propone el paso más chico posible hacia lo que le falta. Si le sacás la IA, no hay lectura del plato, ni relato que se entiende, ni perfil que aprende, ni recetas a su medida." |

**Si la demo falla** (más de 10 s sin respuesta): "Les muestro la misma corrida grabada", y se pasa al video desde el mismo paso. No se reintenta en vivo.

## Diapositivas

1. **El problema.** Tres números grandes: 97% vitamina D · 91% fibra · 71% calcio. Debajo: "El peso normal lo esconde".
2. **Hoy y Tomás.** Papel y consulta cada 2–4 semanas · 2 apps en las tiendas. Tarjeta de Tomás (6 años, 6 alimentos, alergia al huevo, caso ficticio).
3. **Cómo funciona.** El ciclo de 5 pasos (registrar → entender → aprender → mostrar → actuar), con qué hace la IA y qué hace el código en cada uno.
4. **Calidad.** Tabla de resultados medidos (§11) y la curva, si llegó.
5. **Seguridad.** Alergias a mano y validadas por código · sin metas de calorías · nada escondido · sin lenguaje de presión · alertas que derivan al profesional.
6. **Cierre.** La frase final y el logo.

## Preguntas probables

| Pregunta | Respuesta |
|---|---|
| ¿En qué se diferencia de FamEats o EatPal? | Ellos piden registrar a mano. Nosotros leemos la foto y la voz, calculamos la nutrición con una tabla real y aprendemos patrones combinados en un grafo. La revisión de apps no encontró ninguna que junte nutrición con tabla real, perfil sensorial, cadenas de alimentos y reporte para el profesional. |
| ¿Por qué voz? | Después de comer, el padre tiene las manos ocupadas y al chico al lado: hablar 20 segundos cuesta menos que tocar 10 botones. |
| ¿Por qué un grafo y no un prompt? | Las relaciones combinadas no entran en el contexto y el modelo alucina. Al LLM le llegan unas 20 líneas de evidencia, y el resto lo calcula el código. Lo mostramos con la curva grafo contra base. |
| ¿Qué tan precisa es la nutrición? | Los gramos tienen ~35% de error por comida; por eso mostramos rangos y el indicador es semanal. Nuestro resultado medido: … |
| ¿Es seguro? | Alergias a mano y validadas por código, sin metas de calorías, sin esconder alimentos, sin lenguaje de presión, alertas que derivan al profesional. No reemplaza al nutricionista: le lleva un resumen con números. |
| ¿Y si cargo a mi hijo desde cero? | Lo hacemos ahora (celular 2): un solo audio con nombre, edad, alergias, lo que come y lo que no. La IA llena el perfil (las alergias las confirma el padre tocándolas) y **el día cero ya hay plato**, armado con lo que contó. Con la primera foto empieza a aprender; Tomás muestra adónde llega después de 20 comidas |
| ¿Qué es real y qué no? | Toda la IA es real. Tomás es ficticio y su historial se cargó con el flujo real; el dataset sintético y la curva son simulaciones, y lo dice el README. |
