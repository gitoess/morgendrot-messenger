/**
 * Team-Mailboxes (Shared-Postfächer pro Einsatzgruppe): lokal verwaltet, on-chain = `Mailbox` (nicht PrivateMailbox).
 */

import {
  clearActiveSendMailbox,
  readActiveSendMailbox,
  setActiveTeamMailboxObjectId,
} from '@/frontend/lib/my-mailbox-active'

export type MyTeamMailboxEntry = {
  objectId: string
  label?: string
  joinedAtMs?: number
  digest?: string
  removedAtMs?: number
}

const LS_LIST = 'morgendrot.myTeamMailboxes.v1'
const LS_ARCHIVE = 'morgendrot.myTeamMailboxes.archive.v1'

function isValidObjectId(id: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/i.test(id.trim())
}

function parseEntries(raw: string | null): MyTeamMailboxEntry[] {
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
        const joinedAtMs = typeof o.joinedAtMs === 'number' ? o.joinedAtMs : undefined
        const digest = typeof o.digest === 'string' ? o.digest.trim() : undefined
        const removedAtMs = typeof o.removedAtMs === 'number' ? o.removedAtMs : undefined
        return {
          objectId,
          ...(label ? { label } : {}),
          ...(joinedAtMs ? { joinedAtMs } : {}),
          ...(digest ? { digest } : {}),
          ...(removedAtMs ? { removedAtMs } : {}),
        }
      })
      .filter((x): x is MyTeamMailboxEntry => x != null)
  } catch {
    return []
  }
}

function readListRaw(): MyTeamMailboxEntry[] {
  if (typeof window === 'undefined') return []
  return parseEntries(window.localStorage.getItem(LS_LIST))
}

function readArchiveRaw(): MyTeamMailboxEntry[] {
  if (typeof window === 'undefined') return []
  return parseEntries(window.localStorage.getItem(LS_ARCHIVE))
}

function writeListRaw(entries: MyTeamMailboxEntry[]): void {
  if (typeof window === 'undefined') return
  if (!entries.length) window.localStorage.removeItem(LS_LIST)
  else window.localStorage.setItem(LS_LIST, JSON.stringify(entries))
}

function writeArchiveRaw(entries: MyTeamMailboxEntry[]): void {
  if (typeof window === 'undefined') return
  if (!entries.length) window.localStorage.removeItem(LS_ARCHIVE)
  else window.localStorage.setItem(LS_ARCHIVE, JSON.stringify(entries))
}

export function readMyTeamMailboxes(): MyTeamMailboxEntry[] {
  return readListRaw()
}

export function readArchivedMyTeamMailboxes(): MyTeamMailboxEntry[] {
  return readArchiveRaw()
}

export function suggestNextTeamMailboxLabel(
  list: MyTeamMailboxEntry[] = readListRaw(),
  archive: MyTeamMailboxEntry[] = readArchiveRaw()
): string {
  const used = new Set<number>()
  const scan = (entries: MyTeamMailboxEntry[]) => {
    for (const e of entries) {
      const m = (e.label ?? '').trim().match(/^Team\s*#(\d+)$/i)
      if (m) used.add(Number.parseInt(m[1]!, 10))
    }
  }
  scan(list)
  scan(archive)
  let n = 1
  while (used.has(n)) n++
  return `Team #${n}`
}

export function addMyTeamMailbox(entry: MyTeamMailboxEntry): void {
  const objectId = entry.objectId.trim()
  if (!isValidObjectId(objectId)) return
  const archive = readArchiveRaw().filter((e) => e.objectId.toLowerCase() !== objectId.toLowerCase())
  writeArchiveRaw(archive)
  const list = readListRaw().filter((e) => e.objectId.toLowerCase() !== objectId.toLowerCase())
  const label = entry.label?.trim() || suggestNextTeamMailboxLabel(list, archive)
  list.unshift({
    objectId,
    label,
    joinedAtMs: entry.joinedAtMs ?? Date.now(),
    ...(entry.digest?.trim() ? { digest: entry.digest.trim() } : {}),
  })
  writeListRaw(list)
  setActiveTeamMailboxObjectId(objectId)
}

export function joinMyTeamMailbox(objectId: string, label?: string): void {
  addMyTeamMailbox({ objectId, ...(label?.trim() ? { label: label.trim() } : {}) })
}

export function archiveMyTeamMailbox(objectId: string): void {
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
  if (sel.kind === 'team' && sel.objectId.toLowerCase() === t) clearActiveSendMailbox()
}

export function restoreMyTeamMailbox(objectId: string): void {
  const t = objectId.trim()
  if (!isValidObjectId(t)) return
  const arch = readArchiveRaw()
  const entry = arch.find((e) => e.objectId.toLowerCase() === t.toLowerCase())
  if (!entry) return
  writeArchiveRaw(arch.filter((e) => e.objectId.toLowerCase() !== t.toLowerCase()))
  const { removedAtMs: _r, ...rest } = entry
  addMyTeamMailbox(rest)
}

export function forgetMyTeamMailbox(objectId: string): void {
  const t = objectId.trim().toLowerCase()
  if (!t) return
  writeListRaw(readListRaw().filter((e) => e.objectId.toLowerCase() !== t))
  writeArchiveRaw(readArchiveRaw().filter((e) => e.objectId.toLowerCase() !== t))
  const sel = readActiveSendMailbox()
  if (sel.kind === 'team' && sel.objectId.toLowerCase() === t) clearActiveSendMailbox()
}

export function updateMyTeamMailboxLabel(objectId: string, label: string): void {
  const t = objectId.trim()
  if (!isValidObjectId(t)) return
  const patch = (entries: MyTeamMailboxEntry[]) => {
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

/** Bestehende Einträge ohne Label → `Team #1`, `#2`, … (einmalig beim Panel-Laden). */
export function backfillTeamMailboxLabels(): boolean {
  let changed = false
  const fill = (entries: MyTeamMailboxEntry[], other: MyTeamMailboxEntry[]) => {
    const out = [...entries]
    for (let i = 0; i < out.length; i++) {
      if ((out[i]!.label ?? '').trim()) continue
      changed = true
      out[i] = { ...out[i]!, label: suggestNextTeamMailboxLabel(out, other) }
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
