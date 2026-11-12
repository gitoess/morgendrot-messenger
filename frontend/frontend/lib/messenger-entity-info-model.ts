/**
 * Read-only technische Infofelder für Chat / Gruppe / Telegram / NFT.
 * Secrets (Team-Key-Material, Bot-Token Klartext, Vault-PW) gehören hier nicht hin.
 */

import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  CONTACT_MAILBOX_SLOT_IDS,
  CONTACT_MAILBOX_SLOT_LABELS,
  readContactMailboxSlots,
  type ContactMailboxSlots,
} from '@/frontend/lib/contact-mailbox-slots'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import type { Message } from '@/frontend/lib/types'
import type { TelegramIntegrationPublic } from '@/frontend/lib/api/telegram-integrations'
import type { TelegramAlarmGroupMembership } from '@/frontend/lib/telegram-alarm-group-prefs'
import { hasTeamBroadcastKey, readTeamBroadcastKeyEpoch } from '@/frontend/lib/team-broadcast-key-store'

export type MessengerInfoField = {
  id: string
  label: string
  value: string
  copyable?: boolean
  hint?: string
  /** Explorer-Link (Object/TX). */
  href?: string
  hrefLabel?: string
}

export type MessengerInfoSection = {
  id: string
  title: string
  fields: MessengerInfoField[]
  note?: string
}

function field(id: string, label: string, value: string | undefined | null, extra?: Partial<MessengerInfoField>): MessengerInfoField | null {
  const v = (value ?? '').trim()
  if (!v) return null
  return {
    id,
    label,
    value: v,
    copyable: extra?.copyable !== false,
    hint: extra?.hint,
    href: extra?.href,
    hrefLabel: extra?.hrefLabel,
  }
}

function push(fields: MessengerInfoField[], f: MessengerInfoField | null) {
  if (f) fields.push(f)
}

function recentChainMeta(messages: readonly Message[], peerAddress?: string): {
  lastTx?: string
  lastMailbox?: string
} {
  const peer = peerAddress?.trim().toLowerCase()
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m) continue
    if (peer) {
      const from = (m.from ?? '').trim().toLowerCase()
      const to = (m.recipient ?? '').trim().toLowerCase()
      if (from !== peer && to !== peer) continue
    }
    const tx = (m.chainTxDigest ?? '').trim()
    const mb = (m.chainMailboxObjectId ?? '').trim()
    if (tx || mb) return { lastTx: tx || undefined, lastMailbox: mb || undefined }
  }
  return {}
}

/** Kontakt / 1:1 — Wallet, Telegram, Mailbox-Slots, optional letzte Chain-Meta. */
export function buildContactInfoSections(p: {
  address: string
  entry?: ContactMeshEntryClient | null
  slotOverrides?: ContactMailboxSlots
  messages?: readonly Message[]
  packageId?: string
}): MessengerInfoSection[] {
  const address = p.address.trim()
  const identity: MessengerInfoField[] = []
  push(identity, field('wallet', 'Kontakt-ID (Wallet)', address))
  push(identity, field('mesh', 'Funk Node-ID', p.entry?.meshNodeId))
  push(identity, field('tg', 'Telegram Chat-ID', p.entry?.telegramChatId))
  if (p.entry?.roleTags?.length) {
    push(identity, field('roles', 'Rollen', p.entry.roleTags.join(', '), { copyable: false }))
  }

  const slots = {
    ...readContactMailboxSlots(p.entry),
    ...(p.slotOverrides ?? {}),
  }
  const mailbox: MessengerInfoField[] = []
  for (const id of CONTACT_MAILBOX_SLOT_IDS) {
    push(mailbox, field(`mb-${id}`, CONTACT_MAILBOX_SLOT_LABELS[id], slots[id]))
  }

  const chain: MessengerInfoField[] = []
  push(chain, field('package', 'Package-ID (aktiv)', p.packageId))
  const meta = recentChainMeta(p.messages ?? [], address)
  push(chain, field('last-tx', 'Letzte TX (Verlauf)', meta.lastTx))
  push(chain, field('last-mb', 'Letzte Mailbox (Verlauf)', meta.lastMailbox))

  const sections: MessengerInfoSection[] = []
  if (identity.length) {
    sections.push({
      id: 'identity',
      title: 'Identität (IDs)',
      fields: identity,
      note: 'Wallet / Funk / Telegram — zum Kopieren, nicht der Anzeigename.',
    })
  }
  if (mailbox.length) {
    sections.push({
      id: 'mailboxes',
      title: 'Mailboxen (Ziele)',
      fields: mailbox,
      note: mailbox.length
        ? 'Postfach-Object-IDs für diesen Kontakt — wohin Nachrichten landen können.'
        : 'Keine Mailbox-Slots hinterlegt — unter Bearbeiten zuweisen.',
    })
  } else {
    sections.push({
      id: 'mailboxes',
      title: 'Mailboxen (Ziele)',
      fields: [],
      note: 'Keine Mailbox-Slots hinterlegt — unter Bearbeiten / Mailbox zuweisen.',
    })
  }
  if (chain.length) {
    sections.push({
      id: 'chain',
      title: 'Zuletzt in der Chain (Verlauf)',
      fields: chain,
      note: 'Aus dem lokalen Verlauf — nicht live vom Explorer. Package = aktives Move-Paket.',
    })
  }
  return sections
}

