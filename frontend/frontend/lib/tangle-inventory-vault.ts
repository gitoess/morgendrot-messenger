'use client'

import type { PersonalSecretEntry } from '@/frontend/lib/api'
import { fetchVaultPersonalSecrets, saveVaultPersonalSecrets } from '@/frontend/lib/api'
import type { TangleInventoryItem, TangleInventoryOrigin, TangleInventoryStatus, TangleInventoryType } from '@/frontend/lib/tangle-inventory'

const AUTO_SAVE_KEY = 'morgendrot.tangleInventory.autoVaultSave.v1'
const DIGEST_MARKER = 'morgendrot.tangle.digest.v1'

type DigestMeta = {
  digest: string
  timestamp: number
  type: TangleInventoryType
  status: TangleInventoryStatus
  origin?: TangleInventoryOrigin
  nonce?: string
  encrypted?: boolean
  contentPreview?: string
  evidenceSecuredAt?: number
}

function shortDigest(d: string): string {
  if (d.length <= 14) return d
  return `${d.slice(0, 8)}…${d.slice(-4)}`
}

function toMeta(item: Omit<TangleInventoryItem, 'id'>): DigestMeta {
  return {
    digest: item.digest,
    timestamp: item.timestamp,
    type: item.type,
    status: item.status,
    origin: item.origin,
    nonce: item.nonce,
    encrypted: item.encrypted,
    contentPreview: item.contentPreview,
    evidenceSecuredAt: item.evidenceSecuredAt,
  }
}

function buildVaultEntry(item: Omit<TangleInventoryItem, 'id'>): PersonalSecretEntry {
  const meta = toMeta(item)
  return {
    id: `${DIGEST_MARKER}:${meta.digest}:${meta.timestamp}`,
    title: `Tangle Digest ${shortDigest(meta.digest)}`,
    username: 'iota-tx',
    secret: meta.digest,
    note: `${DIGEST_MARKER}:${JSON.stringify(meta)}`,
    updatedAt: Date.now(),
  }
}

function parseVaultDigestEntry(entry: PersonalSecretEntry): Omit<TangleInventoryItem, 'id'> | null {
  const note = String(entry.note ?? '')
  const secret = String(entry.secret ?? '').trim()
  const markerIdx = note.indexOf(`${DIGEST_MARKER}:`)
  if (markerIdx >= 0) {
    const raw = note.slice(markerIdx + `${DIGEST_MARKER}:`.length)
    try {
      const m = JSON.parse(raw) as Partial<DigestMeta>
      if (typeof m.digest !== 'string' || !m.digest.trim()) return null
      return {
        digest: m.digest.trim(),
        timestamp: Number.isFinite(m.timestamp) ? Number(m.timestamp) : Date.now(),
        type: (m.type as TangleInventoryType) ?? 'unknown',
        status: (m.status as TangleInventoryStatus) ?? 'anchored',
        origin: typeof m.origin === 'string' ? (m.origin as TangleInventoryOrigin) : undefined,
        nonce: typeof m.nonce === 'string' ? m.nonce : undefined,
        encrypted: typeof m.encrypted === 'boolean' ? m.encrypted : undefined,
        contentPreview: typeof m.contentPreview === 'string' ? m.contentPreview : undefined,
        evidenceSecuredAt:
          typeof m.evidenceSecuredAt === 'number' && Number.isFinite(m.evidenceSecuredAt)
            ? m.evidenceSecuredAt
            : undefined,
      }
    } catch {
      return null
    }
  }
  if (secret.startsWith('0x') && secret.length >= 12 && /[a-fA-F0-9]/.test(secret.slice(2))) {
    return {
      digest: secret,
      timestamp: entry.updatedAt && Number.isFinite(entry.updatedAt) ? entry.updatedAt : Date.now(),
      type: 'unknown',
      status: 'anchored',
    }
  }
  return null
}

export function isTangleInventoryAutoVaultSaveEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(AUTO_SAVE_KEY) === '1'
  } catch {
    return false
  }
}

export function setTangleInventoryAutoVaultSaveEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(AUTO_SAVE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export async function saveDigestToVault(item: Omit<TangleInventoryItem, 'id'>): Promise<{ ok: boolean; error?: string }> {
  const existing = await fetchVaultPersonalSecrets()
  if (!existing.ok) return { ok: false, error: existing.error ?? 'Tresor nicht erreichbar.' }
  if (existing.unlocked !== true) return { ok: false, error: 'Tresor ist gesperrt.' }
  const entries = Array.isArray(existing.entries) ? [...existing.entries] : []
  const digest = item.digest.trim().toLowerCase()
  const filtered = entries.filter((e) => String(e.secret ?? '').trim().toLowerCase() !== digest)
  filtered.unshift(buildVaultEntry(item))
  const save = await saveVaultPersonalSecrets(filtered, true)
  return save.ok ? { ok: true } : { ok: false, error: save.error ?? 'Digest konnte nicht im Tresor gespeichert werden.' }
}

export async function maybeAutoSaveDigestToVault(item: Omit<TangleInventoryItem, 'id'>): Promise<void> {
  if (!isTangleInventoryAutoVaultSaveEnabled()) return
  try {
    await saveDigestToVault(item)
  } catch {
    /* silent: darf Versandfluss nicht blockieren */
  }
}

function digestNorm(d: string): string {
  return d.trim().toLowerCase()
}

function entryMatchesDigest(entry: PersonalSecretEntry, digest: string): boolean {
  const want = digestNorm(digest)
  if (digestNorm(String(entry.secret ?? '')) === want) return true
  const parsed = parseVaultDigestEntry(entry)
  return parsed != null && digestNorm(parsed.digest) === want
}

/** Alle txDigests, die aktuell im Tresor liegen (normalisiert lowercase). */
export async function fetchVaultStoredDigestSet(): Promise<{
  ok: boolean
  digests?: Set<string>
  error?: string
}> {
  const r = await fetchVaultPersonalSecrets()
  if (!r.ok) return { ok: false, error: r.error ?? 'Tresor nicht erreichbar.' }
  if (r.unlocked !== true) return { ok: false, error: 'Tresor ist gesperrt.' }
  const entries = Array.isArray(r.entries) ? r.entries : []
  const digests = new Set<string>()
  for (const e of entries) {
    const parsed = parseVaultDigestEntry(e)
    if (parsed?.digest) digests.add(digestNorm(parsed.digest))
    else {
      const secret = String(e.secret ?? '').trim()
      if (secret.startsWith('0x')) digests.add(digestNorm(secret))
    }
  }
  return { ok: true, digests }
}

/** Entfernt alle Tresor-Einträge mit diesem txDigest. */
export async function removeDigestFromVault(digest: string): Promise<{ ok: boolean; error?: string; removed?: number }> {
  const want = digest.trim()
  if (!want) return { ok: false, error: 'Digest fehlt.' }
  const existing = await fetchVaultPersonalSecrets()
  if (!existing.ok) return { ok: false, error: existing.error ?? 'Tresor nicht erreichbar.' }
  if (existing.unlocked !== true) return { ok: false, error: 'Tresor ist gesperrt.' }
  const entries = Array.isArray(existing.entries) ? [...existing.entries] : []
  const kept = entries.filter((e) => !entryMatchesDigest(e, want))
  const removed = entries.length - kept.length
  if (removed === 0) return { ok: true, removed: 0 }
  const save = await saveVaultPersonalSecrets(kept, true)
  return save.ok
    ? { ok: true, removed }
    : { ok: false, error: save.error ?? 'Tresor-Eintrag konnte nicht gelöscht werden.' }
}

export async function importDigestsFromVault(): Promise<{
  ok: boolean
  items?: Array<Omit<TangleInventoryItem, 'id'>>
  error?: string
}> {
  const r = await fetchVaultPersonalSecrets()
  if (!r.ok) return { ok: false, error: r.error ?? 'Tresor nicht erreichbar.' }
  if (r.unlocked !== true) return { ok: false, error: 'Tresor ist gesperrt.' }
  const entries = Array.isArray(r.entries) ? r.entries : []
  const out: Array<Omit<TangleInventoryItem, 'id'>> = []
  for (const e of entries) {
    const parsed = parseVaultDigestEntry(e)
    if (parsed) out.push(parsed)
  }
  return { ok: true, items: out }
}
