# Eval de visión (§11.1)

17/10/2026 20:40 · 8 fotos (0 del equipo, 8 de internet, declaradas) · 18 alimentos etiquetados · sin perfil del chico: solo el catálogo semilla

| Modelo | Recall | Precisión | Atributos | Latencia media | p95 | Fotos < 8 s | Errores |
|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 15/18 (83%) | 15/19 (79%) | 52/59 (88%) | 4,1 s | 6,3 s | 100% | 0 |
| claude-sonnet-5-5 | 15/18 (83%) | 15/18 (83%) | 47/59 (80%) | 4,6 s | 7,6 s | 100% | 0 |

**Recomendación: claude-haiku-5-5**: reconoce 15 de 18 alimentos en fotos analizadas en menos de 8 s.

Recall: alimentos etiquetados que reconoció (el ingrediente de más gramos de un ítem). Precisión: de los que dijo, cuántos estaban; los `otro_<grupo>` cuentan como "no reconocido", no como error. Atributos: textura, forma, color y cocción (si está etiquetada), solo en los reconocidos. Una foto con error cuenta como no reconocida y fuera de los 8 s.

## Atributos de los alimentos reconocidos

| Modelo | Textura | Forma | Color | Cocción |
|---|---|---|---|---|
| claude-haiku-5-5 | 13/15 (87%) | 13/15 (87%) | 12/15 (80%) | 14/14 (100%) |
| claude-sonnet-5-5 | 9/15 (60%) | 13/15 (87%) | 12/15 (80%) | 13/14 (93%) |

## Por foto

### claude-haiku-5-5

| Foto | Reconocidos | Faltaron | De más | otro_* | Atributos | Tiempo |
|---|---|---|---|---|---|---|
| milanesa-papas-fritas.jpg | 2/2 (100%) | — | manteca | 0 | 7/7 (100%) | 5,7 s |
| nuggets.jpg | 1/1 (100%) | — | — | 0 | 4/4 (100%) | 2,6 s |
| pollo-plancha-papas-fritas.jpg | 2/2 (100%) | — | — | 0 | 6/8 (75%) | 6,3 s |
| arroz-blanco.jpg | 1/1 (100%) | — | — | 0 | 4/4 (100%) | 2,1 s |
| carne-pure-arvejas.jpg | 2/3 (67%) | carne_picada | carne_vacuna | 0 | 8/8 (100%) | 3,7 s |
| fideos-bolognesa.jpg | 1/1 (100%) | — | — | 0 | 3/4 (75%) | 3,3 s |
| bandeja-escolar-manzana.jpg | 4/5 (80%) | leche | leche_vitamina_d | 0 | 12/16 (75%) | 5,1 s |
| milanesa-pollo-salsa-papas-arvejas.jpg | 2/3 (67%) | pollo | carne_vacuna | 0 | 8/8 (100%) | 3,7 s |

### claude-sonnet-5-5

| Foto | Reconocidos | Faltaron | De más | otro_* | Atributos | Tiempo |
|---|---|---|---|---|---|---|
| milanesa-papas-fritas.jpg | 2/2 (100%) | — | — | 0 | 7/7 (100%) | 5,1 s |
| nuggets.jpg | 1/1 (100%) | — | — | 0 | 4/4 (100%) | 3,3 s |
| pollo-plancha-papas-fritas.jpg | 2/2 (100%) | — | — | 0 | 7/8 (88%) | 4,3 s |
| arroz-blanco.jpg | 1/1 (100%) | — | — | 0 | 4/4 (100%) | 2,9 s |
| carne-pure-arvejas.jpg | 2/3 (67%) | carne_picada | carne_vacuna | 0 | 8/8 (100%) | 4,9 s |
| fideos-bolognesa.jpg | 1/1 (100%) | — | — | 0 | 1/4 (25%) | 3,1 s |
| bandeja-escolar-manzana.jpg | 4/5 (80%) | leche | leche_vitamina_d | 0 | 9/16 (56%) | 7,6 s |
| milanesa-pollo-salsa-papas-arvejas.jpg | 2/3 (67%) | pollo | carne_vacuna | 0 | 7/8 (88%) | 6,0 s |
