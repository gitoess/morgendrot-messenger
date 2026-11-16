/**
 * Speichern nach async Arbeit. `<a download>` nach `await` wird oft blockiert —
 * File System Access in der User-Geste, sonst Pending + zweiter Klick.
 */

export type PendingBrowserFileSave = {
  filename: string
  mime: string
  blob: Blob
  objectUrl: string
}

type SavePickerHandle = {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>
}

function hasSavePicker(
  w: Window
): w is Window & {
  showSaveFilePicker: (opts: {
    suggestedName?: string
    types?: Array<{ description?: string; accept: Record<string, string[]> }>
  }) => Promise<SavePickerHandle>
} {
  return typeof (w as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function'
}

export function revokePendingBrowserFileSave(p: PendingBrowserFileSave | null | undefined): void {
  if (!p?.objectUrl) return
  try {
    URL.revokeObjectURL(p.objectUrl)
  } catch {
    /* ignore */
  }
}

export function downloadPendingBrowserFileSave(p: PendingBrowserFileSave): void {
  const a = document.createElement('a')
  a.href = p.objectUrl
  a.download = p.filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function anchorDownload(blob: Blob, filename: string): string {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  return url
}

/** Sofort in der Klick-Geste aufrufen (vor langen awaits). */
export async function reserveBrowserSaveHandle(opts: {
  filename: string
  mime: string
}): Promise<SavePickerHandle | null | 'aborted'> {
  if (typeof window === 'undefined' || !hasSavePicker(window)) return null
  try {
    const ext = opts.filename.includes('.') ? `.${opts.filename.split('.').pop()}` : ''
    return await window.showSaveFilePicker({
      suggestedName: opts.filename,
      types: [{ description: 'Export', accept: { [opts.mime]: ext ? [ext] : ['.bin'] } }],
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'aborted'
    return null
  }
}

export async function writeBlobToSaveHandle(handle: SavePickerHandle, blob: Blob): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

/**
 * Blob speichern. `reservedHandle` = Ergebnis von `reserveBrowserSaveHandle` in der Geste.
 * Sonst: Picker-Versuch / Anchor; liefert ggf. Pending für UI-Zweitklick.
 */
export async function commitBrowserFileSave(opts: {
  filename: string
  mime: string
  blob: Blob
  reservedHandle?: SavePickerHandle | null | 'aborted'
}): Promise<'saved' | 'aborted' | PendingBrowserFileSave> {
  if (opts.reservedHandle === 'aborted') return 'aborted'
  if (opts.reservedHandle) {
    await writeBlobToSaveHandle(opts.reservedHandle, opts.blob)
    return 'saved'
  }
  if (typeof window !== 'undefined' && hasSavePicker(window)) {
    try {
      const ext = opts.filename.includes('.') ? `.${opts.filename.split('.').pop()}` : ''
      const handle = await window.showSaveFilePicker({
        suggestedName: opts.filename,
        types: [{ description: 'Export', accept: { [opts.mime]: ext ? [ext] : ['.bin'] } }],
      })
      await writeBlobToSaveHandle(handle, opts.blob)
      return 'saved'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'aborted'
    }
  }
  const objectUrl = anchorDownload(opts.blob, opts.filename)
  return { filename: opts.filename, mime: opts.mime, blob: opts.blob, objectUrl }
}
