// Validación de lo que llega a los endpoints de B, contra el vocabulario cerrado de shared/contratos.ts (§5).
// Errores claros (400) en lugar de datos raros en el bronze.
import type {
  AnalisisComida, Atributos, DatosBasicos, ItemDetectado, Nutrientes, PerfilBorrador, RegistrarComidaReq, Regla,
} from '../../shared/contratos.js'
import {
  ALERGENO, COCCION, COLOR, CONDUCTA, CUANTO, DIETA, DISTRIBUCION, FORMA, GRUPO, MOMENTO, MOTIVO, NUTRIENTE, PLATO,
  PORCION, PRESENTACION, SABOR, TEMPERATURA, TEXTURA,
} from '../../shared/contratos.js'
import { ErrorNibble } from '../http.js'
import { esDia } from './fechas.js'

type Objeto = Record<string, unknown>
const esObjeto = (x: unknown): x is Objeto => typeof x === 'object' && x !== null && !Array.isArray(x)
const mal = (mensaje: string): never => {
  throw new ErrorNibble('entrada_invalida', mensaje)
}

function de<T extends string>(valores: readonly T[], x: unknown, donde: string): T {
  if (typeof x === 'string' && (valores as readonly string[]).includes(x)) return x as T
  return mal(`${donde}: "${String(x)}" no es válido (${valores.join(', ')})`)
}

function texto(x: unknown, donde: string, max = 2000): string {
  if (typeof x !== 'string' || !x.trim()) return mal(`Falta ${donde}`)
  if (x.length > max) return mal(`${donde} es demasiado largo`)
  return x
}

function numero(x: unknown, donde: string, min: number, max: number): number {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max) return mal(`${donde} tiene que ser un número entre ${min} y ${max}`)
  return x
}

function lista(x: unknown, donde: string): unknown[] {
  if (!Array.isArray(x)) return mal(`${donde} tiene que ser una lista`)
  return x
}

const opcional = <T>(x: unknown, f: (v: unknown) => T): T | undefined => (x === undefined || x === null || x === '' ? undefined : f(x))

export const ATRIBUTOS_VOCABULARIO = {
  textura: TEXTURA, forma: FORMA, color: COLOR, sabor: SABOR, temperatura: TEMPERATURA,
  presentacion: PRESENTACION, grupo: GRUPO, coccion: COCCION,
} as const

function atributos(x: unknown, donde: string): Atributos {
  if (!esObjeto(x)) return mal(`Faltan los atributos de ${donde}`)
  const coccion = opcional(x.coccion, (v) => de(COCCION, v, `${donde}.coccion`))
  return {
    textura: de(TEXTURA, x.textura, `${donde}.textura`),
    forma: de(FORMA, x.forma, `${donde}.forma`),
    color: de(COLOR, x.color, `${donde}.color`),
    sabor: de(SABOR, x.sabor, `${donde}.sabor`),
    temperatura: de(TEMPERATURA, x.temperatura, `${donde}.temperatura`),
    presentacion: de(PRESENTACION, x.presentacion, `${donde}.presentacion`),
    grupo: de(GRUPO, x.grupo, `${donde}.grupo`),
    ...(coccion ? { coccion } : {}),
  }
}

function atributosParciales(x: unknown, donde: string): Partial<Atributos> {
  if (x === undefined || x === null) return {}
  if (!esObjeto(x)) return mal(`${donde}: los atributos tienen que ser un objeto`)
  const r: Partial<Record<keyof Atributos, string>> = {}
  for (const [k, v] of Object.entries(x)) {
    if (!(k in ATRIBUTOS_VOCABULARIO)) return mal(`${donde}: "${k}" no es un atributo`)
    if (v === undefined || v === null) continue
    r[k as keyof Atributos] = de(ATRIBUTOS_VOCABULARIO[k as keyof typeof ATRIBUTOS_VOCABULARIO], v, `${donde}.${k}`)
  }
  return r as Partial<Atributos>
}

