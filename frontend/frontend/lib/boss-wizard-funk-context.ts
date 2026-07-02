'use client'

import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { parseMeshtasticNodeIdToNumber } from '@/frontend/lib/meshtastic-node-id'

export type BossFunkWizardStatus = {
  stickConnected: boolean
  nodeIdConfigured: boolean
  /** Stick verbunden oder Node-ID gespeichert — reicht für „Weiter“. */
  readyMinimal: boolean
}

export function resolveBossOwnMeshNodeId(
  ownAddress: string,
  contactDirectory?: Record<string, ContactMeshEntryClient> | null
): string {
  const key = ownAddress.trim().toLowerCase()
  if (!key) return ''
  const direct = contactDirectory?.[key]?.meshNodeId?.trim()
  if (direct) return direct
  for (const [k, entry] of Object.entries(contactDirectory ?? {})) {
    if (k.trim().toLowerCase() === key && entry.meshNodeId?.trim()) {
      return entry.meshNodeId.trim()
    }
  }
  return ''
}

export function isLikelyMeshtasticNodeId(raw: string): boolean {
  return parseMeshtasticNodeIdToNumber(raw.trim()) != null
}

export function deriveBossFunkWizardStatus(opts: {
  connected: boolean
  savedNodeId?: string
  nodeIdDraft?: string
}): BossFunkWizardStatus {
  const saved = opts.savedNodeId?.trim() || ''
  const draft = opts.nodeIdDraft?.trim() || ''
  const nodeOk = Boolean(saved || (draft && isLikelyMeshtasticNodeId(draft)))
  const stickConnected = opts.connected
  return {
    stickConnected,
    nodeIdConfigured: nodeOk,
    readyMinimal: stickConnected || nodeOk,
  }
}
