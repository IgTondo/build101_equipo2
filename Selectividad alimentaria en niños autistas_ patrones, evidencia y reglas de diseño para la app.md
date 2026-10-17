# Selectividad alimentaria en niños autistas: patrones, evidencia y reglas de diseño para la app

La evidencia respalda la idea central de la app. La selectividad alimentaria en autismo es frecuente (prevalencia media de 63,49% en el metaanálisis de Dos Santos Junior et al. 2025, con 1.458 personas; 45,6% en un estudio transversal grande), se guía sobre todo por la textura, y produce carencias de vitamina D, calcio y fibra que pasan desapercibidas porque el peso suele ser normal. La forma de ampliar el repertorio que tiene más respaldo es gradual, honesta y sin presión: un alimento nuevo por vez, en porción mínima, junto a un alimento seguro, cambiando un solo atributo a la vez (food chaining) y con muchas exposiciones (8 a 15 o más). Esconder alimentos y presionar al niño tienen evidencia en contra o débil. Algunos casos son graves (escorbuto, ARFID, pérdida de peso) y la app tiene que detectarlos y derivar al profesional, no tratarlos.

## TL;DR

- **Patrones que importan para el diseño:** en el estudio de Hubbard 2014, los niños con TEA rechazaron alimentos mucho más que sus pares por textura (77,4% vs 36,2%), sabor u olor (49,1% vs 5,2%), mezclas (45,3% vs 25,9%), marca (15,1% vs 1,7%) y forma (11,3% vs 1,7%). Temperatura, color y "que se toquen" fueron rechazos comunes, pero no más frecuentes que en niños típicos. El motor de recomendación debe modelar sobre todo **textura, mezcla, marca y forma**, y tratar "que no se toque" y el color como preferencias de cada niño, no como reglas universales.
- **Reglas del motor:** cambiar un solo atributo por vez a partir de un alimento ya aceptado; servir el alimento nuevo separado, en porción pequeña y al lado de un alimento seguro; no esconder ingredientes sin avisar; no usar lenguaje de presión; contar entre 8 y 15 exposiciones o más antes de dar un alimento por "rechazado".
- **Nutrientes y alertas:** en niños con TEA y selectividad severa, el 78% tenía riesgo de 5 o más carencias de nutrientes: vitamina D 97%, fibra 91%, vitamina E 83%, calcio 71% (Sharp 2018). La revisión sistemática de Sharp et al. (J Dev Behav Pediatr 2020) reunió 20 reportes con 24 niños con autismo y escorbuto (edad media 9 ± 3,5 años; 22 varones). Hay que derivar ante: pérdida de peso, menos de 10 a 20 alimentos, eliminación de grupos enteros, arcadas o atragantamiento, síntomas de escorbuto (no querer caminar, encías sangrantes, moretones), constipación persistente, pica o angustia severa.

## Key Findings

### 1. Patrones sensoriales (pregunta 1)

- **Prevalencia:** la revisión narrativa "Beyond the plate" (24 estudios) informa un rango de 21% a 77% en niños con TEA, siempre por encima de los controles. El metaanálisis de Dos Santos Junior et al. (Annales Médico-psychologiques, 2025), con 1.458 personas con TEA de 5 países, estimó una prevalencia media de **63,49%**. Wenzell et al. 2024 encontró 45,6%.\[1\]\[2\] El dato "cerca de la mitad" que usa el equipo es conservador y defendible.
- **La textura es el factor dominante:** el 70% de los niños con autismo elige la comida por textura, frente al 11% de los niños sin autismo.\[3\] En el estudio de Hubbard 2014 (53 niños con TEA y 58 típicos, de 3 a 11 años), la textura o consistencia fue el motivo de rechazo más citado en ambos grupos.\[4\]\[5\] En un estudio en Chile (con Perfil Sensorial 2 de Dunn y BAMBI), el 78% mostró selectividad marcada por textura y el 53% por color. Los cuidadores identificaron aversiones a texturas (57%), a olores de las preparaciones (44%) y a colores (35%).\[6\]\[7\]
- **Dieta "beige" y uniforme:** una revisión cita que más del 90% de los niños con TEA prefieren de forma marcada alimentos de **textura uniforme, sabor suave y color neutro**, y que lo crocante "es un éxito", a diferencia de frutas y verduras.\[8\] Las revisiones también describen una preferencia por almidones y snacks.\[9\] Esto explica por qué funcionan los productos ultraprocesados: cada unidad es idéntica a la anterior, mientras que una fruta fresca varía en madurez, jugosidad y color.
- **Marca, empaque y "se ve distinto":** según los padres, el niño rechaza la comida si se ve apenas distinta a lo habitual o si no está la marca preferida.\[10\]\[11\]
- **Matiz importante:** Hubbard 2014 **no encontró diferencias** entre niños con TEA y típicos en rechazo por temperatura, por alimentos que se tocan o por color. El rechazo por color sí se asoció a menor consumo de verduras en ambos grupos.\[5\]\[12\] Para la app esto significa que "que no se toquen" es frecuente, pero no hay que asumirlo en todos los niños: se pregunta en el onboarding.
- **Cambia con el tiempo:** en Bandini et al. 2017 (18 niños con TEA seguidos unos 6,5 años, de una edad media de 6,8 a 13,3 años), la proporción de niños que rechazaban por textura bajó de 94% a 39%, y el rechazo de mezclas bajó de 50% a 28%. El perfil no es fijo y hay que reevaluarlo.

### 2. Presentación en el plato (pregunta 2)

