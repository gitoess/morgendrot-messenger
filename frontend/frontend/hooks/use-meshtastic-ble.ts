'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MeshDevice } from '@meshtastic/core'
import { Protobuf } from '@meshtastic/core'
import { findAddressByV2Fingerprint, tryParseEmergencyBinaryV2 } from '@/frontend/lib/emergency-binary-browser'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { Message } from '@/frontend/lib/types'
import { contentDedupKey } from '@/frontend/lib/message-dedup'
import { MeshFragReassembler } from '@/frontend/lib/mesh-v2-fragment'
import { stripDelayMirrorMarker } from '@/frontend/lib/mesh-delayed-upload'

const V2_MAX_BYTES = 240

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

export type MeshtasticBleOptions = {
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onMeshChatMessage?: (msg: Message) => void
  /** Backend /mesh-decrypt-v2 – voller v2-Wire (PRIVATE_APP-Payload). */
  decryptMeshV2Wire?: (senderAddress: string, fullWire: Uint8Array) => Promise<string | null>
  /** Nach MF1-Merge: Klartext ohne Marker an IOTA spiegeln (Delayed Upload). */
  onDelayMirrorPlaintext?: (plaintext: string, senderAddress: string) => void | Promise<void>
}

function nodeNumToMeshId(from: number): string {
  return `!${Number(from).toString(16)}`
}

export function useMeshtasticBle(opts?: MeshtasticBleOptions) {
  const [device, setDevice] = useState<MeshDevice | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deviceRef = useRef<MeshDevice | null>(null)

  const dirRef = useRef(opts?.contactDirectory ?? {})
  const onMsgRef = useRef(opts?.onMeshChatMessage)
  const decryptRef = useRef(opts?.decryptMeshV2Wire)
  const delayMirrorRef = useRef(opts?.onDelayMirrorPlaintext)
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
    deviceRef.current = device
  }, [device])

  const bleSupported =
    typeof navigator !== 'undefined' && typeof navigator.bluetooth !== 'undefined'

  useEffect(() => {
    if (!device) return
    const seen = new Set<string>()

    const handlePrivate = (pm: {
      from: number
      id: number
      rxTime: Date
      data: Uint8Array
    }) => {
      const parsed = tryParseEmergencyBinaryV2(pm.data, V2_MAX_BYTES)
      if (!parsed) return
      const dedup = `v2:${pm.from}:${parsed.nonce}`
      if (seen.has(dedup)) return
      seen.add(dedup)

      const addrs = Object.keys(dirRef.current)
      const fromMesh = nodeNumToMeshId(pm.from)
      const fullWire = pm.data
      void findAddressByV2Fingerprint(parsed.fingerprintHex, addrs).then(async (senderAddr) => {
        const decrypt = decryptRef.current
        let body: string
        let encrypted = true
        let mf1Mid: string | undefined
        if (senderAddr && decrypt) {
          const plain = await decrypt(senderAddr, fullWire)
          if (plain) {
            const merged = meshFragRef.current.tryMerge(senderAddr, plain)
            if (merged.status === 'pending') return
            body = merged.text
            mf1Mid = merged.mf1Mid
            encrypted = false
            const strip = stripDelayMirrorMarker(body)
            if (strip.mirrored) {
              body = strip.body
              void delayMirrorRef.current?.(strip.body, senderAddr)
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
          meshMeta: { kind: 'v2', fromNodeNum: pm.from, nonce: parsed.nonce },
        })
      })
    }

    const handleText = (pm: {
      from: number
      id: number
      rxTime: Date
      data: string
    }) => {
      const dedup = `txt:${pm.from}:${pm.id}`
      if (seen.has(dedup)) return
      seen.add(dedup)
      const fromMesh = nodeNumToMeshId(pm.from)
      const ts = pm.rxTime.getTime()
      const body = pm.data
      const dedupKey = contentDedupKey(`mesh:${fromMesh}`, body, ts)
      onMsgRef.current?.({
        id: `mesh-txt-${pm.from}-${pm.id}`,
        from: `mesh:${fromMesh}`,
        content: body,
        timestamp: ts,
        encrypted: false,
        source: 'mesh',
        transports: ['mesh'],
        dedupKey,
        meshMeta: { kind: 'text', fromNodeNum: pm.from },
      })
    }

    const unsubPriv = device.events.onPrivatePacket.subscribe(handlePrivate)
    const unsubTxt = device.events.onMessagePacket.subscribe(handleText)
    return () => {
      unsubPriv()
      unsubTxt()
    }
  }, [device])

  const connect = useCallback(async () => {
    setError(null)
    setConnecting(true)
    try {
      const prev = deviceRef.current
      if (prev) {
        await disconnectMeshDevice(prev)
        deviceRef.current = null
        setDevice(null)
      }
      const [{ MeshDevice }, { TransportWebBluetooth }] = await Promise.all([
        import('@meshtastic/core'),
        import('@meshtastic/transport-web-bluetooth'),
      ])
      const transport = await TransportWebBluetooth.create()
      const mesh = new MeshDevice(transport)
      setDevice(mesh)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setDevice(null)
      deviceRef.current = null
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    void (async () => {
      const current = deviceRef.current
      deviceRef.current = null
      await disconnectMeshDevice(current)
      setDevice(null)
      setError(null)
    })()
  }, [])

  const sendBinaryV2 = useCallback(
    async (wire: Uint8Array, destination: number | 'broadcast' = 'broadcast') => {
      if (!device) throw new Error('Meshtastic nicht verbunden')
      return device.sendPacket(wire, Protobuf.Portnums.PortNum.PRIVATE_APP, destination)
    },
    [device]
  )

  const sendMeshText = useCallback(
    async (text: string) => {
      if (!device) throw new Error('Meshtastic nicht verbunden')
      return device.sendText(text, 'broadcast')
    },
    [device]
  )

  return {
    bleSupported,
    connected: !!device,
    connecting,
    error,
    device,
    connect,
    disconnect,
    sendBinaryV2,
    sendMeshText,
  }
}
