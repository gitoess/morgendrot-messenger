/** Hilfetexte für .env-Keys in den Einstellungen (Messenger). */

export type ConfigFieldInputKind = 'text' | 'bool' | 'select'

export type ConfigFieldMeta = {
  description: string
  deployHint?: string
  inputKind?: ConfigFieldInputKind
  selectOptions?: { value: string; label: string }[]
  /** In Messenger-Einstellungen ausblenden (Legacy oder oben schon editierbar). */
  hiddenInMessenger?: boolean
  deprecated?: boolean
}

const ROLE_OPTIONS = [
  { value: 'boss', label: 'Boss (Einsatzleitung)' },
  { value: 'kommandant', label: 'Kommandant' },
  { value: 'arbeiter', label: 'Arbeiter / Helfer' },
  { value: 'messenger', label: 'Messenger (Standard)' },
  { value: 'lock', label: 'Lock (M2M-Schloss)' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'waerter', label: 'Wächter' },
] as const

const SIGNER_OPTIONS = [
  { value: 'sdk', label: 'sdk (Mnemonic im Vault)' },
  { value: 'cli', label: 'cli (IOTA-CLI)' },
  { value: 'remote', label: 'remote (Remote-Signer)' },
] as const

const TRUST_TIER_OPTIONS = [
  { value: '1', label: '1 — öffentliche RPC-Nodes' },
  { value: '2', label: '2 — kuratierte Liste' },
  { value: '3', label: '3 — eigener Node' },
] as const

const UI_VARIANT_OPTIONS = [
  { value: 'messenger', label: 'messenger (schlank)' },
  { value: 'full', label: 'full (mehr Panels)' },
] as const

const TRANSPORT_PROFILE_OPTIONS = [
  { value: 'mesh-first', label: 'mesh-first (Funk zuerst)' },
  { value: 'iota-anchored', label: 'iota-anchored' },
  { value: 'iota-full', label: 'iota-full' },
] as const

const MESSENGER_EDITION_OPTIONS = [
  { value: 'standalone', label: 'standalone' },
  { value: 'sales', label: 'sales (Kunden-UI)' },
] as const

/** Keys, die im Messenger oben schon als eigene Zeile stehen. */
export const CONFIG_KEYS_EDITED_ABOVE = new Set(['RPC_URL', 'PACKAGE_ID'])

/** Legacy /connect — im Messenger durch Telefonbuch ersetzt. */
export const CONFIG_KEYS_LEGACY_PARTNER = new Set([
  'PARTNER_ADDRESS',
  'PARTNER_ADDRESS_FILE',
  'PARTNER_ADDRESSES',
])

/**
 * .env-Keys, die in Messenger-Einstellungen sichtbar sind.
 * Alles andere (Shop/Tickets, Lock, Monitor, Stripe, …) nur im Morgendrot Projekt.
 * Unbekannte Keys aus dem Backend: standardmäßig aus (fail-closed).
 */
