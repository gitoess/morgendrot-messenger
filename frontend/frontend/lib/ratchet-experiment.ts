/**
 * H.23 C1.5 — Opt-in Double-Ratchet Experiment (kein Produktiv-Default).
 * Flag + Encrypt/Decrypt-Hilfen; Send-Pfad nur wenn Flag an und Session existiert.
 */

import {
  createRatchetSessionPair,
  type RatchetCipherPacket,
} from '@morgendrot/shared/morgendrot-ratchet-session'
import {
  getRatchetSessionForPeer,
  putRatchetSessionForPeer,
} from '@/frontend/lib/ratchet-session-local-store'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'

export const RATCHET_EXPERIMENT_LS_KEY = 'morgendrot.experiment.doubleRatchet.v1'
export const RATCHET_EXPERIMENT_CHANGED = 'morgendrot:ratchet-experiment'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export function readRatchetExperimentEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(RATCHET_EXPERIMENT_LS_KEY) === '1'
  } catch {
    return false
  }
}

export function writeRatchetExperimentEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RATCHET_EXPERIMENT_LS_KEY, on ? '1' : '0')
    window.dispatchEvent(new CustomEvent(RATCHET_EXPERIMENT_CHANGED, { detail: { enabled: on } }))
  } catch {
    /* ignore */
  }
}

function norm(a: string): string {
  return a.trim().toLowerCase()
}

/**
 * Stellt Symmetric-Session für Peer sicher (neu aus ECDH-Shared oder Vault).
 * `ecdhShared` nur nötig wenn noch keine Session im Vault.
 * Rolle: lexikographisch kleinere Adresse = Alice (beide Seiten gleich).
 */
export async function ensureRatchetSessionForPeer(opts: {
  peerAddress: string
  ecdhShared?: Uint8Array
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!readRatchetExperimentEnabled()) {
    return { ok: false, error: 'Double-Ratchet-Experiment aus.' }
  }
  const peer = norm(opts.peerAddress)
  if (!HEX64.test(peer)) return { ok: false, error: 'Peer-Adresse ungültig.' }
  if (getRatchetSessionForPeer(peer)) return { ok: true }

  const meRaw = getDirectIotaSessionSignerAddress()?.trim()
  if (!meRaw || !HEX64.test(meRaw)) return { ok: false, error: 'Kein Session-Signer.' }
  const me = norm(meRaw)
  if (!opts.ecdhShared || opts.ecdhShared.length < 16) {
    return { ok: false, error: 'Kein ECDH-Shared für neue Ratchet-Session.' }
  }

  const [aliceAddr, bobAddr] = me < peer ? [me, peer] : [peer, me]
  const { alice, bob } = await createRatchetSessionPair(opts.ecdhShared, aliceAddr, bobAddr)
  putRatchetSessionForPeer(peer, me === aliceAddr ? alice : bob)
  return { ok: true }
}

export async function ratchetExperimentEncrypt(opts: {
  peerAddress: string
  plaintext: string
  msgId: string
}): Promise<{ ok: true; packet: RatchetCipherPacket } | { ok: false; error: string }> {
  if (!readRatchetExperimentEnabled()) {
    return { ok: false, error: 'Double-Ratchet-Experiment aus.' }
  }
  const peer = norm(opts.peerAddress)
  const session = getRatchetSessionForPeer(peer)
  if (!session) return { ok: false, error: 'Keine Ratchet-Session für Peer — zuerst Handshake/ECDH.' }
  try {
    const packet = await session.encrypt(opts.plaintext, opts.msgId)
    putRatchetSessionForPeer(peer, session)
    return { ok: true, packet }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function ratchetExperimentDecrypt(opts: {
  peerAddress: string
  packet: RatchetCipherPacket
}): Promise<{ ok: true; plaintext: string } | { ok: false; error: string }> {
  if (!readRatchetExperimentEnabled()) {
    return { ok: false, error: 'Double-Ratchet-Experiment aus.' }
  }
  const peer = norm(opts.peerAddress)
  const session = getRatchetSessionForPeer(peer)
  if (!session) return { ok: false, error: 'Keine Ratchet-Session für Peer.' }
  try {
    const plaintext = await session.decrypt(opts.packet)
    putRatchetSessionForPeer(peer, session)
    return { ok: true, plaintext }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Send-Hook: wenn Flag an + Session existiert → RATCHET_V3-Wire; sonst `null` (Caller bleibt bei v2).
 * Kein Composer-Default — Caller muss Flag/Session prüfen.
 */
export async function tryRatchetExperimentWrapOutgoing(opts: {
  peerAddress: string
  plaintext: string
  msgId: string
}): Promise<{ wire: string } | null> {
  if (!readRatchetExperimentEnabled()) return null
  if (!getRatchetSessionForPeer(norm(opts.peerAddress))) return null
  const enc = await ratchetExperimentEncrypt(opts)
  if (!enc.ok) return null
  return { wire: encodeRatchetPacketWire(enc.packet) }
}

/**
 * Decrypt-Hook: erkennt RATCHET_V3-Wire und entschlüsselt bei Flag+Session; sonst `null`.
 */
export async function tryRatchetExperimentUnwrapIncoming(opts: {
  peerAddress: string
  raw: string
}): Promise<{ plaintext: string } | null> {
  if (!readRatchetExperimentEnabled()) return null
  const decoded = decodeRatchetPacketWire(opts.raw)
  if (!decoded.ok) return null
  const dec = await ratchetExperimentDecrypt({
    peerAddress: opts.peerAddress,
    packet: decoded.packet,
  })
  if (!dec.ok) return null
  return { plaintext: dec.plaintext }
}

/** Packet → transportierbarer JSON-String (noch kein IOTA-Send). */
export function encodeRatchetPacketWire(packet: RatchetCipherPacket): string {
  let body = ''
  for (let i = 0; i < packet.body.length; i++) body += String.fromCharCode(packet.body[i]!)
  const bodyB64 = btoa(body)
  return JSON.stringify({
    morg: 'RATCHET_V3',
    header: packet.header,
    bodyB64,
  })
}

export function decodeRatchetPacketWire(
  raw: string
): { ok: true; packet: RatchetCipherPacket } | { ok: false; error: string } {
  try {
    const j = JSON.parse(raw) as { morg?: string; header?: RatchetCipherPacket['header']; bodyB64?: string }
    if (j.morg !== 'RATCHET_V3' || !j.header || typeof j.bodyB64 !== 'string') {
      return { ok: false, error: 'Kein RATCHET_V3-Wire.' }
    }
    const bin = atob(j.bodyB64)
    const body = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) body[i] = bin.charCodeAt(i)
    return { ok: true, packet: { header: j.header, body } }
  } catch {
    return { ok: false, error: 'RATCHET_V3-Wire ungültig.' }
  }
}
