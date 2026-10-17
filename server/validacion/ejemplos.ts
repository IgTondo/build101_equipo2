// Datos chicos para los tests de la receta (validación, A9 y A10) y para la eval de recetas (A12). Sin red ni archivos de B:
// un catálogo de alimentos de prueba (se carga con fijarAlimentos), las preparaciones de data/sinteticos/ más una
// fortificada, la evidencia de fixtures/receta.json con un tercer candidato y el perfil de Tomás (alergia: huevo).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  Alergeno, Alimento, Candidato, Evidencia, Grupo, Nutrientes, Perfil, PreparacionCatalogo, Receta,
} from '../../shared/contratos.js'
import { calcularAporte } from './receta.js'

const leer = <T>(...ruta: string[]): T => JSON.parse(readFileSync(join(process.cwd(), ...ruta), 'utf8')) as T

const n = (energia_kcal: number, proteina_g: number, calcio_mg: number, vitamina_d_ug: number, hierro_mg: number,
  fibra_g: number, omega3_g: number, b12_ug: number, vitamina_c_mg: number): Nutrientes =>
  ({ energia_kcal, proteina_g, calcio_mg, vitamina_d_ug, hierro_mg, fibra_g, omega3_g, b12_ug, vitamina_c_mg })

const alimento = (id: string, nombre: string, grupo: Grupo, por100g: Nutrientes, alergenos: Alergeno[] = []): Alimento =>
  ({ id, nombre, alias: [], fdcId: null, grupo, por100g, alergenos, porcionMedianaG: 100, fuente: 'equipo' })

/** Valores aproximados de USDA; alcanzan para los tests (el catálogo real lo genera A3). */
export const ALIMENTOS: Alimento[] = [
  alimento('papa', 'Papa', 'cereal_almidon', n(77, 2, 12, 0, 0.8, 2.2, 0.01, 0, 19.7)),
  alimento('aceite_girasol', 'Aceite de girasol', 'otro', n(884, 0, 0, 0, 0, 0, 0.04, 0, 0)),
  alimento('queso_muzzarella', 'Queso muzzarella', 'lacteo', n(300, 22, 505, 0.4, 0.4, 0, 0.1, 2.3, 0), ['leche']),
  alimento('pan_rallado', 'Pan rallado', 'cereal_almidon', n(395, 13, 183, 0, 4.8, 4.5, 0.1, 0, 0), ['gluten']),
  alimento('leche', 'Leche', 'lacteo', n(61, 3.2, 113, 1.3, 0.03, 0, 0.01, 0.45, 0), ['leche']),
  alimento('huevo', 'Huevo', 'proteina', n(143, 12.6, 56, 2, 1.75, 0, 0.07, 0.9, 0), ['huevo']),
  alimento('yogur', 'Yogur', 'lacteo', n(61, 3.5, 121, 0.1, 0.05, 0, 0, 0.37, 0.5), ['leche']),
  alimento('yogur_vitamina_d', 'Yogur con vitamina D', 'lacteo', n(61, 3.5, 121, 1.5, 0.05, 0, 0, 0.37, 0.5), ['leche']),
  alimento('cacao_azucarado', 'Cacao azucarado', 'otro', n(380, 4, 30, 0, 3, 5, 0, 0, 0)),
  alimento('carne_vacuna', 'Carne vacuna', 'proteina', n(250, 26, 18, 0.1, 2.6, 0, 0.05, 2.6, 0)),
  alimento('zanahoria', 'Zanahoria', 'verdura', n(41, 0.9, 33, 0, 0.3, 2.8, 0, 0, 5.9)),
  alimento('brocoli', 'Brócoli', 'verdura', n(35, 2.4, 40, 0, 0.7, 3.3, 0.1, 0, 65)),
  alimento('otro_lacteo', 'Otro lácteo', 'lacteo', n(60, 3, 100, 0, 0, 0, 0, 0, 0)),
]

const YOGUR_D: PreparacionCatalogo = {
  id: 'yogur_vainilla_d',
  nombre: 'Yogur de vainilla con vitamina D',
  atributos: { textura: 'cremoso', forma: 'pure', color: 'blanco', sabor: 'dulce', temperatura: 'frio', presentacion: 'separado', grupo: 'lacteo', coccion: 'listo' },
  ingredientes: [{ alimentoId: 'yogur_vitamina_d', gramos: 150 }],
  fortificadaDe: 'yogur_vainilla',
}

export const PREPARACIONES = new Map<string, PreparacionCatalogo>(
  [...leer<PreparacionCatalogo[]>('data', 'sinteticos', 'preparaciones.json'), YOGUR_D].map((p) => [p.id, p]),
)
export const preparacion = (id: string) => PREPARACIONES.get(id)
export const prep = (id: string): PreparacionCatalogo => {
  const p = PREPARACIONES.get(id)
  if (!p) throw new Error(`Falta la preparación ${id} en los ejemplos`)
  return p
}

const TOMAS = leer<{ datos: Perfil['datos']; borrador: { reglas: Perfil['reglas'] } }>('data', 'sinteticos', 'tomas.json')
const RECETA_FIXTURE = leer<Receta>('fixtures', 'receta.json')

