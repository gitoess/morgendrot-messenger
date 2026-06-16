import type { Message } from '@/frontend/lib/types'

/** Einsatz-Exporte und ECDH-Morg-Pkg aus dem Posteingang (P5b). */
export type InboxExportActionsPort = {
  readonly exportEcdhMorgPkgForMessage: (msg: Message) => void | Promise<void>
  readonly onExportEinsatzberichtJson: () => void
  readonly onExportEinsatzberichtTxt: () => void
  readonly onExportEinsatzberichtTxtFull: () => void
  readonly onExportEinsatzberichtEncrypted: () => void | Promise<void>
  readonly onExportEinsatzprotokoll: () => void | Promise<void>
  readonly onExportEinsatzprotokollPlainZip: () => void | Promise<void>
  readonly onExportEinsatzprotokollMarked: () => void | Promise<void>
}

export function asInboxExportActions(actions: InboxExportActionsPort): InboxExportActionsPort {
  return actions
}
