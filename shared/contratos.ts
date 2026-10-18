// Contratos de Nibble (PLAN.md §5). Los leen todas las pistas; los crea C.
// Congelados desde el CP0: solo cambios aditivos (campos opcionales nuevos) y avisando en el grupo.
// Lo agregado en C1 lleva `// C1`: ErrorApi, tipos de los endpoints que en §5 eran solo comentarios
// y `preparacionId` opcional en /api/receta.

// ---------- Vocabulario cerrado ----------
export const TEXTURA = ['crocante', 'blando', 'cremoso', 'masticable', 'jugoso', 'mixto'] as const
export const FORMA = ['baston', 'redondo', 'plano', 'trozos', 'pure', 'granos', 'entero'] as const
export const COLOR = ['blanco', 'beige', 'amarillo', 'naranja', 'rojo', 'verde', 'marron', 'mixto'] as const
export const SABOR = ['salado', 'dulce', 'acido', 'neutro'] as const
export const TEMPERATURA = ['frio', 'tibio', 'caliente'] as const
export const PRESENTACION = ['separado', 'mezclado', 'con_salsa'] as const
export const COCCION = ['frito', 'horno', 'hervido', 'plancha', 'crudo', 'listo'] as const // v4 · 'listo' = se come como viene (yogur, pan, galletitas)
export const GRUPO = ['cereal_almidon', 'proteina', 'verdura', 'fruta', 'lacteo', 'otro'] as const
export const DISTRIBUCION = ['separados', 'tocandose', 'mezclados'] as const
export const PLATO = ['hondo', 'playo', 'con_divisiones', 'otro'] as const
export const MOMENTO = ['desayuno', 'almuerzo', 'merienda', 'cena', 'colacion'] as const
export const NUTRIENTE = ['energia_kcal', 'proteina_g', 'calcio_mg', 'vitamina_d_ug', 'hierro_mg', 'fibra_g', 'omega3_g', 'b12_ug', 'vitamina_c_mg'] as const // v2: + vitamina_c_mg
export const ALERGENO = ['leche', 'huevo', 'gluten', 'mani', 'frutos_secos', 'soja', 'pescado', 'mariscos', 'sesamo'] as const
export const CUANTO = ['todo', 'mitad', 'poco', 'probo', 'toco', 'nada', 'aparto'] as const // v2: + aparto · es la escalera de exposición (tabla abajo)
export const PORCION = ['chica', 'mediana', 'grande'] as const
export const CONDUCTA = ['tranquilo', 'se_levanto', 'angustia', 'pidio_otra_cosa', 'arcadas', 'atragantamiento'] as const // v2
export const MOTIVO = ['textura', 'sabor_olor', 'mezcla', 'marca', 'forma', 'color', 'temperatura', 'se_tocaban', 'cantidad', 'otro'] as const // v2 · perfil y relato
export const CAMBIO = ['fortificar', 'coccion', 'forma', 'sabor', 'ingrediente', 'temperatura', 'textura'] as const // v2 · de menor a mayor dificultad · v4: + coccion (nuggets fritos → al horno)
export const DIETA = ['ninguna', 'sin_gluten_caseina', 'otra'] as const // v2

type De<T extends readonly string[]> = T[number]
export type Textura = De<typeof TEXTURA>
export type Forma = De<typeof FORMA>
export type Color = De<typeof COLOR>
export type Sabor = De<typeof SABOR>
export type Temperatura = De<typeof TEMPERATURA>
export type Presentacion = De<typeof PRESENTACION>
export type Coccion = De<typeof COCCION>     // v4
export type Grupo = De<typeof GRUPO>
export type Distribucion = De<typeof DISTRIBUCION>
export type Plato = De<typeof PLATO>
export type Momento = De<typeof MOMENTO>
export type Nutriente = De<typeof NUTRIENTE>
export type Alergeno = De<typeof ALERGENO>
export type Cuanto = De<typeof CUANTO>
export type Porcion = De<typeof PORCION>
export type Conducta = De<typeof CONDUCTA>   // v2
export type Motivo = De<typeof MOTIVO>       // v2
export type Cambio = De<typeof CAMBIO>       // v2
export type Dieta = De<typeof DIETA>         // v2
export type Nutrientes = Record<Nutriente, number>

export interface Atributos {
  textura: Textura; forma: Forma; color: Color; sabor: Sabor
  temperatura: Temperatura; presentacion: Presentacion; grupo: Grupo
  coccion?: Coccion                      // v4 · opcional para no romper el contrato; la visión lo devuelve siempre
}
export type Caja = [number, number, number, number] // [ymin, xmin, ymax, xmax] de 0 a 1000 (si con Claude salen corridas, la UI muestra solo las etiquetas)

