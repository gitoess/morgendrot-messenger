/**
 * Gruppenchat (M2a): Mailbox-Persistenz an alle Mitglieder = N× pairwise TX (kein Chain-Gruppenraum).
 */
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'

const LS_SEND_ALL = 'morgendrot.groupMailboxSendAll.v1'
const ADDR_64 = /^0x[a-f0-9]{64}$/

export function readGroupMailboxSendAll(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = window.localStorage.getItem(LS_SEND_ALL)
    if (v === '0') return false
    return true
  } catch {
    return true
  }
}

export function writeGroupMailboxSendAll(value: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_SEND_ALL, value ? '1' : '0')
}

export function resolveGroupMailboxSendTargets(p: {
  activeGroup: MessengerGroupDefinition | null
  myAddress: string
  composerRecipient: string
  sendAllMembers: boolean
}): string[] {
  const { activeGroup, myAddress, composerRecipient, sendAllMembers } = p
  if (!activeGroup) return []
  const me = myAddress.trim().toLowerCase()
  if (!sendAllMembers) {
    const one = composerRecipient.trim().toLowerCase()
    return ADDR_64.test(one) && one !== me ? [one] : []
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of activeGroup.memberAddresses) {
    const a = raw.trim().toLowerCase()
    if (!ADDR_64.test(a) || a === me || seen.has(a)) continue
    seen.add(a)
    out.push(a)
  }
  return out
}

export function groupMailboxTargetCount(activeGroup: MessengerGroupDefinition | null, myAddress: string): number {
  if (!activeGroup) return 0
  return resolveGroupMailboxSendTargets({
    activeGroup,
    myAddress,
    composerRecipient: '',
    sendAllMembers: true,
  }).length
}
