/**
 * M4e: vier Ziel-Mailboxen pro Kontakt (Shared / Privat / Team / Puffer).
 * § H.24b P3: Send-Slot-Präferenz + Slot-Overrides pro Einsatzprofil (Spec §3.3).
 */
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  activeProfileId,
  readScoped,
  removeScoped,
  writeScoped,
} from '@/frontend/lib/package-profile-namespace'

export const CONTACT_MAILBOX_SLOT_IDS = ['shared', 'private', 'team', 'buffer'] as const
export type ContactMailboxSlotId = (typeof CONTACT_MAILBOX_SLOT_IDS)[number]

/** Send-Ziel: Kontakt-Slot, eigene/Server-Mailbox, oder nur Wallet (Event). */
export type ContactSendMailboxTarget = ContactMailboxSlotId | 'own' | 'server' | 'event'

export type ContactMailboxSlots = Partial<Record<ContactMailboxSlotId, string>>

const HEX_64 = /^0x[a-f0-9]{64}$/

const CONTACT_MAILBOX_SLOTS_DOMAIN = 'contactMailboxSlots'
const LS_SEND_SLOT = 'morgendrot.contactSendMailboxSlot.v1'
const LS_SLOT_OVERRIDE = 'morgendrot.contactMailboxSlotsByWallet.v1'

export const CONTACT_MAILBOX_SLOT_LABELS: Record<ContactMailboxSlotId, string> = {
  shared: 'Einsatz (Shared)',
  private: 'Privat',
  team: 'Team / Gruppe',
  buffer: 'Puffer',
}

export function normalizeMailboxObjectId(id: string): string | undefined {
  const t = id.trim().toLowerCase()
  return HEX_64.test(t) ? t : undefined
}

function normalizeWalletKey(wallet: string | undefined): string | undefined {
  const k = (wallet ?? '').trim().toLowerCase()
  return HEX_64.test(k) ? k : undefined
}

/** Liest Slots inkl. Legacy `mailboxObjectId` → private (nur Telefonbuch-Eintrag, ohne Profil-Override). */
export function readContactMailboxSlots(entry?: ContactMeshEntryClient | null): ContactMailboxSlots {
  if (!entry) return {}
  const out: ContactMailboxSlots = {}
  const legacy = entry.mailboxObjectId?.trim()
  const priv = entry.mailboxPrivateId?.trim() ?? legacy
  const shared = entry.mailboxSharedId?.trim()
  const team = entry.mailboxTeamId?.trim()
  const buffer = entry.mailboxBufferId?.trim()
  if (shared && HEX_64.test(shared.toLowerCase())) out.shared = shared.toLowerCase()
  if (priv && HEX_64.test(priv.toLowerCase())) out.private = priv.toLowerCase()
  if (team && HEX_64.test(team.toLowerCase())) out.team = team.toLowerCase()
  if (buffer && HEX_64.test(buffer.toLowerCase())) out.buffer = buffer.toLowerCase()
  return out
}

function parseSlotOverrideMap(raw: string | null): Record<string, ContactMailboxSlots> {
  if (!raw) return {}
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object' || Array.isArray(j)) return {}
    const out: Record<string, ContactMailboxSlots> = {}
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      const key = k.trim().toLowerCase()
      if (!HEX_64.test(key) || !v || typeof v !== 'object' || Array.isArray(v)) continue
      const slots: ContactMailboxSlots = {}
      for (const id of CONTACT_MAILBOX_SLOT_IDS) {
        const mb = (v as Record<string, unknown>)[id]
        if (typeof mb !== 'string') continue
        const norm = normalizeMailboxObjectId(mb)
        if (norm) slots[id] = norm
      }
      if (Object.keys(slots).length > 0) out[key] = slots
    }
    return out
  } catch {
    return {}
  }
}

function readProfileSlotOverrideMap(): Record<string, ContactMailboxSlots> {
  return parseSlotOverrideMap(readScoped(CONTACT_MAILBOX_SLOTS_DOMAIN, LS_SLOT_OVERRIDE))
}

