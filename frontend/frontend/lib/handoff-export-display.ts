import type { HandoffEinsatzPreset } from '@/frontend/lib/handoff-export-presets'

/** Kurz-Anzeige 0xabc…def456 für Boss-UI (volle Adresse bleibt im Export). */
export function formatHandoffAddressShort(addr: string): string {
  const t = addr.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(t)) return t.length > 24 ? `${t.slice(0, 12)}…` : t
  return `${t.slice(0, 8)}…${t.slice(-6)}`
}

export function formatHandoffMailboxShort(id: string): string {
  const t = id.trim()
  if (t.length < 12) return t
  return `…${t.slice(-8)}`
}

export function parsePartnerAddressCsv(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^0x[a-fA-F0-9]{64}$/i.test(s))
}

export function buildHandoffExportSummary(p: {
  preset: HandoffEinsatzPreset
  bezeichnung: string
  teamMailboxCount: number
  partnerCount: number
  usesTeamMailboxes: boolean
  includeIotaArchivReadme: boolean
}): { title: string; detail: string } {
  const name = p.bezeichnung.trim() || p.preset.defaultBezeichnung
  const title = `${p.preset.label}-Paket „${name}"`

  const parts: string[] = []
  if (p.usesTeamMailboxes) {
    parts.push(
      p.teamMailboxCount === 0
        ? 'Kein Team-Postfach gewählt'
        : `${p.teamMailboxCount} Team-Postfach${p.teamMailboxCount === 1 ? '' : 'er'}`
    )
  } else {
    parts.push('Kein Team-Postfach (Preset)')
  }
  parts.push(`${p.partnerCount} Partner`)
  parts.push('Meshtastic-PSK')
  if (p.preset.transportProfile === 'mesh-first') {
    parts.push(p.includeIotaArchivReadme ? 'IOTA-Archiv im README' : 'IOTA-Archiv aus')
  }

  return { title, detail: parts.join(' · ') }
}
