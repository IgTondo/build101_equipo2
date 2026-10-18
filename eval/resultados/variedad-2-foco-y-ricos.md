# Eval de variedad de las recetas creativas

18/10/2026 07:25 · claude-sonnet-5-5 · Valentina (data/sinteticos/valentina.json, sin Mongo), hoy = 2026-10-18 · 6 recetas seguidas por comida, cada una con las anteriores en `anteriores`, como la app

**De 12 recetas, 9 ingredientes principales distintos (8 familias) y 7 alimentos de partida distintos; 5 de 12 llevan queso.**

| Comida | Salieron | Principales distintos | Familias | Partidas distintas | Con queso | Nombres repetidos | Siguieron el foco | Sin candidatos | Timeouts | Errores | Latencia media | p95 | Costo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cena | 6/6 (100%) | 5/6 | 5 | 3/6 | 2/6 (33%) | 0 | 5/6 (83%) | 0 | 0 | 0 | 21,5 s | 35,3 s | USD 0,36 |
| Desayuno | 6/6 (100%) | 6/6 | 5 | 4/6 | 3/6 (50%) | 0 | 6/6 (100%) | 0 | 0 | 0 | 16,6 s | 27,1 s | USD 0,29 |
| **Total** | 12/12 (100%) | 9/12 | 8 | 7/12 | 5/12 (42%) | 0 | 11/12 (92%) | 0 | 0 | 0 | 19,1 s | 35,3 s | USD 0,65 |

Principal: el ingrediente de más gramos de la receta; familia: el primer tramo de su id (`queso_muzzarella` → `queso`). Partidas: los alimentos seguros de los que parte. Con queso: algún `queso_*` o ricota entre los ingredientes. Siguió el foco: partió del alimento que sorteó el código y, si el foco trae un ingrediente, lo usó (de principal al cambiar el principal; entre los ingredientes al sumar uno). Las distintas se cuentan sobre las pedidas: 6/6 es una distinta por receta.

Costo con el uso que reportó la API: 188377 tokens de entrada y 27369 de salida, a USD 2 y 10 por millón (Sonnet 5.5).

## Cena

| # | Receta | Parte de | Cambio | Nutriente | Principal | Nuevos (respecto de su alimento) | Foco (¿lo siguió?) | Llamadas | Latencia |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Medallones de ricota dorados al horno, crocantes como su milanesa | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | calcio | ricota | ricota, queso_rallado, huevo | no · pure_zapallo, cambiar el principal (queso_rallado), calcio | 2 | 35,3 s |
| 2 | Milanesa de avena y queso al horno, dorada y crocante | Milanesa de lentejas al horno (sin huevo) | ingrediente | omega-3 | avena | avena, queso_dambo, huevo_enriquecido | sí · milanesa_lentejas_horno, cambiar el principal (avena), omega-3 | 1 | 19,4 s |
| 3 | Garbanzos desmenuzados tibios con zanahoria y pan, suaves y tiernos | Pollo hervido desmenuzado | ingrediente | fibra | garbanzos | garbanzos, zanahoria, pan_blanco, leche | sí · pollo_desmenuzado, cambiar el principal (garbanzos), fibra | 2 | 18,6 s |
| 4 | Huevo duro desmenuzado tibio, tierno como su pollo | Pollo hervido desmenuzado | ingrediente | omega-3 | huevo_enriquecido | huevo_enriquecido, leche, manteca | sí · pollo_desmenuzado, cambiar el principal (huevo_enriquecido), omega-3 | 1 | 18,5 s |
| 5 | Milanesa de yogur al horno, dorada y crocante | Milanesa de lentejas al horno (sin huevo) | ingrediente | calcio | yogur | yogur, harina_trigo, aceite_canola | sí · milanesa_lentejas_horno, cambiar el principal (yogur), calcio | 1 | 19,7 s |
| 6 | Tortilla de huevo enriquecido y papa desmenuzada, tibia y tierna como su pollo | Pollo hervido desmenuzado | ingrediente | omega-3 | huevo_enriquecido | huevo_enriquecido, papa, leche, espinaca | sí · pollo_desmenuzado, cambiar el principal (huevo_enriquecido), omega-3 | 2 | 17,7 s |

Principales: huevo_enriquecido ×2, ricota, avena, garbanzos, yogur · Partidas: pollo_desmenuzado ×3, milanesa_lentejas_horno ×2, milanesa_carne_horno · Nutrientes: omega-3 ×3, calcio ×2, fibra

## Desayuno

| # | Receta | Parte de | Cambio | Nutriente | Principal | Nuevos (respecto de su alimento) | Foco (¿lo siguió?) | Llamadas | Latencia |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Licuado cremoso de queso dambo y banana | Licuado de banana con leche | ingrediente | omega-3 | queso_dambo | queso_dambo | sí · licuado_banana_leche, cambiar el principal (queso_dambo), omega-3 | 1 | 17,2 s |
| 2 | Crema fría de avena y manzana, suave como su banana pisada | Banana pisada | ingrediente | omega-3 | avena | avena, leche, manzana, miel | sí · banana_pisada, cambiar el principal (avena), omega-3 | 2 | 27,1 s |
| 3 | Crema fría de queso rallado y vainilla, espesa como su yogur | Yogur de vainilla | ingrediente | calcio | queso_rallado | queso_rallado, leche, azucar | sí · yogur_vainilla, cambiar el principal (queso_rallado), calcio | 2 | 15,7 s |
| 4 | Tostadas crocantes con untable de porotos y ricota | Tostadas de pan blanco | ingrediente | calcio | porotos | porotos, ricota | sí · tostadas, sumar (porotos), calcio | 1 | 22,8 s |
| 5 | Tostadas crocantes de yogur y pan, doradas al horno | Tostadas de pan blanco | ingrediente | calcio | yogur | yogur, harina_trigo | sí · tostadas, cambiar el principal (yogur), calcio | 1 | 8,9 s |
| 6 | Postre frío de leche y vainilla, cremoso como su yogur | Yogur de vainilla | ingrediente | calcio | leche | leche, azucar, harina_trigo | sí · yogur_vainilla, cambiar el principal (leche), calcio | 1 | 8,1 s |

Principales: queso_dambo, avena, queso_rallado, porotos, yogur, leche · Partidas: yogur_vainilla ×2, tostadas ×2, licuado_banana_leche, banana_pisada · Nutrientes: calcio ×4, omega-3 ×2
