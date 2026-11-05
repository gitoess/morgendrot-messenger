import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  CONTACT_MAILBOX_SLOT_LABELS,
  resolveContactMailboxSlots,
  type ContactMailboxSlotId,
} from '@/frontend/lib/contact-mailbox-slots'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'

export type ComposerMailboxRecipientHint =
  | { show: false }
  | {
      show: true
      tone: 'mismatch' | 'unknown'
      message: string
      detail: string
    }

/** Warnt, wenn Composer-Mailbox-ID nicht zu den Telefonbuch-Postfächern des Empfängers passt. */
export function getComposerMailboxRecipientHint(p: {
  recipientAddress: string
  composerMailboxObjectId: string
  contactDirectory?: Record<string, ContactMeshEntryClient>
}): ComposerMailboxRecipientHint {
  const mb = p.composerMailboxObjectId.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(mb)) return { show: false }

  const to = p.recipientAddress.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(to)) return { show: false }

  const entry = p.contactDirectory?.[to]
  if (!entry) {
    return {
      show: true,
      tone: 'unknown',
      message: 'Empfänger nicht im Telefonbuch.',
      detail:
        'Prüfen, ob der Partner diese Mailbox überhaupt lädt — sonst sieht er die Nachricht im Posteingang nicht.',
    }
  }

  const slots = resolveContactMailboxSlots(to, entry)
  const known = Object.entries(slots) as [ContactMailboxSlotId, string][]
  if (known.length === 0) {
    return {
      show: true,
      tone: 'unknown',
      message: 'Für diesen Kontakt ist keine Mailbox im Telefonbuch hinterlegt.',
      detail:
        'Nachricht kann on-chain landen, der Partner findet sie evtl. nicht. Im Telefonbuch eine Mailbox zuordnen oder „Standard (Event)“ wählen.',
    }
  }

  if (known.some(([, id]) => id === mb)) return { show: false }

  const list = known
    .map(([slot, id]) => `${CONTACT_MAILBOX_SLOT_LABELS[slot]} ${maskWalletAddress(id, 8, 6)}`)
    .join(' · ')
  return {
    show: true,
    tone: 'mismatch',
    message: 'Gewählte Mailbox passt nicht zu den Postfächern dieses Kontakts im Telefonbuch.',
    detail: `Hinterlegt: ${list}. Gewählt: ${maskWalletAddress(mb, 8, 6)}.`,
  }
}
