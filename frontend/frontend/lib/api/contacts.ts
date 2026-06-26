import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'
import { OFFLINE_CACHE_TTL_MS } from '@/frontend/lib/offline-cache-ttl'

/** Kontakt mit optionalem Meshtastic-Mapping (GET /api/contact-labels → directory). */
export type ContactMeshEntryClient = {
  label: string
  /** Einsatz-Tags (z. B. Medic) — Anzeige, siehe initialProfile */
  roleTags?: string[]
  meshNodeId?: string
  meshPublicKeyHex?: string
  bleUuid?: string
  /** Legacy / Alias für `mailboxPrivateId` (M4e). */
  mailboxObjectId?: string
  mailboxSharedId?: string
  mailboxPrivateId?: string
  mailboxTeamId?: string
  mailboxBufferId?: string
  /** Telegram Chat-ID des Kontakts (Hinweis nach Send, § H.26 B). */
  telegramChatId?: string
}

const CONTACT_DIRECTORY_CACHE_KEY = 'morgendrot.contacts.directory.v1'

type CachedContactDirectoryEnvelope = {
  savedAtMs: number
  labels?: Record<string, string>
  directory?: Record<string, ContactMeshEntryClient>
}

function cacheContactDirectorySnapshot(payload: {
  labels?: Record<string, string>
  directory?: Record<string, ContactMeshEntryClient>
}): void {
  if (typeof window === 'undefined') return
  try {
    const envelope: CachedContactDirectoryEnvelope = {
      savedAtMs: Date.now(),
      labels: payload.labels,
      directory: payload.directory,
    }
    window.localStorage.setItem(CONTACT_DIRECTORY_CACHE_KEY, JSON.stringify(envelope))
  } catch {
    // Kein Hard-Fail bei gesperrtem oder vollem Speicher.
  }
}

function readCachedContactDirectorySnapshot():
  | {
      labels?: Record<string, string>
      directory?: Record<string, ContactMeshEntryClient>
      cacheAgeMs: number
    }
  | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONTACT_DIRECTORY_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedContactDirectoryEnvelope>
    const savedAtMs = Number(parsed.savedAtMs ?? 0)
    if (!Number.isFinite(savedAtMs) || savedAtMs <= 0) return null
    const ageMs = Date.now() - savedAtMs
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > OFFLINE_CACHE_TTL_MS) return null
    const labels = parsed.labels as Record<string, string> | undefined
    const directory = parsed.directory as Record<string, ContactMeshEntryClient> | undefined
    if ((!labels || Object.keys(labels).length === 0) && (!directory || Object.keys(directory).length === 0)) return null
    return { labels, directory, cacheAgeMs: ageMs }
  } catch {
    return null
  }
}

/** POST /api/contact-labels/apply-initial-profile — gleiches Schema wie Server `InitialProfile`. */
export async function applyInitialProfileProvisioning(profile: Record<string, unknown>): Promise<{
  ok: boolean
  applied?: number
  message?: string
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/contact-labels/apply-initial-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Profil konnte nicht angewendet werden.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      applied: typeof b.applied === 'number' ? b.applied : undefined,
      message: typeof b.message === 'string' ? b.message : undefined,
      error: typeof b.error === 'string' ? b.error : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

export async function fetchContactDirectory(): Promise<{
  ok: boolean
  labels?: Record<string, string>
  directory?: Record<string, ContactMeshEntryClient>
  fromCache?: boolean
  cacheAgeMs?: number
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/contact-labels')
    if (!fr.ok) {
      const cached = readCachedContactDirectorySnapshot()
      if (cached) {
        console.info('[contacts] Live-Request fehlgeschlagen, nutze Cache-Fallback.', { error: fr.error })
        return {
          ok: true,
          labels: cached.labels,
          directory: cached.directory,
          fromCache: true,
          cacheAgeMs: cached.cacheAgeMs,
          error: fr.error,
        }
      }
      return { ok: false, error: fr.error }
    }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Kontakte nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    const labels = b.labels as Record<string, string> | undefined
    let directory = b.directory as Record<string, ContactMeshEntryClient> | undefined
    if ((!directory || Object.keys(directory).length === 0) && labels && Object.keys(labels).length > 0) {
      directory = {}
      for (const [addr, label] of Object.entries(labels)) {
        const a = addr.trim().toLowerCase()
        if (!a) continue
        directory[a] = { label: label || 'Partner' }
      }
    }
    cacheContactDirectorySnapshot({ labels, directory })
    return {
      ok: true,
      labels,
      directory,
      fromCache: false,
      cacheAgeMs: 0,
      error: typeof b.error === 'string' ? b.error : undefined,
    }
  } catch (error) {
    const cached = readCachedContactDirectorySnapshot()
    if (cached) {
      const msg = formatFetchFailureMessage(error)
      console.info('[contacts] Ausnahme beim Live-Request, nutze Cache-Fallback.', { error: msg })
      return {
        ok: true,
        labels: cached.labels,
        directory: cached.directory,
        fromCache: true,
        cacheAgeMs: cached.cacheAgeMs,
        error: msg,
      }
    }
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

/** Kontakt inkl. optionaler BLE-UUID / Mesh-Felder (POST /api/contact-label). */
export async function saveContactEntry(body: {
  address: string
  label?: string
  bleUuid?: string
  meshNodeId?: string
  meshPublicKeyHex?: string
  mailboxObjectId?: string
  mailboxSharedId?: string
  mailboxPrivateId?: string
  mailboxTeamId?: string
  mailboxBufferId?: string
  telegramChatId?: string
  clearMesh?: boolean
  roleTags?: string[]
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/contact-label', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Kontakt speichern fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      message: typeof b.message === 'string' ? b.message : undefined,
      error: typeof b.error === 'string' ? b.error : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

/** Nur Mesh-Metadaten; Passwort nur lokal/TLS. */
export async function exportContactMeshEncrypted(password: string): Promise<{
  ok: boolean
  bundle?: { v: number; salt: string; iv: string; tag: string; ciphertext: string }
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/contact-mesh-export-encrypted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Mesh-Export fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    const raw = b.bundle
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: 'Unerwartete Export-Antwort (bundle).' }
    }
    const o = raw as Record<string, unknown>
    if (
      typeof o.v !== 'number' ||
      typeof o.salt !== 'string' ||
      typeof o.iv !== 'string' ||
      typeof o.tag !== 'string' ||
      typeof o.ciphertext !== 'string'
    ) {
      return { ok: false, error: 'Unerwartetes Bundle-Format.' }
    }
    return {
      ok: true,
      bundle: { v: o.v, salt: o.salt, iv: o.iv, tag: o.tag, ciphertext: o.ciphertext },
      error: typeof b.error === 'string' ? b.error : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

export async function importContactMeshEncrypted(
  password: string,
  bundle: { v: number; salt: string; iv: string; tag: string; ciphertext: string }
): Promise<{ ok: boolean; merged?: number; message?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/contact-mesh-import-encrypted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, bundle }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Mesh-Import fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      merged: typeof b.merged === 'number' ? b.merged : undefined,
      message: typeof b.message === 'string' ? b.message : undefined,
      error: typeof b.error === 'string' ? b.error : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