export const CONFIG_KEYS_MESSENGER = new Set([
  // IOTA / Kette
  'RPC_URLS',
  'RPC_HTTP_PROXY',
  'RPC_SOCKS_PROXY',
  'NETWORK_TRUST_TIER',
  'MAILBOX_ID',
  'MY_ADDRESS',
  'VAULT_REGISTRY_ID',
  'DEFAULT_TTL_DAYS',
  'DEFAULT_KEY_TTL_DAYS',
  // Rolle & Signer
  'ROLE',
  'ROLE_ID',
  'SIGNER',
  'REMOTE_SIGNER_URL',
  'REMOTE_SIGNER_TOKEN',
  'BOSS_SIGNER_PUBLIC_URL',
  'WALLET_DERIVATION_PATH',
  'ENABLE_HD_CONTACT_ADDRESSES',
  // Mailbox / Chat / Vertraulichkeit
  'USE_MAILBOX',
  'MAILBOX_STORE_PLAINTEXT',
  'ENABLE_PLAINTEXT_CHANNEL',
  'ENABLE_PURGE',
  'USE_ENCRYPTED_DISCOVERY',
  'ENABLE_PAIRWISE_GROUPS',
  'ENABLE_BROADCAST_PINNWAND',
  'BROADCAST_PINNWAND_ADDRESS',
  'BROADCAST_AUTHORIZED_SENDERS',
  // Einsatz-Hierarchie (Telefonbuch / Boss)
  'BOSS_ADDRESS',
  'KOMMANDANT_ADDRESSES',
  'WORKER_ADDRESSES',
  'DEVICE_ROLES',
  'DEVICE_NAMES',
  'ENABLE_COMMAND_DOWN',
  'ENABLE_KEY_ISSUE',
  'ENABLE_REVOKE_DOWN',
  'ENABLE_STATUS_READ_DOWN',
  'ENABLE_STATUS_READ_UP',
  'ENABLE_CONFIG_CHANGE',
  'ENABLE_HIERARCHY_CHANGE',
  // Listener / Handshake
  'ENABLE_LISTENER',
  'FETCH_LAST_ON_START',
  'ENABLE_FETCH_COMMAND',
  'LISTENER_POLL_MS',
  'HANDSHAKE_REFRESH_MS',
  'ENABLE_REPLAY_PROTECTION',
  'REPLAY_STATE_FILE',
  'ENABLE_AUTO_EXECUTE',
  'AUTHORIZED_SENDERS',
  'MAX_SEND_AMOUNT_IOTA',
  // Streams / Puls (optional)
  'OPEN_STREAMS_ENABLED',
  'STREAMS_ANCHOR_ID',
  'STREAMS_TOPIC',
  'STREAMS_LISTEN_ENABLED',
  'STREAMS_BRIDGE_URL',
  'ENABLE_HEARTBEAT',
  'HEARTBEAT_INTERVAL_MS',
  // Tresor
  'VAULT_FILE',
  // Gas / Credits / Messenger-Policy
  'GAS_BUDGET',
  'SPONSOR_GAS_OWNER',
  'SPONSORED_TRANSACTION_ENABLED',
  'MESSENGER_AUTO_SPONSOR',
  'MESSENGER_LICENSE_NFT_OBJECT_ID',
  'MESSENGER_CREDITS_OBJECT_ID',
  'PAIRING_GATE_NFT_OBJECT_ID',
  'VERIFIED_IOTA_NAME_PACKAGE_IDS',
  'MESSENGER_GAS_STATE_FILE',
  'IOTA_GAS_STATION_URL',
  'SHADOW_SWEEP_GAS_RESERVE_MIST',
  'GAS_STATION_ENABLED',
  'GAS_STATION_MIN_IOTA',
  'GAS_STATION_TOPUP_IOTA',
  // Deployment / UI-Profil (Backend)
  'UI_VARIANT',
  'MESSENGER_EDITION',
  'DEPLOYMENT_PROFILE',
  'TRANSPORT_PROFILE',
  'SIMPLE_MODE',
])