// ---------- Datos ----------
export interface Alimento {              // data/alimentos.json (curado) · colección alimentos_fdc en Mongo (completa)
  id: string; nombre: string; alias: string[]; fdcId: number | null; grupo: Grupo
  por100g: Nutrientes; alergenos: Alergeno[]; porcionMedianaG: number
  fuente: 'USDA' | 'TCAU' | 'equipo'     // v2 · se muestra al usuario
  dataset?: 'foundation' | 'sr_legacy' | 'fndds'           // v3
  porciones?: { descripcion: string; gramos: number }[]    // v3 · pesos reales por unidad ("1 nugget = 16 g"), de FNDDS o SR Legacy
  faltantes?: Nutriente[]                // A3 · nutrientes sin dato en la tabla: van en 0 (§10.1, "se marca")
}
export interface PreparacionCatalogo {   // data/preparaciones.json · catálogo semilla curado
  id: string; nombre: string; atributos: Atributos
  ingredientes: { alimentoId: string; gramos: number }[]   // por porción; el de más gramos es el ingrediente principal
  fortificadaDe?: string                 // v2 · id de la preparación de la que es versión fortificada (yogur → yogur con vitamina D)
  momentos?: Momento[]                   // v5.2 · para qué comidas se sugiere (curado a mano): la chocolatada no va a la cena
}

// ---------- POST /api/analizar-comida (A) ----------
export interface AnalizarComidaReq { ninoId: string; imagenBase64: string; mime: 'image/jpeg'; comentario?: string }
export interface ItemDetectado {
  idTmp: string
  preparacion: string                    // "papas fritas en bastones"
  preparacionId: string | null           // si coincide con una conocida del chico o del catálogo
  ingredientes: { alimentoId: string; gramosEst: number }[]
  conteo?: { cantidad: number; unidad: string }   // v3 · "6 nuggets": si la unidad está en `porciones`, el código usa ese peso real
  porcion: Porcion
  atributos: Atributos
  caja: Caja | null
  confianza: number                      // de 0 a 1
  nombreIngles?: string                  // A · solo si algún ingrediente cayó en otro_<grupo>: el código lo busca en alimentos_fdc (§7)
}
export interface Pregunta {
  id: string; texto: string; opciones: string[]
  itemIdTmp?: string; caja?: Caja; origen: 'duda' | 'regla' | 'contexto'
}
export interface AnalisisComida {
  analisisId: string
  sinComida: boolean
  items: ItemDetectado[]
  distribucion: { estado: Distribucion; cantidadItems: number; plato: Plato }
  preguntas: Pregunta[]                  // máx. 3, de la IA. El "¿cómo le fue?" por ítem lo arma la UI.
  modelo: string; ms: number
}

// ---------- POST /api/relato-comida (A) · v2 ----------
export interface RelatoComidaReq {
  ninoId: string
  analisis: AnalisisComida               // para conocer los ítems (idTmp) y las preguntas
  audioBase64?: string; mime?: string    // 'audio/mp4' (iPhone) o 'audio/webm' (Android)
  texto?: string                         // plan B: dictado del teclado o texto escrito
}
export interface RelatoComida {
  transcripcion: string
  respuestas: { itemIdTmp: string; cuanto: Cuanto; porcion?: Porcion; motivo?: Motivo; confianza: number
    cita?: string                        // v4 · el fragmento textual de la transcripción que la justifica; sin cita, el ítem va a sinMencion
  }[]
  respuestasPreguntas: { preguntaId: string; respuesta: string }[]
  conducta: Conducta[]
  comentario: string                     // una línea neutra para el registro
  sinMencion: string[]                   // idTmp de los ítems de los que no dijo nada: la UI los deja sin marcar
  ms: number
}
// POST /api/transcribir (A) · v2 · { audioBase64, mime, pista?: string } → { texto, ms } · lo usa el perfil inicial
export interface TranscribirReq { audioBase64: string; mime: string; pista?: string }   // C1
export interface TranscribirRes { texto: string; ms: number }                           // C1

