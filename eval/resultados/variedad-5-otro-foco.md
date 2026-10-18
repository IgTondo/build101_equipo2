# Eval de variedad de las recetas creativas

18/10/2026 09:42 · claude-sonnet-5-5 · Valentina (data/sinteticos/valentina.json, sin Mongo), hoy = 2026-10-18 · 6 recetas seguidas por comida, cada una con las anteriores en `anteriores`, como la app

**De 11 recetas, 11 ingredientes principales distintos (11 familias) y 8 alimentos de partida distintos; 3 de 11 llevan queso.**

| Comida | Salieron | Principales distintos | Familias | Partidas distintas | Con queso | Nombres repetidos | Siguieron el foco | Sin candidatos | Timeouts | Errores | Latencia media | p95 | Costo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cena | 5/6 (83%) | 5/6 | 5 | 3/6 | 2/5 (40%) | 0 | 3/5 (60%) | 1 | 0 | 0 | 33,6 s | 43,0 s | USD 0,66 |
| Desayuno | 6/6 (100%) | 6/6 | 6 | 5/6 | 1/6 (17%) | 0 | 6/6 (100%) | 0 | 0 | 0 | 24,7 s | 41,7 s | USD 0,46 |
| **Total** | 11/12 (92%) | 11/12 | 11 | 8/12 | 3/11 (27%) | 0 | 9/11 (82%) | 1 | 0 | 0 | 29,1 s | 43,0 s | USD 1,13 |

Principal: el ingrediente de más gramos de la receta; familia: el primer tramo de su id (`queso_muzzarella` → `queso`). Partidas: los alimentos seguros de los que parte. Con queso: algún `queso_*` o ricota entre los ingredientes. Siguió el foco: partió del alimento que sorteó el código y, si el foco trae un ingrediente, lo usó (de principal al cambiar el principal; entre los ingredientes al sumar uno). Las distintas se cuentan sobre las pedidas: 6/6 es una distinta por receta.

Costo con el uso que reportó la API: 345867 tokens de entrada y 43467 de salida, a USD 2 y 10 por millón (Sonnet 5.5).

## Cena

| # | Receta | Parte de | Cambio | Nutriente | Principal | Nuevos (respecto de su alimento) | Foco (¿lo siguió?) | Llamadas | Latencia |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Milanesa de porotos de soja al horno, crocante como su milanesa | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | omega-3 | porotos_soja | porotos_soja, semillas_lino, cebolla | sí · milanesa_carne_horno, cambiar el principal (porotos_soja), omega-3 | 2 | 28,4 s |
| 2 | Nuggets crocantes de lentejas y tofu | Nuggets caseros de pollo con el mismo apanado, fritos (sin huevo) | ingrediente | calcio | lentejas | lentejas, tofu, salsa_blanca | sí · nuggets_pollo_caseros, cambiar el principal (lentejas), calcio | 2 | 36,1 s |
| 3 | Milanesa de arvejas al horno, crocante como la suya | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | fibra | arvejas_partidas | arvejas_partidas, queso_rallado, maicena | no · papas_fritas_baston, cambiar el principal (cebada), fibra | 3 | 40,8 s |
| 4 | *sin candidatos* | — | — | — | — | — | pizza_muzzarella, cambiar el principal (panqueques), calcio | 3 | 35,4 s |
| 5 | Pizzetas crocantes de fideos integrales y muzzarella | Pizza de muzzarella sin salsa, masa fina y crocante | ingrediente | omega-3 | fideos_integrales | fideos_integrales, huevo_enriquecido, semillas_lino | sí · pizza_muzzarella, cambiar el principal (fideos_integrales), omega-3 | 1 | 17,5 s |
| 6 | Milanesa de garbanzos al horno, crocante como la de carne | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | fibra | garbanzos | garbanzos, papa, leche | no · papas_fritas_baston, cambiar el principal (cebada), fibra | 3 | 43,0 s |

Principales: porotos_soja, lentejas, arvejas_partidas, fideos_integrales, garbanzos · Partidas: milanesa_carne_horno ×3, nuggets_pollo_caseros, pizza_muzzarella · Nutrientes: omega-3 ×2, fibra ×2, calcio

Fallas:
- 4. sin candidatos: Esta vez no salió una receta segura. Probá otra idea. {"problemas":["En cena lo nuevo tiene que ser el principal, un plato potente (una proteína: carne, pollo, legumbres, queso…), no una guarnición. Partí de su principal (por ejemplo, su milanesa o sus nuggets) y que lo que ya come sea la guarnició…

## Desayuno

| # | Receta | Parte de | Cambio | Nutriente | Principal | Nuevos (respecto de su alimento) | Foco (¿lo siguió?) | Llamadas | Latencia |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Chips de ñoquis crocantes con lino, para el desayuno | Copos de maíz (cereal de desayuno, como vienen) | ingrediente | omega-3 | noquis | noquis, semillas_lino, aceite_canola | sí · copos_maiz, cambiar el principal (noquis), omega-3 | 1 | 18,1 s |
| 2 | Hojuelas crocantes de mandioca y queso al horno | Copos de maíz (cereal de desayuno, como vienen) | ingrediente | calcio | mandioca | mandioca, queso_rallado, leche_descremada | sí · copos_maiz, cambiar el principal (mandioca), calcio | 1 | 9,1 s |
| 3 | Crackers de panqueque con nueces, crocantes como sus galletitas | Galletitas de agua | ingrediente | omega-3 | panqueques | panqueques, nueces, semillas_sesamo | sí · galletitas_agua, cambiar el principal (panqueques), omega-3 | 2 | 30,2 s |
| 4 | Crema de banana y frambuesa, fría y suave | Banana pisada | ingrediente | omega-3 | banana | frambuesa, yogur_griego | sí · banana_pisada, sumar (frambuesa), omega-3 | 3 | 41,7 s |
| 5 | Crema de naranja y pera pisada con chía, fría | Frutillas pisadas | ingrediente | fibra | naranja | naranja, pera, semillas_chia | sí · frutilla_pisada, cambiar el principal (naranja), fibra | 2 | 41,0 s |
| 6 | Licuado de vainilla y canela con leche descremada, frío y cremoso | Licuado de banana con leche | ingrediente | calcio | leche_descremada | leche_descremada, azucar, maicena | sí · licuado_banana_leche, cambiar el principal (leche_descremada), calcio | 1 | 8,3 s |

Principales: noquis, mandioca, panqueques, banana, naranja, leche_descremada · Partidas: copos_maiz ×2, galletitas_agua, banana_pisada, frutilla_pisada, licuado_banana_leche · Nutrientes: omega-3 ×3, calcio ×2, fibra