/**
 * Gruppe — IDs und Schlüssel-Status.
 * Kein Klartext-Passwort: Team-Broadcast-Key ist kein Chat-Passwort; nur Epoch/Status.
 */
export function buildGroupInfoSections(p: {
  group: MessengerGroupDefinition
  packageId?: string
}): MessengerInfoSection[] {
  const g = p.group
  const overview: MessengerInfoField[] = []
  push(overview, field('name', 'Name', g.name, { copyable: false }))
  push(overview, field('gid', 'Gruppen-ID (lokal)', g.id))
  push(
    overview,
    field('members', 'Mitglieder', String(g.memberAddresses.length), { copyable: false })
  )

  const members: MessengerInfoField[] = []
  g.memberAddresses.forEach((addr, i) => {
    push(members, field(`member-${i}`, `Mitglied ${i + 1}`, addr))
  })

  const mailbox: MessengerInfoField[] = []
  push(mailbox, field('team-mb', 'Team-Mailbox Object-ID', g.teamMailboxObjectId))
  push(mailbox, field('streams', 'Streams-Anchor', g.streamsAnchorId))
  if (g.teamMailboxObjectId) {
    const hasKey = hasTeamBroadcastKey(g.teamMailboxObjectId)
    const epoch = hasKey ? readTeamBroadcastKeyEpoch(g.teamMailboxObjectId) : 0
    push(
      mailbox,
      field(
        'team-key',
        'Team-Schlüssel',
        hasKey ? `hinterlegt · Epoch ${epoch || 1}` : 'nicht hinterlegt',
        {
          copyable: false,
          hint:
            'Kein Chat-Passwort — kryptografisches Gruppen-Geheimnis (Vault). Material nur über Handoff/Verwalten.',
        }
      )
    )
    push(
      mailbox,
      field(
        'broadcast',
        'Broadcast-Modus',
        g.useTeamBroadcast === false ? '1:1 je Person (Handshake)' : 'Gemeinsames Postfach',
        { copyable: false }
      )
    )
  }

  const secondary: MessengerInfoField[] = []
  if (g.secondaryChannel) {
    const sc = g.secondaryChannel
    if (sc.channelName) push(secondary, field('sec-name', 'Funk-Kanal Name', sc.channelName, { copyable: false }))
    if (sc.channelIndex != null) {
      push(secondary, field('sec-idx', 'Funk-Kanal Index', String(sc.channelIndex), { copyable: false }))
    }
    push(secondary, field('sec-psk', 'PSK-Referenz', sc.pskRef, { hint: 'Nur Referenz — kein PSK-Secret.' }))
  }

  const chain: MessengerInfoField[] = []
  push(chain, field('package', 'Package-ID (aktiv)', p.packageId))

  const sections: MessengerInfoSection[] = [
    { id: 'overview', title: 'Gruppe', fields: overview },
  ]
  if (members.length) {
    sections.push({
      id: 'members',
      title: 'Mitglieder-Adressen',
      fields: members.slice(0, 24),
      note:
        members.length > 24
          ? `Weitere ${members.length - 24} Adressen unter „Gruppe verwalten“.`
          : undefined,
    })
  }
  if (mailbox.length) {
    sections.push({
      id: 'mailbox',
      title: 'Mailbox & Schlüssel',
      fields: mailbox,
      note:
        'Ein optionales gemeinsames Gruppen-Passwort gibt es nicht — Sicherheit läuft über Team-Schlüssel und Vault.',
    })
  } else {
    sections.push({
      id: 'mailbox',
      title: 'Mailbox & Schlüssel',
      fields: [],
      note: 'Noch keine Team-Mailbox — unter „Gruppe verwalten“ einrichten.',
    })
  }
  if (secondary.length) sections.push({ id: 'secondary', title: 'Funk (Secondary)', fields: secondary })
  if (chain.length) sections.push({ id: 'chain', title: 'On-Chain', fields: chain })
  return sections
}

