import { BUILTIN_SYMPTOMS } from './symptoms'

/**
 * Message « consulte en urgence » (jamais alarmiste, mais clair). Déclenché par :
 *  - difficulté à respirer, gonflement des lèvres ou de la gorge, malaise : quelle que soit l'intensité ;
 *  - une douleur très intense : 9 ou 10 sur 10, ou le maximum (5 sur 5) pour une douleur notée sur 5.
 * Les symptômes perso ne déclenchent jamais le message (on ne sait pas ce qu'ils désignent).
 */
export const PAIN_URGENT_ON_10 = 9
const BY_ID = new Map(BUILTIN_SYMPTOMS.map((s) => [s.id, s]))

export function needsEmergencyMessage(symptomId: string, intensity?: number): boolean {
  const s = BY_ID.get(symptomId)
  if (!s) return false
  if (s.urgent) return true
  if (!s.painLike || intensity === undefined) return false
  return s.scale === 10 ? intensity >= PAIN_URGENT_ON_10 : intensity >= s.scale
}

/** Numéro d'urgence européen (valable en Espagne et en France). */
export const EMERGENCY_NUMBER = '112'
