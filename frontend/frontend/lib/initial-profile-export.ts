import type { ContactMeshEntryClient } from '@/frontend/lib/api'

/** Baut `initialProfile` (v1) aus dem Telefonbuch — für Boss-Export / Handoff. */
export function buildInitialProfileFromDirectory(
  directory: Record<string, ContactMeshEntryClient>,
  opts?: { deploymentChannelTag?: string; offlineBriefing?: string }
): Record<string, unknown> {
  const contacts = Object.entries(directory)
    .filter(([addr]) => /^0x[a-fA-F0-9]{64}$/i.test(addr.trim()))
    .map(([addr, entry]) => {
      const name = (entry.label?.trim() || 'Partner').slice(0, 120)
      const roleTags = Array.isArray(entry.roleTags)
        ? entry.roleTags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
        : []
      return {
        name,
        address: addr.trim().toLowerCase(),
        ...(roleTags.length ? { roleTags } : {}),
      }
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'de'))

  const out: Record<string, unknown> = { version: 1, contacts }
  const tag = opts?.deploymentChannelTag?.trim()
  if (tag) out.deploymentChannelTag = tag.slice(0, 120)
  const ob = opts?.offlineBriefing?.trim()
  if (ob) out.offlineBriefing = ob.slice(0, 2000)
  return out
}

export function downloadInitialProfileJson(profile: Record<string, unknown>, filename = 'einsatz-kontakte.json'): void {
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
