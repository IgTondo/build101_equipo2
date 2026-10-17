// La curva de aprendizaje (PLAN.md §11.4, P2, simulación declarada): un chico virtual con reglas ocultas recibe en
// cada comida su alimento seguro + una preparación nueva elegida por una política. ¿Cuántas acepta, comida a comida?
// Políticas: `grafo` (propagación + patrones), `base` (α/β por atributo) y `azar` (el piso). Mismas funciones puras
// de producción y mismo catálogo. Los chicos virtuales arrancan sin comidas.
//   --modo=cadena      la del producto: solo candidatos a UN cambio de lo que ya acepta (food chaining)
//   --modo=prediccion  ¿qué tan bien aprende lo que el chico acepta? Cada política elige entre todo lo que todavía no
//                      acepta (seguro para sus alergias y sus reglas), sin la restricción de un solo cambio
// Uso: npx tsx scripts/simular-nino.ts [--modo=cadena|prediccion] [--corridas=50] [--comidas=20] [--salida=curva.json]
//      (con ALIMENTOS_ARCHIVO=server/datos/prueba/alimentos-prueba.json mientras no esté data/alimentos.json)
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Cuanto, DatosBasicos, Motor, Nutriente, PerfilBorrador, PreparacionCatalogo, RegistrarComidaReq } from '../shared/contratos.js'
import { candidatosCadena, esSegura, reglaQueViola } from '../server/aprendizaje/cadena.js'
import { type Condicion, cumple } from '../server/aprendizaje/condiciones.js'
import { comio } from '../server/aprendizaje/escalera.js'
import { calcularEstado } from '../server/aprendizaje/estado.js'
import { puntuador } from '../server/aprendizaje/recomendador.js'
import { alimentosCatalogo, preparacionesCatalogo } from '../server/datos/catalogos.js'
import { sumarDias } from '../server/datos/fechas.js'
import { resolverComida } from '../server/datos/resolver.js'
import type { ComidaDoc, NinoDoc } from '../server/datos/tipos.js'
import { faltanSemana } from '../server/nutricion/calcular.js'
import { CON_META, objetivosPara } from '../server/nutricion/objetivos.js'
import { semana } from '../server/nutricion/progreso.js'

interface Virtual {
  nombre: string
  datos: DatosBasicos
  borrador: PerfilBorrador
  reglasOcultas: { condiciones: Condicion[]; resultado: 'acepta' | 'rechaza' }[]
}
type Politica = Motor | 'azar'
type Modo = 'cadena' | 'prediccion'

const arg = (nombre: string) => process.argv.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3)
const CORRIDAS = Number(arg('corridas') ?? 50)
const COMIDAS = Number(arg('comidas') ?? 20)
const MODOS: Modo[] = arg('modo') === 'cadena' ? ['cadena'] : arg('modo') === 'prediccion' ? ['prediccion'] : ['cadena', 'prediccion']
const POLITICAS: Politica[] = ['grafo', 'base', 'azar']

