/**
 * Profilbild lokal — Wallet (`0x…`) oder Sidebar-Slot (`slot:…` / `group:…`).
 * Stufe B Share nur für Wallet-Adressen (Visitenkarte).
 * @see docs/IDEEN-BACKLOG.md
 */

export const CONTACT_AVATAR_STORAGE_KEY = 'morgendrot.contactAvatars.v1'
export const CONTACT_AVATAR_CHANGED_EVENT = 'morgendrot-contact-avatar-changed'

/** Feste Sidebar-Slots (kein Chain-Objekt). */
export const AVATAR_SLOT_INBOX_ALL = 'slot:inbox-all'
export const AVATAR_SLOT_TG_ALARM = 'slot:tg-alarm'
export const AVATAR_SLOT_PINNWAND = 'slot:pinnwand'

export function avatarKeyForGroup(groupId: string): string {
  const id = groupId.trim()
  return id ? `group:${id}` : ''
}

/**
 * Gültige Keys: `0x`+64 Hex, `slot:…` (a-z0-9-), `group:…` (nicht leer).
 */
export function normalizeAvatarKey(key: string): string | null {
  const t = key.trim().toLowerCase()
  if (!t) return null
  if (/^0x[a-f0-9]{64}$/.test(t)) return t
  if (/^slot:[a-z0-9][a-z0-9_-]{0,63}$/.test(t)) return t
  if (/^group:[a-z0-9][a-z0-9_.:-]{0,127}$/i.test(t)) return t
  return null
}

export function isWalletAvatarKey(key: string): boolean {
  return /^0x[a-f0-9]{64}$/i.test(key.trim())
}

function emitAvatarChanged(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(
      new CustomEvent(CONTACT_AVATAR_CHANGED_EVENT, {
        detail: { address: key, key },
      })
    )
  } catch {
    /* */
  }
}

/** ~96px JPEG, Ziel ≤ ~4 KB wo möglich. */
const AVATAR_MAX_EDGE = 96
const AVATAR_JPEG_QUALITY = 0.72
const AVATAR_MAX_DATA_URL_CHARS = 8_000

function readMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CONTACT_AVATAR_STORAGE_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object' || Array.isArray(j)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      const key = normalizeAvatarKey(k)
      if (key && typeof v === 'string' && v.startsWith('data:image/')) out[key] = v
    }
    return out
  } catch {
    return {}
  }
}

function writeMap(m: Record<string, string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONTACT_AVATAR_STORAGE_KEY, JSON.stringify(m))
  } catch {
    /* Quota */
  }
}

export function getContactAvatarDataUrl(key: string): string | null {
  const k = normalizeAvatarKey(key)
  if (!k) return null
  return readMap()[k] ?? null
}

export function clearContactAvatar(key: string): void {
  const k = normalizeAvatarKey(key)
  if (!k) return
  const m = readMap()
  delete m[k]
  writeMap(m)
  emitAvatarChanged(k)
}

/** Stufe B Empfang: Data-URL speichern (kein Remote-Fetch). Nur Wallet-Keys. */
export function setContactAvatarDataUrl(
  address: string,
  dataUrl: string,
  opts?: { overwrite?: boolean }
): { ok: true; skippedLocalOverride?: boolean } | { ok: false; error: string } {
  const a = normalizeAvatarKey(address)
  if (!a || !isWalletAvatarKey(a)) return { ok: false, error: 'Adresse ungültig.' }
  const url = String(dataUrl || '').trim()
  if (!url.startsWith('data:image/')) return { ok: false, error: 'Kein Bild-Data-URL.' }
  if (url.length > AVATAR_MAX_DATA_URL_CHARS * 1.5) {
    return { ok: false, error: 'Profilbild-Thumb zu groß.' }
  }
  const m = readMap()
  if (m[a] && !opts?.overwrite) {
    return { ok: true, skippedLocalOverride: true }
  }
  m[a] = url
  writeMap(m)
  emitAvatarChanged(a)
  return { ok: true }
}

/** SHA-256 Hex über den Data-URL-String (Integrität Stufe B). Nur Web Crypto — kein node:crypto (Webpack). */
export async function sha256HexUtf8(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle?.digest) {
    throw new Error('SHA-256 (Web Crypto) nicht verfügbar.')
  }
  const data = new TextEncoder().encode(text)
  const buf = await subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function setContactAvatarFromFile(
  key: string,
  file: Blob
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  const k = normalizeAvatarKey(key)
  if (!k) return { ok: false, error: 'Avatar-Key ungültig.' }
  if (typeof createImageBitmap === 'undefined' && typeof Image === 'undefined') {
    return { ok: false, error: 'Bildverarbeitung im Browser nicht verfügbar.' }
  }

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, AVATAR_MAX_EDGE / Math.max(bitmap.width, bitmap.height, 1))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return { ok: false, error: 'Canvas fehlgeschlagen.' }
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    let dataUrl = canvas.toDataURL('image/jpeg', AVATAR_JPEG_QUALITY)
    if (dataUrl.length > AVATAR_MAX_DATA_URL_CHARS) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.55)
    }
    if (dataUrl.length > AVATAR_MAX_DATA_URL_CHARS * 1.5) {
      return { ok: false, error: 'Bild zu groß nach Kompression — kleineres Foto wählen.' }
    }
    const m = readMap()
    m[k] = dataUrl
    writeMap(m)
    emitAvatarChanged(k)
    return { ok: true, dataUrl }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Avatar speichern fehlgeschlagen.' }
  }
}