const META: Record<string, ConfigFieldMeta> = {
  RPC_URL: {
    description:
      'Primäre IOTA-Fullnode (HTTPS). Alle Chain-Abfragen und Submits laufen darüber, sofern keine Rotation greift.',
    deployHint: 'Runtime-Key: gilt sofort nach „Setzen“. Kein Move-Deploy nötig.',
  },
  RPC_URLS: {
    description:
      'Zusätzliche Fullnode-URLs (kommagetrennt) für Fallback/Rotation. RPC_URL bleibt der erste Eintrag.',
    deployHint: 'Kein Move-Deploy. Backend ggf. neu starten, wenn nicht als Runtime markiert.',
  },
  RPC_HTTP_PROXY: {
    description: 'HTTP-Proxy für RPC (selten). Tor meist über RPC_SOCKS_PROXY.',
  },
  RPC_SOCKS_PROXY: {
    description: 'SOCKS-Proxy für RPC, z. B. socks5://127.0.0.1:9050 (Tor).',
    deployHint: 'Gilt in der Regel sofort — kein Move-Deploy.',
  },
  NETWORK_TRUST_TIER: {
    description: 'Vertrauensstufe der RPC-Quelle (Hinweis in der UI, kein Krypto-Schutz allein).',
    inputKind: 'select',
    selectOptions: [...TRUST_TIER_OPTIONS],
  },
  PACKAGE_ID: {
    description: 'Deployte Move-Package-ID (0x…). Messenger, Mailbox und Handshake nutzen dieses Paket.',
    deployHint:
      'Neu nur nach Move-Deploy. Danach PACKAGE_ID setzen und ggf. create_globals / MAILBOX_ID nachziehen.',
  },
  MAILBOX_ID: {
    description: 'Shared Server-Postfach (Object-ID). Posteingang und Klartext-Mailbox auf der Kette.',
    deployHint: 'Kommt aus create_globals nach Deploy — nicht mit jeder .env-Änderung neu deployen.',
  },
  MY_ADDRESS: {
    description: 'Eigene Wallet-/Objekt-Adresse (0x…). Wird oft aus Vault/Unlock abgeleitet.',
  },
  ROLE: {
    description: 'Geräterolle: steuert UI, Berechtigungen und Default-Transport.',
    inputKind: 'select',
    selectOptions: [...ROLE_OPTIONS],
    deployHint: 'Runtime möglich. Kein Move-Deploy — nur Verhalten der Node/UI.',
  },
  SIGNER: {
    description: 'Wo signiert wird: Vault-SDK, CLI oder Remote-Signer.',
    inputKind: 'select',
    selectOptions: [...SIGNER_OPTIONS],
    deployHint: 'Runtime-Key. Kein Move-Deploy.',
  },
  USE_MAILBOX: {
    description: 'Mailbox-Persistenz auf der Kette aktiv (statt nur Events).',
    inputKind: 'bool',
    deployHint: 'Runtime-Key. Paket muss Mailbox-Funktionen enthalten (bereits deployt).',
  },
  MAILBOX_STORE_PLAINTEXT: {
    description: 'Klartext in der Mailbox speichern (store_plaintext_message).',
    inputKind: 'bool',
  },
  ENABLE_PLAINTEXT_CHANNEL: {
    description: 'Klartext-Kanal (/send-plain) erlauben.',
    inputKind: 'bool',
  },
  ENABLE_PURGE: {
    description: 'On-chain Purge/Rebate für Mailbox-Nachrichten erlauben.',
    inputKind: 'bool',
  },
  STREAMS_ANCHOR_ID: {
    description:
      'IOTA-Streams-Kanal-ID (0x…) — nur Puls/Monitor/Live-Hinweis, nicht der Chat-Posteingang.',
  },
  STREAMS_BRIDGE_URL: {
    description: 'HTTP-Bridge für Streams (z. B. Mock oder LoRa-Gateway). Leer = Stub.',
  },
  OPEN_STREAMS_ENABLED: {
    description: 'Streams für Lock/Open-Befehle nutzen.',
    inputKind: 'bool',
  },
  ENABLE_HEARTBEAT: {
    description: 'Periodischer Heartbeat an STREAMS_ANCHOR_ID (Gerät lebt).',
    inputKind: 'bool',
  },
  PARTNER_ADDRESS: {
    description: 'Legacy: Default-Partner für Lite-UI /connect. Im Messenger: Telefonbuch + Handshake.',
    deprecated: true,
    hiddenInMessenger: true,
  },
  PARTNER_ADDRESS_FILE: {
    description: 'Legacy: Datei für PARTNER_ADDRESS. Im Messenger nicht nötig.',
    deprecated: true,
    hiddenInMessenger: true,
  },
  PARTNER_ADDRESSES: {
    description: 'Legacy: mehrere Partner für /connect. Im Messenger: Kontakte/Gruppen.',
    deprecated: true,
    hiddenInMessenger: true,
  },
  VAULT_REGISTRY_ID: {
    description: 'On-Chain Vault-Registry (0x…) aus create_globals — für Vault-Blobs pro Adresse.',
    deployHint: 'Nach Deploy setzen, nicht pro Handoff neu deployen.',
  },
  DEFAULT_TTL_DAYS: {
    description: 'Standard-Gültigkeit für Nachrichten, Handshake und Vault-Einträge (Tage).',
  },
  DEFAULT_KEY_TTL_DAYS: {
    description: 'Standard-Gültigkeit für ausgestellte AccessKey-NFTs (Tage).',
  },
  ROLE_ID: {
    description:
      'Berechtigungs-Bitmaske 0–63 (D·LW·BW·L·S·P). Export-Assistent und Handoff — siehe Handbuch ROLE_ID.',
    deployHint: 'Runtime-Key. Kein Move-Deploy.',
  },
  REMOTE_SIGNER_URL: {
    description: 'URL des Remote-Signer-Dienstes — nur bei SIGNER=remote.',
  },
  REMOTE_SIGNER_TOKEN: {
    description: 'Bearer-Token für REMOTE_SIGNER_URL. Nie in Handoff-ZIPs legen.',
  },
  BOSS_SIGNER_PUBLIC_URL: {
    description: 'Öffentliche Basis-URL des Boss-Signer-Services (Anzeige/Peering).',
  },
  WALLET_DERIVATION_PATH: {
    description: 'HD-Ableitungspfad für SIGNER=sdk. Leer = Standard-Pfad.',
  },
  ENABLE_HD_CONTACT_ADDRESSES: {
    description: 'Kontakt-Wallets per HD aus Master ableiten (experimentell).',
    inputKind: 'bool',
  },
  USE_ENCRYPTED_DISCOVERY: {
    description: 'Discovery über verschlüsselte Kanäle (geplant, selten aktiv).',
    inputKind: 'bool',
  },
  ENABLE_PAIRWISE_GROUPS: {
    description: 'Gruppenchat mit pairwise Handshake pro Mitglied (teurer, sicherer).',
    inputKind: 'bool',
  },
  ENABLE_BROADCAST_PINNWAND: {
    description: 'Pinnwand per IOTA-Broadcast aktivieren.',
    inputKind: 'bool',
  },
  BROADCAST_PINNWAND_ADDRESS: {
    description: 'Zieladresse der Pinnwand (0x…), wenn Broadcast aktiv.',
  },
  BROADCAST_AUTHORIZED_SENDERS: {
    description: 'Kommagetrennte 0x-Adressen — nur diese dürfen an die Pinnwand schreiben.',
  },
  BOSS_ADDRESS: {
    description: 'Wallet-Adresse der Einsatzleitung (0x + 64 Hex) — Hierarchie und Handoff.',
  },
  KOMMANDANT_ADDRESSES: {
    description: 'Kommandanten-Adressen (kommagetrennt) im Ameisen-/Einsatz-Modell.',
  },
  WORKER_ADDRESSES: {
    description: 'Arbeiter-Adressen (kommagetrennt) im Einsatz-Modell.',
  },
  DEVICE_ROLES: {
    description: 'JSON-Zuordnung Gerät → Rolle (erweiterte Hierarchie).',
  },
  DEVICE_NAMES: {
    description: 'JSON oder Zuordnung Anzeigenamen für Geräte.',
  },
  ENABLE_COMMAND_DOWN: {
    description: 'Befehle an Untergebene senden (Boss/Kommandant).',
    inputKind: 'bool',
  },
  ENABLE_KEY_ISSUE: {
    description: 'Schlüssel an Untergebene ausstellen (typisch nur Boss).',
    inputKind: 'bool',
  },
  ENABLE_REVOKE_DOWN: {
    description: 'Widerruf/Sperren nach unten in der Hierarchie.',
    inputKind: 'bool',
  },
  ENABLE_STATUS_READ_DOWN: {
    description: 'Status von Untergebenen lesen.',
    inputKind: 'bool',
  },
  ENABLE_STATUS_READ_UP: {
    description: 'Status an Vorgesetzte melden/lesen.',
    inputKind: 'bool',
  },
  ENABLE_CONFIG_CHANGE: {
    description: 'Konfiguration der Hierarchie ändern (typisch Boss).',
    inputKind: 'bool',
  },
  ENABLE_HIERARCHY_CHANGE: {
    description: 'Hierarchie-Struktur ändern (typisch Boss).',
    inputKind: 'bool',
  },
  ENABLE_LISTENER: {
    description: 'Auf Chain-Events hören und reagieren. Aus = kein Empfang.',
    inputKind: 'bool',
    deployHint: 'false = maximale Passivität; für reine Sender-Instanzen.',
  },
  FETCH_LAST_ON_START: {
    description: 'Beim Start die letzten N Nachrichten von der Chain holen (0 = aus).',
  },
  ENABLE_FETCH_COMMAND: {
    description: 'Befehl „letzte N Nachrichten holen“ (/fetch) erlauben.',
    inputKind: 'bool',
  },
  LISTENER_POLL_MS: {
    description: 'Abstand zwischen Event-Abfragen in Millisekunden (min. 1000).',
  },
  HANDSHAKE_REFRESH_MS: {
    description: 'Intervall für Handshake-Aktualisierung (ms).',
  },
  ENABLE_REPLAY_PROTECTION: {
    description: 'Replay-Schutz per Nonce pro Sender (empfohlen).',
    inputKind: 'bool',
  },
  REPLAY_STATE_FILE: {
    description: 'Datei für Nonce-Stand. Leer = nur im Speicher (nach Neustart weg).',
  },
  ENABLE_AUTO_EXECUTE: {
    description:
      'Empfangene Befehle automatisch ausführen. false = nur anzeigen (Kill-Switch). Produktion: oft false.',
    inputKind: 'bool',
  },
  AUTHORIZED_SENDERS: {
    description: 'Zusätzliche 0x-Adressen, die Befehle senden dürfen (kommagetrennt).',
  },
  MAX_SEND_AMOUNT_IOTA: {
    description: 'Obergrenze IOTA pro Sendung. Leer = kein Limit.',
  },
  STREAMS_TOPIC: {
    description: 'Optionales Streams-Topic (wenn Streams aktiv).',
  },
  STREAMS_LISTEN_ENABLED: {
    description: 'Zusätzlich zu Rebased auf Streams „open“ hören.',
    inputKind: 'bool',
  },
  HEARTBEAT_INTERVAL_MS: {
    description: 'Abstand zwischen Heartbeats an STREAMS_ANCHOR_ID (ms).',
  },
  VAULT_FILE: {
    description: 'Pfad zur lokalen Vault-Datei (verschlüsselte Keys), z. B. .morgendrot-vault.',
  },
  GAS_BUDGET: {
    description: 'Gas-Budget pro Transaktion (MIST/Units — Betriebsparameter).',
  },
  SPONSOR_GAS_OWNER: {
    description: '0x-Adresse, die Gas für Untergebene sponsert.',
  },
  SPONSORED_TRANSACTION_ENABLED: {
    description: 'Gesponserte On-Chain-Transaktionen erlauben.',
    inputKind: 'bool',
  },
  MESSENGER_AUTO_SPONSOR: {
    description: 'Messenger sendet mit Auto-Sponsor-Policy (Credits/Lizenz).',
    inputKind: 'bool',
  },
  MESSENGER_LICENSE_NFT_OBJECT_ID: {
    description: 'Object-ID der Messenger-Lizenz-NFT (Gas-Policy).',
  },
  MESSENGER_CREDITS_OBJECT_ID: {
    description: 'Object-ID des Messenger-Credits-Kontos.',
  },
  PAIRING_GATE_NFT_OBJECT_ID: {
    description: 'Object-ID Pairing-Gate-NFT (Freischaltung).',
  },
  VERIFIED_IOTA_NAME_PACKAGE_IDS: {
    description: 'Erlaubte IOTA-Name-Service-Package-IDs (kommagetrennt).',
  },
  MESSENGER_GAS_STATE_FILE: {
    description: 'Persistente Datei für Messenger-Gas-Zähler.',
  },
  IOTA_GAS_STATION_URL: {
    description: 'URL einer IOTA Gas Station (optional).',
  },
  SHADOW_SWEEP_GAS_RESERVE_MIST: {
    description: 'Reserve in MIST für Shadow-Sweep (nicht unterschreiten).',
  },
  GAS_STATION_ENABLED: {
    description: 'Gas-Station-Integration aktiv.',
    inputKind: 'bool',
  },
  GAS_STATION_MIN_IOTA: {
    description: 'Mindest-Guthaben an der Gas Station (IOTA).',
  },
  GAS_STATION_TOPUP_IOTA: {
    description: 'Nachfüll-Betrag Gas Station (IOTA).',
  },
  UI_VARIANT: {
    description: 'UI-Oberfläche: messenger (Einsatz) oder full (mehr Funktionen).',
    inputKind: 'select',
    selectOptions: [...UI_VARIANT_OPTIONS],
    deployHint: 'Handoff setzt oft messenger oder full.',
  },
  MESSENGER_EDITION: {
    description: 'Bundle-Edition: standalone (Plug-and-Play) oder sales.',
    inputKind: 'select',
    selectOptions: [...MESSENGER_EDITION_OPTIONS],
  },
  DEPLOYMENT_PROFILE: {
    description: 'Betriebsprofil, z. B. einsatz — steuert Defaults mit TRANSPORT_PROFILE.',
  },
  TRANSPORT_PROFILE: {
    description: 'Transport-Priorität: Funk (mesh-first), IOTA-anker oder voll online.',
    inputKind: 'select',
    selectOptions: [...TRANSPORT_PROFILE_OPTIONS],
    deployHint: 'Handoff-Presets setzen dies mit.',
  },
  SIMPLE_MODE: {
    description: 'Vereinfachte UI für Helfer (weniger Expert-Flächen).',
    inputKind: 'bool',
  },
}

