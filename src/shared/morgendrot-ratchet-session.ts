/**
 * H.23 C1.2 — Ratchet PoC (in-memory).
 *
 * C1.2a: Symmetric Ratchet (gespiegelte Chains aus Root).
 * C1.2b: DH-Ratchet — Header `dh` = echte P-256 SPKI (base64url); KDF_RK(RK, ECDH).
 *
 * Spec: docs/MESSENGER-DOUBLE-RATCHET-C1-SPEC.md
 */

import { encodeRatchetEnvelopeHeader, type MorgRatchetEnvelopeV3 } from './morgendrot-ratchet-envelope'

const MAX_SKIP = 64
const INFO_CK = new TextEncoder().encode('morgendrot-ratchet-ck-v1')
const INFO_MK = new TextEncoder().encode('morgendrot-ratchet-mk-v1')
const INFO_RK = new TextEncoder().encode('morgendrot-ratchet-rk-v1')

function getSubtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error('Web Crypto fehlt (crypto.subtle).')
  return s
}

function buf(u: Uint8Array): Parameters<SubtleCrypto['importKey']>[1] {
  return u as Parameters<SubtleCrypto['importKey']>[1]
}

function b64url(u: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]!)
  const b64 = typeof btoa === 'function' ? btoa(s) : Buffer.from(u).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  if (typeof atob === 'function') {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

function sameBytes(a: Uint8Array | null, b: Uint8Array): boolean {
  if (!a || a.length !== b.length) return false
  return a.every((x, i) => x === b[i])
}

async function hkdfRaw(ikm: Uint8Array, info: Uint8Array, len = 32): Promise<Uint8Array> {
  const subtle = getSubtle()
  const key = await subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits'])
  const bits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info },
    key,
    len * 8
  )
  return new Uint8Array(bits)
}

export async function deriveRatchetRootKey(
  ecdhShared: Uint8Array,
  localAddress: string,
  remoteAddress: string
): Promise<Uint8Array> {
  const a = localAddress.trim().toLowerCase()
  const b = remoteAddress.trim().toLowerCase()
  const [p0, p1] = a < b ? [a, b] : [b, a]
  const info = new TextEncoder().encode(`morgendrot-ratchet-root-v1:${p0}:${p1}`)
  return hkdfRaw(ecdhShared, info, 32)
}

async function kdfCk(ck: Uint8Array): Promise<{ chainKey: Uint8Array; messageKey: Uint8Array }> {
  const messageKey = await hkdfRaw(ck, INFO_MK, 32)
  const chainKey = await hkdfRaw(ck, INFO_CK, 32)
  return { chainKey, messageKey }
}

async function kdfRk(rootKey: Uint8Array, dhOut: Uint8Array): Promise<{ rootKey: Uint8Array; chainKey: Uint8Array }> {
  const ikm = new Uint8Array(rootKey.length + dhOut.length)
  ikm.set(rootKey, 0)
  ikm.set(dhOut, rootKey.length)
  const material = await hkdfRaw(ikm, INFO_RK, 64)
  return { rootKey: material.slice(0, 32), chainKey: material.slice(32, 64) }
}

type EcdhPair = { privateKey: CryptoKey; publicRaw: Uint8Array }

async function generateDh(): Promise<EcdhPair> {
  const subtle = getSubtle()
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const publicRaw = new Uint8Array(await subtle.exportKey('spki', kp.publicKey))
  return { privateKey: kp.privateKey, publicRaw }
}

async function dhDerive(privateKey: CryptoKey, peerSpki: Uint8Array): Promise<Uint8Array> {
  const subtle = getSubtle()
  const pub = await subtle.importKey('spki', buf(peerSpki), { name: 'ECDH', namedCurve: 'P-256' }, true, [])
  return new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: pub }, privateKey, 256))
}

export type RatchetCipherPacket = {
  header: MorgRatchetEnvelopeV3
  body: Uint8Array
}

type PeerState = {
  mode: 'symmetric' | 'dh'
  role: 'alice' | 'bob'
  rootKey: Uint8Array
  sendChainKey: Uint8Array | null
  sendN: number
  recvChainKey: Uint8Array | null
  recvN: number
  dhSend: EcdhPair | null
  dhRecvPub: Uint8Array | null
  /** Bob's published init pub (Alice encrypt first hop) */
  peerInitPub: Uint8Array | null
  pn: number
  skipped: Map<string, Uint8Array>
}

