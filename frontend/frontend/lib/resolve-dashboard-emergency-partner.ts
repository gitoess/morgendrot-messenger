'use client'

import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { lookupContactAddressByLabel } from '@/frontend/lib/contact-display'
import { readConnectedPeersSnapshot } from '@/frontend/lib/connected-peers-snapshot'

const ADDR_64_LOWER = /^0x[a-f0-9]{64}$/
const PEERS_SNAPSHOT_KEY = 'morgendrot.connectedPeersSnapshot.v1'
const CONTACT_DIRECTORY_KEY = 'morgendrot.contacts.directory.v1'

function normalizeAddr(a: string): string | null {
  const t = String(a || '').trim().toLowerCase()
  return ADDR_64_LOWER.test(t) ? t : null
}

function readHandoffDirectoryBoss(me: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONTACT_DIRECTORY_KEY)
    if (!raw) return null
    const env = JSON.parse(raw) as { directory?: Record<string, ContactMeshEntryClient> }
    const directory = env.directory && typeof env.directory === 'object' ? env.directory : {}
    for (const [addr, entry] of Object.entries(directory)) {
      const normalized = normalizeAddr(addr)
      if (!normalized || normalized === me) continue
      const lab = String(entry?.label || '').trim().toLowerCase()
      if (lab === 'boss' || lab.includes('boss')) return normalized
    }
  } catch {
    /* ignore */
  }
  return null
}

function readLegacyPeerSnapshot(me: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PEERS_SNAPSHOT_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as { peers?: Array<{ address?: string } | string> }
    const peers = Array.isArray(j.peers) ? j.peers : []
    for (const peer of peers) {
      const a = normalizeAddr(typeof peer === 'string' ? peer : String(peer?.address || ''))
      if (a && a !== me) return a
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Boss/Partner für Dashboard-SOS, wenn Composer noch leer ist (Handoff, Telefonbuch, Peers). */
export function resolveDashboardEmergencyPartner(p: {
  directory: Record<string, ContactMeshEntryClient>
  myAddress: string
}): string | null {
  const me = normalizeAddr(p.myAddress)
  if (!me) return null

  const fromLabel = lookupContactAddressByLabel(p.directory, 'Boss')
  if (fromLabel) {
    const normalized = normalizeAddr(fromLabel)
    if (normalized && normalized !== me) return normalized
  }

  for (const [addr, entry] of Object.entries(p.directory)) {
    const normalized = normalizeAddr(addr)
    if (!normalized || normalized === me) continue
    const lab = String(entry?.label || '').trim().toLowerCase()
    if (lab === 'boss' || lab.includes('boss')) return normalized
  }

  const fromHandoffDir = readHandoffDirectoryBoss(me)
  if (fromHandoffDir) return fromHandoffDir

  const snap = readConnectedPeersSnapshot()
  for (const a of snap?.addresses ?? []) {
    if (a !== me) return a
  }

  return readLegacyPeerSnapshot(me)
}
