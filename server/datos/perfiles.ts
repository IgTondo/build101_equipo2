// POST /api/perfil (B8): crea el chico desde el borrador que confirmó el padre. GET /api/perfil: su Perfil (§5).
import { randomBytes } from 'node:crypto'
import type { DatosBasicos, Perfil, PerfilBorrador } from '../../shared/contratos.js'
import { calcularEstado } from '../aprendizaje/estado.js'
import { slug } from '../aprendizaje/textos.js'
import { almacen, sinFrenar } from '../grafo/almacen.js'
import { ErrorNibble } from '../http.js'
import { patronesVista } from '../nutricion/progreso.js'
import { preparacionesCatalogo } from './catalogos.js'
import { cargarNino, objetivoDe } from './cargar.js'
import { asegurarIndices, col } from './mongo.js'
import type { NinoDoc } from './tipos.js'

export interface NuevoPerfil {
  datos: DatosBasicos
  borrador: PerfilBorrador
  ninoId?: string // solo para scripts y demo (Tomás vive en ?nino=tomas)
}

const nuevoId = (nombre: string) => `${slug(nombre).slice(0, 24) || 'nino'}-${randomBytes(3).toString('hex')}`

export async function crearPerfil(p: NuevoPerfil, op: { reemplazar?: boolean; ahora?: Date } = {}): Promise<{ ninoId: string }> {
  await asegurarIndices()
  const ahora = (op.ahora ?? new Date()).toISOString()
  const nino: NinoDoc = {
    _id: p.ninoId ?? nuevoId(p.datos.nombre),
    datos: p.datos,
    borrador: p.borrador,
    reglas: p.borrador.reglas,
    ...(p.borrador.objetivosNutricionista ? { objetivosNutricionista: p.borrador.objetivosNutricionista } : {}),
    creadoISO: ahora,
    actualizadoISO: ahora,
  }
  if (op.reemplazar) {
    await col.comidas().deleteMany({ ninoId: nino._id })
    await col.ninos().replaceOne({ _id: nino._id }, nino, { upsert: true })
    await sinFrenar('borrar el chico del grafo', () => almacen().borrarNino(nino._id))
  } else {
    try {
      await col.ninos().insertOne(nino)
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new ErrorNibble('entrada_invalida', `Ya existe el perfil "${nino._id}".`)
      throw e
    }
  }
  // El conocimiento inicial: lo que contó el padre y los patrones de investigación (§10.2)
  const estado = calcularEstado(nino, [], preparacionesCatalogo())
  await sinFrenar('escribir el chico en el grafo', () => almacen().escribirNino(nino, objetivoDe(nino), estado))
  await col.ninos().updateOne({ _id: nino._id }, { $set: { patrones: estado.patrones.map(guardarPatron) } })
  return { ninoId: nino._id }
}

export const guardarPatron = (p: { clave: string; texto: string; resultado: 'acepta' | 'rechaza'; n: number; media: number; fuente: 'aprendido' | 'investigacion' }) => ({
  clave: p.clave, texto: p.texto, resultado: p.resultado, apoyo: p.n, media: Math.round(p.media * 1000) / 1000, fuente: p.fuente,
})

export async function obtenerPerfil(ninoId: string): Promise<Perfil> {
  const c = await cargarNino(ninoId)
  const estado = calcularEstado(c.nino, c.comidas, c.catalogo)
  const orden = { acepta: 0, en_proceso: 1, rechaza: 2 }
  return {
    ninoId,
    datos: c.nino.datos,
    reglas: c.nino.reglas,
    patrones: patronesVista(estado.patrones),
    preparaciones: [...estado.estados.values()]
      .sort((a, b) => orden[a.estado] - orden[b.estado] || b.p - a.p)
      .map((e) => ({ id: e.prepId, nombre: e.nombre, estado: e.estado, puntaje: Math.round(e.p * 100) / 100, veces: e.veces })),
  }
}