- **Plato separado o dividido:** es práctica clínica habitual (en el enfoque SOS, el alimento nuevo va "en el plato, separado del aceptado").\[10\] La evidencia experimental es escasa: hay un estudio piloto registrado (NCT07516431) que explora un "plato estructurado" en TEA.\[13\] Conviene presentarlo como una opción configurable con respaldo clínico, no como algo probado.
- **Alimento seguro siempre presente:** las guías clínicas para familias recomiendan incluir en cada comida al menos un alimento que el niño ya come, y agregar el nuevo al lado o en un "plato de exploración" aparte, sin pedirle que lo toque ni que lo pruebe.\[10\]\[14\]
- **Porción del nuevo:** se recomiendan porciones mínimas,\[15\] del tamaño de una arveja.\[16\]\[17\] Algunos terapeutas proponen una proporción aproximada de 75% de alimentos conocidos y 25% de alimentos nuevos (es una recomendación clínica sin ensayo que la respalde).\[18\]
- **Rutinas:** misma hora, mismo plato y mismos cubiertos ("está bien usar el mismo plato en cada comida"), y el nuevo alimento servido igual durante varias comidas antes de juzgar si funcionó.\[10\]\[14\] La rigidez en la comida es un factor propio del BAMBI.\[19\]
- **Escalera de exposición (SOS / desensibilización):** tolerar el alimento en la habitación → en la mesa → en el plato → tocarlo → olerlo → llevarlo a los labios → lamerlo → morderlo.\[10\]\[14\] Cada paso cuenta como un éxito.\[20\]\[21\]

### 3. Combinaciones, mezclas y alimentos escondidos (pregunta 3)

- **Mezclas, guisos y rellenos son de alto riesgo:** el 45,3% de los niños con TEA rechaza alimentos mezclados (frente a 25,9% de los típicos).\[5\]\[12\]\[22\] Una salsa por encima, un relleno o un guiso combinan varias texturas y vuelven el alimento impredecible. Por defecto, las salsas van aparte, para mojar.
- **Esconder alimentos:** la evidencia es débil y hay riesgos. En un estudio con 68 escolares (Pope et al., 2012), informarles que el snack tenía verduras no siempre redujo la aceptación, y esa aceptación dependía de la familiaridad previa con la verdura.\[23\] Las recetas con verduras escondidas suelen aportar poca cantidad de verdura.\[24\] Los especialistas en alimentación advierten que, si el niño descubre el ingrediente, puede perder confianza y aumentar su ansiedad en las comidas, y que los niños con sensibilidad a la textura suelen detectar lo escondido.\[25\] Postura recomendada: **fortificar de forma transparente** (decirle al niño o a la familia qué tiene la preparación) y ofrecer siempre el alimento también a la vista.\[24\]

### 4. Estrategias para ampliar el repertorio (pregunta 4)

- **Food chaining (Fraker, Walbert, Cox y Fishbein):** se parte de un alimento aceptado y se proponen alimentos parecidos en sabor, textura y temperatura, avanzando de a pasos chicos.\[17\]\[26\] En la revisión de historias clínicas de Fishbein et al. (Nutr Clin Pract 2006), los 10 niños tratados durante 3 meses ampliaron su repertorio.\[27\]\[28\] Fuentes secundarias informan que pasaron de unos 5 a 20,5 alimentos aceptados.\[26\] Es una serie de casos pequeña, sin grupo control. Las revisiones narrativas sobre trastornos alimentarios pediátricos lo recomiendan para el apetito selectivo.\[29\]
- **Exposición repetida:** en lactantes, la ingesta de una verdura que al principio rechazaban se igualó a la de una verdura aceptada hacia la **8.ª exposición**, y 63% la seguían comiendo 9 meses después (Maier 2007). En preescolares, el tofu sin sabor necesitó **15 exposiciones** (Sullivan y Birch).\[30\] Las revisiones del Comité Asesor de Guías Alimentarias de EE. UU. 2025 (USDA NESR) concluyen que la exposición repetida probablemente aumenta la aceptación entre los 2 y los 6 años.\[31\] En niños con TEA el número probablemente es mayor: no hay una cifra validada.
- **Enfoque SOS (Sequential Oral Sensory):** la evidencia es emergente y limitada.\[32\] Un ECA pequeño en niños pequeños que rechazaban alimentos mostró mejoras.\[33\]\[34\] Un piloto con 15 niños con TEA mostró una tendencia a comer más alimentos y a bajar el puntaje BAMBI.\[35\] En una comparación con 6 niños con TEA (Peterson et al., 2016), un SOS modificado rindió peor que un enfoque conductual (ABA).\[34\]\[36\] La exposición gradual es razonable, pero para casos severos el tratamiento corresponde a equipos especializados.
- **Presión:** en el estudio "Finish your soup" (Galloway et al., 2006), presionar a preescolares para que comieran **no fue efectivo**: comieron más y dijeron menos comentarios negativos cuando no se los presionaba.\[37\]\[38\] La presión se asocia a que el niño luego quiera menos ese alimento.\[21\]\[39\] La app nunca debe sugerir "que termine el plato" ni frases equivalentes.
- **Food jags / agotamiento de alimentos seguros:** si un alimento seguro se sirve todos los días igual, el niño puede cansarse y abandonarlo, y el repertorio se achica. Rotar la presentación de los alimentos seguros (por ejemplo, alternar días) es práctica clínica, con poca evidencia formal.
- **Programas estructurados para padres:** el Autism MEAL Plan (Sharp et al.) y "Autism Eats" (NCT05194345) combinan exposición repetida, food chaining y rutinas.\[40\]\[41\] Sirven como modelo de contenido para la app.

### 5. Nutrientes críticos (pregunta 5)

