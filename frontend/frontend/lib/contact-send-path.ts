import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { parsePhonebookContact } from '@/frontend/lib/apply-phonebook-contact'
import { lookupContactEntry } from '@/frontend/lib/contact-display'
import type { InboxPartnerOption } from '@/frontend/components/chat-view-inbox-partner-strip'
import type { ActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'
import { isDisplayableContactStorageKey } from '@/frontend/lib/contact-storage-key'

export function contactReachableOnSendPath(
  storageKey: string,
  entry: ContactMeshEntryClient | undefined,
  path: ActiveSendPath
): boolean {
  const c = parsePhonebookContact(storageKey, entry ?? { label: '' })
  switch (path) {
    case 'internet':
      return Boolean(c.iotaAddress)
    case 'telegram':
      return Boolean(c.telegramChatId)
    case 'mesh':
      return Boolean(c.meshNodeId)
    case 'adhoc':
      return Boolean(c.bleUuid)
    default:
      return false
  }
}

/** Schlüssel für Posteingangs-1:1-Filter (IOTA bevorzugt, sonst tg:/…). */
export function inboxPartnerKeyForContact(storageKey: string, entry?: ContactMeshEntryClient): string {
  const c = parsePhonebookContact(storageKey, entry ?? { label: '' })
  return c.iotaAddress ?? c.storageKey
}

export type SendPathContactRow = {
  storageKey: string
  entry?: ContactMeshEntryClient
}

export function collectContactsForSendPath(p: {
  directory: Record<string, ContactMeshEntryClient>
  partnerOptions: readonly InboxPartnerOption[]
  path: ActiveSendPath
  hidden?: ReadonlySet<string>
}): SendPathContactRow[] {
  const hidden = p.hidden ?? new Set<string>()
  const byKey = new Map<string, ContactMeshEntryClient | undefined>()

  for (const [addr, entry] of Object.entries(p.directory)) {
    const key = addr.trim().toLowerCase()
    if (!key || hidden.has(key) || !isDisplayableContactStorageKey(key)) continue
    byKey.set(key, entry)
  }

  const rows: SendPathContactRow[] = []
  for (const [storageKey, entry] of byKey) {
    const resolved = entry ?? lookupContactEntry(p.directory, storageKey)
    if (contactReachableOnSendPath(storageKey, resolved, p.path)) {
      rows.push({ storageKey, entry: resolved })
    }
  }

  return rows.sort((a, b) => {
    const la = (lookupContactEntry(p.directory, a.storageKey)?.label ?? a.storageKey).toLowerCase()
    const lb = (lookupContactEntry(p.directory, b.storageKey)?.label ?? b.storageKey).toLowerCase()
    return la.localeCompare(lb, 'de')
  })
}

export function sidebarAllSubtitleForSendPath(path: ActiveSendPath, contactCount: number): string {
  switch (path) {
    case 'telegram':
      return contactCount > 0
        ? `${contactCount} Telegram-Empfänger — alle eintragen`
        : 'Alle Telegram-Chat-IDs eintragen'
    case 'mesh':
      return contactCount > 0
        ? `${contactCount} Funk-Kontakte — Broadcast (nicht 1:1-Node)`
        : 'Funk-Broadcast (kein Ziel-Node)'
    case 'adhoc':
      return contactCount > 0
        ? `${contactCount} BLE-Kontakte`
        : 'Alle Ad-hoc-Kontakte'
    default:
      return contactCount > 0
        ? `${contactCount} IOTA-Adressen — alle eintragen (PTB pro Empfänger beim Senden)`
        : 'Alle IOTA-Empfänger eintragen'
  }
}

export function formatAllRecipientsForSendPath(
  contacts: readonly SendPathContactRow[],
  path: ActiveSendPath
): {
  recipient: string
  partner: string
  meshPlaintextNodeId: string
  meshPlaintextToNodeEnabled: boolean
} {
  const iotaAddrs: string[] = []
  const tgIds: string[] = []

  for (const { storageKey, entry } of contacts) {
    const c = parsePhonebookContact(storageKey, entry ?? { label: '' })
    if (c.iotaAddress) iotaAddrs.push(c.iotaAddress)
    if (c.telegramChatId) tgIds.push(c.telegramChatId)
  }

  switch (path) {
    case 'telegram':
      return {
        recipient: tgIds.map((id) => `tg:${id}`).join(', '),
        partner: '',
        meshPlaintextNodeId: '',
        meshPlaintextToNodeEnabled: false,
      }
    case 'mesh':
      return {
        recipient: '',
        partner: iotaAddrs[0] ?? '',
        meshPlaintextNodeId: '',
        meshPlaintextToNodeEnabled: false,
      }
    case 'adhoc':
      return {
        recipient: '',
        partner: iotaAddrs[0] ?? '',
        meshPlaintextNodeId: '',
        meshPlaintextToNodeEnabled: false,
      }
    default:
      return {
        recipient: iotaAddrs.join(', '),
        partner: iotaAddrs[0] ?? '',
        meshPlaintextNodeId: '',
        meshPlaintextToNodeEnabled: false,
      }
  }
}
