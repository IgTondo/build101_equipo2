# Eval de variedad de las recetas creativas

18/10/2026 08:32 · claude-sonnet-5-5 · Valentina (data/sinteticos/valentina.json, sin Mongo), hoy = 2026-10-18 · 6 recetas seguidas por comida, cada una con las anteriores en `anteriores`, como la app

**De 10 recetas, 10 ingredientes principales distintos (10 familias) y 6 alimentos de partida distintos; 4 de 10 llevan queso.**

| Comida | Salieron | Principales distintos | Familias | Partidas distintas | Con queso | Nombres repetidos | Siguieron el foco | Sin candidatos | Timeouts | Errores | Latencia media | p95 | Costo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cena | 6/6 (100%) | 6/6 | 6 | 3/6 | 4/6 (67%) | 0 | 2/6 (33%) | 0 | 0 | 0 | 27,1 s | 34,2 s | USD 0,50 |
| Desayuno | 4/6 (67%) | 4/6 | 4 | 3/6 | 0/4 (0%) | 0 | 3/4 (75%) | 2 | 0 | 0 | 22,1 s | 35,4 s | USD 0,42 |
| **Total** | 10/12 (83%) | 10/12 | 10 | 6/12 | 4/10 (40%) | 0 | 5/10 (50%) | 2 | 0 | 0 | 24,6 s | 35,4 s | USD 0,93 |

Principal: el ingrediente de más gramos de la receta; familia: el primer tramo de su id (`queso_muzzarella` → `queso`). Partidas: los alimentos seguros de los que parte. Con queso: algún `queso_*` o ricota entre los ingredientes. Siguió el foco: partió del alimento que sorteó el código y, si el foco trae un ingrediente, lo usó (de principal al cambiar el principal; entre los ingredientes al sumar uno). Las distintas se cuentan sobre las pedidas: 6/6 es una distinta por receta.

Costo con el uso que reportó la API: 279279 tokens de entrada y 36801 de salida, a USD 2 y 10 por millón (Sonnet 5.5).

## Cena

| # | Receta | Parte de | Cambio | Nutriente | Principal | Nuevos (respecto de su alimento) | Foco (¿lo siguió?) | Llamadas | Latencia |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Milanesa de pollo al horno con rebozado de lino, crocante como la suya | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | omega-3 | pollo | pollo, semillas_lino, leche | no · pure_zapallo, cambiar el principal (fideos_integrales), omega-3 | 2 | 33,5 s |
| 2 | Pizza crocante con base cremosa de yogur y muzzarella | Pizza de muzzarella sin salsa, masa fina y crocante | ingrediente | calcio | prepizza | yogur_bebible | sí · pizza_muzzarella, sumar (yogur_bebible), calcio | 1 | 23,6 s |
| 3 | Milanesa de tofu al horno, crocante como su milanesa | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | calcio | tofu | tofu, leche_descremada, queso_rallado | no · bastones_zanahoria_horno, cambiar el principal (boniato), calcio | 2 | 27,3 s |
| 4 | Milanesa de porotos de soja al horno, crocante como la suya | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | calcio | porotos_soja | porotos_soja, harina_trigo, cebolla | sí · milanesa_carne_horno, cambiar el principal (porotos_soja), calcio | 1 | 11,8 s |
| 5 | Milanesas de ricota doradas al horno, crocantes como su milanesa | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | calcio | ricota | ricota, queso_rallado, maicena, leche_descremada | no · papas_fritas_baston, cambiar el principal (boniato), calcio | 2 | 34,2 s |
| 6 | Milanesas de arvejas secas al horno, crocantes como sus milanesas | Milanesa de lentejas al horno (sin huevo) | ingrediente | fibra | arvejas_partidas | arvejas_partidas, queso_rallado, maicena | no · bastones_zanahoria_horno, cambiar el principal (cebada), fibra | 2 | 32,6 s |

Principales: pollo, prepizza, tofu, porotos_soja, ricota, arvejas_partidas · Partidas: milanesa_carne_horno ×4, pizza_muzzarella, milanesa_lentejas_horno · Nutrientes: calcio ×4, omega-3, fibra

## Desayuno

| # | Receta | Parte de | Cambio | Nutriente | Principal | Nuevos (respecto de su alimento) | Foco (¿lo siguió?) | Llamadas | Latencia |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Leche cremosa de vainilla con lino molido | Yogur de vainilla | ingrediente | omega-3 | leche | leche, semillas_lino, maicena, azucar | sí · yogur_vainilla, cambiar el principal (leche), omega-3 | 1 | 10,8 s |
| 2 | Licuado cremoso de yogur bebible con banana y frutilla | Licuado de banana con leche | ingrediente | calcio | yogur_bebible | yogur_bebible, frutilla | no · galletitas_agua, sumar (yogur_bebible), calcio | 2 | 35,4 s |
| 3 | Bastones helados de frambuesa y chía | Manzana pelada en bastones | ingrediente | omega-3 | frambuesa | frambuesa, semillas_chia, avena, miel | sí · manzana_bastones, cambiar el principal (frambuesa), omega-3 | 1 | 18,3 s |
| 4 | *sin candidatos* | — | — | — | — | — | manzana_bastones, sumar (mandioca), omega-3 | 2 | 34,0 s |
| 5 | Crema de pera y mora con vainilla | Yogur de vainilla | ingrediente | fibra | pera | pera, mora | sí · yogur_vainilla, cambiar el principal, fibra | 1 | 17,9 s |
| 6 | *sin candidatos* | — | — | — | — | — | galletitas_agua, sumar (queso_muzzarella), calcio | 2 | 16,0 s |

Principales: leche, yogur_bebible, frambuesa, pera · Partidas: yogur_vainilla ×2, licuado_banana_leche, manzana_bastones · Nutrientes: omega-3 ×2, calcio, fibra

Fallas:
- 4. sin candidatos: Esta vez no salió una receta segura. Probá otra idea. {"problemas":["El plato entero tiene 481 kcal y una comida completa para desayuno va de 218 a 464 kcal: ajustá los gramos (o sumá lo que falte del plato)."]}
- 6. sin candidatos: Esta vez no salió una receta segura. Probá otra idea. {"problemas":["De «Galletitas de agua» a «Galletitas crocantes de muzzarella y orégano, al horno» cambian 2 cosas (la cocción: listo → horno; el ingrediente principal: Galletitas al agua → Queso muzzarella): tiene que cambiar una sola."]}
