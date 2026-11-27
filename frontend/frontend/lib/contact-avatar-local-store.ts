/**
 * Profilbild Stufe A — nur lokal (kein Share/QR).
 * @see docs/IDEEN-BACKLOG.md
 */

export const CONTACT_AVATAR_STORAGE_KEY = 'morgendrot.contactAvatars.v1'
export const CONTACT_AVATAR_CHANGED_EVENT = 'morgendrot-contact-avatar-changed'

function emitAvatarChanged(address: string): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(
      new CustomEvent(CONTACT_AVATAR_CHANGED_EVENT, { detail: { address: address.toLowerCase() } })
    )
  } catch {
    /* */
  }
}

/** ~96px JPEG, Ziel ≤ ~4 KB wo möglich. */
const AVATAR_MAX_EDGE = 96
const AVATAR_JPEG_QUALITY = 0.72
const AVATAR_MAX_DATA_URL_CHARS = 8_000

function normalizeAddr(address: string): string {
  return address.trim().toLowerCase()
}

function readMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CONTACT_AVATAR_STORAGE_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object' || Array.isArray(j)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      const a = normalizeAddr(k)
      if (a && typeof v === 'string' && v.startsWith('data:image/')) out[a] = v
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

export function getContactAvatarDataUrl(address: string): string | null {
  const a = normalizeAddr(address)
  if (!a) return null
  return readMap()[a] ?? null
}

export function clearContactAvatar(address: string): void {
  const a = normalizeAddr(address)
  if (!a) return
  const m = readMap()
  delete m[a]
  writeMap(m)
  emitAvatarChanged(a)
}

export async function setContactAvatarFromFile(
  address: string,
  file: Blob
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  const a = normalizeAddr(address)
  if (!/^0x[a-fA-F0-9]{64}$/i.test(a)) return { ok: false, error: 'Adresse ungültig.' }
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
    m[a] = dataUrl
    writeMap(m)
    emitAvatarChanged(a)
    return { ok: true, dataUrl }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Avatar speichern fehlgeschlagen.' }
  }
}
