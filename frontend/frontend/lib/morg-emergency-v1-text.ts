'use client'

/**
 * MORG_EMERGENCY_V1 (Browser): gleiche Logik wie `src/shared/morg-emergency-v1-text.ts` — Präfix muss
 * mit `MorgTextWireMarker.EMERGENCY_V1` in `src/shared/opcodes.ts` übereinstimmen (Next/Turbopack lädt kein `../src/shared`).
 */
const MORG_EMERGENCY_V1_PREFIX = '[[MORG_EMERGENCY_V1:' as const
const CLOSE = ']]' as const

export type MorgEmergencyV1KindCode = 't' | 'v'

export type MorgEmergencyV1Envelope = { v: 1; k: MorgEmergencyV1KindCode; ts: number }

export function buildMorgEmergencyV1MarkerJson(kind: 'text' | 'voice'): string {
  const env: MorgEmergencyV1Envelope = {
    v: 1,
    k: kind === 'text' ? 't' : 'v',
    ts: Date.now(),
  }
  return `${MORG_EMERGENCY_V1_PREFIX}${JSON.stringify(env)}${CLOSE}`
}

export function prependMorgEmergencyV1Marker(body: string, kind: 'text' | 'voice'): string {
  const head = buildMorgEmergencyV1MarkerJson(kind)
  const b = body ?? ''
  if (!b) return head
  return `${head}\n${b}`
}

export function stripLeadingMorgEmergencyV1Marker(plaintext: string): {
  emergency: boolean
  kind?: 'text' | 'voice'
  body: string
} {
  if (!plaintext.startsWith(MORG_EMERGENCY_V1_PREFIX)) {
    return { emergency: false, body: plaintext }
  }
  const closeIdx = plaintext.indexOf(CLOSE, MORG_EMERGENCY_V1_PREFIX.length)
  if (closeIdx < 0) {
    return { emergency: false, body: plaintext }
  }
  const jsonStr = plaintext.slice(MORG_EMERGENCY_V1_PREFIX.length, closeIdx)
  let kind: 'text' | 'voice' | undefined
  try {
    const o = JSON.parse(jsonStr) as MorgEmergencyV1Envelope
    if (o?.v === 1 && o.k === 't') kind = 'text'
    else if (o?.v === 1 && o.k === 'v') kind = 'voice'
  } catch {
    /* ungültige Hülle */
  }
  let rest = plaintext.slice(closeIdx + CLOSE.length)
  if (rest.startsWith('\n')) rest = rest.slice(1)
  return { emergency: true, kind, body: rest }
}

export function plaintextStartsWithMorgEmergencyV1(plaintext: string): boolean {
  return plaintext.startsWith(MORG_EMERGENCY_V1_PREFIX)
}