// ---------- POST /api/registrar-comida (B) ----------
export interface RegistrarComidaReq {
  ninoId: string
  dia: string                            // 'YYYY-MM-DD' en hora de Uruguay; lo calcula el cliente (Vercel corre en UTC)
  fechaISO: string                       // permite cargar historial con fecha pasada (se declara)
  momento: Momento
  thumbBase64?: string
  comentario?: string
  analisis: AnalisisComida               // ya corregido por el padre (ítems borrados o renombrados)
  respuestas: { itemIdTmp: string; cuanto: Cuanto; porcion: Porcion; motivo?: Motivo; cita?: string }[]  // v2: + motivo · v4: + cita (se guarda en el bronze)
  respuestasPreguntas: { preguntaId: string; respuesta: string }[]
  conducta: Conducta[]                   // v2
  relato?: { transcripcion: string; fuente: 'voz' | 'texto' }   // v2
}
export interface Rango { valor: Nutrientes; min: Nutrientes; max: Nutrientes }
export interface Aprendizaje {
  tipo: 'aceptacion' | 'exposicion' | 'patron_nuevo' | 'patron_reforzado' | 'patron_borrado' | 'contradiccion'
  texto: string
}
export interface Alerta {                // v2 · reglas en server/nutricion/alertas.ts (§10.4)
  tipo: 'repertorio_chico' | 'repertorio_baja' | 'grupo_ausente' | 'sin_vitamina_c' | 'arcadas' | 'atragantamiento' | 'dieta_eliminacion' | 'declarada'
  texto: string
}
export interface RegistrarComidaRes {
  comidaId: string; nutrientesComida: Rango; dia: CoberturaDia; aprendi: Aprendizaje[]
  alertas: Alerta[]                      // v2 · las que disparó esta comida
}

// ---------- GET /api/nutricion · GET /api/progreso (B) ----------
export interface ComidaResumen {
  id: string; fechaISO: string; momento: Momento; thumbBase64?: string
  items: { nombre: string; cuanto: Cuanto }[]
  conducta?: Conducta[]                  // v2
}
export interface CoberturaDia {
  dia: string; consumido: Rango; objetivo: Nutrientes
  cobertura: Nutrientes                  // consumido / objetivo (puede pasar de 1)
  faltan: Nutriente[]                    // de menor a mayor cobertura, sin energía
  comidas: ComidaResumen[]
}
export interface PatronVista {
  texto: string; resultado: 'acepta' | 'rechaza'; apoyo: number; confianza: number
  fuente: 'aprendido' | 'investigacion'
}
export interface Progreso {
  dias: CoberturaDia[]
  semana: { cobertura: Nutrientes; faltan: Nutriente[]; energiaPromedioKcal: number } // v2: + energía; faltan en el orden de prioridad de §1
  aceptadas: number; enProceso: number; patrones: PatronVista[]
  frase: string                                              // v2 · "Esta semana cubrió 5 de 8…" (plantilla)
  semanas: { desde: string; cobertura: Nutrientes }[]        // v2 · evolución, últimas 4
  repertorioTendencia: number                                // v2 · aceptadas ahora − hace 7 días
  grupos: { grupo: Grupo; diasSinComer: number | null }[]    // v2 · null = nunca registrado
  exposiciones: { preparacionId: string; nombre: string; veces: number; mejorPaso: Cuanto; ultimaISO: string }[] // v2
  alertas: Alerta[]                                          // v2
  proximoPaso?: Candidato                                    // v2 · el mejor candidato del grafo, sin LLM, para la tarjeta del tablero
  sugerencias?: Sugerencia[]                                 // v4 · siempre en el orden segura, un_paso, mas_nutritiva (§8); proximoPaso = la de un_paso
  momento?: Momento                                          // v5.2 · vino ?momento=: las sugerencias (y proximoPaso) son solo de esa comida; pueden ser menos de 3 o ninguna
  variedad?: Variedad                                        // v5.5 · solo si hay comidas esta semana y ningún nutriente clave falta (semana.faltan vacío): modo variedad
}
// v5.5 · Modo variedad: cuando ningún nutriente clave falta esta semana (todos ≥ 70%), el objetivo pasa a ser sumar
// variedad: entre los grupos del tablero (fruta, verdura, lácteo, proteína), el que menos come (el que nunca registramos
// o el de más días sin comer, desde 3 días). Sin `grupo`: come de todos y la idea es algo nuevo a un cambio de lo que come.
export interface Variedad {               // v5.5
  grupo?: Grupo
  diasSinComer?: number | null           // viene con `grupo`: null = no registramos que lo haya comido
}
// v5.5 · Para qué es la receta (Receta.objetivo) o la sugerencia (Sugerencia.objetivo): un nutriente que falta o sumar variedad.
export type ObjetivoReceta = { tipo: 'nutriente'; nutriente: Nutriente } | ({ tipo: 'variedad' } & Variedad)
// v5.4 · Ideas del catálogo del grafo para una comida (Recomendacion.ideas, server): la receta creativa las usa solo de referencia.
export interface IdeaReceta { preparacionId: string; nombre: string; nutriente: Nutriente }
export interface Sugerencia {            // v4 · las tres opciones del tablero: explotar, explorar de a un cambio, priorizar lo que falta
  tipo: 'segura' | 'un_paso' | 'mas_nutritiva'
  preparacionId: string; nombre: string
  probAcepta: number                     // de 0 a 1: la aceptación (segura) o el puntaje del candidato llevado a 0–1
  aporte: Partial<Nutrientes>            // por porción
  porQue: string                         // plantilla, sin LLM: "La come 8 de cada 8 veces" · "Se parece a sus papas fritas: cambia solo el ingrediente"
  candidato?: Candidato                  // en un_paso y mas_nutritiva; abre la receta
  grupo?: Grupo                          // v5.1 · el grupo de la preparación: la pantalla elige la que encaja con la próxima comida
  objetivo?: ObjetivoReceta              // v5.5 · solo en mas_nutritiva en modo variedad ({ tipo: 'variedad', grupo? }): no apunta a un nutriente sino al grupo que menos come (el tipo sigue siendo mas_nutritiva)
}
// v5.1 · la próxima comida (PLAN §9, "La pantalla principal"): desayuno → almuerzo → cena → desayuno; la merienda y la
// colación llevan a la principal que sigue. /api/progreso acepta ?momento= para que B ordene las sugerencias para esa comida.
// v5.2 · con ?momento=, B solo sugiere preparaciones del catálogo cuyo `momentos` lo incluye (lo que no está anotado no
// sale) y devuelve `Progreso.momento`. Si no queda ninguna, menos sugerencias: nunca una de otra comida.

