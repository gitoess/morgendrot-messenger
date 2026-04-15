export {
  OFFLINE_MAILBOX_QUEUE_STORAGE_KEY,
  OFFLINE_MAILBOX_MAX_ITEMS,
  OFFLINE_MAILBOX_MAX_PAYLOAD_CHARS,
  OFFLINE_QUEUE_ITEM_STATUS,
  type OfflineQueueItemStatus,
  type OfflineMailboxKind,
  type OfflineMailboxQueueItem,
} from './model.js'

export {
  normalizeOfflineMailboxItem,
  parseOfflineMailboxQueueFromJson,
  serializeOfflineMailboxQueueToJson,
} from './codec.js'

export {
  offlineMailboxDedupKey,
  offlineMailboxEnqueueCollides,
  maxClientOutSeqIn,
  nextClientOutSeqFromItems,
  sortOfflineMailboxForDrain,
  backoffMsForDrainAttempt,
  shouldDeferDrainAttempt,
  tryEnqueueOfflineMailboxItem,
  bumpOfflineMailboxItemAfterFailedSend,
  type EnqueueOfflineMailboxPureResult,
} from './state.js'

export {
  createOfflineMailboxManager,
  type OfflineMailboxManager,
  type OfflineMailboxManagerDeps,
  type EnqueueOfflineMailboxFailureResult,
} from './manager.js'

export type { MailboxSendResult, OfflineMailboxSendPort } from './send-port.js'
export { drainOfflineMailboxOnce } from './drain.js'

export {
  computeCanonicalMsgRefV1,
  stableOfflineMailboxThreadId,
  normalizeMailboxAddressUtf8,
  type ComputeCanonicalMsgRefV1Input,
} from './canonical-msg-ref.js'
