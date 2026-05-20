/**
 * M4d: private Mailbox-Object-IDs lokal (Profil-QR, mehrere Mailboxes, eine aktiv, Archiv).
 */

export type MyPrivateMailboxEntry = {
  objectId: string
  label?: string
  createdAtMs?: number
  digest?: string
  removedAtMs?: number
}

export const ACTIVE_SERVER_MAILBOX = '__server__'

const LS_LIST = 'morgendrot.myPrivateMailboxes.v2'
const LS_ARCHIVE = 'morgendrot.myPrivateMailboxes.archive.v1'
const LS_ACTIVE = 'morgendrot.activePrivateMailboxObjectId.v2'
const LS_LEGACY = 'morgendrot.myPrivateMailboxObjectId.v1'

function isValidObjectId(id: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/i.test(id.trim())
}

function readActiveRaw(): string {
  if (typeof window === 'undefined') return ''
  return (window.localStorage.getItem(LS_ACTIVE) ?? '').trim()
}

function writeActiveRaw(id: string): void {
  if (typeof window === 'undefined') return
  const t = id.trim()
  if (!t) window.localStorage.removeItem(LS_ACTIVE)
  else window.localStorage.setItem(LS_ACTIVE, t)
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
  const raw = window.localStorage.getItem(LS_LIST)
  if (!raw) return migrateLegacyIfNeeded()
  return parseEntries(raw)
}

function readArchiveRaw(): MyPrivateMailboxEntry[] {
  if (typeof window === 'undefined') return []
  return parseEntries(window.localStorage.getItem(LS_ARCHIVE))
}

function migrateLegacyIfNeeded(): MyPrivateMailboxEntry[] {
  if (typeof window === 'undefined') return []
  const legacy = (window.localStorage.getItem(LS_LEGACY) ?? '').trim()
  if (!legacy || !isValidObjectId(legacy)) return []
  const entry: MyPrivateMailboxEntry = { objectId: legacy, createdAtMs: Date.now() }
  writeListRaw([entry])
  writeActiveRaw(legacy)
  window.localStorage.removeItem(LS_LEGACY)
  return [entry]
}

function writeListRaw(entries: MyPrivateMailboxEntry[]): void {
  if (typeof window === 'undefined') return
  if (!entries.length) window.localStorage.removeItem(LS_LIST)
  else window.localStorage.setItem(LS_LIST, JSON.stringify(entries))
}

function writeArchiveRaw(entries: MyPrivateMailboxEntry[]): void {
  if (typeof window === 'undefined') return
  if (!entries.length) window.localStorage.removeItem(LS_ARCHIVE)
  else window.localStorage.setItem(LS_ARCHIVE, JSON.stringify(entries))
}

export function readMyPrivateMailboxes(): MyPrivateMailboxEntry[] {
  return readListRaw()
}

export function readArchivedMyPrivateMailboxes(): MyPrivateMailboxEntry[] {
  return readArchiveRaw()
}

export type ActiveMailboxSelection = { kind: 'server' } | { kind: 'private'; objectId: string }

export function readActiveMailboxSelection(): ActiveMailboxSelection {
  const active = readActiveRaw()
  if (active === ACTIVE_SERVER_MAILBOX) return { kind: 'server' }
  if (isValidObjectId(active)) return { kind: 'private', objectId: active }
  return { kind: 'server' }
}

export function readActivePrivateMailboxObjectId(): string {
  const sel = readActiveMailboxSelection()
  return sel.kind === 'private' ? sel.objectId : ''
}

export function readMyPrivateMailboxObjectId(): string {
  return readActivePrivateMailboxObjectId()
}

export function setActiveServerMailbox(): void {
  writeActiveRaw(ACTIVE_SERVER_MAILBOX)
}

export function setActivePrivateMailboxObjectId(id: string): void {
  const t = id.trim()
  if (t && !isValidObjectId(t)) return
  if (!t) setActiveServerMailbox()
  else writeActiveRaw(t)
}

export function addMyPrivateMailbox(entry: MyPrivateMailboxEntry): void {
  const objectId = entry.objectId.trim()
  if (!isValidObjectId(objectId)) return
  const archive = readArchiveRaw().filter((e) => e.objectId.toLowerCase() !== objectId.toLowerCase())
  writeArchiveRaw(archive)
  const list = readListRaw().filter((e) => e.objectId.toLowerCase() !== objectId.toLowerCase())
  list.unshift({
    objectId,
    ...(entry.label?.trim() ? { label: entry.label.trim() } : {}),
    ...(entry.createdAtMs ? { createdAtMs: entry.createdAtMs } : { createdAtMs: Date.now() }),
    ...(entry.digest?.trim() ? { digest: entry.digest.trim() } : {}),
  })
  writeListRaw(list)
  writeActiveRaw(objectId)
}

/** Aus Liste entfernen → Archiv (Wiederherstellen möglich). Chain-Objekt bleibt. */
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
  const sel = readActiveMailboxSelection()
  if (sel.kind === 'private' && sel.objectId.toLowerCase() === t) setActiveServerMailbox()
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

/** Nach erfolgreichem Rebate: aus Liste und Archiv entfernen. */
export function forgetMyPrivateMailbox(objectId: string): void {
  const t = objectId.trim().toLowerCase()
  if (!t) return
  writeListRaw(readListRaw().filter((e) => e.objectId.toLowerCase() !== t))
  writeArchiveRaw(readArchiveRaw().filter((e) => e.objectId.toLowerCase() !== t))
  const sel = readActiveMailboxSelection()
  if (sel.kind === 'private' && sel.objectId.toLowerCase() === t) setActiveServerMailbox()
}

/** @deprecated → archiveMyPrivateMailbox */
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
    setActiveServerMailbox()
    return
  }
  if (!isValidObjectId(t)) return
  addMyPrivateMailbox({ objectId: t })
}
