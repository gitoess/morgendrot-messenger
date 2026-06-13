/**
 * M4e: vier Ziel-Mailboxen pro Kontakt (Shared / Privat / Team / Puffer).
 */
import type { ContactMeshEntryClient } from '@/frontend/lib/api'

export const CONTACT_MAILBOX_SLOT_IDS = ['shared', 'private', 'team', 'buffer'] as const
export type ContactMailboxSlotId = (typeof CONTACT_MAILBOX_SLOT_IDS)[number]

/** Send-Ziel: Kontakt-Slot, eigene/Server-Mailbox, oder nur Wallet (Event). */
export type ContactSendMailboxTarget = ContactMailboxSlotId | 'own' | 'server' | 'event'

export type ContactMailboxSlots = Partial<Record<ContactMailboxSlotId, string>>

const HEX_64 = /^0x[a-f0-9]{64}$/

export const CONTACT_MAILBOX_SLOT_LABELS: Record<ContactMailboxSlotId, string> = {
  shared: 'Ops (shared)',
  private: 'Private',
  team: 'Team / group',
  buffer: 'Buffer',
}

export function normalizeMailboxObjectId(id: string): string | undefined {
  const t = id.trim().toLowerCase()
  return HEX_64.test(t) ? t : undefined
}

/** Liest Slots inkl. Legacy `mailboxObjectId` → private. */
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

export function contactHasAnyMailboxSlot(entry?: ContactMeshEntryClient | null): boolean {
  return Object.keys(readContactMailboxSlots(entry)).length > 0
}

export function resolveContactMailboxSlotObjectId(
  entry: ContactMeshEntryClient | undefined,
  slot: ContactMailboxSlotId
): string | undefined {
  return readContactMailboxSlots(entry)[slot]
}

/** Erster belegter Slot (Priorität für Default). */
export function defaultContactSendSlot(entry?: ContactMeshEntryClient | null): ContactSendMailboxTarget {
  const s = readContactMailboxSlots(entry)
  if (s.private) return 'private'
  if (s.team) return 'team'
  if (s.shared) return 'shared'
  if (s.buffer) return 'buffer'
  return 'own'
}

const LS_SEND_SLOT = 'morgendrot.contactSendMailboxSlot.v1'

function readSendSlotMap(): Record<string, ContactSendMailboxTarget> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_SEND_SLOT)
    if (!raw) return {}
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object' || Array.isArray(j)) return {}
    const out: Record<string, ContactSendMailboxTarget> = {}
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      const key = k.trim().toLowerCase()
      if (!/^0x[a-f0-9]{64}$/.test(key)) continue
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

export function readContactSendMailboxTarget(recipientWallet: string): ContactSendMailboxTarget | undefined {
  const k = recipientWallet.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(k)) return undefined
  return readSendSlotMap()[k]
}

export function writeContactSendMailboxTarget(
  recipientWallet: string,
  target: ContactSendMailboxTarget
): void {
  if (typeof window === 'undefined') return
  const k = recipientWallet.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(k)) return
  const map = readSendSlotMap()
  map[k] = target
  window.localStorage.setItem(LS_SEND_SLOT, JSON.stringify(map))
}

export function buildSendMailboxTargetOptions(
  entry: ContactMeshEntryClient | undefined,
  serverMailboxId?: string
): { value: ContactSendMailboxTarget; label: string; objectId?: string }[] {
  const slots = readContactMailboxSlots(entry)
  const opts: { value: ContactSendMailboxTarget; label: string; objectId?: string }[] = [
    { value: 'event', label: 'Wallet address only (on-chain event)' },
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
  opts.push({ value: 'own', label: 'My active mailbox (team/private)' })
  const srv = serverMailboxId?.trim()
  if (srv && HEX_64.test(srv.toLowerCase())) {
    opts.push({
      value: 'server',
      label: `Server ops (shared) · ${srv.slice(0, 10)}…`,
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

export function slotsFromEntry(entry?: Partial<ContactMeshEntryClient>): {
  mailboxSharedId: string
  mailboxPrivateId: string
  mailboxTeamId: string
  mailboxBufferId: string
} {
  const s = readContactMailboxSlots(entry as ContactMeshEntryClient | undefined)
  return {
    mailboxSharedId: s.shared ?? '',
    mailboxPrivateId: s.private ?? '',
    mailboxTeamId: s.team ?? '',
    mailboxBufferId: s.buffer ?? '',
  }
}
