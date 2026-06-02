/** Lokales Archiv für importierte .morg-pkg (nicht im Posteingang). */

export type MorgPkgImportItem = {
  label: string
  content: string
  kind: 'text' | 'compact_image' | 'file_txt' | 'opus' | 'unknown'
}

export type MorgPkgImportRecord = {
  id: string
  importedAt: number
  sender: string
  fileName?: string
  items: MorgPkgImportItem[]
}

const LS_KEY = 'morgendrot.morgPkgImports.v1'

export function readMorgPkgImports(): MorgPkgImportRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(LS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (r): r is MorgPkgImportRecord =>
        r != null &&
        typeof r === 'object' &&
        typeof (r as MorgPkgImportRecord).id === 'string' &&
        Array.isArray((r as MorgPkgImportRecord).items)
    )
  } catch {
    return []
  }
}

export function writeMorgPkgImports(records: MorgPkgImportRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(LS_KEY, JSON.stringify(records.slice(0, 48)))
  } catch {
    /* ignore */
  }
}

export function itemKindFromBundleKind(
  k: string
): MorgPkgImportItem['kind'] {
  if (k === 'text' || k === 'compact_image' || k === 'file_txt' || k === 'opus') return k
  return 'unknown'
}
