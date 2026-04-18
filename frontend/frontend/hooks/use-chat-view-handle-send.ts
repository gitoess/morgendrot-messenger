'use client'

import { useCallback } from 'react'
import {
  sosGatewayAckDigest,
  enqueueOfflineMailboxFailure,
  isOfflineMailboxQueueEnabled,
  stableOfflineMailboxThreadId,
  nextOfflineMailboxClientOutSeq,
  parseMailboxOutNonceMarker,
  prependMailboxOutNonceMarker,
} from '@/frontend/lib/api'
import { sendMeshV2WireBurst } from '@/frontend/features/send/chat-view-mesh-send'
import {
  buildChatOutgoingWireContent,
  buildLoraMeshDualWireTexts,
} from '@/frontend/features/send/chat-view-outgoing-payload'
import { buildTxtFileWireParts } from '@/frontend/features/send/chat-view-txt-split'
import {
  validateLoraDualWireUtf8,
  validateMeshDisallowsIotaCompactBlob,
  validateStandardOutgoingWire,
} from '@/frontend/features/send/chat-view-send-utils'
import type { UseChatViewSendFlowParams } from '@/frontend/hooks/use-chat-view-send-flow-types'
import { MESH_PLAINTEXT_MAX_CHARS } from '@/frontend/lib/chat-view-messenger-transport'
import { prependDelayMirrorMarker } from '@/frontend/features/send/mesh-delayed-upload'
import type { ChatSendHandleOptions } from '@/frontend/features/send/chat-send-handle-options'
import { prependMorgEmergencyV1Marker } from '@/frontend/lib/morg-emergency-v1-text'
import type { SendMeshV2WireBurstOptions } from '@/frontend/features/send/chat-view-mesh-send'
import { SOS_MESH_RETRY_DEFAULTS, sosMeshRetryDelayMs } from '@/frontend/lib/morg-sos-mesh-retry'
import { sha256HexUtf8 } from '@/frontend/lib/sha256-hex-utf8'
import {
  sendEncryptedMailboxHybrid,
  sendPlaintextMailboxHybrid,
} from '@/frontend/lib/mailbox-send-hybrid'
import {
  isForensicImageMailboxAttestationEnabled,
  runForensicMailboxAttestationAfterSend,
  sha256HexFromBase64Bytes,
} from '@/frontend/lib/forensic-mailbox-attestation'
import { formatTxDigestStatusSuffix } from '@/frontend/lib/iota-tx-explorer-hint'
import {
  formatMeshtasticNodeIdFromNum,
  parseMeshtasticNodeIdToNumber,
  resolveMeshtasticPlaintextDestination,
} from '@/frontend/lib/meshtastic-node-id'
import type { Message } from '@/frontend/lib/types'
import { formatUnknownError } from '@/frontend/lib/format-unknown-error'

/** Gleiche Meldung: Klartext-Mesh und verschlüsselter Mesh-Pfad bei fehlendem Heltec. */
const MESH_BT_NOT_CONNECTED_MSG = 'Meshtastic/Web Bluetooth nicht verbunden (Heltec).'

/** UI: „IDs & Puls“ → Strikt ohne Funk-Fallback bei Online-Versand. */
function readStrictOnlineNoMeshFallback(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('morgendrot.strictOnlineNoMeshFallback') === '1'
  } catch {
    return false
  }
}

/** B2: nach erfolgreichem Funk-SOS zusätzlich verschlüsselt in die Mailbox spiegeln (Opt-out: `localStorage` `morgendrot.sosIotaMirror` = `0`). */
function readSosIotaMirrorEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem('morgendrot.sosIotaMirror') !== '0'
  } catch {
    return true
  }
}

/**
 * B2+: Zwischen Funk-Wiederholungen `/send` versuchen — erfolgreiche Mailbox = Basis erreicht → **keine** weiteren LoRa-Versuche (Airtime).
 * Opt-out: `localStorage` **`morgendrot.sosRetryStopOnServerAck`** = **`0`**.
 */
function readSosRetryStopOnServerAckEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem('morgendrot.sosRetryStopOnServerAck') !== '0'
  } catch {
    return true
  }
}

/** Optional: vor `/send` nur `/sos-gateway-ack` (Log, keine Mailbox) — aktivieren mit `localStorage` `morgendrot.sosUseDedicatedGatewayAck` = `1`. */
function readSosUseDedicatedGatewayAck(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('morgendrot.sosUseDedicatedGatewayAck') === '1'
  } catch {
    return false
  }
}

/** Nach erfolgreichem Funk-SOS auf Mesh-Ack warten (ms), `localStorage` `morgendrot.sosWaitMeshAckMs` (0 = aus, max 120000). */
function readSosWaitMeshAckAfterSendMs(): number {
  if (typeof window === 'undefined') return 0
  try {
    const v = parseInt(window.localStorage.getItem('morgendrot.sosWaitMeshAckMs') || '0', 10)
    if (!Number.isFinite(v) || v <= 0) return 0
    return Math.min(v, 120_000)
  } catch {
    return 0
  }
}

function applyValidationError(
  v: { ok: false; message: string; idleMs?: number },
  setStatus: UseChatViewSendFlowParams['setStatus'],
  setStatusMsg: UseChatViewSendFlowParams['setStatusMsg']
): void {
  setStatus('error')
  setStatusMsg(v.message)
  setTimeout(() => setStatus('idle'), v.idleMs ?? 6000)
}