function item(x: unknown, i: number): ItemDetectado {
  const donde = `analisis.items[${i}]`
  if (!esObjeto(x)) return mal(`${donde} no es un objeto`)
  const conteo = opcional(x.conteo, (c) =>
    esObjeto(c) ? { cantidad: numero(c.cantidad, `${donde}.conteo.cantidad`, 0, 500), unidad: texto(c.unidad, `${donde}.conteo.unidad`, 60) } : mal(`${donde}.conteo no es válido`),
  )
  // Lo manda A cuando un ingrediente cayó en otro_<grupo>: hace falta para buscarlo en alimentos_fdc (§7)
  const nombreIngles = typeof x.nombreIngles === 'string' && x.nombreIngles.trim() ? x.nombreIngles.trim().slice(0, 200) : undefined
  return {
    idTmp: texto(x.idTmp, `${donde}.idTmp`, 60),
    preparacion: texto(x.preparacion, `${donde}.preparacion`, 200),
    preparacionId: x.preparacionId === null || x.preparacionId === undefined ? null : texto(x.preparacionId, `${donde}.preparacionId`, 120),
    ingredientes: lista(x.ingredientes, `${donde}.ingredientes`).map((g, j) => {
      if (!esObjeto(g)) return mal(`${donde}.ingredientes[${j}] no es un objeto`)
      return { alimentoId: texto(g.alimentoId, `${donde}.ingredientes[${j}].alimentoId`, 120), gramosEst: numero(g.gramosEst, `${donde}.ingredientes[${j}].gramosEst`, 0, 2000) }
    }),
    ...(conteo ? { conteo } : {}),
    ...(nombreIngles ? { nombreIngles } : {}),
    porcion: de(PORCION, x.porcion, `${donde}.porcion`),
    atributos: atributos(x.atributos, donde),
    caja: Array.isArray(x.caja) && x.caja.length === 4 ? (x.caja as ItemDetectado['caja']) : null,
    confianza: typeof x.confianza === 'number' ? Math.min(Math.max(x.confianza, 0), 1) : 1,
  }
}

function analisis(x: unknown): AnalisisComida {
  if (!esObjeto(x)) return mal('Falta el análisis de la comida')
  const items = lista(x.items, 'analisis.items').map(item)
  const ids = new Set(items.map((it) => it.idTmp))
  if (ids.size !== items.length) mal('analisis.items: hay idTmp repetidos')
  const d = esObjeto(x.distribucion) ? x.distribucion : mal('Falta analisis.distribucion')
  return {
    analisisId: typeof x.analisisId === 'string' && x.analisisId ? x.analisisId : 'sin-id',
    sinComida: x.sinComida === true,
    items,
    distribucion: {
      estado: de(DISTRIBUCION, d.estado, 'analisis.distribucion.estado'),
      cantidadItems: typeof d.cantidadItems === 'number' ? d.cantidadItems : items.length,
      plato: de(PLATO, d.plato, 'analisis.distribucion.plato'),
    },
    preguntas: Array.isArray(x.preguntas) ? (x.preguntas as AnalisisComida['preguntas']) : [],
    modelo: typeof x.modelo === 'string' ? x.modelo : '',
    ms: typeof x.ms === 'number' ? x.ms : 0,
  }
}

