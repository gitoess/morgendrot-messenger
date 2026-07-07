'use client'

/**
 * § H.32b — Einsatz beenden: lokaler Cache & Einsatz-IDs weg (kein Chain-Purge).
 */
import { OFFLINE_MAILBOX_QUEUE_STORAGE_KEY } from '@/frontend/lib/api/offline-queue'
import { clearLocalHistory } from '@/frontend/lib/api/clear-local-history'
import { clearCachedApiStatusSnapshot } from '@/frontend/lib/api/status'
import { clearDirectChatEcdhKeyMaterial } from '@/frontend/lib/direct-chat-ecdh-session'
import { clearDirectSessionKeysArchive } from '@/frontend/lib/direct-session-keys-archive'
import { clearDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'
import { clearLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { HANDOFF_IMPORT_DRAFT_KEY } from '@/frontend/lib/handoff-pending-server-apply'
import {
  clearInboxBrowserViewFilters,
  INBOX_PARTNER_MEMORY_BLOCKED_LS,
  INBOX_PARTNER_MEMORY_LS,
} from '@/frontend/lib/inbox-browser-view-state'
import { clearTeamMemberRemoveSent } from '@/frontend/lib/team-removed-members-store'
import { clearActivePrivateMailbox } from '@/frontend/lib/my-private-mailbox-store'
import { clearActiveSendMailbox } from '@/frontend/lib/my-mailbox-active'
import { saveMirrorQueue } from '@/frontend/lib/delayed-mirror-queue'
import {
  INBOX_CACHE_KEY_PREFIX,
  INBOX_CACHE_KEY_PREFIX_LEGACY,
  isInboxCacheStorageKey,
} from '@/frontend/lib/inbox-cache-key'

export { INBOX_CACHE_KEY_PREFIX } from '@/frontend/lib/inbox-cache-key'

export const EINSATZ_END_CACHE_WIPED_EVENT = 'morgendrot:einsatz-end-cache-wiped'

/** Dokumentierte Allowlist v1 (Vitest + Handbuch). */
export const EINSATZ_END_LOCAL_STORAGE_KEYS = [
  'morgendrot.handshakeOffersCache.v1',
  'morgendrot.dismissedHandshakeOffers.v1',
  'morgendrot.dismissedOutgoingHandshakeOffers.v1',
  'morgendrot.directSessionKeys.v1',
  'morgendrot.meshLocalMessages.v1',
  'morg.delayed-mirror-queue.v1',
  OFFLINE_MAILBOX_QUEUE_STORAGE_KEY,
  'morgendrot.inbox.overviewLastSeen.v1',
  'morgendrot.inbox.partnerLastSeen.v1',
  HANDOFF_IMPORT_DRAFT_KEY,
  'morgendrot.einsatz.manifestAnchoredEntryHashes.v1',
  'morgendrot.einsatz.manifestLastAnchorMeta.v1',
  'morgendrot.einsatz.manifestLastSequence.v1',
] as const

export const EINSATZ_END_LOCAL_STORAGE_PREFIXES = [
  INBOX_CACHE_KEY_PREFIX,
  INBOX_CACHE_KEY_PREFIX_LEGACY,
  'morgendrot.directChain.',
  'morgendrot.directChatEcdh.',
] as const

export const EINSATZ_END_SESSION_STORAGE_KEYS = [
  'morg.pinnwand.pinned.ids.v1',
  INBOX_PARTNER_MEMORY_LS,
  INBOX_PARTNER_MEMORY_BLOCKED_LS,
] as const

export type EinsatzEndCacheWipeOptions = {
  /** Server `.inbox.enc` via `/api/clear-local-history` (wenn Basis erreichbar). */
  clearServerInbox?: boolean
  /** Mesh-Mirror- und Offline-Mailbox-Queues leeren (Default: true). */
  clearTransportQueues?: boolean
}

export type EinsatzEndCacheWipeResult = {
  ok: boolean
  removedLocalStorageKeys: number
  removedSessionStorageKeys: number
  serverInboxCleared: boolean
  serverError?: string
}

function removeLocalStorageKeysMatching(predicate: (key: string) => boolean): number {
  if (typeof window === 'undefined') return 0
  let n = 0
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && predicate(key)) keys.push(key)
    }
    for (const key of keys) {
      window.localStorage.removeItem(key)
      n += 1
    }
  } catch {
    /* ignore */
  }
  return n
}