- **Sharp et al. 2018 (J Acad Nutr Diet):** de 279 historias clínicas, 70 niños de 2 a 17 años con TEA y selectividad severa cumplían criterios (selectividad severa = omitir uno o más grupos de alimentos, o comer 5 alimentos distintos o menos por semana).\[42\]\[43\] El 78% tenía una dieta con riesgo de 5 o más carencias: **vitamina D 97%, fibra 91%, vitamina E 83%, calcio 71%**. El 67% no comía verduras y el 27% no comía frutas.\[2\]\[44\]\[45\] **La selectividad severa no se asoció a menor crecimiento ni a obesidad**: esto confirma que el peso normal enmascara las carencias.\[43\]
- **Revisiones:** muestran ingesta insuficiente de vitaminas A, B6, B12, C, D, folato, calcio, hierro, magnesio y zinc.\[22\] Varios estudios describen mayor riesgo de déficit de omega-3.\[45\] En comparación con controles, los niños con TEA consumieron menos proteína, calcio, B12 y vitamina D.\[44\]\[46\] También se describen baja densidad mineral ósea, osteopenia, raquitismo e incluso fracturas vertebrales en TEA con selectividad severa o ARFID.\[2\]
- **Escorbuto (vitamina C):** la revisión sistemática de Sharp, Berry, Burrell, Scahill y McElhanon (Marcus Autism Center; J Dev Behav Pediatr 2020), con búsquedas en MEDLINE, CINAHL y PsycINFO entre 1990 y 2018, reunió 20 reportes con **24 niños** con autismo y ARFID (edad media 9 ± 3,5 años; 22 varones). Hay casos recientes con dificultad para caminar, gingivitis o encías hipertróficas, petequias y hasta trombosis venosa profunda por hematomas subperiósticos (un varón de 14 años).\[47\]\[48\]\[49\] Hay casos en Argentina (Arch Argent Pediatr 2018).\[50\] Suelen diagnosticarse tarde, después de muchos estudios.\[51\]\[52\]
- **Dietas sin gluten ni caseína (GFCF):** el metaanálisis de ECA de Keller et al. (Nutrients 2021, niños de 3 a 17 años) no encontró beneficios sobre los síntomas de TEA, con evidencia de calidad baja o muy baja, y señaló que la dieta podría aumentar los efectos gastrointestinales adversos (RR 2,33; IC 95% 0,69–7,90). Los varones con TEA en dieta sin caseína tuvieron **menor espesor cortical óseo** (Hediger 2008).\[53\] La dieta implica riesgo de déficit de calcio, vitamina D y vitaminas B, y hay niveles plasmáticos más bajos de aminoácidos esenciales.\[54\] Si la familia la sigue, la app debe marcar calcio y vitamina D como prioritarios y sugerir supervisión profesional.

### 6. Señales de alerta (pregunta 6)

- **ARFID:** el DSM-5-TR exige que se cumpla al menos uno de estos criterios: pérdida de peso o crecimiento insuficiente, deficiencia nutricional significativa, dependencia de suplementos orales o alimentación por sonda, o interferencia psicosocial marcada.\[55\]\[56\] **No requiere pérdida de peso.**\[55\] En una clínica de alimentación, el 49% de los niños derivados cumplía criterios de ARFID, y el TEA fue un predictor (Farag 2022).\[56\] En SPARK, Koomar et al. (Frontiers in Psychiatry, 2021), con unos 5.157 participantes autistas tamizados con NIAS, encontraron que el 21% tenía alto riesgo de ARFID (y hasta el 17% de sus padres), pero solo el 1% tenía diagnóstico.
- **Indicadores que citan las guías de atención primaria (BJGP 2024):** evitar grupos enteros de alimentos, asco con arcadas, dieta limitada a **menos de unos 10 alimentos seguros**, falta de interés en comer, evitar comer fuera de casa, y pérdida de peso o síntomas de carencia.\[57\]
- **Desnutrición severa (criterio de un programa de ARFID de Boston):** no ganar peso durante 6 meses o más en un niño en crecimiento, o perder el 5% o más del peso en 3 meses.\[58\]

### 7. Herramientas de evaluación (pregunta 7)

- **BAMBI (Lukens y Linscheid, 2008):** 18 ítems puntuados de 1 (nunca o rara vez) a 5 (casi todas las comidas); 4 ítems se puntúan al revés; el total va de 18 a 90.\[59\]\[60\] Tiene factores de variedad limitada, rechazo de alimentos y rasgos de autismo. Algunas versiones posteriores agregan rigidez en las comidas y conductas disruptivas.\[19\]\[61\] En la validación brasileña, un corte de 47 o más identificó al 79% de los niños con problemas de alimentación.\[62\] Está validado en muchos idiomas, y hay estudios en Chile que lo usan.\[7\]\[61\]
- **Otras herramientas:** BPFAS (Behavioral Pediatrics Feeding Assessment Scale), Perfil Sensorial 2 de Dunn, cuestionario de frecuencia de consumo, diario de 3 días para contar el repertorio, Stanford Feeding Questionnaire, NIAS (tamizaje de ARFID de 9 ítems) y la evaluación de Feeding Matters para PFD.\[63\]
- **Qué se pregunta en la primera consulta (base del onboarding):** lista de alimentos aceptados con marca y formato exactos; alimentos rechazados y motivo (textura, olor, color, forma, marca, mezcla, temperatura); grupos de alimentos que faltan por completo; historia de peso y talla; arcadas, vómitos o atragantamiento; constipación o reflujo; alergias e intolerancias; dietas especiales (GFCF); suplementos; conductas en la mesa (levantarse, rabietas, rigidez); dónde y con quién come; estrés de la familia; terapias en curso.

### 8. Valores de referencia en Uruguay (pregunta 8)

