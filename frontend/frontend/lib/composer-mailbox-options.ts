import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import type { ActiveSendMailbox } from '@/frontend/lib/my-mailbox-active'
import { readMyPrivateMailboxes } from '@/frontend/lib/my-private-mailbox-store'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'

export type ComposerMailboxOption = {
  objectId: string
  label: string
}

function pushUnique(
  out: ComposerMailboxOption[],
  seen: Set<string>,
  objectId: string,
  label: string
) {
  const id = objectId.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/i.test(id) || seen.has(id)) return
  seen.add(id)
  out.push({ objectId: id, label })
}

export function buildComposerMailboxOptions(p: {
  serverMailboxId?: string
  activeSend?: ActiveSendMailbox
  contactDirectory?: Record<string, ContactMeshEntryClient>
}): ComposerMailboxOption[] {
  const out: ComposerMailboxOption[] = []
  const seen = new Set<string>()

  const server = (p.serverMailboxId ?? '').trim()
  if (/^0x[a-fA-F0-9]{64}$/i.test(server)) {
    pushUnique(out, seen, server, `Server-Postfach · ${maskWalletAddress(server, 8, 6)}`)
  }

  const active = p.activeSend
  if (active && active.kind !== 'none') {
    const kindLabel = active.kind === 'team' ? 'Aktiv (Team)' : 'Aktiv (Privat)'
    pushUnique(out, seen, active.objectId, `${kindLabel} · ${maskWalletAddress(active.objectId, 8, 6)}`)
  }

  for (const e of readMyTeamMailboxes()) {
    const lab = e.label?.trim() || 'Team-Mailbox'
    pushUnique(out, seen, e.objectId, `Team · ${lab} · ${maskWalletAddress(e.objectId, 8, 6)}`)
  }

  for (const e of readMyPrivateMailboxes()) {
    const lab = e.label?.trim() || 'Private Mailbox'
    pushUnique(out, seen, e.objectId, `Privat · ${lab} · ${maskWalletAddress(e.objectId, 8, 6)}`)
  }

  const dir = p.contactDirectory ?? {}
  for (const [addr, entry] of Object.entries(dir)) {
    const slots = [
      entry.mailboxObjectId,
      entry.mailboxSharedId,
      entry.mailboxPrivateId,
      entry.mailboxTeamId,
      entry.mailboxBufferId,
    ]
    const name = contactDisplayLabel(dir, addr) || maskWalletAddress(addr, 8, 6)
    for (const mb of slots) {
      const id = (mb ?? '').trim()
      if (!id) continue
      pushUnique(out, seen, id, `Kontakt ${name} · ${maskWalletAddress(id, 8, 6)}`)
    }
  }

  return out.sort((a, b) => a.label.localeCompare(b.label, 'de'))
}