/** Telegram-Alarmgruppe + Bot-Metadaten (Token nur maskiert). */
export function buildTelegramAlarmInfoSections(p: {
  membership?: TelegramAlarmGroupMembership | null
  integration?: Pick<
    TelegramIntegrationPublic,
    | 'enabled'
    | 'botTokenConfigured'
    | 'botTokenMasked'
    | 'botUserId'
    | 'adminChatId'
    | 'einsatzGroupChatId'
    | 'einsatzGroupLabel'
    | 'einsatzGroupInviteLink'
    | 'einsatzGroupAlarmEnabled'
    | 'inboundMode'
    | 'relayBaseUrl'
  > | null
}): MessengerInfoSection[] {
  const m = p.membership
  const i = p.integration
  const group: MessengerInfoField[] = []
  push(group, field('label', 'Label', m?.label || i?.einsatzGroupLabel, { copyable: false }))
  push(group, field('invite', 'Invite-Link', m?.inviteLink || i?.einsatzGroupInviteLink))
  push(
    group,
    field(
      'chat-id',
      'Gruppen-Chat-ID',
      m?.groupChatId || i?.einsatzGroupChatId
    )
  )
  if (i) {
    push(
      group,
      field('alarm', 'Alarm aktiv', i.einsatzGroupAlarmEnabled ? 'ja' : 'nein', { copyable: false })
    )
  }

  const bot: MessengerInfoField[] = []
  if (i) {
    push(bot, field('bot-on', 'Integration', i.enabled ? 'an' : 'aus', { copyable: false }))
    push(
      bot,
      field(
        'bot-token',
        'Bot-Token',
        i.botTokenConfigured ? i.botTokenMasked || '•••• (hinterlegt)' : 'nicht konfiguriert',
        {
          copyable: Boolean(i.botTokenMasked?.trim()),
          hint: 'Klartext nur in Einstellungen → Telegram (ersetzen).',
        }
      )
    )
    push(bot, field('bot-user', 'Bot User-ID', i.botUserId))
    push(bot, field('admin', 'Admin Chat-ID', i.adminChatId))
    push(bot, field('inbound', 'Inbound-Modus', i.inboundMode, { copyable: false }))
    push(bot, field('relay', 'Relay Base-URL', i.relayBaseUrl))
  }

  const sections: MessengerInfoSection[] = []
  sections.push({
    id: 'tg-group',
    title: 'Einsatz-Alarmgruppe',
    fields: group,
    note: group.length ? undefined : 'Noch keine Mitgliedschaft / Chat-ID — Join-Karte oder Einstellungen.',
  })
  if (bot.length) {
    sections.push({
      id: 'tg-bot',
      title: 'Bot & Relay',
      fields: bot,
      note: 'Bearbeiten unter Einstellungen → Telegram.',
    })
  }
  return sections
}

