import type { Message } from '@/frontend/lib/types'
import type { EinsatzberichtContentMode } from '@/frontend/lib/einsatzbericht-export'
import type { MorgMediaKindFilter } from '@/frontend/lib/einsatzprotokoll-export'

export type EinsatzExportUiOpts = {
  scope?: 'all' | 'visibleChat'
  contentMode?: EinsatzberichtContentMode
}

/** Einsatz-Exporte und ECDH-Morg-Pkg aus dem Posteingang (P5b). */
export type InboxExportActionsPort = {
  readonly exportEcdhMorgPkgForMessage: (msg: Message) => void | Promise<void>
  readonly onExportEinsatzberichtJson: (opts?: EinsatzExportUiOpts) => void | Promise<void>
  readonly onExportEinsatzberichtTxt: (opts?: EinsatzExportUiOpts) => void | Promise<void>
  readonly onExportEinsatzberichtTxtFull: (opts?: EinsatzExportUiOpts) => void | Promise<void>
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
