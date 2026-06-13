'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { MeshDevice } from '@meshtastic/core'
import { Protobuf } from '@meshtastic/core'
import { findAddressByV2Fingerprint, tryParseEmergencyBinaryV2 } from '@/frontend/lib/emergency-binary-browser'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { Message } from '@/frontend/lib/types'
import { contentDedupKey } from '@/frontend/lib/message-dedup'
import { MeshFragReassembler } from '@/frontend/lib/mesh-v2-fragment'
import { stripDelayMirrorMarker } from '@/frontend/features/send/mesh-delayed-upload'
import {
  formatSosVisibleContent,
  normalizeChatMessageContentForDisplay,
} from '@/frontend/lib/chat-message-display-normalize'
import { plaintextStartsWithMorgEmergencyV1 } from '@/frontend/lib/morg-emergency-v1-text'
import { buildMorgSosAckV1Wire, tryParseMorgSosAckV1Plaintext } from '@/frontend/lib/morg-sos-ack-wire'
import { sha256HexUtf8 } from '@/frontend/lib/sha256-hex-utf8'
import { formatMeshtasticNodeIdFromNum } from '@/frontend/lib/meshtastic-node-id'
import {
  meshtasticThrownErrorIsRetryable,
  throwIfMeshtasticRoutingFailed,
} from '@/frontend/lib/meshtastic-routing-error'
import { tryDecodeMeshtasticCompressedTextPayload } from '@/frontend/lib/mesh-meshtastic-compressed-text'
import { normalizeMeshtasticChannelIndex } from '@/frontend/lib/meshtastic-channel-index'

const MESH_TEXT_RETRY_BACKOFF_MS = [600, 1800] as const

function meshRxDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('morgendrot.meshRxDebug') === '1'
  } catch {
    return false
  }
}

/** Nur wenn `localStorage['morgendrot.meshRxDebug']==='1'` — siehe Setup-Panel Hinweis. */
function meshRxLog(...args: unknown[]): void {
  if (!meshRxDebugEnabled()) return
  console.info('[morgendrot mesh]', ...args)
}

function meshPacketRxTimeMs(o: Record<string, unknown>): number {
  const r = o.rxTime ?? o.timestamp
  if (r instanceof Date && !Number.isNaN(r.getTime())) return r.getTime()
  if (typeof r === 'bigint') {
    const n = Number(r)
    return Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : Date.now()
  }
  if (typeof r === 'number' && Number.isFinite(r)) {
    return r < 1e12 ? Math.round(r * 1000) : r
  }
  return Date.now()
}

/** Wenn `sendText`/`sendPacket` nie resolved (häufig Broadcast/Web-BLE), hängt die UI — Nachricht kann trotzdem raus sein. */
const MESH_SEND_STALL_MS = 25_000
const MIN_REASONABLE_MESH_TS_MS = Date.UTC(2020, 0, 1)
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000

async function raceMeshtasticOutbound<T>(promise: Promise<T>, stallFallback: T): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(stallFallback), MESH_SEND_STALL_MS)),
  ])
}

function normalizeMeshRxTimestamp(ts: number): number {
  const now = Date.now()
  if (!Number.isFinite(ts)) return now
  if (ts < MIN_REASONABLE_MESH_TS_MS) return now
  if (ts > now + MAX_FUTURE_SKEW_MS) return now
  return ts
}

function decodeMeshTextPayload(v: unknown): string | null {
  if (typeof v === 'string') {
    return v
  }
  if (v instanceof Uint8Array) {
    try {
      return new TextDecoder().decode(v)
    } catch {
      return null
    }
  }
  if (Array.isArray(v) && v.every((x) => typeof x === 'number')) {
    try {
      return new TextDecoder().decode(new Uint8Array(v as number[]))
    } catch {
      return null
    }
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const nested = o.text ?? o.message ?? o.payload ?? o.decoded
    if (nested != null) return decodeMeshTextPayload(nested)
  }
  return null
}

function sanitizeMeshTextForDisplay(v: string): string {
  // Steuerzeichen raus, normale Unicode-Zeichen behalten.
  return v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim()
}

function parseMeshNodeNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v >>> 0
  if (typeof v === 'bigint' && v > BigInt(0)) return Number(v & BigInt(0xffffffff)) >>> 0
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase()
    if (!t) return null
    if (t.startsWith('!')) {
      const n = parseInt(t.slice(1), 16)
      return Number.isFinite(n) && n > 0 ? n >>> 0 : null
    }
    if (t.startsWith('0x')) {
      const n = parseInt(t.slice(2), 16)
      return Number.isFinite(n) && n > 0 ? n >>> 0 : null
    }
    const dec = Number(t)
    return Number.isFinite(dec) && dec > 0 ? dec >>> 0 : null
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return (
      parseMeshNodeNum(o.num) ??
      parseMeshNodeNum(o.nodeNum) ??
      parseMeshNodeNum(o.id) ??
      parseMeshNodeNum(o.from) ??
      null
    )
  }
  return null
}

const V2_MAX_BYTES = 240

/** Chromium u. a.: Policy / sicherer Kontext — Nutzerhinweis anhängen. */
function augmentWebBluetoothConnectError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const extra: string[] = []
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === '0.0.0.0') {
      extra.push(
        'Du öffnest die App über http://0.0.0.0:… — das ist oft kein sicherer Kontext für Web Bluetooth. Am PC: http://127.0.0.1:3341 oder http://localhost:3341 (Next lauscht weiter auf allen Interfaces).'
      )
    }
    if (!window.isSecureContext) {
      extra.push(
        'Diese Origin ist kein „sicherer Kontext“ (Web Bluetooth: nur HTTPS oder http://127.0.0.1 / localhost). Unter http://<LAN-IP>… blockiert Chrome die API oft — nutze z. B. USB-adb reverse zu 127.0.0.1:3341 oder eine HTTPS-Dev-URL.'
      )
    }
  }
  if (/globally disabled|enterprise policy|policy has disabled|blocked by policy/i.test(msg)) {
    const brave = typeof navigator !== 'undefined' && /Brave/i.test(navigator.userAgent)
    if (brave) {
      extra.push(
        'Brave schaltet Web Bluetooth standardmäßig ab (Privacy). brave://flags: „Web Bluetooth“ und/oder „Experimental Web Platform features“ auf Enabled, Brave neu starten; für localhost ggf. Löwen-Schild (Shields) für diese Site deaktivieren. Für den Heltec-Messenger-Test sind Google Chrome oder Microsoft Edge meist am unkompliziertesten.'
      )
    } else {
      extra.push(
        'Zusätzlich prüfen: Chrome-Profil ohne Unternehmens-/Kinderkontrolle, chrome://flags (Web Bluetooth / experimentelle Plattform-Features), normale Chrome-Installation (kein reiner WebView-Wrapper).'
      )
    }
  }
  if (extra.length === 0) return msg
  return `${msg}\n\n${extra.join('\n\n')}`
}

/** BLE/Web-BT: Gerät sauber vom GATT trennen (verhindert „hängende“ Verbindungen beim erneuten Koppeln). */
async function disconnectMeshDevice(device: MeshDevice | null): Promise<void> {
  if (!device) return
  const d = device as unknown as {
    disconnect?: () => void | Promise<void>
    close?: () => void | Promise<void>
    transport?: { disconnect?: () => void | Promise<void>; close?: () => void | Promise<void> }
  }
  try {
    if (typeof d.disconnect === 'function') {
      await Promise.resolve(d.disconnect())
      return
    }
    if (typeof d.close === 'function') {
      await Promise.resolve(d.close())
      return
    }
    const t = d.transport
    if (t) {
      if (typeof t.disconnect === 'function') await Promise.resolve(t.disconnect())
      else if (typeof t.close === 'function') await Promise.resolve(t.close())
    }
  } catch {
    /* Verbindung schon weg — Zustand wird trotzdem zurückgesetzt */
  }
}

