# Eval de visión (§11.1)

17/10/2026 20:49 · 8 fotos (0 del equipo, 8 de internet, declaradas) · 18 alimentos etiquetados · sin perfil del chico: solo el catálogo semilla

| Modelo | Recall | Precisión | Atributos | Latencia media | p95 | Fotos < 8 s | Errores |
|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 14/18 (78%) | 14/17 (82%) | 46/55 (84%) | 3,7 s | 6,2 s | 100% | 0 |

Recall: alimentos etiquetados que reconoció (el ingrediente de más gramos de un ítem). Precisión: de los que dijo, cuántos estaban; los `otro_<grupo>` cuentan como "no reconocido", no como error. Atributos: textura, forma, color y cocción (si está etiquetada), solo en los reconocidos. Una foto con error cuenta como no reconocida y fuera de los 8 s.

## Atributos de los alimentos reconocidos

| Modelo | Textura | Forma | Color | Cocción |
|---|---|---|---|---|
| claude-haiku-5-5 | 12/14 (86%) | 10/14 (71%) | 11/14 (79%) | 13/13 (100%) |

## Por foto

### claude-haiku-5-5

| Foto | Reconocidos | Faltaron | De más | otro_* | Atributos | Tiempo |
|---|---|---|---|---|---|---|
| milanesa-papas-fritas.jpg | 2/2 (100%) | — | — | 0 | 7/7 (100%) | 5,2 s |
| nuggets.jpg | 1/1 (100%) | — | — | 0 | 4/4 (100%) | 2,6 s |
| pollo-plancha-papas-fritas.jpg | 2/2 (100%) | — | — | 0 | 6/8 (75%) | 3,4 s |
| arroz-blanco.jpg | 1/1 (100%) | — | — | 0 | 4/4 (100%) | 2,0 s |
| carne-pure-arvejas.jpg | 2/3 (67%) | carne_picada | carne_vacuna | 0 | 8/8 (100%) | 3,6 s |
| fideos-bolognesa.jpg | 1/1 (100%) | — | — | 0 | 2/4 (50%) | 2,5 s |
| bandeja-escolar-manzana.jpg | 3/5 (60%) | porotos, leche | leche_vitamina_d | 1 | 8/12 (67%) | 6,2 s |
| milanesa-pollo-salsa-papas-arvejas.jpg | 2/3 (67%) | pollo | carne_vacuna | 0 | 7/8 (88%) | 3,8 s |
