import {
  parseCompactImageMessage,
  parseFileTxtMessage,
  parseMorgAudioV1Message,
} from '@/frontend/lib/compact-image-wire'
import { reconstructCompactImageToDataUrlWithMeta } from '@/frontend/lib/compact-image-canvas'
import type { MorgPkgImportItem } from '@/frontend/lib/morg-pkg-import-store'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function openBlobInNewTab(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function safeStem(label: string, ext: string): string {
  const base = label.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 48) || 'morg-export'
  return base.endsWith(ext) ? base : `${base}${ext}`
}

/** Text/Bild/Audio aus Archiv-Eintrag als Datei öffnen oder speichern (nicht Composer). */
export async function openMorgPkgArchiveItem(
  item: MorgPkgImportItem,
  mode: 'open' | 'save' = 'open'
): Promise<{ ok: true } | { ok: false; error: string }> {
  const txt = parseFileTxtMessage(item.content)
  if (txt) {
    const blob = new Blob([txt.text], { type: 'text/plain;charset=utf-8' })
    const name = safeStem(txt.fileName || item.label, '.txt')
    if (mode === 'save') downloadBlob(blob, name)
    else openBlobInNewTab(blob)
    return { ok: true }
  }

  const img = parseCompactImageMessage(item.content)
  if (img) {
    let recon: { dataUrl: string; incomplete: boolean }
    try {
      recon = await reconstructCompactImageToDataUrlWithMeta(img.blobBase64)
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Bild konnte nicht dekodiert werden.' }
    }
    if (!recon.dataUrl) {
      return { ok: false, error: 'Bild konnte nicht dekodiert werden.' }
    }
    const res = await fetch(recon.dataUrl)
    const blob = await res.blob()
    const name = safeStem(item.label, '.webp')
    if (mode === 'save') downloadBlob(blob, name)
    else openBlobInNewTab(blob)
    return { ok: true }
  }

  const audio = parseMorgAudioV1Message(item.content)
  if (audio) {
    const raw = Uint8Array.from(atob(audio.blobBase64.replace(/\s/g, '')), (c) => c.charCodeAt(0))
    const blob = new Blob([raw], { type: 'audio/ogg' })
    const name = safeStem(item.label, '.opus')
    if (mode === 'save') downloadBlob(blob, name)
    else openBlobInNewTab(blob)
    return { ok: true }
  }

  if (item.kind === 'text' || (!item.content.includes('[[MORG_'))) {
    const blob = new Blob([item.content], { type: 'text/plain;charset=utf-8' })
    const name = safeStem(item.label, '.txt')
    if (mode === 'save') downloadBlob(blob, name)
    else openBlobInNewTab(blob)
    return { ok: true }
  }

  return { ok: false, error: 'Unbekanntes Wire-Format — Vorschau oben, kein Datei-Export.' }
}