/** NFT / Evidence — Object-ID, TX, Package, optional Vault/Lease. */
export function buildNftInfoSections(p: {
  objectId?: string
  digest?: string
  packageId?: string
  name?: string
  label?: string
  keycardBound?: boolean
  vaultObjectId?: string
  vaultKind?: 'guarded' | 'bearer'
  vaultCreateDigest?: string
  leaseObjectId?: string
  leaseCreateDigest?: string
  leaseUnlockMs?: number
  objectExplorerHref?: string
  digestExplorerHref?: string
  vaultExplorerHref?: string
  vaultCreateDigestExplorerHref?: string
  leaseExplorerHref?: string
  leaseCreateDigestExplorerHref?: string
}): MessengerInfoSection[] {
  const fields: MessengerInfoField[] = []
  push(fields, field('name', 'Name', p.name || p.label, { copyable: false }))
  push(
    fields,
    field('oid', 'Object-ID (NFT)', p.objectId, {
      href: p.objectExplorerHref,
      hrefLabel: 'Explorer',
    })
  )
  push(
    fields,
    field('tx', 'TX / Digest', p.digest, {
      href: p.digestExplorerHref,
      hrefLabel: 'Explorer',
    })
  )
  push(fields, field('package', 'Package-ID', p.packageId))
  if (p.vaultObjectId) {
    push(
      fields,
      field(
        'vault',
        p.vaultKind === 'bearer' ? 'Bearer-Treasury Object-ID' : 'Guarded-Purse Object-ID',
        p.vaultObjectId,
        { href: p.vaultExplorerHref, hrefLabel: 'Explorer' }
      )
    )
  }
  push(
    fields,
    field('vault-tx', 'Vault Create-TX', p.vaultCreateDigest, {
      href: p.vaultCreateDigestExplorerHref,
      hrefLabel: 'Explorer',
    })
  )
  push(
    fields,
    field('lease', 'Lease Object-ID', p.leaseObjectId, {
      href: p.leaseExplorerHref,
      hrefLabel: 'Explorer',
    })
  )
  push(
    fields,
    field('lease-tx', 'Lease Create-TX', p.leaseCreateDigest, {
      href: p.leaseCreateDigestExplorerHref,
      hrefLabel: 'Explorer',
    })
  )
  if (p.leaseUnlockMs && p.leaseUnlockMs > 0) {
    push(
      fields,
      field('lease-unlock', 'Lease Unlock', new Date(p.leaseUnlockMs).toLocaleString(), {
        copyable: false,
      })
    )
  }
  if (p.keycardBound != null) {
    push(
      fields,
      field('keycard', 'Keycard-Bindung', p.keycardBound ? 'ja' : 'nein', { copyable: false })
    )
  }
  return [
    {
      id: 'nft',
      title: 'Objekt-Info',
      fields,
      note: fields.length ? undefined : 'Noch keine Object-ID geladen.',
    },
  ]
}

/** Eigenes Profil — Wallet, aktive Mailboxen, Package, Telegram. */
export function buildSelfInfoSections(p: {
  myAddress?: string
  serverMailboxId?: string
  privateMailboxId?: string
  teamMailboxId?: string
  packageId?: string
  telegramChatId?: string
}): MessengerInfoSection[] {
  const identity: MessengerInfoField[] = []
  push(identity, field('wallet', 'Meine Kontakt-ID (Wallet)', p.myAddress))
  push(identity, field('tg', 'Meine Telegram Chat-ID', p.telegramChatId))

  const mailbox: MessengerInfoField[] = []
  push(mailbox, field('server-mb', 'Server-Mailbox', p.serverMailboxId))
  push(mailbox, field('private-mb', 'Private Mailbox (aktiv)', p.privateMailboxId))
  push(mailbox, field('team-mb', 'Team-Mailbox (aktiv)', p.teamMailboxId))

  const chain: MessengerInfoField[] = []
  push(chain, field('package', 'Package-ID (aktiv)', p.packageId))

  const sections: MessengerInfoSection[] = []
  if (identity.length) sections.push({ id: 'identity', title: 'Identität', fields: identity })
  sections.push({
    id: 'mailboxes',
    title: 'Meine Mailboxen',
    fields: mailbox,
    note:
      mailbox.length === 0
        ? 'Keine Mailbox-ID aktiv — unter Einstellungen → IOTA / Meine Mailboxen.'
        : 'Bearbeiten unter Einstellungen → IOTA.',
  })
  if (chain.length) sections.push({ id: 'chain', title: 'On-Chain', fields: chain })
  return sections
}