- **Documento oficial:** "Recomendaciones de Ingesta de Energía y Nutrientes para la población uruguaya" (MSP, Área Programática de Nutrición, octubre de 2020, elaborado con la Escuela de Nutrición de la UdelaR). Usa la terminología del IOM/DRI (RPE/EAR, RD/RDA, IA/AI, NS/UL) y toma la energía de FAO/OMS/UNU 2001.\[64\] Valores para niños de 2–3 / 4–8 / 9–13 años: **calcio 700 / 1000 / 1300 mg**; **hierro 7 / 10 / 8 mg**; **fibra 19 / 25 / 31 g en varones y 26 g en niñas**. Metas: proteína 10–15% de la energía; omega-3 0,5–2% de la energía; azúcar libre menos de 10%.\[64\] Para los nutrientes que el documento no tabula, corresponde usar directamente las DRI del IOM (fichas NIH ODS).
- **DRI del IOM para 1–3 / 4–8 / 9–13 años:** zinc 3 / 5 / 8 mg; vitamina A 300 / 400 / 600 µg RAE; omega-3 (como ALA, ingesta adecuada) 0,7 / 0,9 / 1,2 g en varones y 1,0 g en niñas.\[65\]\[66\]\[67\] **No existe una ingesta recomendada oficial del IOM para DHA.**\[65\] Vitamina D 600 UI (15 µg); vitamina C 15 / 25 / 45 mg; B12 0,9 / 1,2 / 1,8 µg; proteína 13 / 19 / 34 g. Estos últimos cuatro valores son los estándar del IOM, pero no se pudieron verificar en línea para este informe: confirmarlos en las fichas del NIH ODS antes de cargarlos en el sistema.
- **Guía Alimentaria para la Población Uruguaya (MSP, 2016):** para mayores de 2 años. Prioriza alimentos naturales frente a ultraprocesados, pide "incluí pescado al menos una vez a la semana" y "elegí aceite".\[68\]\[69\] Hay que tener cuidado: muchos alimentos seguros de un niño selectivo son ultraprocesados, y la app debe tratarlos sin culpabilizar a la familia. La Sociedad Uruguaya de Pediatría tiene guías para preescolares y escolares que advierten que los niños pequeños comen porciones menores que la de referencia, "para no forzar su alimentación".\[70\]
- **Tablas de composición:** la Tabla de Composición de Alimentos de Uruguay (Tor y Herrera, MTSS/UdelaR, 2002) tiene **400 alimentos**.\[71\]\[72\] URUGUAYFOODS (Escuela de Nutrición, UdelaR, red LATINFOODS/FAO) está actualizando la base, pero todavía no hay una versión nueva publicada.\[71\] En una encuesta a 94 profesionales uruguayos, los más usados fueron USDA y CENEXA, y solo el 23,2% usaba la tabla uruguaya.\[73\] **Recomendación para el MVP:** usar USDA FoodData Central (abierta y con API) como fuente principal, la TCAU 2002 para alimentos locales, y la tabla brasileña TACO o la de LATINFOODS como respaldo. Mostrar siempre al usuario de qué tabla sale cada valor.

### 9. Cómo razona un profesional (pregunta 9)

1. **Seguridad primero:** revisa el crecimiento, las señales de alerta y si hace falta derivar o pedir análisis (25-OH-vitamina D, ferritina).
2. **Inventario del registro:** lista de alimentos seguros con su formato exacto, grupos ausentes y cálculo de nutrientes frente a las DRI para identificar los 2 o 3 déficits más grandes.
3. **Primero fortificar lo que ya come**, porque es lo de menor riesgo: la misma marca enriquecida, leche o yogur fortificados, sumar queso o aceite a una preparación ya aceptada. Después decide si hace falta un suplemento, y esa es una decisión profesional.
4. **Elige un objetivo de food chaining:** un alimento cercano a uno seguro y con alto aporte del nutriente que falta, cambiando un solo atributo.
5. **Plan de exposición:** porción mínima, separada, junto al alimento seguro, varias veces por semana, con registro de cada paso de la escalera (miró, tocó, olió, probó).
6. **Revisa cada 2 a 4 semanas y ajusta.** El registro fotográfico de la app sirve justamente para este paso.

### 10. Ejemplos de recetas y estrategias (pregunta 10)

*Son propuestas derivadas de los principios anteriores, no recetas probadas en ensayos.*

- **Calcio, para un niño que come cosas crocantes en bastones:** bastones de queso (tipo dambo o colonia) apanados y horneados; grisines o galletas de arroz con queso gratinado; "chips" de queso horneado. Si come yogur liso de una marca, la versión fortificada de esa misma marca. Siempre separado y al lado de su alimento seguro.
- **Hierro, para un niño que come alimentos beige:** cereales de desayuno fortificados de su marca o de una marca similar; milanesa o nuggets caseros de carne o pollo con el mismo apanado y la misma forma que los que ya acepta (cambiando solo el relleno); panqueques o tortitas con harina enriquecida (verificar la etiqueta). Si acepta jugo, acompañar con vitamina C para mejorar la absorción.\[74\]\[75\]
- **Vitamina C (prevenir escorbuto):** papa (el puré o las papas al horno aportan vitamina C), jugo de naranja natural colado y sin pulpa si rechaza las texturas mixtas, frutillas o kiwi en un formato uniforme (por ejemplo, frutas licuadas y coladas, con aviso). Si no hay ninguna fuente aceptada, es una alerta para el profesional.
- **Omega-3:** bastones de merluza caseros con el mismo apanado que sus nuggets (food chaining: nugget de pollo → nugget mitad pollo, mitad pescado, con aviso → bastón de pescado); huevos enriquecidos si acepta huevo; aceite de canola en sus preparaciones (aporta ALA).\[65\] La Guía uruguaya pide pescado al menos una vez por semana.\[69\]
- **Vitamina D:** los alimentos aportan poco (pescado, huevo, lácteos fortificados). Que la app no sugiera suplementos por su cuenta: debe marcar el déficit e indicar que se consulte con el pediatra o el nutricionista.
- **Fibra:** galletas integrales del mismo formato y marca que las que acepta; mezclar al principio una proporción baja de pan integral con su pan habitual, avisando, y subirla de a poco.

### 11. Reconocimiento por foto y apps existentes (pregunta 11)