function recordMeshOutgoingPlaintext(
  append: UseChatViewSendFlowParams['appendMeshMessage'],
  myAddress: string,
  text: string,
  dest: number | 'broadcast'
): void {
  const addr = myAddress.trim()
  if (!append || !addr) return
  const destLabel = dest === 'broadcast' ? 'Meshtastic Broadcast' : `mesh:${formatMeshtasticNodeIdFromNum(dest)}`
  const ts = Date.now()
  const id = `mesh-out-plain-${ts}-${Math.random().toString(36).slice(2, 9)}`
  append({
    id,
    from: addr,
    recipient: destLabel,
    content: text,
    timestamp: ts,
    encrypted: false,
    source: 'mesh',
    transports: ['mesh'],
    dedupKey: `mesh-out-plain|${addr}|${text.slice(0, 80)}|${Math.floor(ts / 120_000)}`,
    meshMeta:
      dest === 'broadcast' ? { kind: 'text', fromNodeNum: 0 } : { kind: 'text', fromNodeNum: (dest as number) >>> 0 },
  })
}

function mailboxHybridErr(res: { error?: unknown; message?: unknown }): string {
  if (typeof res.error === 'string' && res.error.trim()) return res.error.trim()
  if (typeof res.message === 'string' && res.message.trim()) return res.message.trim()
  if (res.error !== undefined && res.error !== null) return formatUnknownError(res.error)
  if (res.message !== undefined && res.message !== null) return formatUnknownError(res.message)
  return 'Fehler'
}

function recordMeshOutgoingV2(
  append: UseChatViewSendFlowParams['appendMeshMessage'],
  myAddress: string,
  wirePlain: string,
  label = 'Meshtastic (Mesh v2)'
): void {
  const addr = myAddress.trim()
  if (!append || !addr) return
  const preview =
    wirePlain.length > 280 ? `${wirePlain.slice(0, 260).trimEnd()}… (${wirePlain.length} Zeichen)` : wirePlain
  const ts = Date.now()
  const id = `mesh-out-v2-${ts}-${Math.random().toString(36).slice(2, 9)}`
  append({
    id,
    from: addr,
    recipient: label,
    content: preview,
    timestamp: ts,
    encrypted: true,
    source: 'mesh',
    transports: ['mesh'],
    dedupKey: `mesh-out-v2|${addr}|${ts}|${Math.random().toString(36).slice(2, 7)}`,
    meshMeta: { kind: 'v2', fromNodeNum: 0 },
  })
}

