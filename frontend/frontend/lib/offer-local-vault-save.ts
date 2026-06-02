'use client'

import { toast } from 'sonner'
import { fetchStatus, vaultSave } from '@/frontend/lib/api'

export type LocalVaultSaveOfferReason = 'handshake' | 'connect'

const REASON_HINT: Record<LocalVaultSaveOfferReason, string> = {
  handshake: 'nach Handshake',
  connect: 'nach Verbindung (Connect)',
}

const lastByReason = new Map<LocalVaultSaveOfferReason, number>()
let lastAny = 0
let saving = false

/** Gleicher Grund: max. ein Toast pro 90 s. Verschiedene Gründe: min. 12 s Abstand. */
const DEDUPE_SAME_MS = 90_000
const DEDUPE_GLOBAL_MS = 12_000

async function runLocalVaultSave(): Promise<void> {
  if (saving) return
  saving = true
  try {
    const r = await vaultSave()
    if (r.ok) {
      toast.success(typeof r.message === 'string' && r.message.trim() ? r.message : 'Lokal gesichert.')
    } else {
      toast.error(r.error || r.message || 'Lokal sichern fehlgeschlagen.')
    }
  } finally {
    saving = false
  }
}

/** Toast mit Aktion „Lokal sichern“ — nur wenn Tresor entsperrt und Keys im RAM. */
export function offerLocalVaultSave(reason: LocalVaultSaveOfferReason): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (now - lastAny < DEDUPE_GLOBAL_MS) return
  const lastReason = lastByReason.get(reason) ?? 0
  if (now - lastReason < DEDUPE_SAME_MS) return

  void (async () => {
    let status: Awaited<ReturnType<typeof fetchStatus>>
    try {
      status = await fetchStatus()
    } catch {
      return
    }
    if (!('pollClockHint' in status)) return
    if (status.locked || status.hasKeys !== true) return

    lastAny = Date.now()
    lastByReason.set(reason, lastAny)

    toast.message('Tresor lokal sichern?', {
      description: `Änderungen ${REASON_HINT[reason]} liegen nur im Arbeitsspeicher. Jetzt in die Vault-Datei schreiben?`,
      duration: 22_000,
      action: {
        label: 'Lokal sichern',
        onClick: () => {
          void runLocalVaultSave()
        },
      },
    })
  })()
}
