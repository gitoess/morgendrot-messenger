import type { ApiStatus } from '@/frontend/lib/api'
import type { ContactSendMailboxTarget } from '@/frontend/lib/contact-mailbox-slots'
import { isSimpleUiMode } from '@/frontend/lib/messenger-role-capabilities'
import { readActiveSendMailboxObjectId } from '@/frontend/lib/my-mailbox-active'
import { readCachedServerMailboxObjectId } from '@/frontend/lib/my-private-mailbox-store'
import { resolveActiveProfileMailboxId } from '@/frontend/lib/package-profile-inbox'

const HEX64 = /^0x[a-f0-9]{64}$/i

/** Erst-Send an neuen Kontakt: Consumer → Event; Einsatz → aktive oder Server-Mailbox. */
export function defaultContactSendMailboxTarget(apiStatus?: ApiStatus | null): ContactSendMailboxTarget {
  if (isSimpleUiMode(apiStatus) || apiStatus?.deploymentProfile === 'consumer') return 'event'
  const active = readActiveSendMailboxObjectId().trim()
  if (HEX64.test(active)) return 'own'
  const profileMb = resolveActiveProfileMailboxId()
  if (HEX64.test(profileMb ?? '')) return 'server'
  const server = readCachedServerMailboxObjectId().trim()
  if (HEX64.test(server)) return 'server'
  return 'event'
}
