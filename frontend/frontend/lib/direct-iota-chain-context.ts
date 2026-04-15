'use client'

/**
 * Snapshot für **Direkt-IOTA**-Mailbox-Submit (Klartext-Pfad): Package, Mailbox, Absender, TTL.
 * Wird aus `/api/status` + `/api/current-ids` befüllt (wenn Basis erreichbar) und in localStorage gespiegelt
 * für den Fall „Basis aus, RPC + Mnemonic noch da“.
 */
import type { ApiStatus } from '@/frontend/lib/api/status'
import { isLikelyIotaHexId } from '@morgendrot/core/iota'

const LS_PKG = 'morgendrot.directChain.packageId'
const LS_MB = 'morgendrot.directChain.mailboxId'
const LS_SENDER = 'morgendrot.directChain.senderAddress'
const LS_TTL = 'morgendrot.directChain.ttlDays'
const LS_FLAGS = 'morgendrot.directChain.flagsJson'

export type DirectMailboxDrainFlags = {
  useMailbox: boolean
  mailboxStorePlaintext: boolean
  messengerCreditsConfigured: boolean
}

export type DirectMailboxChainSnapshot = {
  packageId: string
  mailboxId: string
  senderAddress: string
  ttlDays: bigint
  flags: DirectMailboxDrainFlags
}

let memorySnapshot: DirectMailboxChainSnapshot | null = null
let memoryFlagsOnly: DirectMailboxDrainFlags | null = null

function readFlagsFromLs(): DirectMailboxDrainFlags | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_FLAGS)?.trim()
    if (!raw) return null
    const j = JSON.parse(raw) as Record<string, unknown>
    return {
      useMailbox: j.useMailbox === true,
      mailboxStorePlaintext: j.mailboxStorePlaintext === true,
      messengerCreditsConfigured: j.messengerCreditsConfigured === true,
    }
  } catch {
    return null
  }
}

export function persistDirectMailboxChainSnapshot(s: DirectMailboxChainSnapshot): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_PKG, s.packageId.trim())
    window.localStorage.setItem(LS_MB, s.mailboxId.trim())
    window.localStorage.setItem(LS_SENDER, s.senderAddress.trim())
    window.localStorage.setItem(LS_TTL, s.ttlDays.toString())
    window.localStorage.setItem(
      LS_FLAGS,
      JSON.stringify({
        useMailbox: s.flags.useMailbox,
        mailboxStorePlaintext: s.flags.mailboxStorePlaintext,
        messengerCreditsConfigured: s.flags.messengerCreditsConfigured,
      })
    )
    memorySnapshot = s
  } catch {
    /* ignore */
  }
}

export function loadDirectMailboxChainSnapshotFromLs(): DirectMailboxChainSnapshot | null {
  if (typeof window === 'undefined') return memorySnapshot
  try {
    const packageId = window.localStorage.getItem(LS_PKG)?.trim() ?? ''
    const mailboxId = window.localStorage.getItem(LS_MB)?.trim() ?? ''
    const senderAddress = window.localStorage.getItem(LS_SENDER)?.trim() ?? ''
    const ttlRaw = window.localStorage.getItem(LS_TTL)?.trim() ?? '30'
    const ttlN = parseInt(ttlRaw, 10)
    const ttlDays = BigInt(Number.isFinite(ttlN) && ttlN > 0 && ttlN <= 3650 ? ttlN : 30)
    if (!isLikelyIotaHexId(packageId) || !isLikelyIotaHexId(mailboxId) || !isLikelyIotaHexId(senderAddress)) {
      return memorySnapshot
    }
    const flags = memoryFlagsOnly ?? {
      useMailbox: true,
      mailboxStorePlaintext: true,
      messengerCreditsConfigured: false,
    }
    const snap: DirectMailboxChainSnapshot = {
      packageId,
      mailboxId,
      senderAddress,
      ttlDays,
      flags,
    }
    memorySnapshot = snap
    return snap
  } catch {
    return memorySnapshot
  }
}

export function getDirectMailboxChainSnapshot(): DirectMailboxChainSnapshot | null {
  return memorySnapshot ?? loadDirectMailboxChainSnapshotFromLs()
}

export function syncDirectMailboxFlagsFromApiStatus(status: ApiStatus): void {
  memoryFlagsOnly = {
    useMailbox: status.useMailbox === true,
    mailboxStorePlaintext: status.mailboxStorePlaintext === true,
    messengerCreditsConfigured: status.messengerCreditsConfigured === true,
  }
  if (memorySnapshot) {
    memorySnapshot = { ...memorySnapshot, flags: memoryFlagsOnly }
    persistDirectMailboxChainSnapshot(memorySnapshot)
  } else if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LS_FLAGS, JSON.stringify(memoryFlagsOnly))
    } catch {
      /* ignore */
    }
  }
}

export function applyDirectMailboxChainSnapshotFromNetworkIds(j: {
  packageId?: string
  mailboxId?: string
  myAddress?: string
}): void {
  const packageId = (j.packageId || '').trim()
  const mailboxId = (j.mailboxId || '').trim()
  const senderAddress = (j.myAddress || '').trim()
  if (!isLikelyIotaHexId(packageId) || !isLikelyIotaHexId(mailboxId) || !isLikelyIotaHexId(senderAddress)) return
  const flags = memoryFlagsOnly ?? readFlagsFromLs() ?? {
    useMailbox: true,
    mailboxStorePlaintext: true,
    messengerCreditsConfigured: false,
  }
  const ttlDays = memorySnapshot?.ttlDays ?? BigInt(30)
  persistDirectMailboxChainSnapshot({ packageId, mailboxId, senderAddress, ttlDays, flags })
}

export function canUseDirectPlaintextMailboxDrain(): boolean {
  const s = getDirectMailboxChainSnapshot()
  if (!s) return false
  if (!s.flags.useMailbox || !s.flags.mailboxStorePlaintext) return false
  if (s.flags.messengerCreditsConfigured) return false
  return true
}

/** `store_encrypted_message` ohne Credits — Mailbox an, keine Messenger-Credits (Credits-Pfad = separates PTB). */
export function canUseDirectEncryptedMailboxDrain(): boolean {
  const s = getDirectMailboxChainSnapshot()
  if (!s) return false
  if (!s.flags.useMailbox) return false
  if (s.flags.messengerCreditsConfigured) return false
  return true
}

export function persistDirectMailboxTtlDays(ttlDays: bigint): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_TTL, ttlDays.toString())
    if (memorySnapshot) memorySnapshot = { ...memorySnapshot, ttlDays }
  } catch {
    /* ignore */
  }
}
