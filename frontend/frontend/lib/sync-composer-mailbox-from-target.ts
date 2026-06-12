import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  type ContactSendMailboxTarget,
  readContactSendMailboxTarget,
} from '@/frontend/lib/contact-mailbox-slots'
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'

/** Kontakt-Send-Ziel → Composer-Object-ID (leer = Event). */
export function composerMailboxIdForSendTarget(p: {
  recipientWallet: string
  target: ContactSendMailboxTarget
  contactDirectory?: Record<string, ContactMeshEntryClient>
  serverMailboxId?: string
}): string {
  if (p.target === 'event') return ''
  const wallet = p.recipientWallet.trim().toLowerCase()
  const mb = resolveOutboundMailboxObjectId(
    p.contactDirectory ?? {},
    wallet,
    p.target,
    undefined
  )
  return mb ?? ''
}

/** Liest gespeichertes Kontakt-Ziel oder leitet es aus expliziter Composer-0x ab. */
export function readEffectiveContactSendTarget(
  recipientWallet: string,
  explicitComposerMailboxId: string
): ContactSendMailboxTarget {
  const wallet = recipientWallet.trim().toLowerCase()
  const saved = readContactSendMailboxTarget(wallet)
  if (saved) return saved
  return explicitComposerMailboxId.trim() ? 'own' : 'event'
}