function writeProfileSlotOverrideMap(map: Record<string, ContactMailboxSlots>): void {
  if (Object.keys(map).length === 0) {
    removeScoped(CONTACT_MAILBOX_SLOTS_DOMAIN, LS_SLOT_OVERRIDE)
    return
  }
  writeScoped(CONTACT_MAILBOX_SLOTS_DOMAIN, LS_SLOT_OVERRIDE, JSON.stringify(map))
}

export function readProfileContactMailboxSlotOverride(wallet: string): ContactMailboxSlots {
  const k = normalizeWalletKey(wallet)
  if (!k) return {}
  return readProfileSlotOverrideMap()[k] ?? {}
}

/** Speichert Slot-Overrides für den aktiven Einsatz (ohne Telefonbuch-Eintrag zu ändern). */
export function writeProfileContactMailboxSlotOverride(
  wallet: string,
  slots: ContactMailboxSlots
): void {
  const k = normalizeWalletKey(wallet)
  if (!k || !activeProfileId()) return
  const map = readProfileSlotOverrideMap()
  const cleaned: ContactMailboxSlots = {}
  for (const id of CONTACT_MAILBOX_SLOT_IDS) {
    const mb = slots[id]
    if (mb) cleaned[id] = mb
  }
  if (Object.keys(cleaned).length === 0) {
    delete map[k]
  } else {
    map[k] = cleaned
  }
  writeProfileSlotOverrideMap(map)
}

/** Effektive Slots: Profil-Override überschreibt Telefonbuch-Basis (Spec §3.3). */
export function resolveContactMailboxSlots(
  wallet: string | undefined,
  entry?: ContactMeshEntryClient | null
): ContactMailboxSlots {
  const fromEntry = readContactMailboxSlots(entry)
  const k = normalizeWalletKey(wallet)
  if (!k) return fromEntry
  const override = readProfileContactMailboxSlotOverride(k)
  return { ...fromEntry, ...override }
}

export function contactHasAnyMailboxSlot(
  entry?: ContactMeshEntryClient | null,
  wallet?: string
): boolean {
  return Object.keys(resolveContactMailboxSlots(wallet, entry)).length > 0
}

export function resolveContactMailboxSlotObjectId(
  entry: ContactMeshEntryClient | undefined,
  slot: ContactMailboxSlotId,
  wallet?: string
): string | undefined {
  return resolveContactMailboxSlots(wallet, entry)[slot]
}

/** Erster belegter Slot (Priorität für Default). */
export function defaultContactSendSlot(
  entry?: ContactMeshEntryClient | null,
  wallet?: string
): ContactSendMailboxTarget {
  const s = resolveContactMailboxSlots(wallet, entry)
  if (s.private) return 'private'
  if (s.team) return 'team'
  if (s.shared) return 'shared'
  if (s.buffer) return 'buffer'
  return 'own'
}

