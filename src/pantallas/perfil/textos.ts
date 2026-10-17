// Etiquetas propias del perfil (las del vocabulario compartido están en src/lib/vocabulario.ts).
import type { DatosBasicos, Dieta } from '../../../shared/contratos'
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
