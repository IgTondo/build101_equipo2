// Etiquetas propias del perfil (las del vocabulario compartido están en src/lib/vocabulario.ts).
import type { Alergeno, DatosBasicos, Dieta } from '../../../shared/contratos'
import type { Senal } from './borrador'

export const NOMBRE_DIETA: Record<Dieta, string> = {
  ninguna: 'Ninguna en especial', sin_gluten_caseina: 'Sin gluten ni caseína', otra: 'Otra',
}

export const NOMBRE_SEXO: Record<DatosBasicos['sexo'], string> = { femenino: 'Femenino', masculino: 'Masculino' }

export const NOMBRE_SENAL: Record<Senal, string> = {
  bajo_peso: 'Está bajo de peso',
  arcadas_vomitos: 'Tiene arcadas o vómitos al comer',
  menos_15_alimentos: 'Come menos de 15 alimentos distintos',
}

/** §10.4 · `declarada` y `dieta_eliminacion`: se avisa con calma, sin alarmar. */
export const AVISO_DECLARADA = 'Gracias por contarlo. Recomendamos consultar a un profesional: su pediatra o nutricionista puede acompañarlos.'
export const AVISO_DIETA = 'En esta dieta, el calcio y la vitamina D se vuelven prioridad. Conviene que la supervise un profesional.'

export const anios = (edad: number) => (edad === 1 ? '1 año' : `${edad} años`)

/** "¿Es alérgico al huevo?" · "¿Es alérgica a los frutos secos?" */
export const ALERGENO_CON_ARTICULO: Record<Alergeno, string> = {
  leche: 'a la leche', huevo: 'al huevo', gluten: 'al gluten', mani: 'al maní', frutos_secos: 'a los frutos secos',
  soja: 'a la soja', pescado: 'al pescado', mariscos: 'a los mariscos', sesamo: 'al sésamo',
}
export const alergico = (sexo: DatosBasicos['sexo'] | '') => (sexo === 'femenino' ? 'alérgica' : 'alérgico')

/** La guía del alta por voz (§5.2): lo vital, en cualquier orden. */
export const GUIA_ALTA = [
  'Nombre, edad y sexo',
  'Peso y talla, si los sabés',
  'Alergias',
  'Dieta especial y suplementos',
  'Si tiene arcadas, vómitos o se atraganta',
  'Lo que come seguro: la marca y cómo se lo servís (crocante o blando, frito o al horno, en bastones, frío…)',
  'Lo que no come y por qué: la textura, el olor, que esté mezclado…',
  'Sus reglas: “que no se toquen”, “nada verde”, “en su plato de siempre”',
  'Lo que indicó su nutricionista (opcional)',
]

/** §10.4 · `atragantamiento`: alerta desde la primera vez. */
export const AVISO_ATRAGANTAMIENTO = 'Si tose o se atraganta al comer, conviene consultar con su pediatra o con fonoaudiología.'