export function useChatViewHandleSend(p: UseChatViewSendFlowParams) {
  const {
    isPrivate,
    encrypted,
    forcedTransport,
    messagingPersistenceMode,
    recipient,
    myAddress,
    message,
    setMessage,
    attachedLora,
    attachedBlobBase64,
    attachedTxtFile,
    attachedAudioBase64,
    clearCompactAttachment,
    meshtastic,
    loadMessages,
    setSending,
    setStatus,
    setStatusMsg,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
    delayMirrorToIota,
    waitForMeshSosAckDigest,
    setMeshProgress,
    onOfflineMailboxQueueChanged,
    deviceTimeTrustWarn,
    meshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    appendMeshMessage,
  } = p

  const handleSend = useCallback(async (opts?: ChatSendHandleOptions) => {
    const emergencyKind = opts?.emergencyWire
    const isEmergencySend = emergencyKind === 'text' || emergencyKind === 'voice'
    /** Snaps, die bereits per `/send` (Mailbox) angekommen sind — kein erneuter B2-Spiegel. */
    const sosMailboxAckedSnaps = new Set<string>()
    /** Mindestens ein SOS-Teil wurde nach Funkfehler nur/noch über Mailbox zugestellt (Retry gestoppt). */
    let sosDeliveredViaMailboxAck = false
    /** Nach erfolgreichem Funk: optionaler Hinweis auf empfangenes `MORG_SOS_ACK_V1`. */
    let sosMeshPeerAckFootnote = ''
    const meshBurstOpts: SendMeshV2WireBurstOptions | undefined = isEmergencySend
      ? { priorityFlash: true }
      : undefined

    const meshPlaintextDest = (): number | 'broadcast' | null =>
      resolveMeshtasticPlaintextDestination(meshPlaintextToNodeEnabled, meshPlaintextNodeId)

    const sendMeshBurst = (text: string) =>
      sendMeshV2WireBurst(
        text,
        meshtastic.sendBinaryV2.bind(meshtastic),
        (sent, total) => {
          if (total > 1) {
            setStatusMsg(`Funk: Mesh v2 ${sent}/${total} Pakete…`)
          }
        },
        meshBurstOpts
      )

    const runEmergencyMeshBurstWithRetry = async (wireText: string): Promise<void> => {
      const max = SOS_MESH_RETRY_DEFAULTS.maxAttempts
      let lastErr: unknown
      for (let attempt = 0; attempt < max; attempt++) {
        try {
          if (!meshtastic.connected) {
            throw new Error(MESH_BT_NOT_CONNECTED_MSG)
          }
          await sendMeshBurst(wireText)
          const waitMs = readSosWaitMeshAckAfterSendMs()
          if (waitMs > 0 && waitForMeshSosAckDigest) {
            const digest = await sha256HexUtf8(wireText)
            const got = await waitForMeshSosAckDigest(digest, waitMs)
            if (got) {
              sosMeshPeerAckFootnote = ' Funk-Empfang per [SOS-Ack] bestätigt.'
            }
          }
          return
        } catch (e) {
          lastErr = e
          if (attempt + 1 >= max) break
          if (encrypted && isPrivate && readSosRetryStopOnServerAckEnabled()) {
            const digest = await sha256HexUtf8(wireText)
            let acked = false
            if (readSosUseDedicatedGatewayAck()) {
              setStatusMsg('SOS: Funk fehlgeschlagen — leichtes Gateway-ACK…')
              const g = await sosGatewayAckDigest(digest)
              acked = !!(g && typeof g === 'object' && (g as { ok?: boolean }).ok === true)
            }
            if (!acked) {
              setStatusMsg('SOS: Funk fehlgeschlagen — versuche IOTA-Mailbox (Direct zuerst, sonst Basis)…')
              const ack = await sendEncryptedMailboxHybrid(recipient.trim(), wireText)
              acked = ack.ok
            }
            if (acked) {
              sosMailboxAckedSnaps.add(wireText)
              sosDeliveredViaMailboxAck = true
              setStatusMsg(
                readSosUseDedicatedGatewayAck()
                  ? 'SOS: Gateway/Mailbox-Pfad hat bestätigt — Funk-Wiederholungen gestoppt (Airtime).'
                  : 'SOS: Basis hat die Nachricht über die Mailbox — Funk-Wiederholungen gestoppt (Airtime).'
              )
              return
            }
          }
          const delay = sosMeshRetryDelayMs(attempt)
          setStatusMsg(
            `SOS: Funk fehlgeschlagen — Wiederholung ${attempt + 2}/${max} in ca. ${Math.round(delay / 1000)} s …`
          )
          await new Promise((r) => setTimeout(r, delay))
        }
      }
      throw lastErr
    }

    const singleWireSuccessMsg = (): string => {
      if (!isPrivate) return 'Gesendet!'
      if (!encrypted) {
        if (forcedTransport === 'internet') return 'Klartext über IOTA (/send-plain) gesendet.'
        if (forcedTransport === 'mesh') return 'Klartext über LoRa (Meshtastic-Text) gesendet.'
      }
      if (forcedTransport === 'mesh' && encrypted && sosDeliveredViaMailboxAck) {
        return 'SOS: über IOTA-Mailbox zugestellt (Funk-Wiederholungen nach Basis-Eingang gestoppt).'
      }
      if (forcedTransport === 'mesh' && encrypted && isPrivate && !isEmergencySend) {
        return delayMirrorToIota
          ? 'Nachricht per LoRa gesendet; wird beim Empfänger im Tangle verankert (Delayed Mirror).'
          : 'Nur per LoRa gesendet (ohne Tangle — keine Forensic-Attestation für diese Sendung).'
      }
      if (forcedTransport === 'mesh') return 'Nur Funk: Mesh v2 (PRIVATE_APP) gesendet.'
      if (forcedTransport === 'internet') return 'Online (IOTA/Mailbox) gesendet.'
      return 'Gesendet.'
    }

    const shouldLoadMessagesAfterSend = (): boolean => {
      if (!isPrivate) return true
      if (!encrypted) {
        if (forcedTransport === 'internet') return true
        if (forcedTransport === 'mesh') return true
        return false
      }
      if (forcedTransport === 'mesh') return false
      if (forcedTransport === 'internet') return true
      return false
    }

    if (attachedLora && encrypted && isPrivate && forcedTransport === 'mesh') {
      const { lumaText, chromaText } = buildLoraMeshDualWireTexts(
        attachedLora.lumaWire,
        attachedLora.chromaWire,
        message
      )
      const v = validateLoraDualWireUtf8(lumaText, chromaText)
      if (!v.ok) {
        applyValidationError(v, setStatus, setStatusMsg)
        return
      }
      const meshLuma = delayMirrorToIota ? prependDelayMirrorMarker(lumaText) : lumaText
      const meshChroma = delayMirrorToIota ? prependDelayMirrorMarker(chromaText) : chromaText
      setLoraOnlineFallbackOffer(null)
      loraOnlineOfferPayloadRef.current = null
      setSending(true)
      setStatus('idle')
      let offeredOnline = false
      try {
        if (!meshtastic.connected) {
          setStatus('error')
          setStatusMsg('LoRa (Funk): Heltec/Web Bluetooth nicht verbunden – nichts gesendet.')
          loraOnlineOfferPayloadRef.current = { lumaText, chromaText }
          setLoraOnlineFallbackOffer({ reasonLabel: 'Kein Funkgerät gekoppelt.' })
          offeredOnline = true
        } else {
          setStatusMsg('Funk: LUMA (Mesh v2)…')
          let lumaPktTotal = 1
          await sendMeshV2WireBurst(
            meshLuma,
            meshtastic.sendBinaryV2.bind(meshtastic),
            (sent, total) => {
              lumaPktTotal = total
              setMeshProgress?.(`Luma ${sent}/${total} · Chroma ausstehend`)
              if (total > 1) setStatusMsg(`Funk: LUMA (Mesh v2) ${sent}/${total} …`)
              else setStatusMsg('Funk: LUMA (Mesh v2)…')
            },
            meshBurstOpts
          )
          setStatusMsg('Funk: CHROMA (Mesh v2)…')
          await sendMeshV2WireBurst(
            meshChroma,
            meshtastic.sendBinaryV2.bind(meshtastic),
            (sent, total) => {
              setMeshProgress?.(`Luma ${lumaPktTotal}/${lumaPktTotal} · Chroma ${sent}/${total}`)
              if (total > 1) setStatusMsg(`Funk: CHROMA (Mesh v2) ${sent}/${total} …`)
              else setStatusMsg('Funk: CHROMA (Mesh v2)…')
            },
            meshBurstOpts
          )
          setStatus('success')
          setStatusMsg(
            delayMirrorToIota
              ? 'Funk: LoRa LUMA + CHROMA gesendet (Zweiteiler). Wird beim Empfänger im Tangle verankert (Delayed Mirror; WLAN/Basis).'
              : 'Funk: LoRa LUMA + CHROMA gesendet (Zweiteiler). Nur per LoRa — ohne Tangle keine Forensic-Attestation.'
          )
          const cap = message.trim()
          recordMeshOutgoingV2(
            appendMeshMessage,
            myAddress,
            `[LoRa-Bild] LUMA+CHROMA${cap ? `: ${cap}` : ''}`,
            'Meshtastic (Mesh v2 · LUMA+CHROMA)'
          )
          setMessage('')
          setTimeout(() => void loadMessages(), 500)
        }
      } catch (e) {
        const raw = formatUnknownError(e)
        setStatus('error')
        setStatusMsg(`LoRa (Funk) fehlgeschlagen – nichts gesendet. ${raw}`)
        loraOnlineOfferPayloadRef.current = { lumaText, chromaText }
        setLoraOnlineFallbackOffer({ reasonLabel: raw })
        offeredOnline = true
      } finally {
        setMeshProgress?.(null)
        clearCompactAttachment()
        setSending(false)
        if (!offeredOnline) {
          setTimeout(() => setStatus('idle'), 4000)
        }
      }
      return
    }

    if (attachedLora && encrypted && isPrivate && forcedTransport === 'internet') {
      const { lumaText, chromaText } = buildLoraMeshDualWireTexts(
        attachedLora.lumaWire,
        attachedLora.chromaWire,
        message
      )
      const v = validateLoraDualWireUtf8(lumaText, chromaText)
      if (!v.ok) {
        applyValidationError(v, setStatus, setStatusMsg)
        return
      }
      setLoraOnlineFallbackOffer(null)
      loraOnlineOfferPayloadRef.current = null
      setSending(true)
      setStatus('idle')
      try {
        const rTrim = recipient.trim()
        const n1 = BigInt(nextOfflineMailboxClientOutSeq())
        const w1 = prependMailboxOutNonceMarker(lumaText, n1)
        setStatusMsg('Online: LUMA (IOTA/Mailbox)…')
        const r1 = await sendEncryptedMailboxHybrid(rTrim, w1)
        if (!r1.ok) throw new Error(r1.error || r1.message || 'LUMA fehlgeschlagen.')
        const n2 = BigInt(nextOfflineMailboxClientOutSeq())
        const w2 = prependMailboxOutNonceMarker(chromaText, n2)
        setStatusMsg('Online: CHROMA (IOTA/Mailbox)…')
        const r2 = await sendEncryptedMailboxHybrid(rTrim, w2)
        if (!r2.ok) throw new Error(r2.error || r2.message || 'CHROMA fehlgeschlagen.')
        const baseSuccess = 'Online (IOTA/Mailbox): LUMA + CHROMA gesendet.'
        setStatus('success')
        const mbTx = (r2.ok === true ? r2.txDigest : undefined) ?? (r1.ok === true ? r1.txDigest : undefined)
        if (isForensicImageMailboxAttestationEnabled()) {
          await runForensicMailboxAttestationAfterSend({
            recipient: rTrim,
            senderAddress: myAddress.trim(),
            primary: { payloadUtf8: w1, messageNonceU64: n1 },
            secondary: { payloadUtf8: w2, messageNonceU64: n2 },
            imageContentSha256Hex: null,
            deviceTimeTrustWarn: !!deviceTimeTrustWarn,
            baseSuccessMsg: baseSuccess,
            setStatusMsg,
            mailboxTxDigest: mbTx,
          })
        } else {
          setStatusMsg(baseSuccess + formatTxDigestStatusSuffix(mbTx))
        }
        setMessage('')
        if (shouldLoadMessagesAfterSend()) {
          setTimeout(() => void loadMessages(), 500)
        }
      } catch (e) {
        setStatus('error')
        setStatusMsg(formatUnknownError(e))
      } finally {
        setMeshProgress?.(null)
        clearCompactAttachment()
        setSending(false)
        setTimeout(() => setStatus('idle'), 6000)
      }
      return
    }

    if (attachedLora) {
      setStatus('error')
      setStatusMsg(
        'LoRa-Zweiphasen-Bild: privater Chat, Verschlüsselung an — Sendepfad „online“ (IOTA) oder „funk“ (Mesh). Oder Anhang entfernen.'
      )
      setTimeout(() => setStatus('idle'), 6000)
      return
    }

    if (isEmergencySend) {
      if (!isPrivate || !encrypted) {
        applyValidationError(
          {
            ok: false,
            message:
              'SOS (Hilferuf) ist nur im privaten Chat mit aktivierter Verschlüsselung verfügbar.',
            idleMs: 8000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
      if (emergencyKind === 'voice' && !attachedAudioBase64) {
        applyValidationError(
          {
            ok: false,
            message:
              'SOS-Sprache: keine Audiodaten im Composer – bitte Aufnahme nutzen und erneut senden.',
            idleMs: 7000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
      if (
        emergencyKind === 'text' &&
        (attachedAudioBase64 || attachedBlobBase64 || attachedTxtFile || attachedLora)
      ) {
        applyValidationError(
          {
            ok: false,
            message:
              'SOS-Text: nicht zusammen mit Anhängen. Anhang entfernen oder „SOS jetzt über LoRa“ für die Sprachvariante.',
            idleMs: 9000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
    }

    const cap = message.trim() || undefined
    const useTxtSplit =
      attachedTxtFile != null && !attachedBlobBase64 && !attachedAudioBase64 && !attachedLora

    let textSnaps: string[]
    if (useTxtSplit) {
      try {
        textSnaps = buildTxtFileWireParts(attachedTxtFile.name, attachedTxtFile.text, cap)
      } catch (e) {
        setStatus('error')
        setStatusMsg(formatUnknownError(e))
        setTimeout(() => setStatus('idle'), 7000)
        return
      }
    } else {
      const single = buildChatOutgoingWireContent({
        composerPlainText: message,
        attachedAudioBase64,
        attachedBlobBase64,
        attachedTxtFile,
      })
      if (!single && !(isEmergencySend && emergencyKind === 'text')) return
      textSnaps = [single ?? '']
    }

    if (isEmergencySend && emergencyKind) {
      const k = emergencyKind === 'text' ? 'text' : 'voice'
      textSnaps = textSnaps.map((s) => prependMorgEmergencyV1Marker(s, k))
    }

    const meshKlartextOkWithoutZeroXRecipient =
      forcedTransport === 'mesh' &&
      (!meshPlaintextToNodeEnabled || parseMeshtasticNodeIdToNumber(meshPlaintextNodeId) !== null)

    if (!encrypted && !recipient.trim()) {
      if (!meshKlartextOkWithoutZeroXRecipient) {
        applyValidationError(
          {
            ok: false,
            message:
              'Klartext: Empfänger-Adresse (0x…) angeben — oder bei „funk“ ohne Ziel-Knoten das Heltec verbinden und Broadcast nutzen (Haken „an Node-ID“ aus). Mit Haken: gültige Node-ID z. B. !1a2b3c4d.',
            idleMs: 9000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
    }

    const meshBlob = validateMeshDisallowsIotaCompactBlob(forcedTransport, attachedBlobBase64)
    if (!meshBlob.ok) {
      applyValidationError(meshBlob, setStatus, setStatusMsg)
      return
    }

    for (const snap of textSnaps) {
      const std = validateStandardOutgoingWire(snap, {
        hasAttachedAudio: attachedAudioBase64 != null,
        forcedTransport,
      })
      if (!std.ok) {
        applyValidationError(std, setStatus, setStatusMsg)
        return
      }
    }

    if (isPrivate && !encrypted && forcedTransport === 'mesh') {
      if (attachedBlobBase64 || attachedAudioBase64 || attachedTxtFile || attachedLora) {
        applyValidationError(
          {
            ok: false,
            message:
              'Unverschlüsselter Funk: nur reiner Kurztext, keine Anhänge (kein Bild/Audio/Datei/LoRa-Zweiteiler).',
            idleMs: 9000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
    }

    /** LongFast / TEXT_MESSAGE: harte Nutzlastgrenze — galt fälschlich nur privat; öffentlicher Funk braucht dieselbe Kappe. */
    if (!encrypted && forcedTransport === 'mesh') {
      for (const snap of textSnaps) {
        const charCount = [...snap].length
        if (charCount > MESH_PLAINTEXT_MAX_CHARS) {
          applyValidationError(
            {
              ok: false,
              message: `Unverschlüsselter LoRa-Text maximal ${MESH_PLAINTEXT_MAX_CHARS} Zeichen (aktuell ${charCount}). Kürzen, mehrere Kurznachrichten, oder verschlüsselt senden (Mesh v2).`,
              idleMs: 9000,
            },
            setStatus,
            setStatusMsg
          )
          return
        }
      }
    }

    setSending(true)
    setStatus('idle')
    if (textSnaps.length > 1) {
      setStatusMsg(`Datei wird in ${textSnaps.length} Teile aufgeteilt…`)
    }

    const allowOfflineMailboxQueue =
      textSnaps.length === 1 &&
      isOfflineMailboxQueueEnabled() &&
      !attachedBlobBase64 &&
      !attachedAudioBase64 &&
      !attachedTxtFile &&
      !attachedLora

    type QueueMailboxOutcome = 'queued' | 'duplicate' | 'skipped' | { reject: string }

    const queueMailboxIfAllowed = async (
      kind: 'encrypted_send' | 'plain_send',
      /** Exakt der an `/send` bzw. `/send-plain` gegebene Wire (kann `MORG_MAILBOX_NONCE_V1` enthalten). */
      wireForQueue: string,
      encrypted: boolean,
      lastErr: string,
      /** § H.12: aus Marker geparst oder Fallback `nextOfflineMailboxClientOutSeq` beim Compose. */
      messageNonceU64: bigint
    ): Promise<QueueMailboxOutcome> => {
      if (!allowOfflineMailboxQueue) return 'skipped'
      const en = await enqueueOfflineMailboxFailure({
        kind,
        recipient,
        payload: wireForQueue,
        encrypted,
        timeIsTrusted: !deviceTimeTrustWarn,
        lastError: lastErr,
        senderAddress: myAddress,
        threadId: stableOfflineMailboxThreadId(myAddress, recipient),
        messageNonceU64,
      })
      if (!en.ok) {
        onOfflineMailboxQueueChanged?.()
        return { reject: en.reason }
      }
      if (en.queued) {
        onOfflineMailboxQueueChanged?.()
        return 'queued'
      }
      onOfflineMailboxQueueChanged?.()
      return 'duplicate'
    }

    type MailboxSendCapture = {
      payloadUtf8: string
      messageNonceU64: bigint
      encrypted: boolean
      txDigest?: string
    }

    type PartOk =
      | { ok: true; meshFallback?: { onlineErr: string }; mailboxCapture?: MailboxSendCapture }
      | { ok: false }

    const sendOnePart = async (textSnap: string): Promise<PartOk> => {
      const failSend = (msg: string): PartOk => {
        setStatus('error')
        setStatusMsg(msg)
        return { ok: false }
      }
      const tryMailbox = async (enc: boolean): Promise<PartOk> => {
        let wireForApi: string
        let messageNonceU64: bigint
        if (enc) {
          const existing = parseMailboxOutNonceMarker(textSnap)
          messageNonceU64 = existing?.nonce ?? BigInt(nextOfflineMailboxClientOutSeq())
          wireForApi = existing ? textSnap : prependMailboxOutNonceMarker(textSnap, messageNonceU64)
        } else {
          messageNonceU64 = BigInt(nextOfflineMailboxClientOutSeq())
          wireForApi = textSnap
        }
        const res = enc
          ? await sendEncryptedMailboxHybrid(recipient.trim(), wireForApi)
          : await sendPlaintextMailboxHybrid(recipient.trim(), wireForApi, messageNonceU64)
        if (res.ok) {
          return {
            ok: true,
            mailboxCapture: {
              payloadUtf8: wireForApi,
              messageNonceU64,
              encrypted: enc,
              txDigest: res.txDigest,
            },
          }
        }
        const errText = mailboxHybridErr(res)
        const qm = await queueMailboxIfAllowed(
          enc ? 'encrypted_send' : 'plain_send',
          wireForApi,
          enc,
          errText,
          messageNonceU64
        )
        if (qm === 'queued') {
          return failSend(
            `${errText} — zwischengespeichert; erneuter Versuch, sobald die Basis wieder erreichbar ist (Opt-in „Mailbox-Warteschlange“).`
          )
        }
        if (qm === 'duplicate') {
          return failSend(
            `${errText} — dieselbe Nachricht steht bereits in der Mailbox-Warteschlange (Dedup / § H.12).`
          )
        }
        if (typeof qm === 'object' && 'reject' in qm) {
          return failSend(`Warteschlange: ${qm.reject}`)
        }
        return failSend(errText)
      }

      if (!isPrivate) {
        if (forcedTransport === 'mesh') {
          if (encrypted) {
            return failSend(
              'Öffentlicher Kanal: verschlüsselter Funk braucht privaten Chat mit Handshake und /connect. Wähle Klartext + „funk“ oder wechsle in den privaten Chat.'
            )
          }
          if (!meshtastic.connected) return failSend(MESH_BT_NOT_CONNECTED_MSG)
          const dest = meshPlaintextDest()
          if (dest === null) {
            return failSend(
              'Funk-Klartext an Node: gültige Node-ID (z. B. !1a2b3c4d) eintragen — oder Haken „an Node-ID“ deaktivieren für Broadcast.'
            )
          }
          try {
            await meshtastic.sendMeshText(textSnap, dest)
            recordMeshOutgoingPlaintext(appendMeshMessage, myAddress, textSnap, dest)
            return { ok: true }
          } catch (e) {
            setStatus('error')
            setStatusMsg(formatUnknownError(e))
            return { ok: false }
          }
        }
        return tryMailbox(encrypted)
      }

      if (!encrypted) {
        if (forcedTransport === 'internet') {
          return tryMailbox(false)
        }
        if (forcedTransport === 'mesh') {
          const dest = meshPlaintextDest()
          if (dest === null) {
            return failSend(
              'Funk-Klartext: gültige Node-ID (z. B. !1a2b3c4d) oder Haken „an Node-ID“ aus für Broadcast.'
            )
          }
          if (isEmergencySend) {
            const max = SOS_MESH_RETRY_DEFAULTS.maxAttempts
            let lastErr: unknown
            for (let attempt = 0; attempt < max; attempt++) {
              try {
                if (!meshtastic.connected) {
                  throw new Error(MESH_BT_NOT_CONNECTED_MSG)
                }
                await meshtastic.sendMeshText(textSnap, dest)
                recordMeshOutgoingPlaintext(appendMeshMessage, myAddress, textSnap, dest)
                return { ok: true }
              } catch (e) {
                lastErr = e
                if (attempt + 1 >= max) break
                const delay = sosMeshRetryDelayMs(attempt)
                setStatusMsg(
                  `SOS: Funk fehlgeschlagen — Wiederholung ${attempt + 2}/${max} in ca. ${Math.round(delay / 1000)} s …`
                )
                await new Promise((r) => setTimeout(r, delay))
              }
            }
            setStatus('error')
            setStatusMsg(formatUnknownError(lastErr))
            return { ok: false }
          }
          if (!meshtastic.connected) {
            return failSend(MESH_BT_NOT_CONNECTED_MSG)
          }
          try {
            await meshtastic.sendMeshText(textSnap, dest)
            recordMeshOutgoingPlaintext(appendMeshMessage, myAddress, textSnap, dest)
            return { ok: true }
          } catch (e) {
            setStatus('error')
            setStatusMsg(formatUnknownError(e))
            return { ok: false }
          }
        }
        setStatus('error')
        setStatusMsg(
          forcedTransport === 'adhoc'
            ? 'Ad-hoc: nicht implementiert. Wähle „online“ oder „funk“ (Klartext) bzw. verschlüsselt.'
            : 'Unbekannter Klartext-Pfad.'
        )
        return { ok: false }
      }

      if (forcedTransport === 'adhoc') {
        setStatus('error')
        setStatusMsg(
          'Layer 3 (Smartphone-Direct): nicht implementiert – BLE-Advertising/Scan nur als Konzept (bleUuid im Vault).'
        )
        return { ok: false }
      }

      if (forcedTransport === 'mesh') {
        let wireText = textSnap
        if (delayMirrorToIota && encrypted && !isEmergencySend) {
          wireText = prependDelayMirrorMarker(textSnap)
        }
        try {
          if (isEmergencySend) {
            await runEmergencyMeshBurstWithRetry(wireText)
          } else {
            if (!meshtastic.connected) {
              return failSend(MESH_BT_NOT_CONNECTED_MSG)
            }
            await sendMeshBurst(wireText)
          }
          recordMeshOutgoingV2(appendMeshMessage, myAddress, wireText)
          return { ok: true }
        } catch (e) {
          setStatus('error')
          setStatusMsg(formatUnknownError(e))
          return { ok: false }
        }
      }

      if (forcedTransport === 'internet') {
        const existing = parseMailboxOutNonceMarker(textSnap)
        const messageNonceU64 = existing?.nonce ?? BigInt(nextOfflineMailboxClientOutSeq())
        const wireForApi = existing ? textSnap : prependMailboxOutNonceMarker(textSnap, messageNonceU64)
        const res = await sendEncryptedMailboxHybrid(recipient.trim(), wireForApi)
        if (res.ok) {
          return {
            ok: true,
            mailboxCapture: {
              payloadUtf8: wireForApi,
              messageNonceU64,
              encrypted: true,
              txDigest: res.txDigest,
            },
          }
        }
        const onlineErr = mailboxHybridErr(res) || 'Online-Versand fehlgeschlagen.'
        if (meshtastic.connected && !readStrictOnlineNoMeshFallback()) {
          try {
            if (isEmergencySend) {
              await runEmergencyMeshBurstWithRetry(textSnap)
            } else {
              await sendMeshBurst(textSnap)
            }
            recordMeshOutgoingV2(appendMeshMessage, myAddress, textSnap, 'Meshtastic (Mesh v2 · Online-Fallback)')
            return { ok: true, meshFallback: { onlineErr } }
          } catch (meshErr) {
            const meshMsg = formatUnknownError(meshErr)
            const qmMesh = await queueMailboxIfAllowed(
              'encrypted_send',
              wireForApi,
              true,
              `${onlineErr} / Funk: ${meshMsg}`,
              messageNonceU64
            )
            if (qmMesh === 'queued') {
              return failSend(
                `${onlineErr} Funk-Versuch fehlgeschlagen — zwischengespeichert; erneuter Mailbox-Versuch bei Basis (Opt-in).`
              )
            }
            if (qmMesh === 'duplicate') {
              return failSend(
                `${onlineErr} Funk: ${meshMsg} — Eintrag existiert bereits in der Mailbox-Warteschlange (Dedup).`
              )
            }
            if (typeof qmMesh === 'object' && 'reject' in qmMesh) {
              return failSend(`Warteschlange: ${qmMesh.reject}`)
            }
            setStatus('error')
            setStatusMsg(`${onlineErr} Funk-Versuch: ${meshMsg}`)
            return { ok: false }
          }
        }
        const qmOnline = await queueMailboxIfAllowed('encrypted_send', wireForApi, true, onlineErr, messageNonceU64)
        if (qmOnline === 'queued') {
          return failSend(
            readStrictOnlineNoMeshFallback() && meshtastic.connected
              ? `${onlineErr} „Strikt ohne Funk-Fallback“ — zwischengespeichert; bei Basis erneut versuchen (Opt-in) oder Transport auf „funk“ stellen.`
              : `${onlineErr} Kein Funk (Heltec) verbunden — zwischengespeichert; bei Basis erneut versuchen (Opt-in) oder „funk“ wählen.`
          )
        }
        if (qmOnline === 'duplicate') {
          return failSend(
            `${onlineErr} — dieselbe Nachricht steht bereits in der Mailbox-Warteschlange (Dedup / § H.12).`
          )
        }
        if (typeof qmOnline === 'object' && 'reject' in qmOnline) {
          return failSend(`Warteschlange: ${qmOnline.reject}`)
        }
        setStatus('error')
        setStatusMsg(
          readStrictOnlineNoMeshFallback() && meshtastic.connected
            ? `${onlineErr} „Strikt ohne Funk-Fallback“ aktiv – nur Online oder Transport auf „funk“ stellen.`
            : `${onlineErr} Kein Funk (Heltec) verbunden – „funk“ wählen und koppeln oder Online-Fehler beheben (Wallet, Connect, RPC).`
        )
        return { ok: false }
      }

      setStatus('error')
      setStatusMsg('Unbekannter Sendepfad.')
      return { ok: false }
    }

    try {
      let lastOk: PartOk | null = null
      for (let i = 0; i < textSnaps.length; i++) {
        const textSnap = textSnaps[i]!
        const r = await sendOnePart(textSnap)
        if (!r.ok) {
          if (textSnaps.length > 1 && i > 0) {
            setStatusMsg(
              `Teil ${i + 1}/${textSnaps.length} fehlgeschlagen (vorherige Teile können bereits angekommen sein).`
            )
          }
          return
        }
        lastOk = r
      }

      let mirrorFootnote = ''
      if (
        isEmergencySend &&
        forcedTransport === 'mesh' &&
        encrypted &&
        sosDeliveredViaMailboxAck &&
        textSnaps.length > 1
      ) {
        mirrorFootnote +=
          ' Mindestens ein Teil über IOTA-Mailbox zugestellt (Funk-Wiederholungen für diesen Teil gestoppt).'
      }
      if (
        isEmergencySend &&
        forcedTransport === 'mesh' &&
        encrypted &&
        isPrivate &&
        readSosIotaMirrorEnabled()
      ) {
        for (let mi = 0; mi < textSnaps.length; mi++) {
          const snap = textSnaps[mi]!
          if (sosMailboxAckedSnaps.has(snap)) continue
          const mr = await sendEncryptedMailboxHybrid(recipient.trim(), snap)
          if (!mr.ok) {
            mirrorFootnote = ` IOTA-Spiegel (${mi + 1}/${textSnaps.length}) fehlgeschlagen: ${mailboxHybridErr(mr)}.`
            break
          }
        }
      }

      const successTail = mirrorFootnote + sosMeshPeerAckFootnote
      let successMsg: string
      if (textSnaps.length > 1) {
        successMsg = `Alle ${textSnaps.length} Teile gesendet.${successTail}`
      } else if (lastOk?.ok && lastOk.meshFallback) {
        successMsg = `Online fehlgeschlagen (${lastOk.meshFallback.onlineErr}) – stattdessen per Funk gesendet.${successTail}`
      } else {
        successMsg = singleWireSuccessMsg() + successTail
      }

      const forensicGate =
        isForensicImageMailboxAttestationEnabled() &&
        encrypted &&
        isPrivate &&
        forcedTransport === 'internet' &&
        attachedBlobBase64 &&
        textSnaps.length === 1 &&
        lastOk?.ok === true &&
        lastOk.mailboxCapture?.encrypted === true

      setStatus('success')
      if (forensicGate && lastOk?.ok && lastOk.mailboxCapture) {
        const imgHash = await sha256HexFromBase64Bytes(attachedBlobBase64)
        await runForensicMailboxAttestationAfterSend({
          recipient: recipient.trim(),
          senderAddress: myAddress.trim(),
          primary: {
            payloadUtf8: lastOk.mailboxCapture.payloadUtf8,
            messageNonceU64: lastOk.mailboxCapture.messageNonceU64,
          },
          imageContentSha256Hex: imgHash,
          deviceTimeTrustWarn: !!deviceTimeTrustWarn,
          baseSuccessMsg: successMsg,
          setStatusMsg,
          mailboxTxDigest: lastOk.mailboxCapture.txDigest,
        })
      } else {
        setStatusMsg(successMsg + formatTxDigestStatusSuffix(lastOk?.mailboxCapture?.txDigest))
      }
      setMessage('')
      if (shouldLoadMessagesAfterSend()) {
        setTimeout(() => loadMessages(), 500)
      }
    } catch (e) {
      setStatus('error')
      setStatusMsg(formatUnknownError(e))
    } finally {
      setMeshProgress?.(null)
      clearCompactAttachment()
      setSending(false)
      setTimeout(() => setStatus('idle'), 4000)
    }
  }, [
    appendMeshMessage,
    attachedAudioBase64,
    attachedBlobBase64,
    attachedLora,
    attachedTxtFile,
    clearCompactAttachment,
    delayMirrorToIota,
    encrypted,
    forcedTransport,
    messagingPersistenceMode,
    isPrivate,
    loraOnlineOfferPayloadRef,
    loadMessages,
    message,
    meshtastic,
    recipient,
    myAddress,
    setLoraOnlineFallbackOffer,
    setMessage,
    setSending,
    setStatus,
    setStatusMsg,
    setMeshProgress,
    waitForMeshSosAckDigest,
    onOfflineMailboxQueueChanged,
    deviceTimeTrustWarn,
    meshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
  ])

  return { handleSend }
}