export function validarRegistrarComida(x: unknown): RegistrarComidaReq {
  if (!esObjeto(x)) return mal('Falta la comida')
  if (!esDia(x.dia)) return mal('dia tiene que ser YYYY-MM-DD, en hora de Uruguay')
  const fechaISO = texto(x.fechaISO, 'fechaISO', 40)
  if (Number.isNaN(Date.parse(fechaISO))) mal('fechaISO no es una fecha válida')
  const a = analisis(x.analisis)
  const ids = new Set(a.items.map((it) => it.idTmp))
  const respuestas = lista(x.respuestas, 'respuestas').map((r, i) => {
    if (!esObjeto(r)) return mal(`respuestas[${i}] no es un objeto`)
    const itemIdTmp = texto(r.itemIdTmp, `respuestas[${i}].itemIdTmp`, 60)
    if (!ids.has(itemIdTmp)) mal(`respuestas[${i}]: el ítem ${itemIdTmp} no está en el análisis`)
    const motivo = opcional(r.motivo, (v) => de(MOTIVO, v, `respuestas[${i}].motivo`))
    const cita = typeof r.cita === 'string' && r.cita.trim() ? r.cita.slice(0, 500) : undefined
    return {
      itemIdTmp, cuanto: de(CUANTO, r.cuanto, `respuestas[${i}].cuanto`), porcion: de(PORCION, r.porcion, `respuestas[${i}].porcion`),
      ...(motivo ? { motivo } : {}), ...(cita ? { cita } : {}),
    }
  })
  const relato = opcional(x.relato, (r) =>
    esObjeto(r) ? { transcripcion: typeof r.transcripcion === 'string' ? r.transcripcion.slice(0, 8000) : '', fuente: de(['voz', 'texto'] as const, r.fuente, 'relato.fuente') } : mal('relato no es válido'),
  )
  const thumb = opcional(x.thumbBase64, (t) => (typeof t === 'string' && t.length <= 400_000 ? t : mal('thumbBase64 no es válido o es demasiado grande')))
  const comentario = opcional(x.comentario, (c) => texto(c, 'comentario', 1000))
  return {
    ninoId: texto(x.ninoId, 'ninoId', 80),
    dia: x.dia,
    fechaISO,
    momento: de(MOMENTO, x.momento, 'momento'),
    ...(thumb ? { thumbBase64: thumb } : {}),
    ...(comentario ? { comentario } : {}),
    analisis: a,
    respuestas,
    respuestasPreguntas: (Array.isArray(x.respuestasPreguntas) ? x.respuestasPreguntas : []).flatMap((r) =>
      esObjeto(r) && typeof r.preguntaId === 'string' && typeof r.respuesta === 'string' ? [{ preguntaId: r.preguntaId, respuesta: r.respuesta.slice(0, 500) }] : [],
    ),
    conducta: lista(x.conducta ?? [], 'conducta').map((c) => de(CONDUCTA, c, 'conducta')),
    ...(relato ? { relato } : {}),
  }
}

const ALERTAS_DECLARADAS = ['bajo_peso', 'arcadas_vomitos', 'menos_15_alimentos'] as const
const TIPOS_REGLA = ['textura', 'forma', 'color', 'sabor', 'temperatura', 'presentacion', 'grupo', 'coccion', 'distribucion', 'plato'] as const

function regla(x: unknown, i: number): Regla {
  if (!esObjeto(x)) return mal(`borrador.reglas[${i}] no es un objeto`)
  return {
    texto: texto(x.texto, `borrador.reglas[${i}].texto`, 300),
    efecto: de(['rechaza', 'requiere'] as const, x.efecto, `borrador.reglas[${i}].efecto`),
    condiciones: lista(x.condiciones, `borrador.reglas[${i}].condiciones`).map((c, j) => {
      const donde = `borrador.reglas[${i}].condiciones[${j}]`
      if (!esObjeto(c)) return mal(`${donde} no es un objeto`)
      const tipo = de(TIPOS_REGLA, c.tipo, `${donde}.tipo`)
      const valores: readonly string[] = tipo === 'distribucion' ? DISTRIBUCION : tipo === 'plato' ? PLATO : ATRIBUTOS_VOCABULARIO[tipo]
      return { tipo, valor: de(valores, c.valor, `${donde}.valor`) }
    }),
  }
}

