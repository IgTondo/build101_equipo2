// Documentos de Mongo (capa bronze, PLAN.md §4.3 y §8) y tipos internos de la pista B.
// El bronze nunca se reescribe: silver y gold se recalculan desde acá.
import type {
  AnalisisComida, Atributos, Conducta, Cuanto, DatosBasicos, Distribucion, Momento, Motivo, Nutrientes,
  PerfilBorrador, Plato, Porcion, Rango, Regla, RegistrarComidaReq,
} from '../../shared/contratos.js'

/** Un ítem de la comida ya resuelto: gramos servidos, lo que comió y sus nutrientes. */
export interface ItemComida {
  idTmp: string
  preparacionId: string                  // el de la visión, o el slug del nombre si vino null
  nombre: string
  atributos: Atributos                   // los OBSERVADOS: son los que usa la minería de patrones
  ingredientes: { alimentoId: string; gramos: number }[]   // gramos servidos (ya corregidos por porción y conteo)
  gramos: number
  porcion: Porcion                       // la que confirmó el padre
  cuanto: Cuanto | null                  // null: el padre no respondió por este ítem (no se usa para aprender)
  fraccion: number
  o: number | null
  motivo?: Motivo
  cita?: string
  confianza: number
  nutrientes: Nutrientes                 // consumidos (servido × fracción)
  sinDatos: string[]                     // alimentoIds sin valores en la tabla: cuentan 0 y se avisa
}

export interface ComidaDoc {
  _id: string
  ninoId: string
  dia: string                            // 'YYYY-MM-DD' en hora de Uruguay
  fechaISO: string
  momento: Momento
  thumbBase64?: string
  comentario?: string
  analisis: AnalisisComida               // tal como vino de la IA (ya corregido por el padre)
  respuestas: RegistrarComidaReq['respuestas']
  respuestasPreguntas: RegistrarComidaReq['respuestasPreguntas']
  conducta: Conducta[]
  relato?: RegistrarComidaReq['relato']
  distribucion: Distribucion
  plato: Plato
  items: ItemComida[]
  nutrientes: Rango                      // de toda la comida, con ±35%
  creadoISO: string
}

/** Lo último que se aprendió del chico: sirve para el diff de "qué aprendí". */
export interface PatronGuardado {
  clave: string; texto: string; resultado: 'acepta' | 'rechaza'; apoyo: number; media: number
  fuente: 'aprendido' | 'investigacion'
}

export interface NinoDoc {
  _id: string                            // ninoId
  datos: DatosBasicos
  borrador: PerfilBorrador               // lo que contó el padre (fuente 'padre')
  reglas: Regla[]
  objetivosNutricionista?: Partial<Nutrientes>
  creadoISO: string
  actualizadoISO: string
  patrones?: PatronGuardado[]
}