- **Precisión técnica:** el reconocimiento de alimentos llega a alrededor de 96% de clasificación en condiciones controladas.\[76\] La estimación de porciones es el punto débil: a partir de una sola imagen 2D es un problema "mal planteado" por la ambigüedad de escala.\[77\] Nutrition5k informó un error absoluto porcentual medio (MAPE) de 11,47% en energía, pero con imágenes curadas.\[76\] Las mezclas y los platos combinados empeoran los resultados.\[78\] Comparar fotos de antes y después es una línea de investigación reciente (DietDelta, arXiv 2026, se presenta como uno de los primeros trabajos en estimar directamente lo consumido a partir de pares de fotos antes/después).\[79\] El proyecto TADA validó en adolescentes la captura de fotos antes y después con un marcador de referencia de 5 × 5 cm.\[76\]\[80\] Los nutricionistas entrenados estiman porciones a partir de fotos con mayor precisión.\[81\] **Para el MVP:** usar la foto como ayuda y confirmar cada alimento y su porción con el padre en un paso rápido (opciones de "nada / un poco / la mitad / casi todo / todo").
- **Una ventaja de esta población:** los niños selectivos comen pocos alimentos, siempre los mismos y servidos por separado. Eso facilita el reconocimiento (un catálogo personal de 10 a 30 ítems y un plato sin mezclas). Es una diferencia real del prototipo.
- **Apps existentes:** una revisión sistemática de las tiendas iOS y Android (2024–2025) encontró solo **2 apps** que abordaban explícitamente la alimentación en autismo y cumplían los criterios (EduKitchen–Toddlers Food Games y Autism Food Coach 2),\[82\] y concluyó que faltan herramientas basadas en evidencia.\[83\] Hay otras apps generales de picky eating o ARFID (Pitaya, Playful Eats).\[84\]\[85\] En un ensayo de una intervención nutricional móvil para niños con TEA selectivos, los padres señalaron que la selectividad del propio niño era una barrera y pidieron más personalización.\[86\] **Diferencial del prototipo:** combina cálculo de nutrientes con tablas reales, perfil sensorial por atributos, cadenas de alimentos personalizadas y un reporte para el profesional. Ninguna de las apps encontradas en la revisión integra estas cuatro funciones.

## Implicancias de diseño para la app (reglas del motor de recomendación)

1. **Modelo de datos de cada alimento seguro:** marca, forma (bastón, nugget, redondo), textura (crocante, blanda, lisa, grumosa, mixta), color, temperatura, sabor (suave, intenso), si va mezclado o separado, y con qué salsa. Las recetas se generan como **variaciones de un alimento seguro**.
2. **Un solo atributo por vez:** cada sugerencia cambia una sola dimensión (marca **o** forma **o** sabor **o** textura **o** ingrediente) respecto de un alimento aceptado. Nunca dos a la vez.
3. **Orden de dificultad sugerido:** misma comida con marca o versión fortificada → cambio de forma o tamaño → cambio de sabor suave → cambio de ingrediente → cambio de textura (el último, porque la textura es el principal motivo de rechazo).
4. **Presentación por defecto:** servido separado (o en plato dividido si el perfil lo indica), porción mínima ("del tamaño de una arveja o de un bastón"), junto a un alimento seguro, con salsas aparte. Un solo alimento nuevo por comida.
5. **Sin mezclas por defecto:** nada de guisos, rellenos ni salsas por encima, salvo que el perfil indique que el niño los acepta.
6. **Transparencia:** no sugerir esconder ingredientes. Si la receta tiene un ingrediente "agregado" (por ejemplo, queso en la masa), la app lo dice explícitamente y propone también ofrecerlo a la vista.
7. **Las exposiciones son el resultado:** registrar en qué paso de la escalera quedó el niño (lo toleró en la mesa, lo tocó, lo olió, lo probó, lo comió). Un rechazo no elimina el alimento: se insiste entre 8 y 15 veces o más con la misma presentación antes de cambiarla.
8. **Lenguaje sin presión:** prohibidas frases como "que termine", "una probadita más" o "premio si come". Usar, por ejemplo: "Ofrecelo sin pedirle que lo coma; que esté en el plato ya es un avance".
9. **Proteger los alimentos seguros:** no sugerir quitarlos nunca. Avisar si un alimento seguro aparece todos los días igual (riesgo de agotamiento) y proponer rotar su presentación.
10. **Prioridad de nutrientes:** ordenar los déficits por tamaño y gravedad (vitamina C si no hay ninguna fuente, por el escorbuto; luego calcio y vitamina D, hierro, fibra y omega-3). Atacar uno o dos por vez, empezando por fortificar lo que ya come.
11. **Cálculo honesto:** valores de USDA, TCAU o TACO con la fuente visible. Comparar contra las DRI y las recomendaciones del MSP 2020 por edad y sexo. Promediar por semana (no por día). Mostrar niveles de confianza ("estimado a partir de foto + confirmación").
12. **Respetar las indicaciones del profesional:** si el nutricionista dejó indicaciones, tienen prioridad sobre el motor. Nunca sugerir suplementos, dietas de eliminación ni dosis.
13. **Reporte para el profesional:** repertorio actual (número de alimentos), tendencia, grupos ausentes, nutrientes por debajo de la referencia, progreso de exposiciones y alertas.

## Red flags: derivar al profesional (la app debe detectarlas y no "tratarlas")

- Pérdida de peso, no ganar peso en 6 meses o más, o pérdida de 5% o más en 3 meses; caída de percentiles.\[58\]
- Repertorio de **menos de 10 a 20 alimentos**, o que se reduce (pierde alimentos seguros sin reemplazarlos).
- Eliminación de **grupos enteros** (ninguna fruta ni verdura, ningún lácteo, ninguna proteína).
- Ninguna fuente de vitamina C, o síntomas de **escorbuto**: dolor en las piernas, no querer caminar, cojera, encías inflamadas o sangrantes, petequias o moretones.\[47\]\[50\]
- Arcadas, vómitos, **atragantamiento**, tos al comer o dificultad para tragar (posible disfagia: derivar a fonoaudiología).
- Síntomas **gastrointestinales**: constipación persistente, dolor abdominal, reflujo, diarrea crónica.
- **Pica** (comer cosas que no son alimento).
- Angustia severa, autoagresión o crisis en las comidas; imposibilidad de comer fuera de casa; estrés familiar intenso.
- Dependencia de suplementos o fórmulas para cubrir la energía.
- Dieta sin gluten ni caseína u otra dieta de eliminación sin supervisión.
- Cansancio o palidez (posible anemia), fracturas o dolor óseo.