// ---------- Perfil ----------
export interface DatosBasicos {
  nombre: string; edad: number; sexo: 'masculino' | 'femenino'; pesoKg?: number; tallaCm?: number
  alergias: Alergeno[]                   // a mano, nunca por IA
  alertas: ('bajo_peso' | 'arcadas_vomitos' | 'menos_15_alimentos')[]
  dieta: Dieta                           // v2
  suplementos?: string                   // v2 · solo registro; la app nunca sugiere suplementos
}
export interface Regla {
  texto: string
  condiciones: { tipo: keyof Atributos | 'distribucion' | 'plato'; valor: string }[]
  efecto: 'rechaza' | 'requiere'
}
// POST /api/perfil-inicial (A) · la pantalla transcribe primero con /api/transcribir y deja editar el texto
export interface PerfilInicialReq {
  // v5 · PLAN §5.2 (A8b, 18/10): en el alta por voz no viene; los datos se extraen del relato con su cita
  // (PerfilBorrador.datos) y lo vital que falta va en `faltan`.
  datos?: DatosBasicos
  texto: string; fotoIndicacionBase64?: string
}
export interface DatoCitado<T> { valor: T; cita: string }   // v5 · como en el relato (v4): sin cita textual, no hay dato
export interface DatosExtraidos {         // v5 · lo que dijo del chico; el padre lo confirma o lo corrige en "esto entendí"
  nombre?: DatoCitado<string>; edad?: DatoCitado<number>; sexo?: DatoCitado<'masculino' | 'femenino'>
  pesoKg?: DatoCitado<number>; tallaCm?: DatoCitado<number>
  alergiasMencionadas: DatoCitado<Alergeno>[]       // NUNCA pasan solas a DatosBasicos.alergias: el padre las toca una por una
  sinAlergias?: DatoCitado<true>                     // dijo explícitamente que no tiene; igual se confirma
  alertas: DatoCitado<'bajo_peso' | 'arcadas_vomitos' | 'menos_15_alimentos'>[]
  atragantamiento?: DatoCitado<true>                 // se muestra como alerta (§10.4) desde el alta
  dieta?: DatoCitado<Dieta>; suplementos?: DatoCitado<string>
}
export const CAMPO_VITAL = ['nombre', 'edad', 'sexo', 'alergias', 'acepta', 'rechaza'] as const // v5
export type CampoVital = De<typeof CAMPO_VITAL>
export interface PerfilBorrador {
  acepta: { nombre: string; preparacionId: string | null; marca?: string; atributos: Partial<Atributos> }[]
  rechaza: { nombre: string; preparacionId: string | null; motivo: Motivo }[]   // v2: el motivo usa MOTIVO
  reglas: Regla[]
  objetivosNutricionista?: Partial<Nutrientes>
  datos?: DatosExtraidos                 // v5 · solo si el pedido no trajo datos (alta por voz)
  faltan?: CampoVital[]                  // v5 · lo vital que no mencionó: la pantalla lo pregunta antes de crear el perfil
}
// POST /api/perfil (B) { datos, borrador } → { ninoId }
// GET  /api/perfil?ninoId (B) → Perfil
export interface CrearPerfilReq { datos: DatosBasicos; borrador: PerfilBorrador }       // C1
export interface CrearPerfilRes { ninoId: string }                                      // C1
export interface Perfil {
  ninoId: string; datos: DatosBasicos; reglas: Regla[]; patrones: PatronVista[]
  preparaciones: { id: string; nombre: string; estado: 'acepta' | 'en_proceso' | 'rechaza'; puntaje: number; veces: number }[]
}

