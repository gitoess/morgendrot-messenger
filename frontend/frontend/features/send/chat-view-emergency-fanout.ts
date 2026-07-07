'use client'

import { parseComposerIotaRecipientAddresses } from '@/frontend/lib/composer-recipient-fields'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { SendPartOk } from '@/frontend/features/send/chat-view-handle-send-part-types'

const ADDR_64_LOWER = /^0x[a-f0-9]{64}$/

export type EmergencyFanOutLeg = 'mesh' | 'internet'

export type EmergencyFanOutLegResult = {
  leg: EmergencyFanOutLeg
  ok: boolean
  detail?: string
}

export function planEmergencyFanOutLegs(p: {
  isPrivate: boolean
  plainMailboxRecipient: string
  composerRecipient: string
  composerPartner: string
  groupMailboxInternetChain: boolean
}): EmergencyFanOutLeg[] {
  const legs: EmergencyFanOutLeg[] = ['mesh']
  if (p.groupMailboxInternetChain) {
    legs.push('internet')
    return legs
  }
  const targets = parseComposerIotaRecipientAddresses(p.composerRecipient, p.composerPartner, false)
  const plain = p.plainMailboxRecipient.trim().toLowerCase()
  if (targets.length > 0 || ADDR_64_LOWER.test(plain)) {
    legs.push('internet')
  }
  if (!p.isPrivate && legs.length === 1) {
    /** Öffentlicher Kanal ohne 0x-Ziel: nur Funk. */
    return legs
  }
  return legs
}

export function formatEmergencyFanOutStatus(results: EmergencyFanOutLegResult[]): string {
  return results
    .map((r) => {
      const label = r.leg === 'mesh' ? 'Funk' : 'Online'
      if (r.ok) return `${label} OK`
      const tail = r.detail?.trim()
      return tail ? `${label}: ${tail}` : `${label} fehlgeschlagen`
    })
    .join(' · ')
}

export function emergencyFanOutAnyOk(results: EmergencyFanOutLegResult[]): boolean {
  return results.some((r) => r.ok)
}

export async function runEmergencyFanOut(
  legs: EmergencyFanOutLeg[],
  sendForTransport: (
    transport: ForcedTransport
  ) => Promise<{ ok: boolean; part?: SendPartOk; detail?: string }>
): Promise<{ results: EmergencyFanOutLegResult[]; best: SendPartOk | null }> {
  const results: EmergencyFanOutLegResult[] = []
  let best: SendPartOk | null = null

  await Promise.all(
    legs.map(async (leg) => {
      const transport: ForcedTransport = leg === 'mesh' ? 'mesh' : 'internet'
      const attempt = await sendForTransport(transport)
      results.push({ leg, ok: attempt.ok, detail: attempt.detail })
      if (attempt.ok && attempt.part) {
        if (!best || leg === 'internet') best = attempt.part
      }
    })
  )

  results.sort((a, b) => (a.leg === 'mesh' ? -1 : 1) - (b.leg === 'mesh' ? -1 : 1))
  return { results, best }
}
