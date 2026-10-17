// POST /api/transcribir { TranscribirReq } → TranscribirRes
// Dueño: pista A (A7, PLAN.md §7). Solo el primer paso del relato; lo usa el perfil inicial para dejar editar el texto.
// Transcripción vacía → 422 audio_no_entendido.
import type { TranscribirRes } from '../shared/contratos.js'
import { manejar, permitir } from '../server/http.js'
import { esquemaTranscribirReq, transcribirAudio } from '../server/ia/relato.js'

export default manejar(async (req, res) => {
  if (!permitir(req, res, 'POST')) return
  const { audioBase64, mime, pista } = esquemaTranscribirReq.parse(req.body)
  const { texto, ms } = await transcribirAudio({ audioBase64, mime, pista })
  const cuerpo: TranscribirRes = { texto, ms }
  res.status(200).json(cuerpo)
})
