// v5.7 · La receta creativa es una comida completa (Receta.platoCompleto): lo nuevo + lo que ya come. Cómo se lee en la
// tarjeta: el nombre de cada parte del plato y qué nutrientes del día se muestran. Funciones puras (plato.test.ts).
import type { Nutriente, Nutrientes, RolPlato } from '../../../shared/contratos'
import { NUTRIENTES_CON_META } from '../../lib/vocabulario'

export const NOMBRE_ROL: Record<RolPlato, string> = {
  principal: 'Principal', guarnicion: 'Guarnición', verdura_fruta: 'Verdura o fruta',
  lacteo: 'Lácteo', cereal_pan: 'Pan o cereal', bebida: 'Bebida',
}

const valido = (x: number | undefined) => (x !== undefined && Number.isFinite(x) ? Math.max(x, 0) : 0)

/**
 * Los nutrientes que se muestran del plato (hasta `cuantos`), en este orden: el de la receta (el que le falta, o en
 * modo variedad el que más aporta), la proteína, y después los que el plato más cubre del día. Los que no aporta, no.
 * La energía va aparte (en kcal), nunca en la lista.
 */
export function nutrientesDelPlato(cubreDelDia: Partial<Nutrientes>, objetivo: Nutriente, cuantos = 4): Nutriente[] {
  const fijos = [objetivo, 'proteina_g'].filter((n): n is Nutriente => n !== 'energia_kcal')
  const elegidos = fijos.filter((n, i) => fijos.indexOf(n) === i && (n === objetivo || valido(cubreDelDia[n]) > 0))
  const resto = NUTRIENTES_CON_META
    .filter((n) => !elegidos.includes(n) && valido(cubreDelDia[n]) > 0)
    .sort((a, b) => valido(cubreDelDia[b]) - valido(cubreDelDia[a]))
  return [...elegidos, ...resto].slice(0, cuantos)
}

/** "35% del día" · "120% del día" (el real: la barra es la que se corta en 100%) · "1% del día" si aporta algo. */
export function porcentajeDelDia(fraccion: number | undefined): string {
  const x = valido(fraccion)
  const p = Math.round(x * 100)
  // Hacia el padre nunca más de 100% (lib/cobertura): "215% del día" confunde; lo que pasa, cubre el día
  if (p >= 100) return 'todo lo del día'
  return `${x > 0 ? Math.max(p, 1) : 0}% del día`
}
