# Eval de variedad de las recetas creativas

18/10/2026 07:17 · claude-sonnet-5-5 · Valentina (data/sinteticos/valentina.json, sin Mongo), hoy = 2026-10-18 · 6 recetas seguidas por comida, cada una con las anteriores en `anteriores`, como la app

**De 12 recetas, 9 ingredientes principales distintos (7 familias) y 9 alimentos de partida distintos; 9 de 12 llevan queso.**

| Comida | Salieron | Principales distintos | Familias | Partidas distintas | Con queso | Nombres repetidos | Siguieron el foco | Sin candidatos | Timeouts | Errores | Latencia media | p95 | Costo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cena | 6/6 (100%) | 5/6 | 5 | 4/6 | 5/6 (83%) | 0 | 2/6 (33%) | 0 | 0 | 0 | 27,8 s | 37,9 s | USD 0,44 |
| Desayuno | 6/6 (100%) | 5/6 | 4 | 5/6 | 4/6 (67%) | 0 | 5/6 (83%) | 0 | 0 | 0 | 19,7 s | 32,9 s | USD 0,30 |
| **Total** | 12/12 (100%) | 9/12 | 7 | 9/12 | 9/12 (75%) | 0 | 7/12 (58%) | 0 | 0 | 0 | 23,7 s | 37,9 s | USD 0,74 |

Principal: el ingrediente de más gramos de la receta; familia: el primer tramo de su id (`queso_muzzarella` → `queso`). Partidas: los alimentos seguros de los que parte. Con queso: algún `queso_*` o ricota entre los ingredientes. Siguió el foco: partió del alimento que sorteó el código y, si el foco trae un ingrediente, lo usó (de principal al cambiar el principal; entre los ingredientes al sumar uno). Las distintas se cuentan sobre las pedidas: 6/6 es una distinta por receta.

Costo con el uso que reportó la API: 186365 tokens de entrada y 36422 de salida, a USD 2 y 10 por millón (Sonnet 5.5).

## Cena

| # | Receta | Parte de | Cambio | Nutriente | Principal | Nuevos (respecto de su alimento) | Foco (¿lo siguió?) | Llamadas | Latencia |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Milanesa de ricota al horno, crocante como la suya | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | calcio | ricota | ricota, queso_rallado, huevo | no · pure_papa, cambiar el principal, calcio | 2 | 36,0 s |
| 2 | Milanesa de pollo al horno con rebozado integral, crocante como la suya | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | omega-3 | pollo | pollo, galletitas_integrales, leche, aceite_canola | sí · milanesa_carne_horno, cambiar el principal, omega-3 | 1 | 18,1 s |
| 3 | Nuggets de pollo y queso, fritos y crocantes | Nuggets caseros de pollo con el mismo apanado, fritos (sin huevo) | ingrediente | calcio | pollo | queso_rallado, leche | no · bastones_zanahoria_horno, cambiar el principal, calcio | 2 | 24,4 s |
| 4 | Milanesitas de muzzarella al horno, crocantes como las suyas | Milanesa de carne al horno (rebozada sin huevo) | ingrediente | calcio | queso_muzzarella | queso_muzzarella, polenta, harina_trigo, leche | no · pure_zapallo, cambiar el principal, calcio | 2 | 32,9 s |
| 5 | Milanesas de garbanzos y dambo al horno, crocantes como las suyas | Milanesa de lentejas al horno (sin huevo) | ingrediente | calcio | garbanzos | garbanzos, queso_dambo, leche | no · pollo_desmenuzado, cambiar el principal, calcio | 2 | 37,9 s |
| 6 | Pizzetas de porotos y muzzarella al horno, crocantes como su pizza | Pizza de muzzarella sin salsa, masa fina y crocante | ingrediente | fibra | porotos | porotos, avena, pan_rallado | sí · pizza_muzzarella, cambiar el principal, fibra | 1 | 17,3 s |

Principales: pollo ×2, ricota, queso_muzzarella, garbanzos, porotos · Partidas: milanesa_carne_horno ×3, nuggets_pollo_caseros, milanesa_lentejas_horno, pizza_muzzarella · Nutrientes: calcio ×4, omega-3, fibra

## Desayuno

| # | Receta | Parte de | Cambio | Nutriente | Principal | Nuevos (respecto de su alimento) | Foco (¿lo siguió?) | Llamadas | Latencia |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Batido cremoso de yogur y cacao, bien frío | Leche chocolatada | ingrediente | calcio | yogur | yogur, ricota | sí · leche_chocolatada, cambiar el principal, calcio | 1 | 15,0 s |
| 2 | Crema de ricota y vainilla, bien fría como su yogur | Yogur de vainilla | ingrediente | calcio | ricota | ricota, azucar | no · manzana_bastones, cambiar el principal, calcio | 2 | 32,9 s |
| 3 | Bastones de pera con crocante de galletitas integrales | Manzana pelada en bastones | ingrediente | fibra | pera | pera, galletitas_integrales, yogur | sí · manzana_bastones, cambiar el principal, fibra | 1 | 17,6 s |
| 4 | Galletas crocantes de queso al horno, finitas como sus tostadas | Tostadas de pan blanco | ingrediente | calcio | queso_rallado | queso_rallado, ricota, pan_rallado | sí · tostadas, cambiar el principal, calcio | 1 | 16,7 s |
| 5 | Crema de pera y avena remojada, bien fría | Frutillas pisadas | ingrediente | fibra | pera | pera, avena, yogur | sí · frutilla_pisada, cambiar el principal, fibra | 1 | 17,2 s |
| 6 | Bastones de queso con costra crocante de copos | Manzana pelada en bastones | ingrediente | calcio | queso_dambo | queso_dambo, cereal_fortificado, miel | sí · manzana_bastones, cambiar el principal, calcio | 1 | 18,9 s |

Principales: pera ×2, yogur, ricota, queso_rallado, queso_dambo · Partidas: manzana_bastones ×2, leche_chocolatada, yogur_vainilla, tostadas, frutilla_pisada · Nutrientes: calcio ×4, fibra ×2