## Caveats

- **La evidencia sobre intervenciones es de calidad moderada a baja:** food chaining se apoya en series de casos chicas; SOS tiene ensayos pequeños con resultados mixtos; el número de exposiciones viene de estudios con niños típicos. Las reglas de presentación (plato dividido, proporción 75/25, porción del tamaño de una arveja) son consenso clínico más que resultado de ensayos.
- **Heterogeneidad:** "que no se toquen" y el color no distinguieron a los niños con TEA de los típicos en Hubbard 2014.\[5\]\[87\] El perfil individual siempre manda sobre las reglas generales.
- **Fuentes divulgativas:** algunos datos (por ejemplo, el aumento de 5 a 20,5 alimentos con food chaining) aparecen en blogs de profesionales que citan el estudio original; conviene verificarlos en el artículo de Fishbein 2006 antes de usarlos en una presentación.
- **Valores nutricionales:** los valores de vitamina D, C, B12 y proteína son los estándar del IOM, pero no se pudieron verificar en línea para este informe. La base actualizada de URUGUAYFOODS aún no está publicada.
- **La app no diagnostica:** ARFID, disfagia y carencias se diagnostican en la consulta. La app solo tamiza y deriva.

## Sources

1. [Beyond the plate: nutritional gaps and health risks in selective eaters with ASD - a narrative review](https://link.springer.com/article/10.1186/s12887-026-06977-2)
2. [Beyond the plate: nutritional gaps and health risks in selective eaters with ASD - a narrative review - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13360861/)
3. [(PDF) Sensory Sensitivity and Food Selectivity in Children with Autism Spectrum Disorder](https://www.researchgate.net/publication/320916792_Sensory_Sensitivity_and_Food_Selectivity_in_Children_with_Autism_Spectrum_Disorder)
4. [SENSORY SENSITIVITY AND FOOD SELECTIVITY IN CHILDREN WITH AUTISM SPECTRUM DISORDER - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6215327/)
5. [A Comparison of Food Refusal Related to Characteristics of Food in Children with Autism Spectrum Disorder and Typically Developing Children - ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S2212267214004602)
6. [Food Pattern, Food Selectivity and Sensory Profile in Autism Spectrum Disorder: An Exploratory Analysis in Chilean Children - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12650929/)
7. [Food Pattern, Food Selectivity and Sensory Profile in Autism Spectrum Disorder: An Exploratory Analysis in Chilean Children](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12650929/)
8. [Eating behavior in autism: senses as a window towards food acceptance - ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2214799321000813)
9. [Feeding Behaviours in Families With Children or Young People With Autism: A Systematic Review - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13522876/)
10. [Picky Eating & Autism: Why It Happens and How to Help](https://abacarenetwork.com/blog/autism-and-food-selectivity/)
11. [Full article: Idiosyncratic food preferences of children with autism spectrum disorder in England](https://www.tandfonline.com/doi/full/10.1080/16070658.2019.1697039)
12. [A comparison of food refusal related to characteristics of food in children with autism spectrum disorder and typically developing children](https://escholarship.umassmed.edu/iddrc_pubs/1/)
13. [Preliminary Exploration of the Usability of a Structured Plate to Improve Eating Behaviors in Children With Autism Spectrum Disorder and Its Impact on the Family: A Pilot Study](https://clinicaltrials.gov/study/NCT07516431)
14. [Autism and Picky Eating: What Actually Helps](https://special-learning.com/autism/autism-and-picky-eating-what-helps/)
15. [2019 Selective Eating](https://www.rchsd.org/documents/2020/08/selective-eating.pdf/)
16. [Food Selectivity and Autism: Expanding Your Child's Palate - GoodTherapy.org Therapy Blog](https://www.goodtherapy.org/blog/food-selectivity-autism-expanding-your-childs-palate-0805134/)
17. [How to Help Autistic Children Try New Foods](https://blueabatherapy.com/autism/how-to-help-autistic-children-try-new-foods/)
18. [How to Introduce New Foods to Children with Sensory Sensitivities](https://www.mastermindbehavior.com/post/how-to-introduce-new-foods-to-children-with-sensory-sensitivities)
19. [(PDF) Validation of brief autism mealtime behavior inventory (BAMBI) questionnaire in Vietnam in 2021](https://www.researchgate.net/publication/362791021_Validation_of_brief_autism_mealtime_behavior_inventory_BAMBI_questionnaire_in_Vietnam_in_2021)
20. [How ABA Can Support Smoother Mealtimes for Autistic Children](https://www.actionbehavior.com/resource/post/how-aba-can-support-smoother-mealtimes-for-autistic-children)
21. [Managing Food Selectivity and Picky Eating in Children with Autism With Pops ABA](https://popstherapy.com/managing-food-selectivity-and-picky-eating-in-children-with-autism-with-pops-aba/)
22. [Interrelation of food selectivity, oral sensory sensitivity, and nutrient intake in children with autism spectrum disorder: A scoping review - ScienceDirect](https://www.sciencedirect.com/science/article/pii/S1750946722000150)
23. [Should we play hide-and-go-seek with our children's vegetables?](https://www.sciencedaily.com/releases/2012/03/120301180910.htm)
24. [Hidden Vegetables](https://extension.usu.edu/nutrition/research/hidden-vegetables)
25. [Autism and Vegetables: Practical Strategies for Expanding Food Choices](https://neurolaunch.com/autism-vegetables/)
26. [Food Chaining 101 - Get Your Picky Eater to Try New Foods](https://www.jennyfriedmannutrition.com/food-chaining-for-picky-eating/)
27. [Food Chaining for Picky Eaters - Jackie Silver Nutrition](https://jackiesilvernutrition.com/articles/food-chaining-for-picky-eaters/)
28. [(PDF) Food Chaining: A Systematic Approach for the Treatment of Children With Feeding Aversion](https://www.researchgate.net/publication/7222254_Food_Chaining_A_Systematic_Approach_for_the_Treatment_of_Children_With_Feeding_Aversion)
29. [Diagnosis and Treatment of Pediatric Feeding Disorders: A Narrative Literature Review - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11941252/)
30. [Effects of repeated exposure on acceptance of initially disliked vegetables in 7-month old infants - ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0950329307000523)
31. [What is the relationship between repeated exposure to foods and food acceptance?](https://nesr.usda.gov/2025-dietary-guidelines-advisory-committee-systematic-reviews/repeated-exposure_acceptance)
32. [Methodological Components for Evaluating Intervention Effectiveness of SOS Feeding Approach: A Feasibility Study - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11940901/)
33. [Sensory Based Feeding Intervention for Toddlers With Food Refusal: A Randomized Controlled Trial](https://www.e-arm.org/journal/view.php?doi=10.5535%2Farm.21076)
34. [(PDF) Methodological Components for Evaluating Intervention Effectiveness of SOS Feeding Approach: A Feasibility Study](https://www.researchgate.net/publication/389911682_Methodological_Components_for_Evaluating_Intervention_Effectiveness_of_SOS_Feeding_Approach_A_Feasibility_Study)
35. [2016 International Meeting for Autism Research: The Sequential Oral Sensory Approach Intervention in Treating Children with Autism Spectrum Disorder and Limited Food Repertoire. a Pilot Study](https://insar.confex.com/insar/2016/webprogram/Paper22888.html)
36. [A comparison of a modified sequential oral sensory approach to an applied behavior-analytic approach in the treatment of food selectivity in children with autism spectrum disorder - PubMed](https://pubmed.ncbi.nlm.nih.gov/27449267/)
37. [Changing children's eating behaviour - A review of experimental research - ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0195666317303549)
38. [‘Finish your soup’: Counterproductive effects of pressuring children to eat on intake and affect - ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0195666306000195)
39. ['Finish your soup': Counterproductive effects of pressuring children to eat on intake and affect](https://www.researchgate.net/publication/7153381_'Finish_your_soup'_Counterproductive_effects_of_pressuring_children_to_eat_on_intake_and_affect)
40. [An Integrated Nutrition Intervention to Promote Healthy Eating Habits for Children With ASD](https://clinicaltrials.gov/study/NCT05194345)
41. [An Integrated Nutrition Intervention to Promote Healthy Eating Habits for Children With ASD](https://cdn.clinicaltrials.gov/large-docs/45/NCT05194345/Prot_000.pdf)
42. [Dietary intake, nutrient status, and growth parameters in children with autism spectrum disorder and severe food selectivity: an electronic medical record review - The Center for Nutritional Psychology](https://www.nutritional-psychology.org/research-summaries/dietary-intake-nutrient-status-and-growth-parameters-in-children-with-autism-spectrum-disorder-and-severe-food-selectivity-an-electronic-medical-record-review/)
43. [Food Selectivity in Autism Spectrum Disorder](https://www.researchgate.net/publication/365786831_Food_Selectivity_in_Autism_Spectrum_Disorder)
44. [Diagnosis and Prognosis of Food Selectivity in Autism](https://encyclopedia.pub/entry/42736)
45. [Unlocking the Link: Exploring the Association Between Food Selectivity and Health Outcome in Autism Spectrum Disorder—A Systematic Review](https://academic.oup.com/nutritionreviews/article/84/3/584/8140878)
46. [Diet Texture Progression for Individuals with Autism](https://beckmanoralmotor.com/wp-content/uploads/2024/08/Diet-Texture-Progression-for-Individuals-with-Autism-ASHA.pdf)
47. [Scurvy as a Sequela of Avoidant-Restrictive Food Intake Disorder in Autism: A Systematic Review](https://www.researchgate.net/publication/339210784_Scurvy_as_a_Sequela_of_Avoidant-Restrictive_Food_Intake_Disorder_in_Autism_A_Systematic_Review)
48. [Pediatric scurvy case report: a novel presentation with deep vein thrombosis secondary to large bilateral spontaneous iliac subperiosteal hematomas](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10870519/)
49. [Highly Selective Eating in Autism Spectrum Disorder Leading to Scurvy: A Series of Three Patients - ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0887899418308865)
50. [Scurvy as an Alarm Bell of Autistic Spectrum Disorder in the First World: A Case Report of a 3-Year-Old Girl - PubMed](https://pubmed.ncbi.nlm.nih.gov/34339404/)
51. [Autism and Scurvy: A Case Series](https://publications.aap.org/pediatrics/article/147/3_MeetingAbstract/852/5813/Autism-and-Scurvy-A-Case-Series)
52. [Case Report: Autistic child with restrictive eating behaviour, limping gait and erythematous gingival mass-scurvy?](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12313698/)
53. [Is There Science Behind That? Gluten-Free Autism Treatment](https://asatonline.org/for-parents/becoming-a-savvy-consumer/gluten-free-casein-free-diets/)
54. [Gluten Free Casein Free Diet - an overview](https://www.sciencedirect.com/topics/medicine-and-dentistry/gluten-free-casein-free-diet)
55. [Feeding Disorders in Plain Sight: What Growth Charts Don’t Show](https://www.contemporarypediatrics.com/view/feeding-disorders-in-plain-sight-what-growth-charts-dont-show)
56. [Avoidant/restrictive food intake disorder and autism spectrum disorder: clinical implications for assessment and management - Farag - 2022 - Developmental Medicine & Child Neurology - Wiley Online Library](https://onlinelibrary.wiley.com/doi/10.1111/dmcn.14977)
57. [What is avoidant restrictive food intake disorder?](https://bjgp.org/content/74/745/362)
58. [Feeding and Eating issues in Autism Spectrum Disorders](https://www.maineaap.org/assets/resources/Feeding-issues-in-Children-with-Autism-AAP-2025_Hubbard_Final.pdf)
59. [Brief Autism Mealtime Behavior Inventory (BAMBI): Italian Translation and Validation](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10378622/)
60. [Procedia - Social and Behavioral Sciences 116 ( 2014 ) 403](https://www.sciencedirect.com/science/article/pii/S1877042814002316/pdf?md5=5532293ddc31c741f67f0c11f3516ad5&pid=1-s2.0-S1877042814002316-main.pdf)
61. [Development and Validation of an Inventory to Assess Mealtime Behavior Problems in Children with Autism](https://www.researchgate.net/publication/6257898_Development_and_Validation_of_an_Inventory_to_Assess_Mealtime_Behavior_Problems_in_Children_with_Autism)
62. [(PDF) Validation of the Brief Autism Mealtime Behavior Inventory (BAMBI) Questionnaire](https://www.academia.edu/101868319/Validation_of_the_Brief_Autism_Mealtime_Behavior_Inventory_BAMBI_Questionnaire)
63. [Feeding, Eating, and Emotional Disturbances in Children with Avoidant/Restrictive Food Intake Disorder (ARFID)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7694203/)
64. <https://www.gub.uy/ministerio-salud-publica/sites/ministerio-salud-publica/files/documentos/publicaciones/RECOMENDACIONES_INGESTA_ENERGIA_NUTRIENTES_POBLACION_URUGUAYA.pdf>
65. [Office of Dietary Supplements - Omega-3 Fatty Acids](https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional)
66. [Office of Dietary Supplements - Vitamin A and Carotenoids](https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional)
67. [Office of Dietary Supplements - Zinc](https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional)
68. [MSP apunta contra la sal, el azúcar y las grasas, y alerta sobre el rol de la publicidad - Noticias Uruguay, LARED21 Diario Digital](https://www.lr21.com.uy/comunidad/1315141-msp-guia-alimentacion-saludable-uruguay-azucar-sal)
69. [Guía alimentaria para la población uruguaya](https://www.gub.uy/ministerio-desarrollo-social/comunicacion/publicaciones/guia-alimentaria-para-la-poblacion-uruguaya)
70. [Guías de alimentación del niño preescolar y escolar](https://www.sup.org.uy/wp-content/uploads/2016/07/Guias-de-alimentacion-del-nino-preescolar-y-escolar.pdf)
71. [..:: LATINFOODS ::.. ..:: URY ::..](https://www.latinfoodsportal.net/paises/main.php?sg2=uy&sg3=ury)
72. [Tabla de composición de alimentos de Uruguay Catalogue en ligne](https://catalogo.latu.org.uy/opac_css/index.php?lvl=notice_display&id=27683)
73. [Encuesta a profesionales sobre la nueva base de datos de composición de alimentos de Uruguay](https://www.alanrevista.org/ediciones/2023/suplemento-2/art-14/)
74. [Guia prevención deficiencia de hierro 2014](https://www.mysu.org.uy/wp-content/uploads/2015/07/2014-Recomendaciones-Deficiencia-Hierro.pdf)
75. [Guía para niñas, niños y adolescentes y sus familias Como e](https://www.sup.org.uy/wp-content/uploads/2024/05/Guias-para-ninas-ninos-y-adolescentes-veganos-y-vegetarianos-y-sus-familias.pdf)
76. [A comprehensive review of AI for food recognition and nutrient estimation with an obese children perspective](https://link.springer.com/article/10.1007/s44163-026-01526-3)
77. [Food Portion Estimation: From Pixels to Calories](https://arxiv.org/pdf/2602.05078)
78. [(PDF) A comprehensive review of AI for food recognition and nutrient estimation with an obese children perspective](https://www.researchgate.net/publication/406980686_A_comprehensive_review_of_AI_for_food_recognition_and_nutrient_estimation_with_an_obese_children_perspective)
79. [DietDelta: A Vision-Language Approach for Dietary Assessment via Before-and-After Images](https://arxiv.org/pdf/2604.06352)
80. [New mobile methods for dietary assessment: review of image-assisted and image-based dietary assessment methods](https://www.cambridge.org/core/journals/proceedings-of-the-nutrition-society/article/new-mobile-methods-for-dietary-assessment-review-of-imageassisted-and-imagebased-dietary-assessment-methods/33E6AE4398065ACEBACE8E9E3AD170C9)
81. [Feasibility of Reviewing Digital Food Images for Dietary Assessment among Nutrition Professionals](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6115988/)
82. [Content and Quality Analysis of mHealth Apps for Feeding Children with Autism Spectrum Disorder](https://arxiv.org/html/2509.18716)
83. [Content and Quality Analysis of Parent-Facing Applications for Feeding Children with Autism Spectrum Disorder](https://arxiv.org/pdf/2505.01520)
84. [Feeding Challenges in Autism: Practical Solutions for Children and Teens (and Why Feeding Apps Still Fall Short) — Malina Malkani](https://www.malinamalkani.com/blog/feeding-challenges-in-autism-practical-solutions-for-children-and-teens-and-why-feeding-apps-still-fall-short)
85. [Playful Eats: Fix Picky Eating - Apps on Google Play](https://play.google.com/store/apps/details?id=com.playfuleats.playfuleats&hl=en_US)
86. [Insights from User Experience and Evaluation of a Mobile Health Nutrition Intervention for Children with Autism: A Qualitative Study - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12766634/)
87. [Characteristics of Food Refusal in Children with Autism - Your Therapy Source](https://www.yourtherapysource.com/blog1/2014/11/25/characteristics-of-food-refusal-in-children-with-autism/)
