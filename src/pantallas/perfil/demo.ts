// Modo jurado (C10): datos y relato de ejemplo para /perfil/nuevo?demo=1. Inspirado en Lucía (§10.5): lo blando y
// cremoso, nada crocante, "nada verde". Va con otro nombre a propósito: Tomás es el chico protegido de la demo y
// Lucía es del dataset sintético; el jurado crea siempre un chico nuevo.
import type { DatosBasicos } from '../../../shared/contratos'

export const DATOS_DEMO: DatosBasicos = {
  nombre: 'Martina', edad: 10, sexo: 'femenino', pesoKg: 31, tallaCm: 138,
  alergias: [], alertas: [], dieta: 'ninguna',
}

export const RELATO_DEMO = [
  'Martina tiene 10 años y come pocas cosas, pero las que come las come siempre.',
  'Lo seguro son los fideos con manteca y queso rallado, el puré de papa, el yogur de vainilla (el Conaprole: si le das otro, se da cuenta), el arroz con leche y la banana pisada.',
  'Le gusta todo lo blando, lo cremoso.',
  'Lo crocante no: las papas fritas las saca del plato, dice que le raspan.',
  'Y no come nada verde: el brócoli ni lo mira, por el color.',
  'El yogur lo quiere bien frío y en su bol de siempre.',
].join(' ')
