// Errores de la capa de IA (PLAN.md §7, A4). ErrorIA es un ErrorNibble: manejar() (server/http.ts) lo convierte
// solo en un ErrorApi. `motivo` distingue la causa para logs y tests; el mensaje es para el padre.
import type { CodigoError } from '../../shared/contratos.js'
import { ErrorNibble } from '../http.js'

export type MotivoErrorIA =
  | 'entrada_invalida'   // el pedido no cumple el contrato
  | 'sin_clave'          // falta la key del proveedor en el entorno
  | 'timeout'            // el proveedor no respondió a tiempo (25 s por llamada)
  | 'limite'             // 429: se acabó el cupo o hay demasiados pedidos
  | 'json_invalido'      // la salida no validó contra el schema, ni siquiera con el reintento
  | 'rechazo'            // el modelo se negó (stop_reason: 'refusal')
  | 'proveedor'          // cualquier otro error del proveedor
  | 'no_implementado'

const CODIGO: Record<MotivoErrorIA, CodigoError> = {
  entrada_invalida: 'entrada_invalida',
  sin_clave: 'proveedor_caido',
  timeout: 'timeout',
  limite: 'limite_proveedor',
  json_invalido: 'proveedor_caido',
  rechazo: 'proveedor_caido',
  proveedor: 'proveedor_caido',
  no_implementado: 'interno',
}

const MENSAJE: Record<MotivoErrorIA, string> = {
  entrada_invalida: 'Faltan datos o no tienen el formato esperado.',
  sin_clave: 'El servicio de IA todavía no está configurado.',
  timeout: 'La IA tardó demasiado en responder. ¿Probás de nuevo?',
  limite: 'Hay muchos pedidos a la vez. Esperá unos segundos y probá de nuevo.',
  json_invalido: 'La IA respondió algo que no pudimos leer. ¿Probás de nuevo?',
  rechazo: 'La IA no pudo responder este pedido.',
  proveedor: 'El servicio de IA no está respondiendo. ¿Probás de nuevo?',
  no_implementado: 'Esta parte todavía no está lista.',
}

export class ErrorIA extends ErrorNibble {
  readonly motivo: MotivoErrorIA

  constructor(motivo: MotivoErrorIA, detalle: string, opciones?: { causa?: unknown; mensaje?: string }) {
    super(CODIGO[motivo], opciones?.mensaje ?? MENSAJE[motivo], { motivo, detalle })
    this.name = 'ErrorIA'
    this.motivo = motivo
    if (opciones?.causa !== undefined) this.cause = opciones.causa
  }
}
