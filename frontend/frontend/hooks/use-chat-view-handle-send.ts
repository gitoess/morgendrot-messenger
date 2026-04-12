'use client'

import { useCallback } from 'react'
import { sendMessage, sendEncryptedMessageWithTimeout } from '@/frontend/lib/api'
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

function applyValidationError(
  v: { ok: false; message: string; idleMs?: number },
  setStatus: UseChatViewSendFlowParams['setStatus'],
  setStatusMsg: UseChatViewSendFlowParams['setStatusMsg']
): void {
  setStatus('error')
  setStatusMsg(v.message)
  setTimeout(() => setStatus('idle'), v.idleMs ?? 6000)
}

export function useChatViewHandleSend(p: UseChatViewSendFlowParams) {
  const {
    isPrivate,
    encrypted,
    forcedTransport,
    recipient,
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
  } = p

  const handleSend = useCallback(async (opts?: ChatSendHandleOptions) => {
    const emergencyKind = opts?.emergencyWire
    const isEmergencySend = emergencyKind === 'text' || emergencyKind === 'voice'
    /** Snaps, die bereits per `/send` (Mailbox) angekommen sind — kein erneuter B2-Spiegel. */
    const sosMailboxAckedSnaps = new Set<string>()
    /** Mindestens ein SOS-Teil wurde nach Funkfehler nur/noch über Mailbox zugestellt (Retry gestoppt). */
    let sosDeliveredViaMailboxAck = false
    const meshBurstOpts: SendMeshV2WireBurstOptions | undefined = isEmergencySend
      ? { priorityFlash: true }
      : undefined

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
          return
        } catch (e) {
          lastErr = e
          if (attempt + 1 >= max) break
          if (encrypted && isPrivate && readSosRetryStopOnServerAckEnabled()) {
            setStatusMsg('SOS: Funk fehlgeschlagen — versuche IOTA-Mailbox (Basis)…')
            const ack = await sendEncryptedMessageWithTimeout(wireText)
            if (ack.ok) {
              sosMailboxAckedSnaps.add(wireText)
              sosDeliveredViaMailboxAck = true
              setStatusMsg(
                'SOS: Basis hat die Nachricht über die Mailbox — Funk-Wiederholungen gestoppt (Airtime).'
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
          await sendMeshBurst(lumaText)
          setStatusMsg('Funk: CHROMA (Mesh v2)…')
          await sendMeshBurst(chromaText)
          setStatus('success')
          setStatusMsg(
            'Funk: LoRa LUMA + CHROMA gesendet (Zweiteiler; jede Phase kann mehrere Mesh-v2-Pakete nutzen).'
          )
          setMessage('')
          setTimeout(() => void loadMessages(), 500)
        }
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e)
        setStatus('error')
        setStatusMsg(`LoRa (Funk) fehlgeschlagen – nichts gesendet. ${raw}`)
        loraOnlineOfferPayloadRef.current = { lumaText, chromaText }
        setLoraOnlineFallbackOffer({ reasonLabel: raw })
        offeredOnline = true
      } finally {
        clearCompactAttachment()
        setSending(false)
        if (!offeredOnline) {
          setTimeout(() => setStatus('idle'), 4000)
        }
      }
      return
    }

    if (attachedLora) {
      setStatus('error')
      setStatusMsg(
        'LoRa-Zweiphasen-Bild: nur privater Chat, Verschlüsselung an und Sendepfad „funk“. Oder Anhang entfernen.'
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
        setStatusMsg(e instanceof Error ? e.message : String(e))
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

    if (!encrypted && !recipient.trim()) return

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
      const charCount = [...textSnaps[0]!].length
      if (charCount > MESH_PLAINTEXT_MAX_CHARS) {
        applyValidationError(
          {
            ok: false,
            message: `Unverschlüsselter LoRa-Text maximal ${MESH_PLAINTEXT_MAX_CHARS} Zeichen (aktuell ${charCount}). Kürzen oder verschlüsselt senden.`,
            idleMs: 9000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
    }

    setSending(true)
    setStatus('idle')
    if (textSnaps.length > 1) {
      setStatusMsg(`Datei wird in ${textSnaps.length} Teile aufgeteilt…`)
    }

    type PartOk =
      | { ok: true; meshFallback?: { onlineErr: string } }
      | { ok: false }

    const sendOnePart = async (textSnap: string): Promise<PartOk> => {
      const failSend = (msg: string): PartOk => {
        setStatus('error')
        setStatusMsg(msg)
        return { ok: false }
      }
      const tryMailbox = async (enc: boolean): Promise<PartOk> => {
        const res = await sendMessage(recipient, textSnap, enc)
        if (res.ok) return { ok: true }
        return failSend(res.error || 'Fehler')
      }

      if (!isPrivate) {
        return tryMailbox(encrypted)
      }

      if (!encrypted) {
        if (forcedTransport === 'internet') {
          return tryMailbox(false)
        }
        if (forcedTransport === 'mesh') {
          if (isEmergencySend) {
            const max = SOS_MESH_RETRY_DEFAULTS.maxAttempts
            let lastErr: unknown
            for (let attempt = 0; attempt < max; attempt++) {
              try {
                if (!meshtastic.connected) {
                  throw new Error(MESH_BT_NOT_CONNECTED_MSG)
                }
                await meshtastic.sendMeshText(textSnap)
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
            setStatusMsg(lastErr instanceof Error ? lastErr.message : String(lastErr))
            return { ok: false }
          }
          if (!meshtastic.connected) {
            return failSend(MESH_BT_NOT_CONNECTED_MSG)
          }
          try {
            await meshtastic.sendMeshText(textSnap)
            return { ok: true }
          } catch (e) {
            setStatus('error')
            setStatusMsg(e instanceof Error ? e.message : String(e))
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
        if (
          delayMirrorToIota &&
          encrypted &&
          !isEmergencySend &&
          !attachedBlobBase64 &&
          !attachedAudioBase64 &&
          !attachedTxtFile
        ) {
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
          return { ok: true }
        } catch (e) {
          setStatus('error')
          setStatusMsg(e instanceof Error ? e.message : String(e))
          return { ok: false }
        }
      }

      if (forcedTransport === 'internet') {
        const res = await sendEncryptedMessageWithTimeout(textSnap)
        if (res.ok) return { ok: true }
        const onlineErr = res.error || res.message || 'Online-Versand fehlgeschlagen.'
        if (meshtastic.connected && !readStrictOnlineNoMeshFallback()) {
          try {
            if (isEmergencySend) {
              await runEmergencyMeshBurstWithRetry(textSnap)
            } else {
              await sendMeshBurst(textSnap)
            }
            return { ok: true, meshFallback: { onlineErr } }
          } catch (meshErr) {
            setStatus('error')
            setStatusMsg(
              `${onlineErr} Funk-Versuch: ${meshErr instanceof Error ? meshErr.message : String(meshErr)}`
            )
            return { ok: false }
          }
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

    const singleWireSuccessMsg = (): string => {
      if (!isPrivate) return 'Gesendet!'
      if (!encrypted) {
        if (forcedTransport === 'internet') return 'Klartext über IOTA (/send-plain) gesendet.'
        if (forcedTransport === 'mesh') return 'Klartext über LoRa (Meshtastic-Text) gesendet.'
      }
      if (forcedTransport === 'mesh' && encrypted && sosDeliveredViaMailboxAck) {
        return 'SOS: über IOTA-Mailbox zugestellt (Funk-Wiederholungen nach Basis-Eingang gestoppt).'
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
          const mr = await sendEncryptedMessageWithTimeout(snap)
          if (!mr.ok) {
            mirrorFootnote = ` IOTA-Spiegel (${mi + 1}/${textSnaps.length}) fehlgeschlagen: ${mr.error || mr.message || '?'}.`
            break
          }
        }
      }

      setStatus('success')
      if (textSnaps.length > 1) {
        setStatusMsg(`Alle ${textSnaps.length} Teile gesendet.${mirrorFootnote}`)
      } else if (lastOk?.ok && lastOk.meshFallback) {
        setStatusMsg(
          `Online fehlgeschlagen (${lastOk.meshFallback.onlineErr}) – stattdessen per Funk gesendet.${mirrorFootnote}`
        )
      } else {
        setStatusMsg(singleWireSuccessMsg() + mirrorFootnote)
      }
      setMessage('')
      if (shouldLoadMessagesAfterSend()) {
        setTimeout(() => loadMessages(), 500)
      }
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
    } finally {
      clearCompactAttachment()
      setSending(false)
      setTimeout(() => setStatus('idle'), 4000)
    }
  }, [
    attachedAudioBase64,
    attachedBlobBase64,
    attachedLora,
    attachedTxtFile,
    clearCompactAttachment,
    delayMirrorToIota,
    encrypted,
    forcedTransport,
    isPrivate,
    loraOnlineOfferPayloadRef,
    loadMessages,
    message,
    meshtastic,
    recipient,
    setLoraOnlineFallbackOffer,
    setMessage,
    setSending,
    setStatus,
    setStatusMsg,
  ])

  return { handleSend }
}
