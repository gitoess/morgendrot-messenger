/**
 * H.23 C1.5/C1.6 — Opt-in Double-Ratchet Experiment (kein Produktiv-Default).
 * Flag + Encrypt/Decrypt-Hilfen; Send-Pfad nur wenn Flag an und Session existiert.
 */

import {
  createRatchetSessionPair,
  type RatchetCipherPacket,
} from '@morgendrot/shared/morgendrot-ratchet-session'
import {
  getRatchetSessionForPeer,
  purgeRatchetSessionVault,
  putRatchetSessionForPeer,
  removeRatchetSessionForPeer,
} from '@/frontend/lib/ratchet-session-local-store'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'

export const RATCHET_EXPERIMENT_LS_KEY = 'morgendrot.experiment.doubleRatchet.v1'
export const RATCHET_EXPERIMENT_CHANGED = 'morgendrot:ratchet-experiment'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

/** Kurzlebiger Klartext für eigene Ausgangs-Zeilen (Empfangs-Chain kann eigene Sends nicht öffnen). */
const outgoingPlainByMsgId = new Map<string, { text: string; at: number }>()
const OUTGOING_PLAIN_TTL_MS = 1000 * 60 * 60 * 12

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
    /** Beim Einschalten Sessions verwerfen — sonst A/B mit divergenten States → Roh-JSON im Chat. */
    if (on) {
      purgeRatchetSessionVault()
      outgoingPlainByMsgId.clear()
    }
    window.dispatchEvent(new CustomEvent(RATCHET_EXPERIMENT_CHANGED, { detail: { enabled: on } }))
  } catch {
    /* ignore */
  }
}

/** Innere Lage erkannt (nach Session-Keys+-Decrypt), noch nicht Ratchet-Klartext. */
export function looksLikeRatchetV3Wire(raw: string): boolean {
  const t = raw.trim()
  if (!t.startsWith('{') || !t.includes('RATCHET_V3')) return false
  return decodeRatchetPacketWire(t).ok
}

function norm(a: string): string {
  return a.trim().toLowerCase()
}

function outgoingKey(peer: string, msgId: string): string {
  return `${norm(peer)}|${String(msgId).trim()}`
}

function pruneOutgoingPlain(): void {
  const cut = Date.now() - OUTGOING_PLAIN_TTL_MS
  for (const [k, v] of outgoingPlainByMsgId) {
    if (v.at < cut) outgoingPlainByMsgId.delete(k)
  }
}

export function rememberRatchetOutgoingPlaintext(peerAddress: string, msgId: string, plaintext: string): void {
  const id = String(msgId).trim()
  const text = plaintext.trim()
  if (!id || !text) return
  pruneOutgoingPlain()
  outgoingPlainByMsgId.set(outgoingKey(peerAddress, id), { text, at: Date.now() })
}

export function lookupRatchetOutgoingPlaintext(peerAddress: string, msgId: string): string | null {
  pruneOutgoingPlain()
  return outgoingPlainByMsgId.get(outgoingKey(peerAddress, msgId))?.text ?? null
}

export function peekRatchetWireMsgId(raw: string): string | null {
  const decoded = decodeRatchetPacketWire(raw.trim())
  if (!decoded.ok) return null
  const id = String(decoded.packet.header.msgId ?? '').trim()
  return id || null
}

/**
 * Stellt Symmetric-Session für Peer sicher (neu aus ECDH-Shared oder Vault).
 * `ecdhShared` nötig wenn noch keine Session / forceNew.
 * Rolle: lexikographisch kleinere Adresse = Alice (beide Seiten gleich).
 */
export async function ensureRatchetSessionForPeer(opts: {
  peerAddress: string
  ecdhShared?: Uint8Array
  /** Fallback wenn Session-Signer-Adresse fehlt (Chain-Snapshot). */
  localAddress?: string
  /** Stale Session verwerfen und neu aus ECDH ableiten. */
  forceNew?: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!readRatchetExperimentEnabled()) {
    return { ok: false, error: 'Double-Ratchet-Experiment aus.' }
  }
  const peer = norm(opts.peerAddress)
  if (!HEX64.test(peer)) return { ok: false, error: 'Peer-Adresse ungültig.' }
  if (opts.forceNew) removeRatchetSessionForPeer(peer)
  if (getRatchetSessionForPeer(peer)) return { ok: true }

  const meRaw = (opts.localAddress || getDirectIotaSessionSignerAddress() || '').trim()
  if (!meRaw || !HEX64.test(meRaw)) return { ok: false, error: 'Kein Session-Signer / lokale Adresse.' }
  const me = norm(meRaw)
  if (me === peer) return { ok: false, error: 'Ratchet: lokale Adresse = Peer.' }
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
    rememberRatchetOutgoingPlaintext(peer, opts.msgId, opts.plaintext)
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
 * Bei Fail einmal Session aus ECDH neu aufbauen (divergente States nach Opt-in).
 */
export async function tryRatchetExperimentUnwrapIncoming(opts: {
  peerAddress: string
  raw: string
  ecdhShared?: Uint8Array
  localAddress?: string
}): Promise<{ plaintext: string } | null> {
  if (!readRatchetExperimentEnabled()) return null
  const decoded = decodeRatchetPacketWire(opts.raw)
  if (!decoded.ok) return null

  const attempt = async () =>
    ratchetExperimentDecrypt({
      peerAddress: opts.peerAddress,
      packet: decoded.packet,
    })

  let dec = await attempt()
  if (dec.ok) return { plaintext: dec.plaintext }

  if (opts.ecdhShared && opts.ecdhShared.length >= 16) {
    const ensured = await ensureRatchetSessionForPeer({
      peerAddress: opts.peerAddress,
      ecdhShared: opts.ecdhShared,
      localAddress: opts.localAddress,
      forceNew: true,
    })
    if (ensured.ok) {
      dec = await attempt()
      if (dec.ok) return { plaintext: dec.plaintext }
    }
  }
  return null
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