export const CONFIG_ENV_DEPLOY_INTRO =
  'Die meisten .env-Änderungen betreffen nur die Node (Neustart oder Runtime-Key). Ein neues Move-Deploy brauchst du nur, wenn sich der Smart-Contract-Code ändert — dann neue PACKAGE_ID und ggf. MAILBOX_ID nach create_globals.'

export function getConfigFieldMeta(envKey: string): ConfigFieldMeta {
  const known = META[envKey]
  if (known) return known
  return {
    description: `Konfigurationsschlüssel ${envKey}. Handbuch: ENV-MESSENGER-EINSTELLUNGEN-REFERENZ.md`,
  }
}

export function shouldShowConfigKeyInMessenger(envKey: string, opts?: { showLegacy?: boolean }): boolean {
  if (!envKey || envKey.startsWith('(')) return false
  if (CONFIG_KEYS_EDITED_ABOVE.has(envKey)) return false
  if (CONFIG_KEYS_LEGACY_PARTNER.has(envKey) && !opts?.showLegacy) return false
  const meta = getConfigFieldMeta(envKey)
  if (meta.hiddenInMessenger && !opts?.showLegacy) return false
  return CONFIG_KEYS_MESSENGER.has(envKey)
}

export function resolveConfigInputKind(envKey: string, value: string): ConfigFieldInputKind {
  const meta = getConfigFieldMeta(envKey)
  if (meta.inputKind) return meta.inputKind
  if (value === 'true' || value === 'false') return 'bool'
  return 'text'
}
