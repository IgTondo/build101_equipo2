# Eval de variedad de las recetas creativas

18/10/2026 08:14 · claude-sonnet-5-5 · Valentina (data/sinteticos/valentina.json, sin Mongo), hoy = 2026-10-18 · 6 recetas seguidas por comida, cada una con las anteriores en `anteriores`, como la app

**De 11 recetas, 10 ingredientes principales distintos (9 familias) y 7 alimentos de partida distintos; 2 de 11 llevan queso.**

| Comida | Salieron | Principales distintos | Familias | Partidas distintas | Con queso | Nombres repetidos | Siguieron el foco | Sin candidatos | Timeouts | Errores | Latencia media | p95 | Costo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cena | 5/6 (83%) | 5/6 | 5 | 3/6 | 2/5 (40%) | 0 | 1/5 (20%) | 1 | 0 | 0 | 27,7 s | 39,6 s | USD 0,53 |
| Desayuno | 6/6 (100%) | 6/6 | 5 | 4/6 | 0/6 (0%) | 0 | 5/6 (83%) | 0 | 0 | 0 | 19,1 s | 42,5 s | USD 0,33 |
| **Total** | 11/12 (92%) | 10/12 | 9 | 7/12 | 2/11 (18%) | 0 | 6/11 (55%) | 1 | 0 | 0 | 23,4 s | 42,5 s | USD 0,86 |

Principal: el ingrediente de más gramos de la receta; familia: el primer tramo de su id (`queso_muzzarella` → `queso`). Partidas: los alimentos seguros de los que parte. Con queso: algún `queso_*` o ricota entre los ingredientes. Siguió el foco: partió del alimento que sorteó el código y, si el foco trae un ingrediente, lo usó (de principal al cambiar el principal; entre los ingredientes al sumar uno). Las distintas se cuentan sobre las pedidas: 6/6 es una distinta por receta.

Costo con el uso que reportó la API: 262284 tokens de entrada y 33330 de salida, a USD 2 y 10 por millón (Sonnet 5.5).

## Cena

| # | Receta | Parte de | Cambio | Nutriente | Principal | Nuevos (respecto de su alimento) | Foco (¿lo siguió?) | Llamadas | Latencia |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Milanesas de tofu al horno, crocantes como sus milanesas | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | calcio | tofu | tofu, leche_descremada, aceite_canola | no · papas_fritas_baston, sumar (tofu), calcio | 2 | 35,3 s |
| 2 | Milanesas de pollo al horno con apanado de lino, crocantes como las suyas | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | omega-3 | pollo | pollo, semillas_lino, leche | no · pure_zapallo, cambiar el principal (papas_fritas), omega-3 | 2 | 34,4 s |
| 3 | Milanesas de arvejas secas al horno, crocantes como sus milanesas | Milanesa de lentejas al horno (sin huevo) | ingrediente | fibra | arvejas_partidas | arvejas_partidas, queso_rallado, harina_trigo, cebolla | no · bastones_boniato_fritos, cambiar el principal (pera), fibra | 2 | 20,9 s |
| 4 | Milanesas de porotos de soja al horno, crocantes como sus milanesas | Milanesa de lentejas al horno (sin huevo) | ingrediente | omega-3 | porotos_soja | porotos_soja, cebolla, harina_trigo | sí · milanesa_lentejas_horno, cambiar el principal (porotos_soja), omega-3 | 1 | 11,9 s |
| 5 | *sin candidatos* | — | — | — | — | — | pure_zapallo, cambiar el principal (lentejas), fibra | 2 | 23,9 s |
| 6 | Nuggets de ricota dorados y crocantes, como sus nuggets | Nuggets caseros de pollo con el mismo apanado, fritos (sin huevo) | ingrediente | calcio | ricota | ricota, queso_rallado, harina_trigo, leche_descremada | no · bastones_boniato_fritos, cambiar el principal (naranja), calcio | 2 | 39,6 s |

Principales: tofu, pollo, arvejas_partidas, porotos_soja, ricota · Partidas: milanesa_carne_horno ×2, milanesa_lentejas_horno ×2, nuggets_pollo_caseros · Nutrientes: calcio ×2, omega-3 ×2, fibra

Fallas:
- 5. sin candidatos: Esta vez no salió una receta segura. Probá otra idea. {"problemas":["Choca con su regla «No come verduras» (grupo=verdura).","En cena lo nuevo tiene que ser el principal, un plato potente (una proteína: carne, pollo, legumbres, queso…), no una verdura o fruta. Partí de su principal (por ejemplo, su…

## Desayuno

| # | Receta | Parte de | Cambio | Nutriente | Principal | Nuevos (respecto de su alimento) | Foco (¿lo siguió?) | Llamadas | Latencia |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Hojuelas crocantes de papa y lino, para el desayuno | Copos de maíz (cereal de desayuno, como vienen) | ingrediente | omega-3 | papas_fritas | papas_fritas, harina_maiz, semillas_lino, pan_rallado | sí · copos_maiz, cambiar el principal (papas_fritas), omega-3 | 1 | 17,9 s |
| 2 | Licuado cremoso de banana y nueces | Licuado de banana con leche | ingrediente | omega-3 | leche | nueces | sí · licuado_banana_leche, sumar (nueces), omega-3 | 1 | 10,0 s |
| 3 | Licuado cremoso de tofu y cacao, bien frío | Leche chocolatada | ingrediente | calcio | tofu | tofu, leche_descremada, azucar | sí · leche_chocolatada, cambiar el principal (tofu), calcio | 1 | 10,9 s |
| 4 | Cremita fría de vainilla en vasito, como su yogur | Yogur de vainilla | ingrediente | calcio | leche_descremada | leche_descremada, maicena, azucar, vainilla | no · galletitas_agua, sumar (yogur_bebible), calcio | 2 | 42,5 s |
| 5 | Crema fría de ravioles de ricota y cacao, para tomar en vaso | Leche chocolatada | ingrediente | calcio | ravioles | ravioles | sí · leche_chocolatada, cambiar el principal (ravioles), calcio | 1 | 18,8 s |
| 6 | Licuado cremoso de naranja y leche, bien frío | Licuado de banana con leche | ingrediente | calcio | naranja | naranja, leche_descremada, vainilla | sí · licuado_banana_leche, cambiar el principal (naranja), calcio | 1 | 14,5 s |

Principales: papas_fritas, leche, tofu, leche_descremada, ravioles, naranja · Partidas: licuado_banana_leche ×2, leche_chocolatada ×2, copos_maiz, yogur_vainilla · Nutrientes: calcio ×4, omega-3 ×2
