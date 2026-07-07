import type { ChangeEvent, RefObject } from 'react'
import type { MorgPkgExportPartnerOption } from '@/frontend/lib/morg-pkg-export-partners'
import type { AppendMeshMessageFn } from '@/frontend/lib/append-mesh-message-fn'
import type { Message } from '@/frontend/lib/types'

export type InboxLoadMode = 'reset' | 'append' | 'poll'

/** Posteingang laden, Nachrichten-Aktionen und Morg-Pkg-Panel (P5b). */
export type InboxActionsPort = {
  readonly loading: boolean
  readonly loadingMore: boolean
  readonly loadError: string | null
  readonly inboxFromCache: boolean
  readonly inboxCacheAgeMinutes: number | null
  readonly inboxLiveSource: 'rpc' | 'api' | null
  readonly inboxHasMore: boolean
  readonly loadMessages: (
    mode?: InboxLoadMode,
    overridePackageId?: unknown,
    opts?: { silent?: boolean; forceLive?: boolean }
  ) => void | Promise<void>
  readonly loadMoreInbox: () => void
  readonly refreshContactDirectory: () => void
  readonly onHideInboxMessageLocal: (id: string) => void
  readonly onPurgeInboxMessageChain: (msg: Message) => void | Promise<void>
  readonly onForwardMessage: (msg: Message, includeSender: boolean) => void
  readonly onHideAllVisibleLocal: () => void
  readonly onBulkHideSelected: () => void
  readonly onBulkPurgeSelected: () => void
  readonly localPurgeBusy: boolean
  readonly morgPkgFileRef: RefObject<HTMLInputElement | null>
  readonly morgPkgDeviceFilesRef: RefObject<HTMLInputElement | null>
  readonly onMorgPkgImportFile: (e: ChangeEvent<HTMLInputElement>) => void
  readonly onMorgPkgDeviceFiles: (e: ChangeEvent<HTMLInputElement>) => void
  readonly onMorgPkgDeviceExportPick: () => void | Promise<void>
  readonly morgPkgDeviceBusy: boolean
  readonly morgPkgExportRecipient: string
  readonly onMorgPkgExportRecipientChange: (v: string) => void
  readonly morgPkgExportPartnerOptions: MorgPkgExportPartnerOption[]
  readonly morgPkgImportCount: number
  readonly onOpenMorgPkgArchive: () => void
  readonly openPartnerSetupPanel: () => void
  readonly appendMeshMessage: AppendMeshMessageFn
}

export function asInboxActions(actions: InboxActionsPort): InboxActionsPort {
  return actions
}