/** Generador reproducible (mulberry32): cada corrida tiene su semilla, la misma para las tres políticas. */
function azar(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Cómo reacciona el chico virtual: las reglas ocultas mandan (rechazo primero); lo que no cubren, a la suerte. */
function reaccion(v: Virtual, prep: PreparacionCatalogo, r: () => number): Cuanto {
  const aplica = v.reglasOcultas.filter((x) => cumple(x.condiciones, prep.atributos))
  const p = aplica.some((x) => x.resultado === 'rechaza') ? 0.05 : aplica.some((x) => x.resultado === 'acepta') ? 0.9 : 0.35
  if (r() < p) return r() < 0.6 ? 'todo' : 'mitad'
  const no: Cuanto[] = ['aparto', 'nada', 'toco', 'probo']
  return no[Math.floor(r() * no.length)] ?? 'nada'
}

function pedido(dia: string, preps: PreparacionCatalogo[], cuantos: Cuanto[]): RegistrarComidaReq {
  return {
    ninoId: 'virtual', dia, fechaISO: `${dia}T12:30:00-03:00`, momento: 'almuerzo',
    analisis: {
      analisisId: `sim-${dia}`, sinComida: false, preguntas: [], modelo: 'simulacion', ms: 0,
      distribucion: { estado: 'separados', cantidadItems: preps.length, plato: 'playo' },
      items: preps.map((p, i) => ({
        idTmp: `i${i}`, preparacion: p.nombre, preparacionId: p.id, porcion: 'mediana', caja: null, confianza: 1, atributos: p.atributos,
        ingredientes: p.ingredientes.map((g) => ({ alimentoId: g.alimentoId, gramosEst: g.gramos })),
      })),
    },
    respuestas: preps.map((_, i) => ({ itemIdTmp: `i${i}`, cuanto: cuantos[i] ?? 'nada', porcion: 'mediana' })),
    respuestasPreguntas: [], conducta: ['tranquilo'],
  }
}

function correr(v: Virtual, politica: Politica, modo: Modo, semilla: number): number[] {
  const r = azar(semilla)
  const elegirAlAzar = azar(semilla + 7919)
  const catalogo = preparacionesCatalogo()
  const alimentos = alimentosCatalogo()
  const nino: NinoDoc = { _id: 'virtual', datos: v.datos, borrador: v.borrador, reglas: v.borrador.reglas, creadoISO: '2026-11-01T08:00:00-03:00', actualizadoISO: '' }
  const objetivo = objetivosPara(v.datos.edad, v.datos.sexo)
  const comidas: ComidaDoc[] = []
  const aceptadas: number[] = []
  for (let t = 0; t < COMIDAS; t++) {
    const dia = sumarDias('2026-11-01', t)
    const estado = calcularEstado(nino, comidas, catalogo)
    const sem = semana(comidas, dia, objetivo)
    const entrada = {
      catalogo: [...catalogo.values()], conocidas: estado.conocidas, estados: estado.estados, alergias: v.datos.alergias, reglas: nino.reglas,
      alimentos, objetivo, observaciones: estado.observaciones, patrones: estado.patrones,
    }
    let opciones: PreparacionCatalogo[] = []
    if (modo === 'cadena') {
      // Como el producto: los candidatos a un cambio para el nutriente que más falta (o el siguiente que tenga)
      const faltan = sem.diasRegistrados ? faltanSemana(sem.cobertura) : []
      const orden: Nutriente[] = [...faltan, ...CON_META.filter((n) => !faltan.includes(n))]
      for (const n of orden) {
        opciones = candidatosCadena(entrada, n).map((p) => p.cand)
        if (opciones.length) break
      }
    } else {
      opciones = [...catalogo.values()].filter((p) => {
        const s = estado.estados.get(p.id)
        return (!s || s.estado === 'en_proceso') && esSegura(p, v.datos.alergias, alimentos) && !reglaQueViola(p, nino.reglas)
      })
    }
    let nueva: PreparacionCatalogo | undefined
    if (politica === 'azar') nueva = opciones[Math.floor(elegirAlAzar() * opciones.length)]
    else {
      const puntuar = puntuador(entrada, politica)
      nueva = opciones.map((p) => ({ p, s: puntuar(p, null).puntaje })).sort((a, b) => b.s - a.s || a.p.id.localeCompare(b.p.id))[0]?.p
    }
    const seguraId = [...estado.estados.values()].filter((s) => s.estado === 'acepta' && catalogo.has(s.prepId)).sort((a, b) => b.p - a.p)[0]?.prepId
    const segura = seguraId ? catalogo.get(seguraId) : undefined
    if (!nueva || !segura) break
    const cuanto = reaccion(v, nueva, r)
    aceptadas.push(comio(cuanto) ? 1 : 0)
    comidas.push(resolverComida(pedido(dia, [segura, nueva], ['todo', cuanto]), { id: `sim-${t}`, creadoISO: `${dia}T13:00:00-03:00`, alimentos, catalogo }))
  }
  return aceptadas
}

const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(5)

function main() {
  if (!alimentosCatalogo().size) {
    console.warn('Falta data/alimentos.json: corré con ALIMENTOS_ARCHIVO=server/datos/prueba/alimentos-prueba.json')
    process.exitCode = 1
    return
  }
  const leer = (id: string) => JSON.parse(readFileSync(join(process.cwd(), 'data', 'sinteticos', `${id}.json`), 'utf8')) as Omit<Virtual, 'nombre'>
  const tomas = leer('tomas')
  const lucia = leer('lucia')
  const virtuales: Virtual[] = [
    { ...tomas, nombre: 'Tomás' },
    { ...lucia, nombre: 'Lucía' },
    // La regla combinada ("lo verde, solo en puré") sin la regla del padre que tapa todo lo verde
    { ...lucia, nombre: 'Lucía sin su regla', borrador: { ...lucia.borrador, reglas: [] } },
  ]
  const resultado: Record<string, Record<string, Record<string, number[]>>> = {}
  for (const modo of MODOS) {
    console.log(`\nModo ${modo}: % de preparaciones nuevas aceptadas, comida por comida (${CORRIDAS} corridas × ${COMIDAS} comidas)`)
    resultado[modo] = {}
    for (const v of virtuales) {
      const porPolitica: Record<string, number[]> = {}
      for (const politica of POLITICAS) {
        const suma = new Array<number>(COMIDAS).fill(0)
        const n = new Array<number>(COMIDAS).fill(0)
        for (let k = 0; k < CORRIDAS; k++) {
          correr(v, politica, modo, 1000 + k).forEach((a, t) => {
            suma[t] = (suma[t] ?? 0) + a
            n[t] = (n[t] ?? 0) + 1
          })
        }
        const curva = suma.map((s, t) => ((n[t] ?? 0) ? s / (n[t] ?? 1) : 0))
        porPolitica[politica] = curva
        const prom = (xs: number[]) => xs.reduce((x, y) => x + y, 0) / Math.max(1, xs.length)
        console.log(
          `  ${v.nombre.padEnd(19)} ${politica.padEnd(5)}${curva.map(pct).join('')}   total ${pct(prom(curva))} · últimas 10 ${pct(prom(curva.slice(-10)))}`,
        )
      }
      const modoRes = resultado[modo]
      if (modoRes) modoRes[v.nombre] = porPolitica
    }
  }
  console.log('\nSimulación declarada (§11.4): chicos virtuales con las reglas ocultas de §10.5 y respuestas al azar donde las reglas no dicen nada.')
  const salida = arg('salida')
  if (salida) writeFileSync(salida, `${JSON.stringify({ corridas: CORRIDAS, comidas: COMIDAS, curvas: resultado }, null, 2)}\n`)
}

main()
