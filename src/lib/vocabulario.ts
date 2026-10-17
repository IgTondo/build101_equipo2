// Cómo se muestra el vocabulario cerrado de los contratos (§5 y §5.1). Una sola fuente para todas las pantallas.
import type { Alergeno, Cambio, Conducta, Cuanto, Grupo, Momento, Motivo, Nutriente, Porcion } from '../../shared/contratos'

// §5.1: la escalera de exposición, de más a menos. Cada escalón cuenta como avance (salvo apartar).
export const BOTON_CUANTO: Record<Cuanto, string> = {
  todo: 'Comió todo', mitad: 'La mitad', poco: 'Un poco', probo: 'Lo probó',
  toco: 'Lo tocó u olió', nada: 'Lo dejó en el plato', aparto: 'Lo apartó',
}
export const ESCALON: Record<Cuanto, string> = {
  todo: 'comió todo', mitad: 'comió la mitad', poco: 'comió un poco', probo: 'lo probó',
  toco: 'lo tocó', nada: 'lo dejó en el plato', aparto: 'lo apartó',
}
/** Orden de la escalera para mostrar progreso: 0 = apartó … 6 = comió todo. */
export const NIVEL_CUANTO: Record<Cuanto, number> = { aparto: 0, nada: 1, toco: 2, probo: 3, poco: 4, mitad: 5, todo: 6 }

export const CHIP_CONDUCTA: Record<Conducta, string> = {
  tranquilo: 'Estuvo tranquilo', se_levanto: 'Se levantó de la mesa', angustia: 'Lloró o se angustió',
  pidio_otra_cosa: 'Pidió su comida de siempre', arcadas: 'Arcadas o vómitos', atragantamiento: 'Tos o atragantamiento',
}

export const NOMBRE_MOTIVO: Record<Motivo, string> = {
  textura: 'la textura', sabor_olor: 'el sabor o el olor', mezcla: 'estaba mezclado', marca: 'no era su marca',
  forma: 'la forma', color: 'el color', temperatura: 'la temperatura', se_tocaban: 'se tocaban', cantidad: 'la cantidad', otro: 'otro motivo',
}

export const NOMBRE_PORCION: Record<Porcion, string> = { chica: 'Chica', mediana: 'Mediana', grande: 'Grande' }

export const NOMBRE_MOMENTO: Record<Momento, string> = {
  desayuno: 'Desayuno', almuerzo: 'Almuerzo', merienda: 'Merienda', cena: 'Cena', colacion: 'Colación',
}

export const NOMBRE_NUTRIENTE: Record<Nutriente, string> = {
  energia_kcal: 'Energía', proteina_g: 'Proteína', calcio_mg: 'Calcio', vitamina_d_ug: 'Vitamina D', hierro_mg: 'Hierro',
  fibra_g: 'Fibra', omega3_g: 'Omega-3', b12_ug: 'Vitamina B12', vitamina_c_mg: 'Vitamina C',
}
export const UNIDAD: Record<Nutriente, string> = {
  energia_kcal: 'kcal', proteina_g: 'g', calcio_mg: 'mg', vitamina_d_ug: 'µg', hierro_mg: 'mg',
  fibra_g: 'g', omega3_g: 'g', b12_ug: 'µg', vitamina_c_mg: 'mg',
}
export const DECIMALES: Record<Nutriente, number> = {
  energia_kcal: 0, proteina_g: 1, calcio_mg: 0, vitamina_d_ug: 1, hierro_mg: 1,
  fibra_g: 1, omega3_g: 2, b12_ug: 1, vitamina_c_mg: 0,
}
/** Los 8 con meta, en el orden fijo en que se muestran las barras (la energía va aparte, sin meta). */
export const NUTRIENTES_CON_META: Nutriente[] = [
  'calcio_mg', 'vitamina_d_ug', 'hierro_mg', 'fibra_g', 'vitamina_c_mg', 'omega3_g', 'b12_ug', 'proteina_g',
]

export const NOMBRE_GRUPO: Record<Grupo, string> = {
  cereal_almidon: 'Cereales y almidones', proteina: 'Proteínas', verdura: 'Verduras', fruta: 'Frutas', lacteo: 'Lácteos', otro: 'Otros',
}

export const NOMBRE_CAMBIO: Record<Cambio, string> = {
  fortificar: 'la versión fortificada', coccion: 'la cocción', forma: 'la forma', sabor: 'el sabor',
  ingrediente: 'el ingrediente', temperatura: 'la temperatura', textura: 'la textura',
}

export const NOMBRE_ALERGENO: Record<Alergeno, string> = {
  leche: 'Leche', huevo: 'Huevo', gluten: 'Gluten', mani: 'Maní', frutos_secos: 'Frutos secos',
  soja: 'Soja', pescado: 'Pescado', mariscos: 'Mariscos', sesamo: 'Sésamo',
}

const ATRIBUTO: Record<string, string> = {
  forma: 'forma', textura: 'textura', sabor: 'sabor', temperatura: 'temperatura', coccion: 'cocción',
  presentacion: 'presentación', color: 'color', grupo: 'grupo',
}
/** "forma=baston" → "forma: baston" (para seMantiene y camino.atributos). */
export function atributoLegible(par: string): string {
  const [k, v] = par.split('=')
  return v === undefined ? par : `${ATRIBUTO[k] ?? k}: ${v.replace(/_/g, ' ')}`
}

export function formatoNutriente(n: Nutriente, valor: number): string {
  return `${valor.toLocaleString('es-UY', { maximumFractionDigits: DECIMALES[n] })} ${UNIDAD[n]}`
}
export const porcentaje = (x: number) => `${Math.round(x * 100)}%`
