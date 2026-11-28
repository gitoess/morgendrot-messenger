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
/** API+Direct entpacken dieselbe Wire zweimal — Cache verhindert Replay-Fail + forceNew-Desync. */
const incomingPlainByMsgId = new Map<string, { text: string; at: number }>()
/** ECDH-Shared-Fingerprint pro Peer — Live-Pub ≠ Archiv-Pub → Session neu. */
const sessionSharedFpByPeer = new Map<string, string>()
const PLAIN_TTL_MS = 1000 * 60 * 60 * 12
/** Persistenz: Sender sieht Visitenkarte/Klartext nach Reload (opt-in Ratchet). */
const OUTGOING_PLAIN_LS_KEY = 'morgendrot.ratchet.outgoingPlain.v1'
const OUTGOING_PLAIN_LS_MAX = 80

function hydrateOutgoingPlainFromLs(): void {
  if (typeof window === 'undefined') return
  if (outgoingPlainByMsgId.size > 0) return
  try {
    const raw = window.localStorage.getItem(OUTGOING_PLAIN_LS_KEY)?.trim()
    if (!raw) return
    const j = JSON.parse(raw) as Record<string, { text?: string; at?: number }>
    const cut = Date.now() - PLAIN_TTL_MS
    for (const [k, v] of Object.entries(j)) {
      if (!v || typeof v.text !== 'string' || typeof v.at !== 'number') continue
      if (v.at < cut || !v.text.trim()) continue
      outgoingPlainByMsgId.set(k, { text: v.text, at: v.at })
    }
  } catch {
    /* ignore */
  }
}

function persistOutgoingPlainToLs(): void {
  if (typeof window === 'undefined') return
  try {
    const cut = Date.now() - PLAIN_TTL_MS
    const entries = [...outgoingPlainByMsgId.entries()]
      .filter(([, v]) => v.at >= cut && v.text.trim())
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, OUTGOING_PLAIN_LS_MAX)
    const obj: Record<string, { text: string; at: number }> = {}
    for (const [k, v] of entries) obj[k] = v
    window.localStorage.setItem(OUTGOING_PLAIN_LS_KEY, JSON.stringify(obj))
  } catch {
    /* ignore */
  }
}

/** Kurz-Fingerprint des ECDH-Shared (nicht geheim; Wire-Auswahl welches Peer-Pub). */
export function sharedSecretFingerprint(shared: Uint8Array): string {
  const n = Math.min(8, shared.length)
  let s = ''
  for (let i = 0; i < n; i++) s += shared[i]!.toString(16).padStart(2, '0')
  return s
}

function isRatchetReplayError(err: string): boolean {
  const e = err.toLowerCase()
  return e.includes('zu alt') || e.includes('verbrauch') || e.includes('bereits')
}

export function readRatchetExperimentEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(RATCHET_EXPERIMENT_LS_KEY) === '1'
  } catch {
    return false
  }
}

/** Abmelden / hartes Lock: Ratchet-Sender-Echo weg (nicht Soft-Pause). */
export function clearRatchetOutgoingPlainOnLock(): void {
  outgoingPlainByMsgId.clear()
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(OUTGOING_PLAIN_LS_KEY)
  } catch {
    /* ignore */
  }
}

