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
export const AVISO_DECLARADA = 'Gracias por contarlo. Consultá a su pediatra o nutricionista.'
export const AVISO_DIETA = 'En esta dieta, calcio y vitamina D son prioridad. Que la supervise un profesional.'

export const anios = (edad: number) => (edad === 1 ? '1 año' : `${edad} años`)

/** "¿Es alérgico al huevo?" · "¿Es alérgica a los frutos secos?" */
export const ALERGENO_CON_ARTICULO: Record<Alergeno, string> = {
  leche: 'a la leche', huevo: 'al huevo', gluten: 'al gluten', mani: 'al maní', frutos_secos: 'a los frutos secos',
  soja: 'a la soja', pescado: 'al pescado', mariscos: 'a los mariscos', sesamo: 'al sésamo',
}
export const alergico = (sexo: DatosBasicos['sexo'] | '') => (sexo === 'femenino' ? 'alérgica' : 'alérgico')

/**
 * La guía del alta por voz (§5.2): lo vital, en cualquier orden. Sobre el chico, recordatorios cortos; sobre la comida
 * (lo que más le sirve a Nibble), cada tema con un ejemplo de qué contar.
 */
export const GUIA_ALTA = {
  chico: [
    'Nombre, edad y sexo',
    'Peso y talla, si los sabés',
    'Alergias',
    'Dieta especial y suplementos',
    'Si tiene arcadas, vómitos o se atraganta',
    'Lo que indicó su nutricionista (opcional)',
  ],
  comida: {
    acepta: { tema: 'Lo que come seguro', ejemplo: 'La marca y cómo se lo servís: crocante o blando, frito o al horno, en bastones, frío…' },
    rechaza: { tema: 'Lo que no come y por qué', ejemplo: 'La textura, el olor, que esté mezclado…' },
    reglas: { tema: 'Sus reglas', ejemplo: '“Que no se toquen”, “nada verde”, “en su plato de siempre”' },
  },
}

/** §10.4 · `atragantamiento`: alerta desde la primera vez. */
export const AVISO_ATRAGANTAMIENTO = 'Si tose o se atraganta al comer, conviene consultar con su pediatra o con fonoaudiología.'

const conMayuscula = (s: string) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1)
const listaY = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? '' : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`)

/**
 * v5.8 · Qué pasa con sus otras alergias, con calma: las que cruzan con alimentos se revisan en cada receta; las que
 * no ("colorante rojo") no se pueden revisar ingrediente por ingrediente. Vacío si no hay otras.
 * "Kiwi lo revisamos en cada receta. «Colorante rojo» no lo podemos revisar ingrediente por ingrediente: tenelo en cuenta."
 */
export function textoOtrasAlergias(otras: readonly string[], sinCruce: readonly string[]): string {
  const sin = new Set(sinCruce)
  const cruzan = otras.filter((o) => !sin.has(o))
  const noCruzan = otras.filter((o) => sin.has(o))
  const partes: string[] = []
  if (cruzan.length) partes.push(`${conMayuscula(listaY(cruzan))} ${cruzan.length === 1 ? 'lo' : 'los'} revisamos en cada receta.`)
  if (noCruzan.length) {
    partes.push(`${listaY(noCruzan.map((o) => `«${conMayuscula(o)}»`))} no ${noCruzan.length === 1 ? 'lo' : 'los'} podemos revisar ingrediente por ingrediente: tenelo en cuenta.`)
  }
  return partes.join(' ')
}