function readSendSlotMap(): Record<string, ContactSendMailboxTarget> {
  const raw = readScoped(CONTACT_MAILBOX_SLOTS_DOMAIN, LS_SEND_SLOT)
  if (!raw) return {}
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object' || Array.isArray(j)) return {}
    const out: Record<string, ContactSendMailboxTarget> = {}
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      const key = k.trim().toLowerCase()
      if (!HEX_64.test(key)) continue
      if (
        v === 'own' ||
        v === 'server' ||
        v === 'event' ||
        v === 'shared' ||
        v === 'private' ||
        v === 'team' ||
        v === 'buffer'
      ) {
        out[key] = v
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeSendSlotMap(map: Record<string, ContactSendMailboxTarget>): void {
  writeScoped(CONTACT_MAILBOX_SLOTS_DOMAIN, LS_SEND_SLOT, JSON.stringify(map))
}

export function readContactSendMailboxTarget(recipientWallet: string): ContactSendMailboxTarget | undefined {
  const k = normalizeWalletKey(recipientWallet)
  if (!k) return undefined
  return readSendSlotMap()[k]
}

export function writeContactSendMailboxTarget(
  recipientWallet: string,
  target: ContactSendMailboxTarget
): void {
  const k = normalizeWalletKey(recipientWallet)
  if (!k) return
  const map = readSendSlotMap()
  map[k] = target
  writeSendSlotMap(map)
}

export function buildSendMailboxTargetOptions(
  entry: ContactMeshEntryClient | undefined,
  serverMailboxId?: string,
  wallet?: string
): { value: ContactSendMailboxTarget; label: string; objectId?: string }[] {
  const slots = resolveContactMailboxSlots(wallet, entry)
  const opts: { value: ContactSendMailboxTarget; label: string; objectId?: string }[] = [
    { value: 'event', label: 'Nur Wallet-Adresse (Event auf Chain)' },
  ]
  for (const id of CONTACT_MAILBOX_SLOT_IDS) {
    const oid = slots[id]
    if (!oid) continue
    opts.push({
      value: id,
      label: `${CONTACT_MAILBOX_SLOT_LABELS[id]} · ${oid.slice(0, 10)}…`,
      objectId: oid,
    })
  }
  opts.push({ value: 'own', label: 'Meine aktive Mailbox (Team/Privat)' })
  const srv = serverMailboxId?.trim()
  if (srv && HEX_64.test(srv.toLowerCase())) {
    opts.push({
      value: 'server',
      label: `Server-Einsatz (Shared) · ${srv.slice(0, 10)}…`,
      objectId: srv.toLowerCase(),
    })
  }
  return opts
}

export function slotsToSavePayload(slots: {
  mailboxSharedId: string
  mailboxPrivateId: string
  mailboxTeamId: string
  mailboxBufferId: string
}): Pick<
  ContactMeshEntryClient,
  'mailboxSharedId' | 'mailboxPrivateId' | 'mailboxTeamId' | 'mailboxBufferId' | 'mailboxObjectId'
> {
  const shared = normalizeMailboxObjectId(slots.mailboxSharedId) ?? undefined
  const priv = normalizeMailboxObjectId(slots.mailboxPrivateId) ?? undefined
  const team = normalizeMailboxObjectId(slots.mailboxTeamId) ?? undefined
  const buffer = normalizeMailboxObjectId(slots.mailboxBufferId) ?? undefined
  return {
    ...(shared ? { mailboxSharedId: shared } : {}),
    ...(priv ? { mailboxPrivateId: priv, mailboxObjectId: priv } : {}),
    ...(team ? { mailboxTeamId: team } : {}),
    ...(buffer ? { mailboxBufferId: buffer } : {}),
  }
}

/** Slots als Override speichern, wenn ein Einsatzprofil aktiv ist (sonst Telefonbuch-Payload). */
export function persistContactMailboxSlots(
  wallet: string,
  slots: {
    mailboxSharedId: string
    mailboxPrivateId: string
    mailboxTeamId: string
    mailboxBufferId: string
  }
): 'profile' | 'telefonbuch' {
  const k = normalizeWalletKey(wallet)
  if (!k) return 'telefonbuch'
  if (!activeProfileId()) return 'telefonbuch'
  const payload = slotsToSavePayload(slots)
  const override: ContactMailboxSlots = {}
  if (payload.mailboxSharedId) override.shared = payload.mailboxSharedId
  if (payload.mailboxPrivateId) override.private = payload.mailboxPrivateId
  if (payload.mailboxTeamId) override.team = payload.mailboxTeamId
  if (payload.mailboxBufferId) override.buffer = payload.mailboxBufferId
  writeProfileContactMailboxSlotOverride(k, override)
  return 'profile'
}

export function slotsFromEntry(
  entry?: Partial<ContactMeshEntryClient>,
  wallet?: string
): {
  mailboxSharedId: string
  mailboxPrivateId: string
  mailboxTeamId: string
  mailboxBufferId: string
} {
  const s = resolveContactMailboxSlots(wallet, entry as ContactMeshEntryClient | undefined)
  return {
    mailboxSharedId: s.shared ?? '',
    mailboxPrivateId: s.private ?? '',
    mailboxTeamId: s.team ?? '',
    mailboxBufferId: s.buffer ?? '',
  }
}