export function writeRatchetExperimentEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RATCHET_EXPERIMENT_LS_KEY, on ? '1' : '0')
    /** Beim Einschalten Sessions verwerfen — sonst A/B mit divergenten States → Roh-JSON im Chat. */
    if (on) {
      purgeRatchetSessionVault()
      clearRatchetOutgoingPlainOnLock()
      incomingPlainByMsgId.clear()
      sessionSharedFpByPeer.clear()
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

function plainCacheKey(peer: string, msgId: string): string {
  return `${norm(peer)}|${String(msgId).trim()}`
}

function prunePlainMaps(): void {
  const cut = Date.now() - PLAIN_TTL_MS
  for (const [k, v] of outgoingPlainByMsgId) {
    if (v.at < cut) outgoingPlainByMsgId.delete(k)
  }
  for (const [k, v] of incomingPlainByMsgId) {
    if (v.at < cut) incomingPlainByMsgId.delete(k)
  }
}

function rememberOutgoingPlainEntry(key: string, text: string): void {
  if (!key || !text) return
  outgoingPlainByMsgId.set(key, { text, at: Date.now() })
}

/** Sekundär-Index: bodyB64-Präfix — Fallback wenn msgId/Peer nach Reload divergieren. */
export function ratchetOutgoingBodyCacheKey(peerAddress: string, ratchetWire: string): string | null {
  try {
    const j = JSON.parse(ratchetWire.trim()) as { morg?: string; bodyB64?: unknown }
    if (j.morg !== 'RATCHET_V3' || typeof j.bodyB64 !== 'string' || !j.bodyB64) return null
    return `${norm(peerAddress)}|body:${j.bodyB64.slice(0, 48)}`
  } catch {
    return null
  }
}

export function rememberRatchetOutgoingPlaintext(peerAddress: string, msgId: string, plaintext: string): void {
  const id = String(msgId).trim()
  const text = plaintext.trim()
  if (!id || !text) return
  hydrateOutgoingPlainFromLs()
  prunePlainMaps()
  rememberOutgoingPlainEntry(plainCacheKey(peerAddress, id), text)
  persistOutgoingPlainToLs()
}

/** Nach Wrap: msgId + Wire-Body-Index (Sender-Echo nach Chain-Reload). */
export function rememberRatchetOutgoingPlaintextFromWire(
  peerAddress: string,
  msgId: string,
  plaintext: string,
  ratchetWire: string
): void {
  const text = plaintext.trim()
  if (!text) return
  hydrateOutgoingPlainFromLs()
  prunePlainMaps()
  const id = String(msgId).trim()
  if (id) rememberOutgoingPlainEntry(plainCacheKey(peerAddress, id), text)
  const bodyKey = ratchetOutgoingBodyCacheKey(peerAddress, ratchetWire)
  if (bodyKey) rememberOutgoingPlainEntry(bodyKey, text)
  persistOutgoingPlainToLs()
}

export function lookupRatchetOutgoingPlaintext(peerAddress: string, msgId: string): string | null {
  hydrateOutgoingPlainFromLs()
  prunePlainMaps()
  const id = String(msgId).trim()
  if (!id) return null
  const direct = outgoingPlainByMsgId.get(plainCacheKey(peerAddress, id))?.text
  if (direct) return direct
  /** Peer in Inbox-Meta manchmal leer/anders — msgId allein reicht für Echo. */
  const suffix = `|${id}`
  for (const [k, v] of outgoingPlainByMsgId) {
    if (k.endsWith(suffix) && !k.includes('|body:')) return v.text
  }
  return null
}

export function lookupRatchetOutgoingPlaintextByWire(peerAddress: string, ratchetWire: string): string | null {
  hydrateOutgoingPlainFromLs()
  prunePlainMaps()
  const bodyKey = ratchetOutgoingBodyCacheKey(peerAddress, ratchetWire)
  if (bodyKey) {
    const hit = outgoingPlainByMsgId.get(bodyKey)?.text
    if (hit) return hit
  }
  /** body-Präfix ohne Peer-Match (Meta fehlte beim Merken andersherum). */
  try {
    const j = JSON.parse(ratchetWire.trim()) as { bodyB64?: unknown }
    if (typeof j.bodyB64 === 'string' && j.bodyB64) {
      const needle = `|body:${j.bodyB64.slice(0, 48)}`
      for (const [k, v] of outgoingPlainByMsgId) {
        if (k.endsWith(needle)) return v.text
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

export function rememberRatchetIncomingPlaintext(peerAddress: string, msgId: string, plaintext: string): void {
  const id = String(msgId).trim()
  const text = plaintext.trim()
  if (!id || !text) return
  prunePlainMaps()
  incomingPlainByMsgId.set(plainCacheKey(peerAddress, id), { text, at: Date.now() })
}

export function lookupRatchetIncomingPlaintext(peerAddress: string, msgId: string): string | null {
  prunePlainMaps()
  return incomingPlainByMsgId.get(plainCacheKey(peerAddress, msgId))?.text ?? null
}

export function peekRatchetWireMsgId(raw: string): string | null {
  const decoded = decodeRatchetPacketWire(raw.trim())
  if (!decoded.ok) return null
  const id = String(decoded.packet.header.msgId ?? '').trim()
  return id || null
}

/** Optionaler Shared-Fingerprint aus dem Wire (Sender markiert, welches ECDH). */
export function peekRatchetWireRkFp(raw: string): string | null {
  try {
    const j = JSON.parse(raw.trim()) as { morg?: string; rkFp?: unknown }
    if (j.morg !== 'RATCHET_V3') return null
    const fp = typeof j.rkFp === 'string' ? j.rkFp.trim().toLowerCase() : ''
    return fp || null
  } catch {
    return null
  }
}

export function getRatchetSessionSharedFingerprint(peerAddress: string): string | null {
  return sessionSharedFpByPeer.get(norm(peerAddress)) ?? null
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
  let forceNew = Boolean(opts.forceNew)
  if (
    !forceNew &&
    opts.ecdhShared &&
    opts.ecdhShared.length >= 16 &&
    getRatchetSessionForPeer(peer)
  ) {
    const prev = sessionSharedFpByPeer.get(peer)
    const now = sharedSecretFingerprint(opts.ecdhShared)
    if (!prev) sessionSharedFpByPeer.set(peer, now)
    else if (prev !== now) forceNew = true
  }
  if (forceNew) {
    removeRatchetSessionForPeer(peer)
    sessionSharedFpByPeer.delete(peer)
  }
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
  sessionSharedFpByPeer.set(peer, sharedSecretFingerprint(opts.ecdhShared))
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
    const wire = encodeRatchetPacketWire(packet, sessionSharedFpByPeer.get(peer) ?? undefined)
    rememberRatchetOutgoingPlaintextFromWire(peer, opts.msgId, opts.plaintext, wire)
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
  const peer = norm(opts.peerAddress)
  if (!getRatchetSessionForPeer(peer)) return null
  const enc = await ratchetExperimentEncrypt(opts)
  if (!enc.ok) return null
  const rkFp = sessionSharedFpByPeer.get(peer) ?? undefined
  return { wire: encodeRatchetPacketWire(enc.packet, rkFp) }
}

/**
 * Decrypt-Hook: erkennt RATCHET_V3-Wire und entschlüsselt bei Flag+Session; sonst `null`.
 * Bei Auth/Drift-Fail einmal Session aus ECDH neu (nicht bei Replay — sonst A↔B-Desync).
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

  const msgId = String(decoded.packet.header.msgId ?? '').trim()
  if (msgId) {
    const cached = lookupRatchetIncomingPlaintext(opts.peerAddress, msgId)
    if (cached) return { plaintext: cached }
  }

  const attempt = async () =>
    ratchetExperimentDecrypt({
      peerAddress: opts.peerAddress,
      packet: decoded.packet,
    })

  let dec = await attempt()
  if (dec.ok) {
    if (msgId) rememberRatchetIncomingPlaintext(opts.peerAddress, msgId, dec.plaintext)
    return { plaintext: dec.plaintext }
  }

  /** Replay (API+Direct / Poll): Session nicht forceNew-zerstören. */
  if (isRatchetReplayError(dec.error)) {
    if (msgId) {
      const cached = lookupRatchetIncomingPlaintext(opts.peerAddress, msgId)
      if (cached) return { plaintext: cached }
    }
    return null
  }

  if (opts.ecdhShared && opts.ecdhShared.length >= 16) {
    const ensured = await ensureRatchetSessionForPeer({
      peerAddress: opts.peerAddress,
      ecdhShared: opts.ecdhShared,
      localAddress: opts.localAddress,
      forceNew: true,
    })
    if (ensured.ok) {
      dec = await attempt()
      if (dec.ok) {
        if (msgId) rememberRatchetIncomingPlaintext(opts.peerAddress, msgId, dec.plaintext)
        return { plaintext: dec.plaintext }
      }
    }
  }
  return null
}

/** Packet → transportierbarer JSON-String (noch kein IOTA-Send). */
export function encodeRatchetPacketWire(packet: RatchetCipherPacket, rkFp?: string): string {
  let body = ''
  for (let i = 0; i < packet.body.length; i++) body += String.fromCharCode(packet.body[i]!)
  const bodyB64 = btoa(body)
  const fp = rkFp?.trim().toLowerCase()
  return JSON.stringify({
    morg: 'RATCHET_V3',
    header: packet.header,
    bodyB64,
    ...(fp ? { rkFp: fp } : {}),
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
