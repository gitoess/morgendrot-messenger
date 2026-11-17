import type { Message } from '@/frontend/lib/types'
import type { EinsatzberichtContentMode } from '@/frontend/lib/einsatzbericht-export'
import type { MorgMediaKindFilter } from '@/frontend/lib/einsatzprotokoll-export'
import type { PendingBrowserFileSave } from '@/frontend/lib/browser-file-save'

export type EinsatzExportUiOpts = {
  scope?: 'all' | 'visibleChat'
  contentMode?: EinsatzberichtContentMode
  /** Ergebnis von reserveBrowserSaveHandle in der Klick-Geste (JSON/TXT). */
  reservedSaveHandle?:
    | {
        createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>
      }
    | null
    | 'aborted'
}

export type EinsatzExportRunResult =
  | { ok: true; count: number; pending?: PendingBrowserFileSave; timeWarn?: boolean }
  | { ok: false; aborted?: boolean; error: string }

/** Einsatz-Exporte und ECDH-Morg-Pkg aus dem Posteingang (P5b). */
export type InboxExportActionsPort = {
  readonly exportEcdhMorgPkgForMessage: (msg: Message) => void | Promise<void>
  readonly onExportEinsatzberichtJson: (
    opts?: EinsatzExportUiOpts
  ) => void | Promise<void | EinsatzExportRunResult>
  readonly onExportEinsatzberichtTxt: (
    opts?: EinsatzExportUiOpts
  ) => void | Promise<void | EinsatzExportRunResult>
  readonly onExportEinsatzberichtTxtFull: (
    opts?: EinsatzExportUiOpts
  ) => void | Promise<void | EinsatzExportRunResult>
  readonly onExportEinsatzberichtEncrypted: () => void | Promise<void>
  readonly onExportEinsatzprotokoll: (kinds?: MorgMediaKindFilter) => void | Promise<void>
  readonly onExportEinsatzprotokollPlainZip: (kinds?: MorgMediaKindFilter) => void | Promise<void>
  readonly onExportEinsatzprotokollMarked: () => void | Promise<void>
  readonly onExportMorgMediaZip: (kinds: MorgMediaKindFilter) => void | Promise<void>
  readonly onExportMorgMediaDirect: (kinds: MorgMediaKindFilter) => void | Promise<void>
  /** Vollständigen Verlauf für Medien-Galerie (Unlock + alle Mailboxen). */
  readonly loadMessagesForMediaExport?: () => Promise<Message[]>
}

export function asInboxExportActions(actions: InboxExportActionsPort): InboxExportActionsPort {
  return actions
}