function skipId(dhPubB64: string, n: number): string {
  return `${dhPubB64}|${n}`
}

async function aesGcmEncrypt(messageKey: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Promise<Uint8Array> {
  const subtle = getSubtle()
  const key = await subtle.importKey('raw', buf(messageKey), 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: buf(aad) }, key, buf(plaintext))
  )
  const out = new Uint8Array(12 + ct.length)
  out.set(iv, 0)
  out.set(ct, 12)
  return out
}

async function aesGcmDecrypt(messageKey: Uint8Array, body: Uint8Array, aad: Uint8Array): Promise<Uint8Array> {
  if (body.length < 12 + 16) throw new Error('Ratchet: ciphertext zu kurz')
  const subtle = getSubtle()
  const key = await subtle.importKey('raw', buf(messageKey), 'AES-GCM', false, ['decrypt'])
  const iv = body.slice(0, 12)
  const ct = body.slice(12)
  return new Uint8Array(
    await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: buf(aad) }, key, buf(ct))
  )
}

/** C1.2a — Symmetric only. */
export async function createRatchetSessionPair(
  ecdhShared: Uint8Array,
  aliceAddress: string,
  bobAddress: string
): Promise<{ alice: MorgRatchetSession; bob: MorgRatchetSession }> {
  const root = await deriveRatchetRootKey(ecdhShared, aliceAddress, bobAddress)
  const split = await hkdfRaw(root, new TextEncoder().encode('morgendrot-ratchet-split-v1'), 64)
  const chainAb = split.slice(0, 32)
  const chainBa = split.slice(32, 64)
  const alice = new MorgRatchetSession({
    mode: 'symmetric',
    role: 'alice',
    rootKey: new Uint8Array(root),
    sendChainKey: new Uint8Array(chainAb),
    sendN: 0,
    recvChainKey: new Uint8Array(chainBa),
    recvN: 0,
    dhSend: null,
    dhRecvPub: null,
    peerInitPub: null,
    pn: 0,
    skipped: new Map(),
  })
  const bob = new MorgRatchetSession({
    mode: 'symmetric',
    role: 'bob',
    rootKey: new Uint8Array(root),
    sendChainKey: new Uint8Array(chainBa),
    sendN: 0,
    recvChainKey: new Uint8Array(chainAb),
    recvN: 0,
    dhSend: null,
    dhRecvPub: null,
    peerInitPub: null,
    pn: 0,
    skipped: new Map(),
  })
  return { alice, bob }
}

/**
 * C1.2b — DH-Ratchet.
 * Bob published initial DH pub; Alice ECDH(new, bobInit) for first send chain.
 */
export async function createDhRatchetSessionPair(
  ecdhShared: Uint8Array,
  aliceAddress: string,
  bobAddress: string
): Promise<{ alice: MorgRatchetSession; bob: MorgRatchetSession }> {
  const root = await deriveRatchetRootKey(ecdhShared, aliceAddress, bobAddress)
  const bobInit = await generateDh()

  const alice = new MorgRatchetSession({
    mode: 'dh',
    role: 'alice',
    rootKey: new Uint8Array(root),
    sendChainKey: null,
    sendN: 0,
    recvChainKey: null,
    recvN: 0,
    dhSend: null,
    dhRecvPub: null,
    peerInitPub: new Uint8Array(bobInit.publicRaw),
    pn: 0,
    skipped: new Map(),
  })
  const bob = new MorgRatchetSession({
    mode: 'dh',
    role: 'bob',
    rootKey: new Uint8Array(root),
    sendChainKey: null,
    sendN: 0,
    recvChainKey: null,
    recvN: 0,
    dhSend: bobInit,
    dhRecvPub: null,
    peerInitPub: null,
    pn: 0,
    skipped: new Map(),
  })
  return { alice, bob }
}

/** Persistierbarer Symmetric-State (C1.4) — kein PKCS8/DH. */
export type RatchetPeerSnapshotV1 = {
  v: 1
  mode: 'symmetric'
  role: 'alice' | 'bob'
  rootKeyB64: string
  sendChainKeyB64: string
  recvChainKeyB64: string
  sendN: number
  recvN: number
  pn: number
  skipped: Record<string, string>
}

function u8ToB64(u: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]!)
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(u).toString('base64')
}

