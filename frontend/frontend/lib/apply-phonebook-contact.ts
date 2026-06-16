import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { isIotaWalletAddress } from '@/frontend/lib/contact-storage-key'
import type { ActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'
import { inboxPartnerKeyForContact } from '@/frontend/lib/contact-send-path'

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
  setEncrypted?: (v: boolean) => void
  setForcedTransport?: (t: 'internet' | 'mesh' | 'adhoc') => void
  setComposerDelivery?: (d: 'chain' | 'telegram') => void
}

export type ConfigureComposerForContactOpts = {
  handshakeReady?: boolean
  preferEncryptedWhenReady?: boolean
  /** Aktueller Sendepfad — Transport wird nicht gewechselt. */
  activeSendPath?: ActiveSendPath
}

/** Übernimmt Erreichbarkeiten passend zum aktiven Sendepfad in den Composer. */
export function applyPhonebookContactToComposer(
  storageKey: string,
  entry: ContactMeshEntryClient,
  targets: ApplyPhonebookContactTargets,
  opts?: ConfigureComposerForContactOpts
): ParsedPhonebookContact {
  const c = parsePhonebookContact(storageKey, entry)
  const path: ActiveSendPath = opts?.activeSendPath ?? 'internet'

  targets.selectInboxPartnerForSend?.(inboxPartnerKeyForContact(storageKey, entry))

  switch (path) {
    case 'telegram':
      if (c.telegramChatId) {
        targets.setRecipient(`tg:${c.telegramChatId}`)
        targets.setPartner('')
      }
      break
    case 'mesh':
      if (c.iotaAddress) targets.setPartner(c.iotaAddress)
      targets.setRecipient('')
      if (c.meshNodeId) {
        targets.setMeshPlaintextNodeId(c.meshNodeId)
        targets.setMeshPlaintextToNodeEnabled(true)
      }
      break
    case 'adhoc':
      if (c.iotaAddress) {
        targets.setPartner(c.iotaAddress)
        targets.setRecipient('')
      }
      if (c.bleUuid) targets.setContactBleUuid(c.bleUuid)
      break
    case 'internet':
    default:
      if (c.iotaAddress) {
        targets.setPartner(c.iotaAddress)
        targets.setRecipient(c.iotaAddress)
        if (opts?.preferEncryptedWhenReady !== false && opts?.handshakeReady) {
          targets.setEncrypted?.(true)
        }
      } else if (c.telegramChatId) {
        targets.setRecipient(`tg:${c.telegramChatId}`)
        targets.setPartner('')
      } else {
        targets.setRecipient('')
        targets.setPartner('')
      }
      break
  }

  if (path !== 'mesh' && c.meshNodeId) {
    targets.setMeshPlaintextNodeId(c.meshNodeId)
  }

  return c
}