/** Papas fritas → papas al horno en bastones: un solo cambio (la cocción). Es válido para Tomás. */
export const CANDIDATO_PAPAS: Candidato = {
  preparacionId: 'papas_horno_baston',
  nombre: 'Papas al horno en bastones, crocantes',
  puntaje: 0.35,
  camino: { desde: 'Papas fritas en bastones', aceptacion: '8/8', atributos: ['forma=baston', 'textura=crocante', 'sabor=salado', 'temperatura=caliente'] },
  desdeId: 'papas_fritas_baston',
  cambio: 'coccion',
  seMantiene: ['forma=baston', 'textura=crocante', 'sabor=salado', 'temperatura=caliente'],
  patrones: ['Lo crocante servido separado lo acepta'],
  aportePorcion: { calcio_mg: 14 },
}

/**
 * La evidencia de fixtures/receta.json con un tercer candidato. El orden queda: bastones de queso (válido), yogur de
 * vainilla (el fixture dice 'forma', pero de la leche chocolatada cambian la forma y el ingrediente: no pasa) y papas al
 * horno (válido).
 */
export const EVIDENCIA: Evidencia = { ...RECETA_FIXTURE.evidencia, candidatos: [...RECETA_FIXTURE.evidencia.candidatos, CANDIDATO_PAPAS] }
export const [CANDIDATO_QUESO, CANDIDATO_YOGUR] = RECETA_FIXTURE.evidencia.candidatos

const acepta = (id: string, nombre: string, veces: number) => ({ id, nombre, estado: 'acepta' as const, puntaje: 0.9, veces })

export const PERFIL_TOMAS: Perfil = {
  ninoId: 'tomas',
  datos: TOMAS.datos,
  reglas: TOMAS.borrador.reglas,
  patrones: [],
  preparaciones: [
    acepta('papas_fritas_baston', 'Papas fritas en bastones', 8),
    acepta('milanesa_carne_horno', 'Milanesa de carne al horno (rebozada sin huevo)', 6),
    acepta('tostadas', 'Tostadas de pan blanco', 14),
    acepta('galletitas_agua', 'Galletitas de agua', 2),
    acepta('leche_chocolatada', 'Leche chocolatada', 14),
    acepta('papas_horno_baston', 'Papas al horno en bastones, crocantes', 2),
  ],
}

/** Lo que devuelve el LLM (la salida de generarJSON) para los bastones de queso: el texto del fixture, con el aceite en 5 g. */
export const SALIDA_QUESO = {
  nombre: RECETA_FIXTURE.nombre,
  ingredientes: [
    { alimentoId: 'queso_muzzarella', gramos: 40 },
    { alimentoId: 'pan_rallado', gramos: 10 },
    { alimentoId: 'leche', gramos: 10 },
    { alimentoId: 'aceite_girasol', gramos: 5 },
  ],
  pasos: RECETA_FIXTURE.pasos,
  porQue: RECETA_FIXTURE.porQue,
  presentacion: RECETA_FIXTURE.presentacion,
  comoOfrecer: RECETA_FIXTURE.comoOfrecer,
  transparencia: null as string | null,
}

export const SALIDA_PAPAS = {
  nombre: 'Papas al horno en bastones, crocantes como las fritas',
  ingredientes: [{ alimentoId: 'papa', gramos: 120 }, { alimentoId: 'aceite_girasol', gramos: 5 }],
  pasos: [
    'Prendé el horno a 220 °C.',
    'Cortá la papa en bastones del mismo largo y grosor que sus papas fritas.',
    'Secalos bien, pasalos por el aceite y ponelos separados en una placa.',
    'Horneá 25 minutos, dándolos vuelta a la mitad, hasta que estén dorados y crocantes.',
  ],
  porQue: 'Parte de sus papas fritas en bastones, que comió 8 de 8 veces: mantiene la forma de bastón, lo crocante, lo salado y lo caliente, y cambia solo la cocción (al horno en vez de fritas).',
  presentacion: 'En su plato playo: sus papas fritas a la izquierda y 3 bastones al horno a la derecha, separados y sin tocarse.',
  comoOfrecer: 'Ofrecelo sin pedirle que lo coma; que esté en el plato ya es un avance. Servilo igual de 8 a 15 veces antes de cambiar algo.',
  transparencia: null as string | null,
}

/**
 * La receta del fixture, válida: el aceite en 5 g (el fixture trae 2 g, que no pasa) y el aporte de la tabla de prueba.
 * Si `cambios` trae otros ingredientes y no trae aporte, el aporte se recalcula. Necesita fijarAlimentos(ALIMENTOS) antes.
 */
export function recetaQueso(cambios: Partial<Receta> = {}): Receta {
  const ingredientes = cambios.ingredientes ?? SALIDA_QUESO.ingredientes.map((i) => ({ ...i, nombre: i.alimentoId }))
  return { ...RECETA_FIXTURE, evidencia: EVIDENCIA, ...cambios, ingredientes, aporte: cambios.aporte ?? calcularAporte(ingredientes) }
}

/** La receta tal como viene en fixtures/receta.json (aceite en 2 g y el aporte de otra tabla). */
export const recetaDelFixture = (): Receta => RECETA_FIXTURE
