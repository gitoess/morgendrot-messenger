'use client'

import { toast } from 'sonner'
import { fetchStatus, vaultSave } from '@/frontend/lib/api'
import { getIncludeSdkMnemonicInBackup } from '@/frontend/lib/vault-sdk-mnemonic-preference'

export type LocalVaultSaveOfferReason =
  | 'handshake'
  | 'connect'
  | 'notes'
  | 'secrets'
  | 'seed'

const REASON_HINT: Record<LocalVaultSaveOfferReason, string> = {
  handshake: 'Handshake-Keys liegen nur im RAM.',
  connect: 'Connect-Keys liegen nur im RAM.',
  notes: 'Notizen sind nur in der Sitzung — noch nicht dauerhaft in der Tresor-Datei.',
  secrets: 'Passwort-Einträge sind nur in der Sitzung — noch nicht dauerhaft in der Tresor-Datei.',
  seed: 'Wallet-Seed soll in die Tresor-Datei — bitte einmal sichern.',
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
    const includeSeed = getIncludeSdkMnemonicInBackup()
    const r = await vaultSave(undefined, undefined, {
      includeIotaMnemonic: includeSeed,
    })
    if (r.ok) {
      toast.success(typeof r.message === 'string' && r.message.trim() ? r.message : 'Tresor gesichert.')
    } else {
      toast.error(r.error || r.message || 'Tresor sichern fehlgeschlagen.')
    }
  } finally {
    saving = false
  }
}

/** Toast mit Aktion „Tresor sichern“ — nur wenn Tresor entsperrt und Keys im RAM. */
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

    toast.message('Tresor sichern?', {
      description: `${REASON_HINT[reason]} Sonst nach Neustart/Abmelden weg.`,
      duration: 22_000,
      action: {
        label: 'Tresor sichern',
        onClick: () => {
          void runLocalVaultSave()
        },
      },
    })
  })()
}
