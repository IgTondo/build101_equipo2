// v5.10 · Condimentos y hierbas del catálogo curado (data/alimentos.json, grupo otro). Un condimento no es "lo nuevo"
// de una receta ni cuenta para su aporte: se usa de a 1 a 10 g, y cada 100 g las especias secas traen mucho calcio,
// hierro y fibra (el tomillo, 1890 mg de calcio y 124 mg de hierro) que en el plato no llegan. Sirve para variar el
// sabor de lo que ya come: el mismo puré con nuez moscada, el pollo con pimentón, la ensalada con limón.
// Lo usa scripts/usda.ts (sus topes y los genéricos otro_<grupo>, que no los cuentan).

export const CONDIMENTOS: ReadonlySet<string> = new Set([
  'oregano', 'pimenton', 'comino', 'perejil', 'albahaca', 'ajo', 'cebolla_verdeo', 'nuez_moscada', 'canela', 'vainilla',
  'tomillo', 'laurel', 'jugo_limon', 'curcuma', 'romero', 'pimienta', 'vinagre', 'cacao_amargo',
])

export function esCondimento(id: string): boolean {
  return CONDIMENTOS.has(id)
}
