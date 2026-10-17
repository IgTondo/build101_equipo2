// POST /api/analizar-comida { AnalizarComidaReq } → AnalisisComida
// Dueño: pista A (A5, PLAN.md §7). Valida el pedido, trae el contexto del chico (si falla, vacío) y analiza la foto
// con server/ia/vision.ts. Los errores de la IA salen como ErrorApi por manejar().
import { z } from 'zod'
import type { AnalisisComida, AnalizarComidaReq } from '../shared/contratos.js'
import { manejar, permitir } from '../server/http.js'
import { obtenerContexto } from '../server/datos/contexto.js'
import { analizarComida, CONTEXTO_VACIO, contextoVision, fijarFuenteContexto } from '../server/ia/vision.js'

const MAX_IMAGEN = 4_500_000            // el body entero no puede pasar de 4,5 MB en Vercel

// El contexto del chico es de B (lo que acepta, lo que está probando y sus reglas). Sin chico o sin base, null → vacío.
fijarFuenteContexto(async (ninoId) => (await obtenerContexto(ninoId)) ?? CONTEXTO_VACIO)

const Pedido = z.object({
  ninoId: z.string().trim().min(1),
  // Sin el prefijo data: ni saltos de línea (los de `base64` en un curl): la API de Claude no los acepta.
  imagenBase64: z.preprocess(
    (v) => (typeof v === 'string' ? v.replace(/^data:[^,]*,/, '').replace(/\s+/g, '') : v),
    z.string().min(1).max(MAX_IMAGEN).regex(/^[A-Za-z0-9+/]+={0,2}$/, 'No es base64').startsWith('/9j/', 'No es un JPEG'),
  ),
  mime: z.literal('image/jpeg'),
  comentario: z.string().max(500).optional(),
}) satisfies z.ZodType<AnalizarComidaReq>

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  const pedido = Pedido.parse(req.body)
  const contexto = await contextoVision(pedido.ninoId)
  const analisis: AnalisisComida = await analizarComida(pedido, contexto)
  res.status(200).json(analisis)
})