// ---------- GraphRAG y receta ----------
export interface Candidato {
  preparacionId: string; nombre: string; puntaje: number
  camino: { desde: string; aceptacion: string; atributos: string[] } // "papas fritas", "8/8", ["forma=baston", "textura=crocante"]
  desdeId: string                        // v2 · el alimento seguro del que parte
  cambio: Cambio                         // v2 · lo único que cambia
  seMantiene: string[]                   // v2 · ["forma=baston", "textura=crocante", "sabor=salado", "temperatura=caliente"]
  patrones: string[]
  aportePorcion: Partial<Nutrientes>
}
export interface Evidencia {             // armarEvidencia(ninoId, nutriente?) en server/grafo/evidencia.ts (B)
  nutriente: Nutriente; coberturaSemana: number; faltaHoy: number
  candidatos: Candidato[]; reglas: string[]; alergias: Alergeno[]
  texto: string                          // ~20 líneas: lo ÚNICO que ve el LLM
}
// POST /api/receta (A) { ninoId, nutriente?, preparacionId? } → Receta · ?motor=base|grafo (§4.3)
export interface RecetaReq {             // C1
  ninoId: string
  nutriente?: Nutriente                  // por defecto, el primero de semana.faltan
  preparacionId?: string                 // C1 · el candidato elegido en una tarjeta de sugerencia (Candidato.preparacionId); si no viene, el mejor de armarEvidencia()
  momento?: Momento                      // v5.1 · la comida para la que es (la próxima comida, PLAN §9) · v5.2: los candidatos de la evidencia son de esa comida (el preparacionId elegido se respeta igual)
  anteriores?: string[]                  // v5.4 · nombres de recetas que ya vio (máx. 10): con preparacionId, las de esa preparación (otra versión); sin preparacionId, las de esa comida (receta creativa: otro plato)
}
// v5.4 · Sin preparacionId, /api/receta arma una RECETA CREATIVA (server/ia/receta-creativa.ts): el grafo da la base de
// conocimiento (server/grafo/conocimiento.ts) y el LLM inventa un plato nuevo a UN cambio de un alimento seguro; el
// código cuenta los cambios, las alergias, las reglas y el aporte. El plato no está en el catálogo: viene en Receta.plato.
export interface Receta {
  nombre: string; preparacionBaseId: string           // el candidato del catálogo sobre el que se escribe la receta
  desde: { preparacionId: string; nombre: string }   // v2 · su alimento seguro (el punto de partida de la cadena)
  cambio: Cambio; seMantiene: string[]               // v2
  ingredientes: { alimentoId: string; nombre: string; gramos: number }[]
  pasos: string[]; porQue: string
  presentacion: string                   // separado, porción mínima, al lado de su alimento seguro
  comoOfrecer: string                    // v2 · sin presión; repetir igual de 8 a 15 veces
  transparencia: string | null           // v2 · si un ingrediente va adentro, se dice y se ofrece también a la vista
  aporte: Nutrientes                     // recalculado con la tabla, nunca el del LLM
  coberturaDeLoQueFalta: number
  validacion: { ok: boolean; problemas: string[]; reintentos: number }
  evidencia: Evidencia
  plato?: PlatoNuevo                     // v5.4 · solo en la receta creativa: el plato inventado (preparacionBaseId empieza con "nuevo_")
  platoCompleto?: PlatoCompleto          // v5.7 · solo en la receta creativa: la comida entera (lo nuevo + lo que ya come que la completa)
  objetivo?: ObjetivoReceta              // v5.5 · la receta creativa lo trae siempre: el nutriente que falta, o variedad (sin mínimo de nutriente; evidencia.nutriente es solo para mostrar: al que más aporta respecto de su meta)
}
// v5.7 · La receta creativa es una COMIDA COMPLETA, no un plato suelto: lo nuevo (el paso de food chaining, en almuerzo y
// cena de preferencia el principal) + lo que ya come que la completa (guarnición, verdura o fruta, lácteo, pan…),
// según la comida. Un solo alimento nuevo: los demás componentes son cosas que acepta. El aporte es el del plato entero.
export const ROL_PLATO = ['principal', 'guarnicion', 'verdura_fruta', 'lacteo', 'cereal_pan', 'bebida'] as const // v5.7
export type RolPlato = De<typeof ROL_PLATO>
export interface ComponentePlato {       // v5.7
  rol: RolPlato
  preparacionId: string                  // el nuevo: Receta.preparacionBaseId ("nuevo_…"); los demás, algo que acepta
  nombre: string
  nuevo: boolean                         // true solo en el de la receta
  gramos: number                         // la porción servida
  grupo: Grupo
}
export interface PlatoCompleto {         // v5.7
  componentes: ComponentePlato[]         // el nuevo primero
  aporte: Nutrientes                     // del plato entero, con la tabla (el nuevo con su receta, los demás con su porción)
  cubreDelDia: Partial<Nutrientes>       // aporte / objetivo diario (0,35 = el 35% de lo que necesita en el día)
}
export interface PlatoNuevo {            // v5.4
  atributos: Atributos & { coccion: Coccion }
  imagen: { uno: string; varios: string; aspecto: string } // en inglés, para el prompt de la imagen (como VISUAL en prompts/imagen-plato.ts)
}
// POST /api/imagen-plato (A) { receta, reglas } → { imagenBase64, mime, ilustrativa: true }
// GET  /api/resumen?ninoId (C) → { texto, progreso: Progreso, generadoISO }
export interface ImagenPlatoReq { receta: Receta; reglas: Regla[] }                     // C1
export interface ImagenPlatoRes { imagenBase64: string; mime: string; ilustrativa: true } // C1
export interface ResumenRes { texto: string; progreso: Progreso; generadoISO: string }   // C1