function b64ToU8(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

export class MorgRatchetSession {
  constructor(private state: PeerState) {}

  get sendN(): number {
    return this.state.sendN
  }

  get recvN(): number {
    return this.state.recvN
  }

  get mode(): 'symmetric' | 'dh' {
    return this.state.mode
  }

  /** C1.4: nur Symmetric — DH-Persist folgt später (PKCS8). */
  exportSymmetricSnapshot(): RatchetPeerSnapshotV1 {
    if (this.state.mode !== 'symmetric') {
      throw new Error('exportSymmetricSnapshot: nur mode=symmetric')
    }
    if (!this.state.sendChainKey || !this.state.recvChainKey) {
      throw new Error('exportSymmetricSnapshot: Chains fehlen')
    }
    const skipped: Record<string, string> = {}
    for (const [k, v] of this.state.skipped) skipped[k] = u8ToB64(v)
    return {
      v: 1,
      mode: 'symmetric',
      role: this.state.role,
      rootKeyB64: u8ToB64(this.state.rootKey),
      sendChainKeyB64: u8ToB64(this.state.sendChainKey),
      recvChainKeyB64: u8ToB64(this.state.recvChainKey),
      sendN: this.state.sendN,
      recvN: this.state.recvN,
      pn: this.state.pn,
      skipped,
    }
  }

  static fromSymmetricSnapshot(snap: RatchetPeerSnapshotV1): MorgRatchetSession {
    if (snap.v !== 1 || snap.mode !== 'symmetric') {
      throw new Error('fromSymmetricSnapshot: ungültiger Snapshot')
    }
    if (!['alice', 'bob'].includes(snap.role)) {
      throw new Error('fromSymmetricSnapshot: role ungültig')
    }
    const skipped = new Map<string, Uint8Array>()
    for (const [k, v] of Object.entries(snap.skipped || {})) {
      if (typeof v === 'string' && v) skipped.set(k, b64ToU8(v))
    }
    return new MorgRatchetSession({
      mode: 'symmetric',
      role: snap.role,
      rootKey: b64ToU8(snap.rootKeyB64),
      sendChainKey: b64ToU8(snap.sendChainKeyB64),
      sendN: snap.sendN,
      recvChainKey: b64ToU8(snap.recvChainKeyB64),
      recvN: snap.recvN,
      dhSend: null,
      dhRecvPub: null,
      peerInitPub: null,
      pn: snap.pn,
      skipped,
    })
  }

  async encrypt(plaintext: string, msgId: string): Promise<RatchetCipherPacket> {
    if (this.state.mode === 'dh') {
      await this.ensureDhSendChain()
    }
    if (!this.state.sendChainKey) throw new Error('Ratchet: keine Send-Chain')

    const { chainKey, messageKey } = await kdfCk(this.state.sendChainKey)
    const n = this.state.sendN
    this.state.sendChainKey = chainKey
    this.state.sendN = n + 1

    const dhField =
      this.state.mode === 'dh' && this.state.dhSend
        ? b64url(this.state.dhSend.publicRaw)
        : this.state.role === 'alice'
          ? 'cG9jLWFsaWNlLWRoLXBsYWNlaG9sZGVy'
          : 'cG9jLWJvYi1kaC1wbGFjZWhvbGRlcg'

    const header: MorgRatchetEnvelopeV3 = {
      v: 3,
      cs: 1,
      dh: dhField,
      pn: this.state.pn,
      n,
      msgId,
      ts: Date.now(),
    }
    const aad = new TextEncoder().encode(encodeRatchetEnvelopeHeader(header))
    const body = await aesGcmEncrypt(messageKey, new TextEncoder().encode(plaintext), aad)
    return { header, body }
  }

  async decrypt(packet: RatchetCipherPacket): Promise<string> {
    if (this.state.mode === 'dh') {
      return this.decryptDh(packet)
    }
    return this.decryptSymmetric(packet)
  }

  private async ensureDhSendChain(): Promise<void> {
    if (this.state.sendChainKey && this.state.dhSend) return
    const peerPub = this.state.dhRecvPub ?? this.state.peerInitPub
    if (!peerPub) throw new Error('Ratchet DH: kein Peer-Public für Send')
    const fresh = await generateDh()
    const out = await dhDerive(fresh.privateKey, peerPub)
    const { rootKey, chainKey } = await kdfRk(this.state.rootKey, out)
    this.state.rootKey = rootKey
    this.state.sendChainKey = chainKey
    this.state.sendN = 0
    this.state.dhSend = fresh
  }

  private async decryptSymmetric(packet: RatchetCipherPacket): Promise<string> {
    const n = packet.header.n
    const key = skipId(packet.header.dh, n)
    const skipped = this.state.skipped.get(key)
    if (skipped) {
      this.state.skipped.delete(key)
      const aad = new TextEncoder().encode(encodeRatchetEnvelopeHeader(packet.header))
      return new TextDecoder().decode(await aesGcmDecrypt(skipped, packet.body, aad))
    }
    if (!this.state.recvChainKey) throw new Error('Ratchet: keine Empfangs-Chain')
    if (n < this.state.recvN) throw new Error('Ratchet: Nachricht zu alt / bereits verbraucht')
    while (this.state.recvN < n) {
      if (this.state.skipped.size >= MAX_SKIP) throw new Error('Ratchet: skipped overflow')
      const step = await kdfCk(this.state.recvChainKey)
      this.state.skipped.set(skipId(packet.header.dh, this.state.recvN), step.messageKey)
      this.state.recvChainKey = step.chainKey
      this.state.recvN += 1
    }
    const { chainKey, messageKey } = await kdfCk(this.state.recvChainKey)
    this.state.recvChainKey = chainKey
    this.state.recvN = n + 1
    const aad = new TextEncoder().encode(encodeRatchetEnvelopeHeader(packet.header))
    return new TextDecoder().decode(await aesGcmDecrypt(messageKey, packet.body, aad))
  }

  private async decryptDh(packet: RatchetCipherPacket): Promise<string> {
    const theirPub = fromB64url(packet.header.dh)
    const key = skipId(packet.header.dh, packet.header.n)
    const skipped = this.state.skipped.get(key)
    if (skipped) {
      this.state.skipped.delete(key)
      const aad = new TextEncoder().encode(encodeRatchetEnvelopeHeader(packet.header))
      return new TextDecoder().decode(await aesGcmDecrypt(skipped, packet.body, aad))
    }

    if (!sameBytes(this.state.dhRecvPub, theirPub)) {
      await this.dhRatchetIncoming(theirPub)
    }
    if (!this.state.recvChainKey) throw new Error('Ratchet DH: keine Empfangs-Chain')

    const n = packet.header.n
    if (n < this.state.recvN) throw new Error('Ratchet: Nachricht zu alt / bereits verbraucht')
    while (this.state.recvN < n) {
      if (this.state.skipped.size >= MAX_SKIP) throw new Error('Ratchet: skipped overflow')
      const step = await kdfCk(this.state.recvChainKey)
      this.state.skipped.set(skipId(packet.header.dh, this.state.recvN), step.messageKey)
      this.state.recvChainKey = step.chainKey
      this.state.recvN += 1
    }
    const { chainKey, messageKey } = await kdfCk(this.state.recvChainKey)
    this.state.recvChainKey = chainKey
    this.state.recvN = n + 1
    const aad = new TextEncoder().encode(encodeRatchetEnvelopeHeader(packet.header))
    return new TextDecoder().decode(await aesGcmDecrypt(messageKey, packet.body, aad))
  }

  private async dhRatchetIncoming(theirPub: Uint8Array): Promise<void> {
    this.state.pn = this.state.sendN
    this.state.sendChainKey = null
    this.state.sendN = 0

    if (!this.state.dhSend) {
      this.state.dhSend = await generateDh()
    }
    const dhOutRecv = await dhDerive(this.state.dhSend.privateKey, theirPub)
    const stepRecv = await kdfRk(this.state.rootKey, dhOutRecv)
    this.state.rootKey = stepRecv.rootKey
    this.state.recvChainKey = stepRecv.chainKey
    this.state.recvN = 0
    this.state.dhRecvPub = theirPub

    // Neue Send-Chain gegen theirPub
    const newSend = await generateDh()
    const dhOutSend = await dhDerive(newSend.privateKey, theirPub)
    const stepSend = await kdfRk(this.state.rootKey, dhOutSend)
    this.state.rootKey = stepSend.rootKey
    this.state.sendChainKey = stepSend.chainKey
    this.state.dhSend = newSend
  }
}
