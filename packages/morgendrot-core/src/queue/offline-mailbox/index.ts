export {
  OFFLINE_MAILBOX_QUEUE_STORAGE_KEY,
  OFFLINE_MAILBOX_MAX_ITEMS,
  OFFLINE_MAILBOX_MAX_PAYLOAD_CHARS,
  OFFLINE_MAILBOX_PRIORITY_DEFAULT,
  OFFLINE_QUEUE_ITEM_STATUS,
  type OfflineQueueItemStatus,
  type OfflineMailboxKind,
  type OfflineMailboxQueueItem,
} from './model'

export {
  normalizeOfflineMailboxItem,
  parseOfflineMailboxQueueFromJson,
  serializeOfflineMailboxQueueToJson,
} from './codec'

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
} from './state'

export {
  createOfflineMailboxManager,
  type OfflineMailboxManager,
  type OfflineMailboxManagerDeps,
  type EnqueueOfflineMailboxFailureResult,
} from './manager'

export type {
  MailboxSendResult,
  OfflineMailboxSendPort,
  OfflineMailboxTrySend,
  OfflineMailboxDrainOnceArg,
} from './send-port'
export {
  createOfflineMailboxTrySendFromSendPort,
  coerceOfflineMailboxTrySend,
} from './send-port'
export { drainOfflineMailboxOnce, runOfflineMailboxDrainCycle, type OfflineMailboxDrainCycleDeps } from './drain'

export {
  computeCanonicalMsgRefV1,
  stableOfflineMailboxThreadId,
  normalizeMailboxAddressUtf8,
  type ComputeCanonicalMsgRefV1Input,
} from './canonical-msg-ref'

export {
  parseMailboxOutNonceMarker,
  parseMailboxProtocolNonceU64FromWire,
  prependMailboxOutNonceMarker,
  type ParsedMailboxOutNonce,
} from './mailbox-out-nonce-wire'