async function initializeMeshDevice(mesh: MeshDevice): Promise<void> {
  const m = mesh as unknown as {
    connect?: () => Promise<unknown> | unknown
    start?: () => Promise<unknown> | unknown
    initialize?: () => Promise<unknown> | unknown
    init?: () => Promise<unknown> | unknown
  }
  const attempts: Array<keyof typeof m> = ['connect', 'start', 'initialize', 'init']
  for (const fnName of attempts) {
    const fn = m[fnName]
    if (typeof fn !== 'function') continue
    try {
      await Promise.resolve(fn.call(m))
      return
    } catch {
      // Nächste bekannte Init-Methode versuchen (SDK-Versionen unterscheiden sich).
    }
  }
}

export type MeshtasticBleOptions = {
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onMeshChatMessage?: (msg: Message) => void
  /** Backend /mesh-decrypt-v2 – voller v2-Wire (PRIVATE_APP-Payload). */
  decryptMeshV2Wire?: (senderAddress: string, fullWire: Uint8Array) => Promise<string | null>
  /** Nach MF1-Merge: Klartext ohne Marker an IOTA spiegeln (Delayed Upload). */
  onDelayMirrorPlaintext?: (plaintext: string, senderAddress: string) => void | Promise<void>
  /** Optional: verschlüsselten Mesh-Burst für `MORG_SOS_ACK_V1` (wird in Core gesetzt). */
  sendSosAckBurstRef?: MutableRefObject<((wire: string) => Promise<void>) | null>
  /** Optional: `localStorage` `morgendrot.sosAutoMeshAckReply` === `1` — bei eingehendem SOS automatisch Ack senden. */
  shouldAutoAckSosMesh?: () => boolean
}

export type MeshtasticTransportKind = 'bluetooth' | 'usb'