export function validarPerfil(x: unknown): { datos: DatosBasicos; borrador: PerfilBorrador; ninoId?: string } {
  if (!esObjeto(x)) return mal('Faltan los datos del perfil')
  const d = esObjeto(x.datos) ? x.datos : mal('Faltan los datos básicos')
  const pesoKg = opcional(d.pesoKg, (v) => numero(v, 'datos.pesoKg', 3, 150))
  const tallaCm = opcional(d.tallaCm, (v) => numero(v, 'datos.tallaCm', 40, 220))
  const suplementos = opcional(d.suplementos, (v) => texto(v, 'datos.suplementos', 500))
  const datos: DatosBasicos = {
    nombre: texto(d.nombre, 'datos.nombre', 60).trim(),
    edad: numero(d.edad, 'datos.edad', 1, 18),
    sexo: de(['masculino', 'femenino'] as const, d.sexo, 'datos.sexo'),
    ...(pesoKg !== undefined ? { pesoKg } : {}),
    ...(tallaCm !== undefined ? { tallaCm } : {}),
    alergias: [...new Set(lista(d.alergias ?? [], 'datos.alergias').map((a) => de(ALERGENO, a, 'datos.alergias')))],
    alertas: [...new Set(lista(d.alertas ?? [], 'datos.alertas').map((a) => de(ALERTAS_DECLARADAS, a, 'datos.alertas')))],
    dieta: de(DIETA, d.dieta ?? 'ninguna', 'datos.dieta'),
    ...(suplementos ? { suplementos } : {}),
  }
  const b = x.borrador === undefined ? {} : esObjeto(x.borrador) ? x.borrador : mal('El borrador no es válido')
  const preparacionId = (v: unknown, donde: string) => (v === null || v === undefined || v === '' ? null : texto(v, donde, 120))
  const objetivos = opcional(b.objetivosNutricionista, (o) => {
    if (!esObjeto(o)) return mal('borrador.objetivosNutricionista no es válido')
    const r: Partial<Nutrientes> = {}
    for (const [k, v] of Object.entries(o)) r[de(NUTRIENTE, k, 'borrador.objetivosNutricionista')] = numero(v, `objetivosNutricionista.${k}`, 0, 100_000)
    return r
  })
  const borrador: PerfilBorrador = {
    acepta: lista(b.acepta ?? [], 'borrador.acepta').map((a, i) => {
      if (!esObjeto(a)) return mal(`borrador.acepta[${i}] no es un objeto`)
      const marca = opcional(a.marca, (m) => texto(m, `borrador.acepta[${i}].marca`, 80))
      return {
        nombre: texto(a.nombre, `borrador.acepta[${i}].nombre`, 120), preparacionId: preparacionId(a.preparacionId, `borrador.acepta[${i}].preparacionId`),
        ...(marca ? { marca } : {}), atributos: atributosParciales(a.atributos, `borrador.acepta[${i}]`),
      }
    }),
    rechaza: lista(b.rechaza ?? [], 'borrador.rechaza').map((r, i) => {
      if (!esObjeto(r)) return mal(`borrador.rechaza[${i}] no es un objeto`)
      return {
        nombre: texto(r.nombre, `borrador.rechaza[${i}].nombre`, 120), preparacionId: preparacionId(r.preparacionId, `borrador.rechaza[${i}].preparacionId`),
        motivo: de(MOTIVO, r.motivo ?? 'otro', `borrador.rechaza[${i}].motivo`),
      }
    }),
    reglas: lista(b.reglas ?? [], 'borrador.reglas').map(regla),
    ...(objetivos ? { objetivosNutricionista: objetivos } : {}),
  }
  const ninoId = opcional(x.ninoId, (v) => (typeof v === 'string' && /^[a-z0-9][a-z0-9_-]{1,39}$/.test(v) ? v : mal('ninoId: solo minúsculas, números, - y _')))
  return { datos, borrador, ...(ninoId ? { ninoId } : {}) }
}
