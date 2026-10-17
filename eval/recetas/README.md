# Eval de recetas (PLAN.md §11.3, A12)

`casos.json` tiene 12 casos **sintéticos, declarados**: 3 perfiles con alergias × 4 nutrientes (calcio, hierro, vitamina D y fibra).

| Perfil | Alergias | De dónde sale la evidencia |
|---|---|---|
| Tomás, 6 años | huevo | `evidenciaDe()` de B sobre sus 20 comidas de `data/sinteticos/` (sin Mongo) |
| Lucía, 10 años | ninguna ("no come nada verde") | ídem. Para vitamina D, B no encuentra candidatos: el resultado correcto es `sin_candidatos` |
| Bruno, 8 años (inventado) | leche y gluten | armada en `scripts/eval/casos-recetas.ts` con el criterio de `cadena.ts` y 5 preparaciones puente (van en `casos.json`). Con `data/preparaciones.json` no tiene candidatos para estos nutrientes. Cobertura de ejemplo |

No se edita a mano. Si cambia el recomendador de B, el catálogo o los alimentos:

```bash
npx tsx scripts/eval/casos-recetas.ts      # reescribe eval/recetas/casos.json
```

## Correrla

```bash
npx tsx scripts/eval-recetas.ts > eval-recetas.md   # o Actions → Evals → recetas
```

Necesita `ANTHROPIC_API_KEY` (Claude Sonnet 5.5). Cuesta unos USD 0,3 a 0,6 (de 10 a 20 llamadas); el tope, con 4 llamadas en cada caso, es de unos USD 1,3.

## Qué mide

- **El LLM solo:** la primera salida del modelo en cada caso, validada por código antes de cualquier reintento (`DepsReceta.alIntentar`), con el desglose en alergias, un solo cambio, lenguaje y otros.
- **Con la validación y los reintentos:** la receta que devuelve `generarReceta()`, validada otra vez por la eval. **Inválidas tiene que dar 0.** `sin_candidatos` cuenta como respuesta correcta.
- El % de recetas válidas que cubre al menos el 20% de lo que falta hoy, las llamadas, el costo estimado y la latencia (media, p95 y % en menos de 60 s).
- La frase para el pitch: "el LLM se equivocó en X de sus N salidas; el código lo atrapó siempre".