export function useMeshtasticBle(opts?: MeshtasticBleOptions) {
  const [device, setDevice] = useState<MeshDevice | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRxDebug, setLastRxDebug] = useState<string | null>(null)
  /** Welche `device.events.*`-Listener nach Verbindung wirklich gebunden sind (Setup-Panel). */
  const [meshRxSubscriptions, setMeshRxSubscriptions] = useState<string | null>(null)
  const [transportKind, setTransportKind] = useState<MeshtasticTransportKind>('bluetooth')
  const deviceRef = useRef<MeshDevice | null>(null)
  /** Nach manueller Verbindung: Verbindung im Hintergrund erhalten/reconnecten. */
  const stickyConnectRef = useRef(false)
  const reconnectBusyRef = useRef(false)

  const dirRef = useRef(opts?.contactDirectory ?? {})
  const onMsgRef = useRef(opts?.onMeshChatMessage)
  const decryptRef = useRef(opts?.decryptMeshV2Wire)
  const delayMirrorRef = useRef(opts?.onDelayMirrorPlaintext)
  /** Parent’s `MutableRefObject` to `sendMeshV2WireBurst` for SOS-Ack — not the burst fn itself. */
  const sosAckBurstParentRef = useRef(opts?.sendSosAckBurstRef)
  const shouldAutoAckSosMeshRef = useRef(opts?.shouldAutoAckSosMesh)
  const recentSosAckDigestsRef = useRef(new Set<string>())
  /** Lokales Loopback von soeben gesendeten Klartext-Paketen (Meshtastic echo) unterdrücken. */
  const recentOutgoingTextPacketIdsRef = useRef(new Map<string, string>())
  /** Eigene Meshtastic-Node-Nummer (nur exakt ein Wert, um Fehl-Markierung fremder Nodes zu vermeiden). */
  const selfNodeNumRef = useRef<number | null>(null)
  const meshFragRef = useRef(new MeshFragReassembler())
  useEffect(() => {
    dirRef.current = opts?.contactDirectory ?? {}
  }, [opts?.contactDirectory])
  useEffect(() => {
    onMsgRef.current = opts?.onMeshChatMessage
  }, [opts?.onMeshChatMessage])
  useEffect(() => {
    decryptRef.current = opts?.decryptMeshV2Wire
  }, [opts?.decryptMeshV2Wire])
  useEffect(() => {
    delayMirrorRef.current = opts?.onDelayMirrorPlaintext
  }, [opts?.onDelayMirrorPlaintext])
  useEffect(() => {
    sosAckBurstParentRef.current = opts?.sendSosAckBurstRef
  }, [opts?.sendSosAckBurstRef])
  useEffect(() => {
    shouldAutoAckSosMeshRef.current = opts?.shouldAutoAckSosMesh
  }, [opts?.shouldAutoAckSosMesh])

  useEffect(() => {
    deviceRef.current = device
  }, [device])

  const bleSupported =
    typeof navigator !== 'undefined' && typeof navigator.bluetooth !== 'undefined'
  const serialSupported =
    typeof navigator !== 'undefined' && typeof (navigator as Navigator & { serial?: unknown }).serial !== 'undefined'

  useEffect(() => {
    if (!device) return
    const rememberSelfNode = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const o = payload as Record<string, unknown>
      const n =
        parseMeshNodeNum(o.myNodeNum) ??
        parseMeshNodeNum(o.localNodeNum) ??
        parseMeshNodeNum(o.myNode) ??
        parseMeshNodeNum(o.localNode) ??
        null
      if (n != null && n > 0) selfNodeNumRef.current = n >>> 0
    }
    const seen = new Map<string, number>()
    const SEEN_TTL_MS = 120_000
    const markSeen = (k: string, now: number): boolean => {
      for (const [key, ts] of seen) {
        if (now - ts > SEEN_TTL_MS) seen.delete(key)
      }
      const last = seen.get(k)
      if (last != null && now - last <= SEEN_TTL_MS) return true
      seen.set(k, now)
      return false
    }
    const noteRx = (eventName: string, fromNum?: number | null) => {
      const ts = new Date()
      const hh = String(ts.getHours()).padStart(2, '0')
      const mm = String(ts.getMinutes()).padStart(2, '0')
      const ss = String(ts.getSeconds()).padStart(2, '0')
      const from = Number.isFinite(fromNum as number)
        ? ` · von ${formatMeshtasticNodeIdFromNum((fromNum as number) >>> 0)}`
        : ''
      setLastRxDebug(`${hh}:${mm}:${ss} · ${eventName}${from}`)
    }

    const handlePrivate = (pm: {
      from: number
      id: number
      rxTime: Date
      data: Uint8Array
    }) => {
      noteRx('onPrivatePacket', pm.from)
      const parsed = tryParseEmergencyBinaryV2(pm.data, V2_MAX_BYTES)
      if (!parsed) return
      const dedup = `v2:${pm.from}:${parsed.nonce}`
      if (markSeen(dedup, Date.now())) return

      const addrs = Object.keys(dirRef.current)
      const fromMesh = formatMeshtasticNodeIdFromNum(pm.from)
      const fullWire = pm.data
      void findAddressByV2Fingerprint(parsed.fingerprintHex, addrs).then(async (senderAddr) => {
        const decrypt = decryptRef.current
        let body: string
        let encrypted = true
        let mf1Mid: string | undefined
        let meshMetaOut: NonNullable<Message['meshMeta']> = {
          kind: 'v2',
          fromNodeNum: pm.from,
          nonce: parsed.nonce,
        }
        if (senderAddr && decrypt) {
          const plain = await decrypt(senderAddr, fullWire)
          if (plain) {
            const merged = meshFragRef.current.tryMerge(senderAddr, plain)
            if (merged.status === 'pending') return
            let rawBody = merged.text
            mf1Mid = merged.mf1Mid
            encrypted = false
            const strip = stripDelayMirrorMarker(rawBody)
            if (strip.mirrored) {
              rawBody = strip.body
              void delayMirrorRef.current?.(strip.body, senderAddr)
            }
            const ackDigest = tryParseMorgSosAckV1Plaintext(rawBody)
            if (ackDigest) {
              body = `[SOS-Bestätigung · …${ackDigest.slice(-8)}]`
              meshMetaOut = { ...meshMetaOut, sosAckDigest: ackDigest }
            } else if (
              plaintextStartsWithMorgEmergencyV1(rawBody) &&
              sosAckBurstParentRef.current?.current &&
              shouldAutoAckSosMeshRef.current?.()
            ) {
              const d = await sha256HexUtf8(rawBody)
              const recent = recentSosAckDigestsRef.current
              if (!recent.has(d)) {
                recent.add(d)
                setTimeout(() => recent.delete(d), 120_000)
                void sosAckBurstParentRef.current
                  ?.current?.(buildMorgSosAckV1Wire(d))
                  .catch(() => {})
              }
              body = formatSosVisibleContent(rawBody)
            } else {
              body = formatSosVisibleContent(rawBody)
            }
          } else {
            body = `[Mesh v2] Entschlüsselung fehlgeschlagen (Absender ${senderAddr.slice(0, 8)}…).`
          }
        } else if (senderAddr) {
          body = `[Mesh v2] Backend-Decrypt nicht verfügbar — Absender: ${senderAddr.slice(0, 8)}…`
        } else {
          body = `[Mesh v2] Unbekannter Absender-Fingerprint — Knoten ${fromMesh}`
        }

        const ts = pm.rxTime.getTime()
        const dedupKey = senderAddr ? contentDedupKey(senderAddr, body, ts) : undefined
        const msgId =
          mf1Mid != null ? `mesh-v2-mf1-${pm.from}-${mf1Mid}` : `mesh-v2-${pm.from}-${parsed.nonce}`

        onMsgRef.current?.({
          id: msgId,
          from: senderAddr ?? `mesh:${fromMesh}`,
          content: body,
          timestamp: ts,
          encrypted,
          source: 'mesh',
          transports: ['mesh'],
          dedupKey,
          meshMeta: meshMetaOut,
        })
      })
    }

    const appendTextPacket = (fromNum: number, packetId: string, rxMs: number, textRaw: string) => {
      if (selfNodeNumRef.current != null && (fromNum >>> 0) === selfNodeNumRef.current) {
        return
      }
      const outgoingId = packetId
      const body = normalizeChatMessageContentForDisplay(textRaw)
      if (!body.trim()) return
      const expectedBody = recentOutgoingTextPacketIdsRef.current.get(outgoingId)
      if (expectedBody != null && expectedBody === body) {
        recentOutgoingTextPacketIdsRef.current.delete(outgoingId)
        return
      }
      const ts = normalizeMeshRxTimestamp(rxMs)
      /** onMessagePacket + onMeshPacket feuern oft für dasselbe Paket — ein Emit pro (from, id, ts). */
      if (markSeen(`mesh:emit:${fromNum}:${packetId}:${ts}`, ts)) return
      // Manche Firmware/Bridges können packetId wiederverwenden; deshalb Content einbeziehen,
      // damit neue Texte nicht fälschlich als Duplikat verworfen werden.
      const dedup = `txt:${fromNum}:${packetId}:${body}`
      if (markSeen(dedup, ts)) return
      const fromMesh = formatMeshtasticNodeIdFromNum(fromNum)
      // Für eingehende Mesh-Textzeilen keine aggressive Cross-Source-Dedup erzwingen.
      // Sonst können legitime RX-Zeilen im Inbox-Merge untergehen.
      const dedupKey = undefined
      const rowId = `mesh-txt-${fromNum}-${packetId}-${ts}`
      onMsgRef.current?.({
        id: rowId,
        from: `mesh:${fromMesh}`,
        content: body,
        timestamp: ts,
        encrypted: false,
        source: 'mesh',
        transports: ['mesh'],
        dedupKey,
        meshMeta: { kind: 'text', fromNodeNum: fromNum },
      })
    }

    const handleText = (pm: {
      from: number
      id: number
      rxTime: Date
      data: unknown
    }) => {
      meshRxLog('onMessagePacket', { from: pm.from, id: pm.id, dataType: typeof pm.data })
      noteRx('onMessagePacket', pm.from)
      const txt = decodeMeshTextPayload(pm.data)
      if (txt == null) {
        meshRxLog('onMessagePacket: decodeMeshTextPayload → null')
        return
      }
      const cleaned = sanitizeMeshTextForDisplay(txt) || '[Mesh-Text empfangen]'
      appendTextPacket(pm.from, String(pm.id), pm.rxTime.getTime(), cleaned)
    }

    const handleMeshPacketTextOnly = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return
      const o = raw as Record<string, unknown>
      const payloadVariant = o.payloadVariant as { case?: unknown; value?: unknown } | undefined
      if (payloadVariant?.case !== 'decoded') return
      const decoded = payloadVariant.value as Record<string, unknown> | undefined
      if (!decoded || typeof decoded !== 'object') return

      const portRaw = decoded.portnum ?? decoded.portNum ?? (decoded as { portnumValue?: unknown }).portnumValue
      const portStr = String(portRaw ?? '').toUpperCase()
      const portNum = typeof portRaw === 'number' ? portRaw : Number.parseInt(String(portRaw ?? ''), 10)
      /** Port 1 = Klartext; Port 7 = komprimiert — Core ruft kein `onMessagePacket` für 7. */
      const isTextPort =
        portNum === 1 ||
        portNum === 7 ||
        portStr.includes('TEXT_MESSAGE_APP') ||
        portStr.includes('TEXT_MESSAGE_COMPRESSED_APP') ||
        portStr === 'TEXT' ||
        portStr === '1' ||
        portStr === '7'
      if (!isTextPort) return

      const fromNum =
        parseMeshNodeNum(o.from) ??
        parseMeshNodeNum(o.fromNum) ??
        parseMeshNodeNum(o.fromNodeNum) ??
        parseMeshNodeNum(o.fromId) ??
        null
      if (fromNum == null) {
        meshRxLog('onMeshPacket: Absender (from) nicht ermittelt', { port: portNum })
        return
      }

      const id = String(o.id ?? o.packetId ?? '0')
      const rxMs = meshPacketRxTimeMs(o)

      let text: string | null = null
      if (portNum === 7) {
        text = tryDecodeMeshtasticCompressedTextPayload(decoded.payload ?? decoded.data)
        meshRxLog('onMeshPacket port 7', { from: fromNum, ok: !!text, rxMs })
      } else {
        text = decodeMeshTextPayload(decoded.text ?? decoded.payload ?? decoded.message)
      }
      if (!text) {
        meshRxLog('onMeshPacket: kein Text', { port: portNum, from: fromNum })
        return
      }
      const cleaned = sanitizeMeshTextForDisplay(text) || '[Mesh-Text empfangen]'
      if (!cleaned.trim()) return
      appendTextPacket(fromNum >>> 0, id, rxMs, cleaned)
    }

    const eventsObj = (device as unknown as { events?: Record<string, unknown> }).events as
      | Record<string, unknown>
      | undefined
    const unsubs: Array<() => void> = []
    const subscribed: string[] = []
    const subscribeEvent = (eventName: string, cb: (payload: unknown) => void) => {
      const ev = eventsObj?.[eventName] as
        | { subscribe?: (fn: (payload: unknown) => void) => () => void }
        | undefined
      if (!ev || typeof ev.subscribe !== 'function') {
        meshRxLog('subscribe skipped (kein Event)', eventName)
        return
      }
      try {
        const unsub = ev.subscribe((payload: unknown) => {
          if (payload && typeof payload === 'object') {
            const p = payload as Record<string, unknown>
            const fromHint =
              parseMeshNodeNum(p.from) ??
              parseMeshNodeNum(p.fromNum) ??
              parseMeshNodeNum(p.fromNodeNum) ??
              parseMeshNodeNum(p.fromId) ??
              parseMeshNodeNum((p.packet as Record<string, unknown> | undefined)?.from) ??
              null
            noteRx(eventName, fromHint)
            if (eventName === 'onMeshPacket') {
              const pv = p.payloadVariant as { case?: unknown; value?: { portnum?: unknown } } | undefined
              meshRxLog(eventName, {
                fromHint,
                pvCase: pv?.case,
                portnum: pv && typeof pv.value === 'object' && pv.value ? (pv.value as { portnum?: unknown }).portnum : undefined,
              })
            } else {
              meshRxLog(eventName, { fromHint })
            }
          } else {
            noteRx(eventName, null)
            meshRxLog(eventName, payload)
          }
          cb(payload)
        })
        if (typeof unsub === 'function') {
          subscribed.push(eventName)
          unsubs.push(unsub)
        }
      } catch {
        /* ignore unsupported signature */
      }
    }

    subscribeEvent('onPrivatePacket', handlePrivate as unknown as (payload: unknown) => void)
    subscribeEvent('onMessagePacket', handleText as unknown as (payload: unknown) => void)
    subscribeEvent('onMyNodeInfo', (payload: unknown) => {
      rememberSelfNode(payload)
    })
    subscribeEvent('onMeshPacket', handleMeshPacketTextOnly)
    subscribeEvent('onQueueStatus', () => {})
    subscribeEvent('onDeviceStatus', () => {})
    subscribeEvent('onTelemetryPacket', () => {})

    setMeshRxSubscriptions(subscribed.length ? subscribed.join(', ') : '— keine Listener gebunden —')

    return () => {
      for (const unsub of unsubs) unsub()
      setMeshRxSubscriptions(null)
    }
  }, [device])

  const connectInternal = useCallback(async (silent: boolean, mode: MeshtasticTransportKind) => {
    if (reconnectBusyRef.current) return false
    reconnectBusyRef.current = true
    if (!silent) {
      setError(null)
      setConnecting(true)
    }
    try {
      const prev = deviceRef.current
      if (prev) {
        await disconnectMeshDevice(prev)
        deviceRef.current = null
        setDevice(null)
      }
      const [{ MeshDevice }, transportMod] = await Promise.all([
        import('@meshtastic/core'),
        mode === 'usb'
          ? import('@meshtastic/transport-web-serial')
          : import('@meshtastic/transport-web-bluetooth'),
      ])
      const transportFactory =
        mode === 'usb'
          ? (transportMod as { TransportWebSerial?: { create: () => Promise<unknown> } }).TransportWebSerial
          : (transportMod as { TransportWebBluetooth?: { create: () => Promise<unknown> } }).TransportWebBluetooth
      if (!transportFactory || typeof transportFactory.create !== 'function') {
        throw new Error(mode === 'usb' ? 'Web-Serial-Transport nicht verfügbar.' : 'Web-Bluetooth-Transport nicht verfügbar.')
      }
      const transport = await transportFactory.create()
      const mesh = new MeshDevice(transport as ConstructorParameters<typeof MeshDevice>[0])
      await initializeMeshDevice(mesh)
      setDevice(mesh)
      setTransportKind(mode)
      setLastRxDebug(null)
      return true
    } catch (e) {
      if (!silent) {
        setError(mode === 'usb' ? (e instanceof Error ? e.message : String(e)) : augmentWebBluetoothConnectError(e))
      }
      setDevice(null)
      deviceRef.current = null
      return false
    } finally {
      reconnectBusyRef.current = false
      if (!silent) setConnecting(false)
    }
  }, [])

  const connect = useCallback(async () => {
    stickyConnectRef.current = true
    await connectInternal(false, transportKind)
  }, [connectInternal, transportKind])
  const connectBluetooth = useCallback(async () => {
    stickyConnectRef.current = true
    setTransportKind('bluetooth')
    await connectInternal(false, 'bluetooth')
  }, [connectInternal])
  const connectUsb = useCallback(async () => {
    stickyConnectRef.current = true
    setTransportKind('usb')
    await connectInternal(false, 'usb')
  }, [connectInternal])

  const disconnect = useCallback(() => {
    stickyConnectRef.current = false
    void (async () => {
      const current = deviceRef.current
      deviceRef.current = null
      await disconnectMeshDevice(current)
      setDevice(null)
      setLastRxDebug(null)
      setError(null)
    })()
  }, [])

  useEffect(() => {
    if (!stickyConnectRef.current) return
    if (device) return
    if (connecting) return
    const t = setTimeout(() => {
      // keep prior preferred transport for sticky reconnect
      void connectInternal(true, transportKind)
    }, 2500)
    return () => clearTimeout(t)
  }, [device, connecting, connectInternal, transportKind])

  const sendBinaryV2 = useCallback(
    async (
      wire: Uint8Array,
      destination: number | 'broadcast' = 'broadcast',
      channelIndex?: number
    ) => {
      let d = deviceRef.current
      if (!d && stickyConnectRef.current) {
        await connectInternal(true, transportKind)
        d = deviceRef.current
      }
      if (!d) throw new Error('Meshtastic nicht verbunden')
      const normalizedChannelIndex = normalizeMeshtasticChannelIndex(channelIndex)
      const sendPacketFn = d.sendPacket as unknown as (
        payload: Uint8Array,
        port: Protobuf.Portnums.PortNum,
        dest?: number | 'broadcast',
        channel?: number
      ) => Promise<Awaited<ReturnType<MeshDevice['sendPacket']>>>
      const r = await raceMeshtasticOutbound(
        normalizedChannelIndex == null
          ? sendPacketFn(wire, Protobuf.Portnums.PortNum.PRIVATE_APP, destination)
          : sendPacketFn(wire, Protobuf.Portnums.PortNum.PRIVATE_APP, destination, normalizedChannelIndex),
        {} as Awaited<ReturnType<MeshDevice['sendPacket']>>
      )
      throwIfMeshtasticRoutingFailed(
        r,
        normalizedChannelIndex == null
          ? 'Mesh v2 (PRIVATE_APP)'
          : `Mesh v2 (PRIVATE_APP, Kanal ${normalizedChannelIndex})`
      )
      return r
    },
    [connectInternal, transportKind]
  )

  const sendMeshText = useCallback(
    async (
      text: string,
      destination: number | 'broadcast' = 'broadcast',
      channelIndex?: number
    ) => {
      let d = deviceRef.current
      if (!d && stickyConnectRef.current) {
        await connectInternal(true, transportKind)
        d = deviceRef.current
      }
      if (!d) throw new Error('Meshtastic nicht verbunden')
      const normalizedChannelIndex = normalizeMeshtasticChannelIndex(channelIndex)
      const ctx =
        normalizedChannelIndex == null
          ? 'Meshtastic-Text (LongFast)'
          : `Meshtastic-Text (LongFast, Kanal ${normalizedChannelIndex})`
      let lastErr: unknown
      for (let attempt = 0; attempt <= MESH_TEXT_RETRY_BACKOFF_MS.length; attempt++) {
        try {
          const sendTextFn = d.sendText as unknown as (
            payload: string,
            dest?: number | 'broadcast',
            channel?: number
          ) => Promise<Awaited<ReturnType<MeshDevice['sendText']>>>
          const r = await raceMeshtasticOutbound(
            normalizedChannelIndex == null
              ? sendTextFn(text, destination)
              : sendTextFn(text, destination, normalizedChannelIndex),
            {} as Awaited<ReturnType<MeshDevice['sendText']>>
          )
          if (r && typeof r === 'object') {
            const maybeId = (r as { id?: unknown }).id
            if (maybeId != null) {
              const id = String(maybeId)
              recentOutgoingTextPacketIdsRef.current.set(
                id,
                normalizeChatMessageContentForDisplay(text)
              )
              setTimeout(() => {
                recentOutgoingTextPacketIdsRef.current.delete(id)
              }, 45_000)
            }
          }
          throwIfMeshtasticRoutingFailed(r, ctx)
          return r
        } catch (e) {
          lastErr = e
          const canRetry =
            attempt < MESH_TEXT_RETRY_BACKOFF_MS.length && meshtasticThrownErrorIsRetryable(e)
          if (!canRetry) throw e
          await new Promise((res) => setTimeout(res, MESH_TEXT_RETRY_BACKOFF_MS[attempt]))
        }
      }
      throw lastErr
    },
    [connectInternal, transportKind]
  )

  return {
    bleSupported,
    serialSupported,
    transportKind,
    setTransportKind,
    connected: !!device,
    connecting,
    error,
    lastRxDebug,
    meshRxSubscriptions,
    device,
    connect,
    connectBluetooth,
    connectUsb,
    disconnect,
    sendBinaryV2,
    sendMeshText,
  }
}
