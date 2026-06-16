import type { MorgPkgImportItem, MorgPkgImportRecord } from '@/frontend/lib/morg-pkg-import-store'

/** Morg-Pkg-Import-Archiv (Sheet: gelesene Records + Aktionen, P8). */
export type MorgPkgArchivePort = {
  readonly records: readonly MorgPkgImportRecord[]
  readonly open: boolean
  readonly setOpen: (open: boolean) => void
  readonly remove: (id: string) => void
  readonly onForwardItem: (sender: string, item: MorgPkgImportItem) => void
}

export function asMorgPkgArchive(archive: MorgPkgArchivePort): MorgPkgArchivePort {
  return archive
}
