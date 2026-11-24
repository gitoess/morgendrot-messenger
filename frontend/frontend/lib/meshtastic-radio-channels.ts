/**
 * Meshtastic-Kanäle vom Radio (onChannelPacket) — nur Anzeige/Index-Wahl.
 * PSK/Modem bleiben in der Meshtastic-App; Messenger sendet auf dem Index.
 */

export type MeshtasticRadioChannelRole = 'primary' | 'secondary' | 'disabled' | 'unknown'

export type MeshtasticRadioChannel = {
  index: number
  name: string
  role: MeshtasticRadioChannelRole
  /** true wenn settings.psk vorhanden (Länge > 0) — Secret nicht speichern. */
  hasPsk: boolean
}

const ROLE_MAP: Record<number, MeshtasticRadioChannelRole> = {
  0: 'disabled',
  1: 'primary',
  2: 'secondary',
}

export function parseMeshtasticRadioChannel(payload: unknown): MeshtasticRadioChannel | null {
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>
  const rawIndex = o.index ?? o.channelIndex
  const index =
    typeof rawIndex === 'number' && Number.isFinite(rawIndex)
      ? Math.trunc(rawIndex)
      : typeof rawIndex === 'bigint'
        ? Number(rawIndex)
        : NaN
  if (!Number.isFinite(index) || index < 0 || index > 7) return null

  const roleRaw = o.role
  let role: MeshtasticRadioChannelRole = 'unknown'
  if (typeof roleRaw === 'number' && ROLE_MAP[roleRaw] != null) role = ROLE_MAP[roleRaw]
  else if (typeof roleRaw === 'string') {
    const t = roleRaw.toLowerCase()
    if (t.includes('primary')) role = 'primary'
    else if (t.includes('secondary')) role = 'secondary'
    else if (t.includes('disabled')) role = 'disabled'
  }

  const settings =
    o.settings && typeof o.settings === 'object' ? (o.settings as Record<string, unknown>) : null
  const name =
    (typeof settings?.name === 'string' && settings.name.trim()) ||
    (typeof o.name === 'string' && o.name.trim()) ||
    (role === 'primary' ? 'Primary' : `Kanal ${index}`)

  let hasPsk = false
  const psk = settings?.psk ?? o.psk
  if (typeof psk === 'string') hasPsk = psk.length > 0
  else if (psk instanceof Uint8Array) hasPsk = psk.length > 0
  else if (Array.isArray(psk)) hasPsk = psk.length > 0

  return { index, name, role, hasPsk }
}

export function upsertMeshtasticRadioChannel(
  prev: readonly MeshtasticRadioChannel[],
  next: MeshtasticRadioChannel
): MeshtasticRadioChannel[] {
  const without = prev.filter((c) => c.index !== next.index)
  return [...without, next].sort((a, b) => a.index - b.index)
}

export function meshtasticRadioChannelLabel(c: MeshtasticRadioChannel): string {
  const roleDe =
    c.role === 'primary' ? 'Primary' : c.role === 'secondary' ? 'Secondary' : c.role === 'disabled' ? 'aus' : '?'
  const psk = c.hasPsk ? ' · PSK' : ''
  return `${c.index}: ${c.name} (${roleDe}${psk})`
}

/** Was Sender und Empfänger gleich brauchen — Kurztext für UI. */
export const MESHTASTIC_MATCH_SETTINGS_HINT =
  'Damit zwei Heltecs sich verstehen: gleiche Region (z. B. EU_868), gleiches Modem (meist LONG_FAST), gleicher Kanalindex + gleicher Kanalname/PSK. Primary (Index 0) = öffentliches Mesh; deine eigenen Kanäle = Secondary mit geteiltem PSK. Modem/PSK nur in der Meshtastic-App setzen — hier nur Index wählen und Nodes anschreiben.'
