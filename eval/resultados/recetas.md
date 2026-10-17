# Eval de recetas (§11.3)

17/10/2026 20:42 · claude-sonnet-5-5 · 12 casos sintéticos, declarados: 8 con evidenciaDe() de B sobre Tomás y Lucía (data/sinteticos/) y 4 armados para Bruno (leche y gluten, perfil inventado)

**El LLM se equivocó en 2 de sus 13 salidas; el código lo atrapó siempre: ninguna receta inválida llegó a la familia.**

|  | Casos | Sin ningún problema | Alergias | Un solo cambio | Lenguaje | Otros |
|---|---|---|---|---|---|---|
| El LLM solo (su primera salida) | 11 | 9/11 (82%) | 9/11 (82%) | 11/11 (100%) | 11/11 (100%) | 11/11 (100%) |
| Con la validación y los reintentos | 11 | 11/11 (100%) | 11/11 (100%) | 11/11 (100%) | 11/11 (100%) | 11/11 (100%) |

| Recetas válidas | Sin candidatos | Errores | Inválidas | Cubren ≥ 20% de lo que falta | Llamadas al LLM | Costo estimado | Latencia media | p95 | < 60 s |
|---|---|---|---|---|---|---|---|---|---|
| 11 | 1 | 0 | **0** | 7/11 (64%) | 13 | USD 0,34 | 6,8 s | 13,0 s | 100% |

"El LLM solo": cada caso con su primera salida del modelo, validada por código antes de cualquier reintento. "Con la validación": la receta que devuelve generarReceta(), validada otra vez por la eval. **Inválidas tiene que dar 0.** "Sin candidatos" es una respuesta correcta: no hay un paso de un solo cambio y la app lo dice. Un caso con error cuenta fuera de los 60 s.

## Por caso

| Caso | Evidencia | 1.ª salida | Resultado | Receta sobre | Llamadas | Cubre | Latencia | Error |
|---|---|---|---|---|---|---|---|---|
| tomas-calcio_mg | B | bien | válida | bastones_queso_horno | 1 | 41% | 7,3 s |  |
| tomas-hierro_mg | B | bien | válida | tostadas_queso | 1 | 34% | 7,3 s |  |
| tomas-vitamina_d_ug | B | bien | válida | leche_chocolatada_fortificada | 1 | 18% | 5,4 s |  |
| tomas-fibra_g | B | bien | válida | tostadas_pan_integral | 1 | 18% | 5,8 s |  |
| lucia-calcio_mg | B | bien | válida | pure_papa_queso | 1 | 21% | 8,0 s |  |
| lucia-hierro_mg | B | bien | válida | avena_con_leche | 1 | 26% | 5,9 s |  |
| lucia-vitamina_d_ug | B | — | sin candidatos | — | 0 | — | 0,0 s |  |
| lucia-fibra_g | B | bien | válida | avena_con_leche | 1 | 18% | 5,0 s |  |
| bruno-calcio_mg | armada | alergias (1) | válida | bastones_garbanzo_horno | 2 | 5% | 13,0 s |  |
| bruno-hierro_mg | armada | bien | válida | bife_plancha | 1 | 60% | 6,3 s |  |
| bruno-vitamina_d_ug | armada | bien | válida | salmon_plancha | 1 | 96% | 6,7 s |  |
| bruno-fibra_g | armada | alergias (1) | válida | bastones_garbanzo_horno | 2 | 37% | 10,9 s |  |

Sin candidatos a un solo cambio: lucia-vitamina_d_ug.
