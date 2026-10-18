// "Lo que sabemos de <nombre>" (C6/C13): lo que aprendió Nibble, dicho simple y sin el grafo. Funciones puras.
// Hacia el padre nunca se dice "rechaza" (§9) ni se muestran confianzas, "(n de m)" o "investigación".
import type { PatronVista, Perfil } from '../../../shared/contratos'
import { agruparPreparaciones } from './borrador'

type Preparacion = Perfil['preparaciones'][number]

export const MAX_LE_GUSTA = 6
export const MAX_PROBANDO = 4
export const MAX_NOTAMOS = 3

/**
 * "Lo crocante lo acepta (28 de 35)" → "Le gusta lo crocante"; "Las verduras todavía no las acepta" (o el viejo
 * "Las verduras las rechaza") → "Todavía no le gustan las verduras".
 */
export function fraseParaPadres(texto: string): string {
  const limpio = texto.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const m = /^(.+?)\s+(todavía no\s+)?(lo|la|los|las)\s+(acepta|rechaza)\b(.*)$/i.exec(limpio)
  if (!m) {
    return limpio
      .replace(/\bsuelen rechazarse\b/gi, 'suelen costar')
      .replace(/\b(lo|la|los|las) rechaza\b/gi, 'todavía no le gusta')
  }
  const [, sujeto, todaviaNo, pronombre, verbo, resto] = m
  const gusta = /^l[ao]s$/i.test(pronombre) ? 'gustan' : 'gusta'
  const objeto = sujeto.charAt(0).toLowerCase() + sujeto.slice(1)
  const leGusta = verbo.toLowerCase() === 'acepta' && !todaviaNo
  const frase = leGusta ? `Le ${gusta} ${objeto}` : `Todavía no le ${gusta} ${objeto}`
  return `${frase}${resto.replace(/\s+$/, '')}`
}

/** El sujeto del patrón, para no repetir: "lo crocante entre los cereales…" ya lo dice "lo crocante". */
const sujetoDe = (texto: string) =>
  texto
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+(todavía no\s+)?(lo|la|los|las)\s+(acepta|rechaza)\b.*$/i, '')
    .trim()
    .toLowerCase()

/**
 * Hasta 3 cosas que notamos en sus comidas (no las de la investigación, que no son de él): primero lo que le gusta
 * (hasta 2) y después lo que todavía no; si falta de un lado, se completa con el otro. Por evidencia (apoyo × confianza).
 */
export function loQueNotamos(patrones: readonly PatronVista[], max = MAX_NOTAMOS): string[] {
  const peso = (p: PatronVista) => p.apoyo * p.confianza
  const vistos: string[] = []
  const sinRepetir = (lista: PatronVista[]) =>
    lista.filter((p) => {
      const s = sujetoDe(p.texto)
      if (vistos.some((v) => s === v || s.startsWith(`${v} `))) return false
      vistos.push(s)
      return true
    })
  const deSusComidas = patrones.filter((p) => p.fuente === 'aprendido').sort((a, b) => peso(b) - peso(a))
  const buenos = sinRepetir(deSusComidas.filter((p) => p.resultado === 'acepta'))
  const cuestan = sinRepetir(deSusComidas.filter((p) => p.resultado === 'rechaza'))
  const nBuenos = Math.min(buenos.length, Math.max(max - Math.min(cuestan.length, 1), 0))
  const elegidos = [...buenos.slice(0, nBuenos), ...cuestan.slice(0, max - nBuenos)]
  return elegidos.map((p) => fraseParaPadres(p.texto))
}

export interface LoQueSabemos {
  leGusta: Preparacion[]
  leGustaMas: number
  probando: Preparacion[]
  notamos: string[]
}

export function loQueSabemos(perfil: Pick<Perfil, 'preparaciones' | 'patrones'>): LoQueSabemos {
  const { acepta, enProceso } = agruparPreparaciones(perfil.preparaciones)
  return {
    leGusta: acepta.slice(0, MAX_LE_GUSTA),
    leGustaMas: Math.max(acepta.length - MAX_LE_GUSTA, 0),
    probando: enProceso.slice(0, MAX_PROBANDO),
    notamos: loQueNotamos(perfil.patrones),
  }
}
