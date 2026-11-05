/**
 * M4d: private Mailbox-Object-IDs lokal (Profil-QR, mehrere Mailboxes, Archiv).
 * Aktiv-Zustand: @/frontend/lib/my-mailbox-active
 */

import {
  ACTIVE_SERVER_MAILBOX,
  ACTIVE_MAILBOX_CHANGED_EVENT,
  clearActiveSendMailbox,
  readActiveSendMailbox,
  setActivePrivateMailboxObjectId as persistActivePrivateMailbox,
  type ActiveSendMailbox,
} from '@/frontend/lib/my-mailbox-active'
import { readScoped, removeScoped, writeScoped } from '@/frontend/lib/package-profile-namespace'

const PRIVATE_MAILBOX_DOMAIN = 'privateMailboxes'

export type MyPrivateMailboxEntry = {
  objectId: string
  label?: string
  createdAtMs?: number
  digest?: string
  removedAtMs?: number
}

export { ACTIVE_SERVER_MAILBOX, ACTIVE_MAILBOX_CHANGED_EVENT }
export { readActiveSendMailbox, readActiveSendMailboxObjectId } from '@/frontend/lib/my-mailbox-active'
export type { ActiveSendMailbox } from '@/frontend/lib/my-mailbox-active'

/** Letzte Server-MAILBOX_ID aus GET /api/status (Send-Fallback). */
let cachedServerMailboxObjectId = ''

export function cacheServerMailboxObjectId(id: string): void {
  const t = id.trim()
  cachedServerMailboxObjectId = /^0x[a-fA-F0-9]{64}$/i.test(t) ? t : ''
}

export function readCachedServerMailboxObjectId(): string {
  return cachedServerMailboxObjectId
}

const LS_LIST = 'morgendrot.myPrivateMailboxes.v2'
const LS_ARCHIVE = 'morgendrot.myPrivateMailboxes.archive.v1'
const LS_LEGACY = 'morgendrot.myPrivateMailboxObjectId.v1'

function isValidObjectId(id: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/i.test(id.trim())
}

function parseEntries(raw: string | null): MyPrivateMailboxEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x) => {
        if (!x || typeof x !== 'object') return null
        const o = x as Record<string, unknown>
        const objectId = typeof o.objectId === 'string' ? o.objectId.trim() : ''
        if (!isValidObjectId(objectId)) return null
        const label = typeof o.label === 'string' ? o.label.trim() : undefined
        const createdAtMs = typeof o.createdAtMs === 'number' ? o.createdAtMs : undefined
        const digest = typeof o.digest === 'string' ? o.digest.trim() : undefined
        const removedAtMs = typeof o.removedAtMs === 'number' ? o.removedAtMs : undefined
        return {
          objectId,
          ...(label ? { label } : {}),
          ...(createdAtMs ? { createdAtMs } : {}),
          ...(digest ? { digest } : {}),
          ...(removedAtMs ? { removedAtMs } : {}),
        }
      })
      .filter((x): x is MyPrivateMailboxEntry => x != null)
  } catch {
    return []
  }
}

function readListRaw(): MyPrivateMailboxEntry[] {
  if (typeof window === 'undefined') return []
  const raw = readScoped(PRIVATE_MAILBOX_DOMAIN, LS_LIST)
  if (!raw) return migrateLegacyIfNeeded()
  return parseEntries(raw)
}

function readArchiveRaw(): MyPrivateMailboxEntry[] {
  if (typeof window === 'undefined') return []
  return parseEntries(readScoped(PRIVATE_MAILBOX_DOMAIN, LS_ARCHIVE))
}

function migrateLegacyIfNeeded(): MyPrivateMailboxEntry[] {
  if (typeof window === 'undefined') return []
  const legacy = (readScoped(PRIVATE_MAILBOX_DOMAIN, LS_LEGACY) ?? '').trim()
  if (!legacy || !isValidObjectId(legacy)) return []
  const entry: MyPrivateMailboxEntry = { objectId: legacy, createdAtMs: Date.now() }
  writeListRaw([entry])
  persistActivePrivateMailbox(legacy)
  removeScoped(PRIVATE_MAILBOX_DOMAIN, LS_LEGACY)
  return [entry]
}

function writeListRaw(entries: MyPrivateMailboxEntry[]): void {
  if (typeof window === 'undefined') return
  if (!entries.length) removeScoped(PRIVATE_MAILBOX_DOMAIN, LS_LIST)
  else writeScoped(PRIVATE_MAILBOX_DOMAIN, LS_LIST, JSON.stringify(entries))
}

function writeArchiveRaw(entries: MyPrivateMailboxEntry[]): void {
  if (typeof window === 'undefined') return
  if (!entries.length) removeScoped(PRIVATE_MAILBOX_DOMAIN, LS_ARCHIVE)
  else writeScoped(PRIVATE_MAILBOX_DOMAIN, LS_ARCHIVE, JSON.stringify(entries))
}

export function readMyPrivateMailboxes(): MyPrivateMailboxEntry[] {
  return readListRaw()
}

export function readArchivedMyPrivateMailboxes(): MyPrivateMailboxEntry[] {
  return readArchiveRaw()
}

/** @deprecated → readActiveSendMailbox */
export type ActiveMailboxSelection = ActiveSendMailbox

export function readActiveMailboxSelection(): ActiveSendMailbox {
  return readActiveSendMailbox()
}

export function readActivePrivateMailboxObjectId(): string {
  const sel = readActiveSendMailbox()
  return sel.kind === 'private' ? sel.objectId : ''
}

