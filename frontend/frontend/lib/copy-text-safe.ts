/**
 * Clipboard mit sichtbarem Fallback — navigator.clipboard schlägt oft still fehl (HTTP/Permissions).
 */

export async function copyTextSafe(text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = text.trim()
  if (!t) return { ok: false, error: 'Nichts zum Kopieren.' }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t)
      return { ok: true }
    }
  } catch {
    /* fallback */
  }
  try {
    if (typeof document === 'undefined') return { ok: false, error: 'Clipboard nicht verfügbar.' }
    const ta = document.createElement('textarea')
    ta.value = t
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (ok) return { ok: true }
    return { ok: false, error: 'Kopieren blockiert — Text manuell markieren.' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Kopieren fehlgeschlagen.' }
  }
}