export function wipeAllInboxCacheKeys(): number {
  return removeLocalStorageKeysMatching(isInboxCacheStorageKey)
}

export function wipeEinsatzLocalBrowserState(options?: Pick<EinsatzEndCacheWipeOptions, 'clearTransportQueues'>): {
  removedLocalStorageKeys: number
  removedSessionStorageKeys: number
} {
  if (typeof window === 'undefined') {
    return { removedLocalStorageKeys: 0, removedSessionStorageKeys: 0 }
  }

  const clearQueues = options?.clearTransportQueues !== false
  let removedLocal = 0
  let removedSession = 0

  removedLocal += wipeAllInboxCacheKeys()

  for (const key of EINSATZ_END_LOCAL_STORAGE_KEYS) {
    if (!clearQueues && (key === OFFLINE_MAILBOX_QUEUE_STORAGE_KEY || key === 'morg.delayed-mirror-queue.v1')) {
      continue
    }
    try {
      if (window.localStorage.getItem(key) != null) {
        window.localStorage.removeItem(key)
        removedLocal += 1
      }
    } catch {
      /* ignore */
    }
  }

  removedLocal += removeLocalStorageKeysMatching((key) =>
    EINSATZ_END_LOCAL_STORAGE_PREFIXES.some((p) => key.startsWith(p))
  )

  clearLocalHandoffAppliedSnapshot()
  clearCachedApiStatusSnapshot()
  clearDirectMailboxChainSnapshot()
  clearActiveSendMailbox()
  clearActivePrivateMailbox()
  clearTeamMemberRemoveSent()
  clearDirectChatEcdhKeyMaterial()
  clearDirectSessionKeysArchive()
  clearInboxBrowserViewFilters()

  if (clearQueues) {
    saveMirrorQueue([])
  }

  for (const key of EINSATZ_END_SESSION_STORAGE_KEYS) {
    try {
      if (window.sessionStorage.getItem(key) != null) {
        window.sessionStorage.removeItem(key)
        removedSession += 1
      }
    } catch {
      /* ignore */
    }
  }

  try {
    window.dispatchEvent(new CustomEvent(EINSATZ_END_CACHE_WIPED_EVENT))
  } catch {
    /* ignore */
  }

  return { removedLocalStorageKeys: removedLocal, removedSessionStorageKeys: removedSession }
}

/** Synchroner Teil — RAM/Inbox-State via Event in `use-chat-view-inbox`. */
export function performEinsatzEndCacheWipeSync(
  options?: Pick<EinsatzEndCacheWipeOptions, 'clearTransportQueues'>
): Pick<EinsatzEndCacheWipeResult, 'removedLocalStorageKeys' | 'removedSessionStorageKeys'> {
  return wipeEinsatzLocalBrowserState(options)
}

/** Vollständiger Ablauf inkl. optionalem Server-Inbox-Cache. */
export async function performEinsatzEndCacheWipe(
  options: EinsatzEndCacheWipeOptions = {}
): Promise<EinsatzEndCacheWipeResult> {
  const local = wipeEinsatzLocalBrowserState(options)
  let serverInboxCleared = false
  let serverError: string | undefined

  if (options.clearServerInbox !== false) {
    const res = await clearLocalHistory({ shred: true })
    if (res.ok) serverInboxCleared = true
    else serverError = res.error
  }

  return {
    ok: !serverError,
    ...local,
    serverInboxCleared,
    serverError,
  }
}
