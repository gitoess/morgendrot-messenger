'use client'

/** Entfernt UTF-8-BOM, damit JSON.parse nach file.text() zuverlässig ist. */
export function stripUtf8Bom(text: string): string {
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) return text.slice(1)
  return text
}

export function parseJsonObjectFromFileText(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = stripUtf8Bom(text).trim()
  if (!trimmed) return { ok: false, error: 'Datei ist leer.' }
  try {
    const v = JSON.parse(trimmed) as unknown
    if (v == null || typeof v !== 'object' || Array.isArray(v)) {
      return { ok: false, error: 'Erwartet ein JSON-Objekt (kein Array).' }
    }
    return { ok: true, value: v as Record<string, unknown> }
  } catch {
    return { ok: false, error: 'Kein gültiges JSON (Syntaxfehler). Prüfe .morg-pkg.json / Export.' }
  }
}
