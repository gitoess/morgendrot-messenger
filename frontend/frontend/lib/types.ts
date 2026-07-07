export type ProjectType = 'chat' | 'lock' | 'monitor' | 'boss' | 'vault' | 'einsatzleitung'

export type ChatVariant = 'private-chat' | 'pinnwand'
export type LockVariant = 'smart-lock' | 'access-key-ticket' | 'payment-trigger'
export type MonitorVariant = 'sensor-central' | 'device-monitor' | 'heartbeat-sender'
export type BossVariant = 'boss-signer' | 'pinnwand-admin'
export type EinsatzleitungVariant = 'einsatzleitung-hub'
export type VaultVariant = 'local-vault' | 'emergency-purge'

export type ProjectVariant =
  | ChatVariant
  | LockVariant
  | MonitorVariant
  | BossVariant
  | EinsatzleitungVariant
  | VaultVariant

export interface Message {
  id: string
  from: string
  content: string
  timestamp: number
  encrypted?: boolean
  /** Bei Boss-Übersicht: an welche Adresse die Nachricht ging („An mich“ vs „An Kommandant“). */
  recipient?: string
  /** Standard: Mailbox/IOTA; LAN-Relay; lokal vom Funk-Stick; Telegram-Journal (§ H.26) */
  source?: 'mailbox' | 'lan' | 'mesh' | 'telegram'
  meshMeta?: { kind: 'v2' | 'text'; fromNodeNum: number; nonce?: number; sosAckDigest?: string }
  /** Kanäle, über die derselbe Inhalt (dedupKey) angekommen ist */
  transports?: ('internet' | 'lan' | 'mesh' | 'adhoc' | 'telegram')[]
  /** Inhalt + Absender + Zeitfenster – für Zusammenführung IOTA+Funk */
  dedupKey?: string
  /** Mailbox-Nonce (String), nur bei chain-gespeicherten Nachrichten – für /purge-msg */
  chainNonce?: string
  /** true: Nachricht liegt im Rebased-Mailbox-Objekt und kann on-chain gepurgt werden */
  chainPurgeable?: boolean
  /** Optional: IOTA-TX-Digest (Tangle-Inventar, API oder Manifest). */
  chainTxDigest?: string
  /** pairwise = 1:1 MsgKey; team-broadcast = TeamPlainBroadcastKey */
  chainPurgeKind?: 'pairwise' | 'team-broadcast'
  /** Wire hatte [[MORG_PINNWAND_V1]] — bleibt gesetzt, auch wenn UI-Marker entfernt wird. */
  pinnwandPost?: boolean
  /** Ausgehende Telegram-Broadcasts: alle tg:-Empfänger einer zusammengeführten Zeile. */
  telegramRecipients?: string[]
}

export interface KeyData {
  id: string
  lockAddress?: string
  owner?: string
  validUntil?: number
}

export interface TicketData {
  id: string
  eventId?: string
  owner?: string
  validFrom?: number
  validUntil?: number
  used?: boolean
}

export interface DeviceStatus {
  id: string
  name: string
  address: string
  lastSeen: number
  status: 'online' | 'offline' | 'warning'
}

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  /** `/inbox`: weitere Zeilen auf der Chain (Pagination). */
  hasMore?: boolean
  /** Viele /api/command-Antworten liefern Text hier statt in `error`. */
  message?: string
  error?: string
  txDigest?: string
  /** z. B. `/fetch` — Dashboard-Inbox (`frontend/components/inbox.tsx`). */
  messages?: Array<{
    sender: string
    text: string
    isPlain?: boolean
    nonce?: number
  }>
}

export interface QuickAction {
  id: string
  label: string
  description: string
  icon: string
  command: string
  fields?: FormField[]
}

export interface FormField {
  name: string
  label: string
  placeholder?: string
  type?: 'text' | 'number' | 'textarea' | 'select'
  required?: boolean
  options?: { value: string; label: string }[]
}
