// Errores de la capa de IA (PLAN.md §7, A4). Los handlers de api/ los traducen a ErrorApi con estadoHttp().
export type CodigoErrorIA =
  | 'entrada_invalida'   // el pedido no cumple el contrato
  | 'sin_clave'          // falta la key del proveedor en el entorno
  | 'timeout'            // el proveedor no respondió a tiempo (25 s por llamada)
  | 'limite'             // 429: se acabó el cupo o hay demasiados pedidos
  | 'json_invalido'      // la salida no validó contra el schema, ni siquiera con el reintento
  | 'rechazo'            // el modelo se negó (stop_reason: 'refusal')
  | 'proveedor'          // cualquier otro error del proveedor
  | 'no_implementado'

export class ErrorIA extends Error {
  readonly codigo: CodigoErrorIA
  readonly detalle?: unknown

  constructor(codigo: CodigoErrorIA, mensaje: string, opciones?: { causa?: unknown; detalle?: unknown }) {
    super(mensaje, { cause: opciones?.causa })
    this.name = 'ErrorIA'
    this.codigo = codigo
    this.detalle = opciones?.detalle
  }
}

const ESTADO: Record<CodigoErrorIA, number> = {
  entrada_invalida: 400,
  sin_clave: 503,
  timeout: 504,
  limite: 429,
  json_invalido: 502,
  rechazo: 422,
  proveedor: 502,
  no_implementado: 501,
}

export function estadoHttp(codigo: CodigoErrorIA): number {
  return ESTADO[codigo]
}

export function esErrorIA(e: unknown): e is ErrorIA {
  return e instanceof ErrorIA
}