export function readMyPrivateMailboxObjectId(): string {
  return readActivePrivateMailboxObjectId()
}

export function clearActivePrivateMailbox(): void {
  clearActiveSendMailbox()
}

export function setActiveServerMailbox(): void {
  clearActiveSendMailbox()
}

export function setActivePrivateMailboxObjectId(id: string): void {
  const t = id.trim()
  if (!t) {
    clearActiveSendMailbox()
    return
  }
  if (!isValidObjectId(t)) return
  persistActivePrivateMailbox(t)
}

export function suggestNextPrivateMailboxLabel(
  list: MyPrivateMailboxEntry[] = readListRaw(),
  archive: MyPrivateMailboxEntry[] = readArchiveRaw()
): string {
  const used = new Set<number>()
  const scan = (entries: MyPrivateMailboxEntry[]) => {
    for (const e of entries) {
      const m = (e.label ?? '').trim().match(/^Private\s*#(\d+)$/i)
      if (m) used.add(Number.parseInt(m[1]!, 10))
    }
  }
  scan(list)
  scan(archive)
  let n = 1
  while (used.has(n)) n++
  return `Private #${n}`
}

export function addMyPrivateMailbox(entry: MyPrivateMailboxEntry): void {
  const objectId = entry.objectId.trim()
  if (!isValidObjectId(objectId)) return
  const archive = readArchiveRaw().filter((e) => e.objectId.toLowerCase() !== objectId.toLowerCase())
  writeArchiveRaw(archive)
  const list = readListRaw().filter((e) => e.objectId.toLowerCase() !== objectId.toLowerCase())
  const label = entry.label?.trim() || suggestNextPrivateMailboxLabel(list, archive)
  list.unshift({
    objectId,
    label,
    ...(entry.createdAtMs ? { createdAtMs: entry.createdAtMs } : { createdAtMs: Date.now() }),
    ...(entry.digest?.trim() ? { digest: entry.digest.trim() } : {}),
  })
  writeListRaw(list)
  persistActivePrivateMailbox(objectId)
}

export function archiveMyPrivateMailbox(objectId: string): void {
  const t = objectId.trim().toLowerCase()
  if (!t) return
  const list = readListRaw()
  const entry = list.find((e) => e.objectId.toLowerCase() === t)
  if (!entry) return
  writeListRaw(list.filter((e) => e.objectId.toLowerCase() !== t))
  const arch = readArchiveRaw().filter((e) => e.objectId.toLowerCase() !== t)
  arch.unshift({ ...entry, removedAtMs: Date.now() })
  writeArchiveRaw(arch)
  const sel = readActiveSendMailbox()
  if (sel.kind === 'private' && sel.objectId.toLowerCase() === t) clearActiveSendMailbox()
}

export function restoreMyPrivateMailbox(objectId: string): void {
  const t = objectId.trim()
  if (!isValidObjectId(t)) return
  const arch = readArchiveRaw()
  const entry = arch.find((e) => e.objectId.toLowerCase() === t.toLowerCase())
  if (!entry) return
  writeArchiveRaw(arch.filter((e) => e.objectId.toLowerCase() !== t.toLowerCase()))
  const { removedAtMs: _r, ...rest } = entry
  addMyPrivateMailbox(rest)
}

export function forgetMyPrivateMailbox(objectId: string): void {
  const t = objectId.trim().toLowerCase()
  if (!t) return
  writeListRaw(readListRaw().filter((e) => e.objectId.toLowerCase() !== t))
  writeArchiveRaw(readArchiveRaw().filter((e) => e.objectId.toLowerCase() !== t))
  const sel = readActiveSendMailbox()
  if (sel.kind === 'private' && sel.objectId.toLowerCase() === t) clearActiveSendMailbox()
}

export function removeMyPrivateMailbox(objectId: string): void {
  archiveMyPrivateMailbox(objectId)
}

export function updateMyPrivateMailboxLabel(objectId: string, label: string): void {
  const t = objectId.trim()
  if (!isValidObjectId(t)) return
  const patch = (entries: MyPrivateMailboxEntry[]) => {
    const idx = entries.findIndex((e) => e.objectId.toLowerCase() === t.toLowerCase())
    if (idx < 0) return entries
    const next = [...entries]
    const trimmed = label.trim()
    if (trimmed) next[idx] = { ...next[idx]!, label: trimmed }
    else {
      const { label: _l, ...rest } = next[idx]!
      next[idx] = rest
    }
    return next
  }
  writeListRaw(patch(readListRaw()))
  writeArchiveRaw(patch(readArchiveRaw()))
}

export function writeMyPrivateMailboxObjectId(id: string): void {
  const t = id.trim()
  if (!t) {
    clearActiveSendMailbox()
    return
  }
  if (!isValidObjectId(t)) return
  addMyPrivateMailbox({ objectId: t })
}

/** Bestehende Einträge ohne Label → `Private #1`, `#2`, … (einmalig beim Panel-Laden). */
export function backfillPrivateMailboxLabels(): boolean {
  let changed = false
  const fill = (entries: MyPrivateMailboxEntry[], other: MyPrivateMailboxEntry[]) => {
    const out = [...entries]
    for (let i = 0; i < out.length; i++) {
      if ((out[i]!.label ?? '').trim()) continue
      changed = true
      out[i] = { ...out[i]!, label: suggestNextPrivateMailboxLabel(out, other) }
    }
    return out
  }
  const arch = readArchiveRaw()
  const list = fill(readListRaw(), arch)
  const arch2 = fill(arch, list)
  if (changed) {
    writeListRaw(list)
    writeArchiveRaw(arch2)
  }
  return changed
}