// ---------- Motores (§4.3) · C1 ----------
export const MOTOR = ['grafo', 'base'] as const                                         // C1 · ?motor= en /api/progreso y /api/receta
export type Motor = De<typeof MOTOR>

// ---------- GET /api/salud (B) · C1 ----------
export interface EstadoServicio { ok: boolean; ms?: number; error?: string }
export interface SaludRes {
  ok: boolean                            // todos los servicios responden
  servicios: Partial<Record<'mongo' | 'neo4j' | 'claude' | 'transcripcion' | 'imagen', EstadoServicio>>
  motorGrafo: 'neo4j' | 'mongo'
  stub?: boolean
}

// ---------- Errores (todos los endpoints) · C1 ----------
// Cualquier respuesta que no sea 2xx lleva este cuerpo. `mensaje` es para mostrarle al padre, en tono calmo;
// `detalle` es para depurar (nunca se muestra). Los stubs mandan además el header `x-nibble-stub: 1`.
export const CODIGO_ERROR = [
  'entrada_invalida',      // 400 · falta un campo o no pasa la validación (Zod)
  'metodo_no_permitido',   // 405
  'no_encontrado',         // 404 · ninoId o recurso inexistente
  'muy_grande',            // 413 · body > 4,5 MB (foto o audio)
  'sin_comida',            // 422 · la foto no tiene comida
  'audio_no_entendido',    // 422 · la transcripción vino vacía o no se entendió
  'sin_candidatos',        // 422 · armarEvidencia() no encontró candidatos a un cambio
  'limite_proveedor',      // 429 · se acabó el cupo de Claude, Groq o Workers AI
  'timeout',               // 504 · el modelo no respondió a tiempo
  'proveedor_caido',       // 502 · error del proveedor de IA o de la base
  'interno',               // 500
] as const
export type CodigoError = De<typeof CODIGO_ERROR>
export interface ErrorApi {
  error: {
    codigo: CodigoError
    mensaje: string                      // "No pudimos leer la foto. ¿Probás de nuevo?"
    reintentable: boolean                // la UI muestra "Reintentar" solo si es true
    detalle?: unknown
  }
}
