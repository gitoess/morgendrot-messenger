import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { isIotaWalletAddress } from '@/frontend/lib/contact-storage-key'

export type ParsedPhonebookContact = {
  storageKey: string
  label: string
  iotaAddress: string | null
  telegramChatId: string | null
  meshNodeId: string | null
  mailboxObjectId: string | null
  bleUuid: string | null
}

/** Kontakt aus Telefonbuch-Schlüssel + Eintrag in Composer-Felder aufteilen. */
export function parsePhonebookContact(
  storageKey: string,
  entry: ContactMeshEntryClient
): ParsedPhonebookContact {
  const key = storageKey.trim().toLowerCase()
  const label = (entry.label ?? '').trim() || 'Kontakt'
  let iotaAddress: string | null = isIotaWalletAddress(key) ? key : null
  let telegramChatId = entry.telegramChatId?.trim() || null
  if (key.startsWith('tg:')) {
    telegramChatId = telegramChatId || key.slice(3)
  }
  return {
    storageKey: key,
    label,
    iotaAddress,
    telegramChatId,
    meshNodeId: entry.meshNodeId?.trim() || null,
    mailboxObjectId: entry.mailboxObjectId?.trim() || null,
    bleUuid: entry.bleUuid?.trim() || null,
  }
}

export type ApplyPhonebookContactTargets = {
  setPartner: (v: string) => void
  setRecipient: (v: string) => void
  setMeshPlaintextNodeId: (v: string) => void
  setMeshPlaintextToNodeEnabled: (v: boolean) => void
  setContactBleUuid: (v: string) => void
  selectInboxPartnerForSend?: (address: string) => void
}

/** Übernimmt alle hinterlegten Erreichbarkeiten in den Messenger-Composer. */
export function applyPhonebookContactToComposer(
  storageKey: string,
  entry: ContactMeshEntryClient,
  targets: ApplyPhonebookContactTargets
): ParsedPhonebookContact {
  const c = parsePhonebookContact(storageKey, entry)

  if (c.iotaAddress) {
    targets.setPartner(c.iotaAddress)
    targets.setRecipient(c.iotaAddress)
    targets.selectInboxPartnerForSend?.(c.iotaAddress)
  } else if (c.telegramChatId) {
    targets.setRecipient(`tg:${c.telegramChatId}`)
    targets.setPartner('')
  } else {
    targets.setRecipient('')
    targets.setPartner('')
  }

  if (c.meshNodeId) {
    targets.setMeshPlaintextNodeId(c.meshNodeId)
    targets.setMeshPlaintextToNodeEnabled(true)
  }

  if (c.bleUuid) {
    targets.setContactBleUuid(c.bleUuid)
  }

  return c
}
