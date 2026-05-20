'use client'

import { useCallback, useMemo, useRef } from 'react'
import {
  enqueueOfflineMailboxFailure,
  isOfflineMailboxQueueEnabled,
  stableOfflineMailboxThreadId,
  nextOfflineMailboxClientOutSeq,
  parseMailboxOutNonceMarker,
  prependMailboxOutNonceMarker,
} from '@/frontend/lib/api'
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
import {
  CHAT_LORA_DUAL_IMAGE_POLICY_MSG,
  CHAT_ENCRYPTED_HANDSHAKE_REQUIRED_MSG,
  CHAT_ENCRYPTED_MESH_DISABLED_MSG,
  MESH_PLAINTEXT_MAX_CHARS,
} from '@/frontend/lib/chat-view-messenger-transport'
import { prependPath4SelfArchiveMarker } from '@/frontend/features/send/mesh-path4-self-archive'
import type { ChatSendHandleOptions } from '@/frontend/features/send/chat-send-handle-options'
import { prependMorgEmergencyV1Marker } from '@/frontend/lib/morg-emergency-v1-text'
import {
  MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES,
  wireUtf8ByteLength,
} from '@/frontend/lib/compact-image-wire'
import {
  sendEncryptedMailboxHybrid,
  sendPlaintextMailboxHybrid,
} from '@/frontend/lib/mailbox-send-hybrid'
import { canTryLiveEncryptedDirectMailbox } from '@/frontend/lib/direct-iota-encrypted-submit'
import { connect, findPeerHandshake } from '@/frontend/lib/api/package-connect'
import { resolveEncryptedMailboxRecipient } from '@/frontend/lib/composer-recipient-fields'
import {
  getDirectChatEcdhMaterialForRecipient,
  setDirectChatEcdhPeerPubBase64,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { publishStreamsAnchor } from '@/frontend/lib/api/streams'
import {
  isForensicImageMailboxAttestationEnabled,
  runForensicMailboxAttestationAfterSend,
  sha256HexFromBase64Bytes,
} from '@/frontend/lib/forensic-mailbox-attestation'
import { formatTxDigestStatusSuffix } from '@/frontend/lib/iota-tx-explorer-hint'
import { addTangleInventoryItem } from '@/frontend/lib/tangle-inventory'
import { maybeAutoSaveDigestToVault } from '@/frontend/lib/tangle-inventory-vault'
import { parseLoraProgressiveMessage } from '@/frontend/lib/lora-progressive-image-client'
import { sendLoraImageViaMorgSegV1 } from '@/frontend/features/send/lora-image-morg-seg-v1-send'
import {
  formatMeshtasticNodeIdFromNum,
  parseMeshtasticNodeIdToNumber,
  resolveMeshtasticPlaintextDestination,
} from '@/frontend/lib/meshtastic-node-id'
import { SOS_MESH_RETRY_DEFAULTS, sosMeshRetryDelayMs } from '@/frontend/lib/morg-sos-mesh-retry'
import type { Message } from '@/frontend/lib/types'
import { formatUnknownError } from '@/frontend/lib/format-unknown-error'
import { notifyTelegramContact } from '@/frontend/lib/api/telegram-notify'
import {
  buildTelegramMessagePreview,
  readTelegramNotifyOnSend,
  resolveTelegramNotifyRecipientAddress,
} from '@/frontend/lib/telegram-notify-pref'

/** Gleiche Meldung: Klartext-Mesh und verschlüsselter Mesh-Pfad bei fehlendem Heltec. */
const MESH_BT_NOT_CONNECTED_MSG = 'Meshtastic/Web Bluetooth nicht verbunden (Heltec).'

/** Abbruch-Button / `throwIfCancelled` — eine kanonische Meldung für `isUserCancelError`. */
const CHAT_SEND_CANCELLED_MSG = 'Übertragung abgebrochen.'

function isUserCancelError(e: unknown): boolean {
  return e instanceof Error && e.message === CHAT_SEND_CANCELLED_MSG
}

/** UI: „IDs & Puls“ → Strikt ohne Funk-Fallback bei Online-Versand. */
function readStrictOnlineNoMeshFallback(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('morgendrot.strictOnlineNoMeshFallback') === '1'
  } catch {
    return false
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
  dest: number | 'broadcast',
  mirrorOnline = false
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
    source: mirrorOnline ? 'mailbox' : 'mesh',
    transports: mirrorOnline ? ['mesh', 'internet'] : ['mesh'],
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

const ADDR_64_LOWER = /^0x[a-f0-9]{64}$/

export function useChatViewHandleSend(p: UseChatViewSendFlowParams) {
  const {
    isPrivate,
    encrypted,
    forcedTransport,
    partner,
    messagingPersistenceMode,
    apiStatus,
    refreshApiStatus,
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
    meshSelfArchiveAfterLoRa,
    setMeshProgress,
    onOfflineMailboxQueueChanged,
    deviceTimeTrustWarn,
    meshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    clearMeshInboundText,
    drainMeshInboundText,
    appendMeshMessage,
    contactDirectory,
    activeGroup,
    isGroupChannel,
  } = p
  const cancelRequestedRef = useRef(false)
  /** Hook-Ebene: immer definiert (kein ReferenceError in älteren/minifizierten Bundles). */
  const encryptedMailboxRecipient = useMemo(
    () => resolveEncryptedMailboxRecipient(recipient, partner),
    [recipient, partner]
  )

  const cancelSend = useCallback(() => {
    cancelRequestedRef.current = true
    setStatusMsg('Abbruch angefordert — stoppt nach dem laufenden Schritt …')
  }, [setStatusMsg])

  const handleSend = useCallback(async (opts?: ChatSendHandleOptions) => {
    cancelRequestedRef.current = false
    const throwIfCancelled = () => {
      if (cancelRequestedRef.current) throw new Error(CHAT_SEND_CANCELLED_MSG)
    }
    const emergencyKind = opts?.emergencyWire
    const isEmergencySend = emergencyKind === 'text' || emergencyKind === 'voice'
    const inventoryType = attachedBlobBase64 || attachedAudioBase64 || attachedLora ? 'image' : 'text'
    /** Pfad 4 erzwingt Klartext-LoRa + Self-Mirror, unabhängig vom Encrypt-Toggle. */
    const path4Active = meshSelfArchiveAfterLoRa && isPrivate && forcedTransport === 'mesh'

    if (encrypted && isPrivate && !ADDR_64_LOWER.test(encryptedMailboxRecipient)) {
      setStatus('error')
      setStatusMsg(
        'Verschlüsselt: gültige 0x-Empfängeradresse im Composer oder Partner (Handshake) eintragen.'
      )
      return
    }

    const meshPlaintextDest = (): number | 'broadcast' | null =>
      resolveMeshtasticPlaintextDestination(meshPlaintextToNodeEnabled, meshPlaintextNodeId)

    /** Verschlüsselt: Session (/connect), Direkt-ECDH oder Handshake auf Chain → Auto-Connect. */
    const ensureEncryptedPeerReady = async (
      targetRaw: string
    ): Promise<{ ok: true } | { ok: false; message: string }> => {
      const target = targetRaw.trim().toLowerCase()
      if (!ADDR_64_LOWER.test(target)) {
        return { ok: false, message: 'Empfänger: gültige 0x-Adresse (64 Hex) für verschlüsselten Versand.' }
      }
      if (apiStatus?.locked) {
        return { ok: false, message: 'Wallet ist gesperrt — zuerst entsperren.' }
      }
      const connected = (apiStatus?.connectedAddresses ?? []).map((a) => a.toLowerCase())
      if (connected.includes(target)) return { ok: true }
      if (getDirectChatEcdhMaterialForRecipient(target)) return { ok: true }
      if (canTryLiveEncryptedDirectMailbox(target)) return { ok: true }
      if (connected.length === 1 && connected[0] === target) return { ok: true }
      const partnerNorm = partner.trim().toLowerCase()
      if (connected.length > 1) {
        if (!partnerNorm) {
          return {
            ok: false,
            message:
              'Mehrere verbundene Partner: im Feld „Partner (Handshake)“ die Zieladresse wählen, dann verschlüsselt senden.',
          }
        }
        if (!connected.includes(partnerNorm)) {
          return {
            ok: false,
            message:
              'Partner-Adresse ist nicht verbunden. Erst Handshake/Connect für diese Adresse durchführen oder Partnerfeld korrigieren.',
          }
        }
        return { ok: true }
      }
      try {
        const hs = await findPeerHandshake(target)
        if (hs.ok && hs.found && hs.peerPubRawBase64) {
          setDirectChatEcdhPeerPubBase64(target, hs.peerPubRawBase64)
          if (getDirectChatEcdhMaterialForRecipient(target)) return { ok: true }
          const cr = await connect(target)
          if (cr.ok) {
            await refreshApiStatus?.()
            return { ok: true }
          }
        }
      } catch {
        /* optional */
      }
      const deployPartner = (apiStatus?.partnerAddress || partner || '').trim().toLowerCase()
      if (ADDR_64_LOWER.test(deployPartner)) {
        try {
          const cr2 = await connect(deployPartner)
          if (cr2.ok) {
            await refreshApiStatus?.()
            return { ok: true }
          }
        } catch {
          /* optional */
        }
      }
      return { ok: false, message: CHAT_ENCRYPTED_HANDSHAKE_REQUIRED_MSG }
    }

    const singleWireSuccessMsg = (): string => {
      if (!isPrivate) return 'Gesendet!'
      if (path4Active) {
        return 'Klartext über LoRa gesendet; anschließend eigene Tangle-Kopie (Mailbox an dich).'
      }
      if (!encrypted) {
        if (forcedTransport === 'internet') return 'Klartext über IOTA (/send-plain) gesendet.'
        if (forcedTransport === 'mesh') {
          return meshSelfArchiveAfterLoRa && isPrivate
            ? 'Klartext über LoRa (Meshtastic-Text); anschließend eigene Tangle-Kopie (Mailbox an dich).'
            : 'Klartext über LoRa (Meshtastic-Text) gesendet.'
        }
      }
      if (forcedTransport === 'internet') return 'Online (IOTA/Mailbox) gesendet.'
      return 'Gesendet.'
    }

    const shouldLoadMessagesAfterSend = (): boolean => {
      if (!isPrivate) return true
      if (!encrypted) {
        if (forcedTransport === 'internet' || forcedTransport === 'mesh') return true
        return false
      }
      if (forcedTransport === 'internet') return true
      return false
    }

    type Path4MirrorKind = 'text' | 'image_luma' | 'image_chroma'
    type Path4MirrorDispatch = {
      status: 'anchored' | 'queued' | 'duplicate' | 'failed'
      note: string
      txDigest?: string
    }
    const dispatchPath4Mirror = async (
      payload: string,
      messageNonceU64: bigint,
      kind: Path4MirrorKind,
      loraMsgId?: string | null
    ): Promise<Path4MirrorDispatch> => {
      const selfAddr = myAddress.trim().toLowerCase()
      if (!ADDR_64_LOWER.test(selfAddr)) {
        return { status: 'failed', note: 'Eigen-Archiv: MY_ADDRESS ungültig — keine Mailbox-Kopie.' }
      }
      if (apiStatus?.locked) {
        return { status: 'failed', note: 'Eigen-Archiv: Tresor gesperrt — Mailbox-Kopie übersprungen.' }
      }
      const res = await sendPlaintextMailboxHybrid(selfAddr, payload, messageNonceU64, { messagingPersistenceMode })
      if (res.ok) {
        return {
          status: 'anchored',
          note: 'Eigen-Archiv: Klartext-Mailbox an dich gesendet.',
          txDigest: res.txDigest,
        }
      }
      const err = mailboxHybridErr(res)
      if (!isOfflineMailboxQueueEnabled()) return { status: 'failed', note: `Eigen-Archiv (Mailbox): ${err}` }
      const msgIdTag = loraMsgId ? `|msgId=${loraMsgId}` : ''
      const priority =
        kind === 'text' ? 20 : kind === 'image_luma' ? 50 : kind === 'image_chroma' ? 60 : 100
      const en = await enqueueOfflineMailboxFailure({
        kind: 'plain_send',
        recipient: selfAddr,
        payload,
        encrypted: false,
        timeIsTrusted: !deviceTimeTrustWarn,
        lastError: `path4:${kind}${msgIdTag} ${err}`.trim(),
        senderAddress: myAddress.trim(),
        threadId: `${stableOfflineMailboxThreadId(myAddress.trim(), selfAddr)}|path4:${kind}${msgIdTag}`,
        messageNonceU64,
        priority,
      })
      onOfflineMailboxQueueChanged?.()
      if (!en.ok) return { status: 'failed', note: `Eigen-Archiv (Queue): ${en.reason}` }
      if (en.queued) return { status: 'queued', note: 'Eigen-Archiv: in Offline-Warteschlange (Opt-in).' }
      return { status: 'duplicate', note: 'Eigen-Archiv: bereits in Offline-Warteschlange (Dedup).' }
    }

    const runPath4SelfMirrorForLoraImage = async (lumaText: string, chromaText: string): Promise<string> => {
      if (!meshSelfArchiveAfterLoRa || forcedTransport !== 'mesh') return ''
      throwIfCancelled()
      const loraMsgId =
        parseLoraProgressiveMessage(lumaText)?.msgId ?? parseLoraProgressiveMessage(chromaText)?.msgId ?? null
      const n1 = BigInt(nextOfflineMailboxClientOutSeq())
      const w1 = prependMailboxOutNonceMarker(prependPath4SelfArchiveMarker(lumaText), n1)
      const d1 = await dispatchPath4Mirror(w1, n1, 'image_luma', loraMsgId)
      if (d1.status !== 'anchored') return ` ${d1.note}`
      throwIfCancelled()
      const n2 = BigInt(nextOfflineMailboxClientOutSeq())
      const w2 = prependMailboxOutNonceMarker(prependPath4SelfArchiveMarker(chromaText), n2)
      const d2 = await dispatchPath4Mirror(w2, n2, 'image_chroma', loraMsgId)
      if (d2.status !== 'anchored') return ` ${d2.note}`
      const mbTx = d2.txDigest ?? d1.txDigest
      if (isForensicImageMailboxAttestationEnabled()) {
        const selfAddr = myAddress.trim().toLowerCase()
        await runForensicMailboxAttestationAfterSend({
          recipient: selfAddr,
          senderAddress: selfAddr,
          primary: { payloadUtf8: w1, messageNonceU64: n1 },
          secondary: { payloadUtf8: w2, messageNonceU64: n2 },
          imageContentSha256Hex: null,
          deviceTimeTrustWarn: !!deviceTimeTrustWarn,
          baseSuccessMsg: 'Eigen-Archiv: Bild in eigener Mailbox verankert.',
          setStatusMsg,
          mailboxTxDigest: mbTx,
          silent: true,
        })
      }
      return ` Eigen-Archiv verankert.${formatTxDigestStatusSuffix(mbTx)}`
    }

    /** Ohne Pfad 4: verschlüsselter „Funk“-Modus + LUMA — nicht unterstützt (Pfad 4 = Klartext-Luft). */
    if (attachedLora && encrypted && isPrivate && forcedTransport === 'mesh' && !path4Active) {
      applyValidationError(
        {
          ok: false,
          message: CHAT_LORA_DUAL_IMAGE_POLICY_MSG,
          idleMs: 12_000,
        },
        setStatus,
        setStatusMsg
      )
      clearCompactAttachment()
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
      let userCancelledLoraIota = false
      try {
        const rTrim = resolveEncryptedMailboxRecipient(recipient, partner)
        if (!rTrim) {
          setStatus('error')
          setStatusMsg(
            'Verschlüsselt (LoRa→Online): 0x-Empfänger im Composer oder Partner (0x…) im Setup eintragen.'
          )
          setSending(false)
          return
        }
        const n1 = BigInt(nextOfflineMailboxClientOutSeq())
        const w1 = prependMailboxOutNonceMarker(lumaText, n1)
        setStatusMsg('Online: LUMA (IOTA/Mailbox)…')
        const r1 = await sendEncryptedMailboxHybrid(rTrim, w1, { messagingPersistenceMode })
        if (!r1.ok) throw new Error(r1.error || r1.message || 'LUMA fehlgeschlagen.')
        throwIfCancelled()
        const n2 = BigInt(nextOfflineMailboxClientOutSeq())
        const w2 = prependMailboxOutNonceMarker(chromaText, n2)
        setStatusMsg('Online: CHROMA (IOTA/Mailbox)…')
        const r2 = await sendEncryptedMailboxHybrid(rTrim, w2, { messagingPersistenceMode })
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
          setTimeout(() => void loadMessages('reset', undefined, { silent: true }), 500)
        }
      } catch (e) {
        if (isUserCancelError(e)) {
          userCancelledLoraIota = true
          setStatus('error')
          setStatusMsg(CHAT_SEND_CANCELLED_MSG)
        } else {
          setStatus('error')
          setStatusMsg(formatUnknownError(e))
        }
      } finally {
        setMeshProgress?.(null)
        if (!userCancelledLoraIota) clearCompactAttachment()
        setSending(false)
        setTimeout(() => setStatus('idle'), userCancelledLoraIota ? 2500 : 6000)
      }
      return
    }

    /** Online: LUMA+CHROMA nur mit Schloss (zwei verschlüsselte Mailbox-Sends). */
    if (attachedLora && isPrivate && forcedTransport === 'internet' && !encrypted) {
      applyValidationError(
        {
          ok: false,
          message:
            'Bild (LUMA+CHROMA) über „online“: Schloss / Verschlüsselung aktivieren — zwei IOTA-Mailbox-Nachrichten. Alternative: Transport „funk“ mit „LoRa + eigene Verankerung“ (Pfad 4; Luft bleibt Klartext).',
          idleMs: 12_000,
        },
        setStatus,
        setStatusMsg
      )
      return
    }

    if (attachedLora && path4Active) {
      const dest = meshPlaintextDest()
      if (dest === null) {
        setStatus('error')
        setStatusMsg(
          'Funk-Klartext an Node: gültige Node-ID (z. B. !1a2b3c4d) eintragen — oder Haken „an Node-ID“ deaktivieren für Broadcast.'
        )
        setTimeout(() => setStatus('idle'), 6000)
        return
      }
      setLoraOnlineFallbackOffer(null)
      loraOnlineOfferPayloadRef.current = null
      setSending(true)
      setStatus('idle')
      let userCancelledPath4 = false
      clearMeshInboundText?.()
      const drainInbound = drainMeshInboundText ?? (() => [] as string[])
      try {
        const segResult = await sendLoraImageViaMorgSegV1({
          attached: attachedLora,
          dest,
          meshtastic,
          throwIfCancelled,
          onProgress: (line) => setMeshProgress?.(line),
          onStatusMsg: setStatusMsg,
          drainInboundMeshText: drainInbound,
          sendMeshText: (text, d) => meshtastic.sendMeshText(text, d),
        })
        if (!segResult.ok) {
          applyValidationError({ ok: false, message: segResult.error, idleMs: 10_000 }, setStatus, setStatusMsg)
          return
        }
        throwIfCancelled()
        const mirrorNote = await runPath4SelfMirrorForLoraImage(
          attachedLora.lumaWire,
          attachedLora.chromaWire
        )
        setStatus('success')
        setStatusMsg(
          `Flüchtig (LoRa): Bild gesendet (${segResult.plan.totalSegments} Segmente).${mirrorNote || ''}`
        )
        const cap = message.trim()
        recordMeshOutgoingPlaintext(
          appendMeshMessage,
          myAddress,
          `[LoRa-Bild Flüchtig] ${segResult.plan.luma.n}+${segResult.plan.chroma.n} Segmente${cap ? `: ${cap}` : ''}`,
          dest,
          true
        )
        setMessage('')
        if (shouldLoadMessagesAfterSend()) {
          setTimeout(() => void loadMessages('reset', undefined, { silent: true }), 500)
        }
      } catch (e) {
        if (isUserCancelError(e)) {
          userCancelledPath4 = true
          setStatus('error')
          setStatusMsg(CHAT_SEND_CANCELLED_MSG)
        } else {
          const raw = formatUnknownError(e)
          setStatus('error')
          setStatusMsg(
            /NO_RESPONSE|\"error\":\s*8\b|error:\s*8\b/i.test(raw)
              ? 'LoRa (Funk) hat nicht geantwortet (NO_RESPONSE / error 8). Bitte erneut senden oder näher/stabiler verbinden.'
              : raw
          )
        }
      } finally {
        setMeshProgress?.(null)
        if (!userCancelledPath4) clearCompactAttachment()
        setSending(false)
        setTimeout(() => setStatus('idle'), userCancelledPath4 ? 2500 : 6000)
      }
      return
    }

    if (isEmergencySend) {
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
    const recipientTrimLower = recipient.trim().toLowerCase()
    if (!encrypted && forcedTransport === 'internet' && !ADDR_64_LOWER.test(recipientTrimLower)) {
      applyValidationError(
        {
          ok: false,
          message:
            'Online/IOTA: Empfängeradresse muss 0x + 64 Hex sein (z. B. 0x1234…abcd). Erst danach wird gesendet oder gequeued.',
          idleMs: 9000,
        },
        setStatus,
        setStatusMsg
      )
      return
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
      const blocksPlaintextByAttachment =
        !!attachedBlobBase64 ||
        !!attachedAudioBase64 ||
        attachedTxtFile != null ||
        (attachedLora != null && !path4Active)
      if (blocksPlaintextByAttachment) {
        applyValidationError(
          {
            ok: false,
            message:
              'Unverschlüsselter Funk: erlaubt nur Kurztext. LoRa-Bildzweiteiler nur mit aktivem „LoRa + eigene Verankerung“ (Pfad 4).',
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
      const plaintextMaxChars = MESH_PLAINTEXT_MAX_CHARS
      for (const snap of textSnaps) {
        const charCount = [...snap].length
        if (charCount > plaintextMaxChars) {
          applyValidationError(
            {
              ok: false,
              message: attachedAudioBase64
                ? `Unverschlüsseltes LoRa-Sprachmemo passt nicht in einen Meshtastic-Text-Frame (${charCount} Zeichen, max. ${plaintextMaxChars}). Sprache: „online“ wählen. Unverschlüsselte Sprache über LoRa braucht Chunking+ACK (Roadmap).`
                : `Unverschlüsselter LoRa-Text maximal ${plaintextMaxChars} Zeichen (aktuell ${charCount}). Kürzen, mehrere Kurznachrichten, oder für längere Inhalte „online“ mit Verschlüsselung.`,
              idleMs: 9000,
            },
            setStatus,
            setStatusMsg
          )
          return
        }
      }
    }

    /** Noch nicht abgedeckte LUMA+CHROMA-Kombinationen (z. B. Ad-hoc, öffentlicher Chat). */
    if (attachedLora) {
      applyValidationError(
        {
          ok: false,
          message: !isPrivate
            ? 'LoRa-Bild (LUMA+CHROMA) gibt es nur im privaten Chat. Pinnwand: Kurztext — oder Bild über „online“ mit Verschlüsselung.'
            : CHAT_LORA_DUAL_IMAGE_POLICY_MSG,
          idleMs: 12_000,
        },
        setStatus,
        setStatusMsg
      )
      clearCompactAttachment()
      setTimeout(() => setStatus('idle'), 6000)
      return
    }

    if (forcedTransport === 'mesh' && attachedAudioBase64) {
      applyValidationError(
        {
          ok: false,
          message:
            'Sprachnachricht ist derzeit nur für Online/IOTA freigeschaltet. Für Funk bitte SOS-Text (Diktat) oder Kurztext senden.',
          idleMs: 9000,
        },
        setStatus,
        setStatusMsg
      )
      return
    }

    if (meshSelfArchiveAfterLoRa) {
      if (!isPrivate || forcedTransport !== 'mesh') {
        applyValidationError(
          {
            ok: false,
            message:
              '„LoRa + eigene Verankerung“ nur im privaten Chat mit Transport „funk“. Sonst Option deaktivieren.',
            idleMs: 9000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
      if (!ADDR_64_LOWER.test(myAddress.trim().toLowerCase())) {
        applyValidationError(
          {
            ok: false,
            message:
              '„LoRa + eigene Verankerung“: MY_ADDRESS (0x + 64 Hex) muss gesetzt sein — sonst keine Mailbox-Kopie an dich möglich.',
            idleMs: 9000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
      if (apiStatus?.locked) {
        applyValidationError(
          {
            ok: false,
            message:
              '„LoRa + eigene Verankerung“: Tresor entsperren — die Mailbox-Kopie braucht Wallet/Signatur.',
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
      const recipientTrim = encrypted ? encryptedMailboxRecipient : recipient.trim().toLowerCase()
      if (!ADDR_64_LOWER.test(recipientTrim)) {
        return { reject: 'Empfängeradresse ungültig; nicht in Mailbox-Warteschlange gespeichert.' }
      }
      const en = await enqueueOfflineMailboxFailure({
        kind,
        recipient: recipientTrim,
        payload: wireForQueue,
        encrypted,
        timeIsTrusted: !deviceTimeTrustWarn,
        lastError: lastErr,
        senderAddress: myAddress,
        threadId: stableOfflineMailboxThreadId(myAddress, recipientTrim),
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
      | {
          ok: true
          meshFallback?: { onlineErr: string }
          mailboxCapture?: MailboxSendCapture
          path4Footnote?: string
        }
      | { ok: false }

      const sendOnePart = async (textSnap: string): Promise<PartOk> => {
        throwIfCancelled()
      const failSend = (msg: string): PartOk => {
        setStatus('error')
        setStatusMsg(msg)
        return { ok: false }
      }

      /** Pfad 4 (MVP): nach LongFast-Klartext nur eine Mailbox-Kopie (kein zusätzlicher Text-Attestation-TX). */
      const runPath4MailboxSelfArchive = async (airUtf8: string): Promise<string> => {
        if (!path4Active) return ''
        const n = BigInt(nextOfflineMailboxClientOutSeq())
        const marked = prependPath4SelfArchiveMarker(airUtf8)
        const wireForApi = prependMailboxOutNonceMarker(marked, n)
        const d = await dispatchPath4Mirror(wireForApi, n, 'text')
        if (d.status === 'failed') return `__PATH4_FAILED__${d.note}`
        if (d.status !== 'anchored') return ` ${d.note}`
        if (d.txDigest) {
          const inv = {
            digest: d.txDigest,
            type: 'text',
            status: 'anchored',
            nonce: n.toString(),
            encrypted: false,
          } as const
          addTangleInventoryItem(inv)
          void maybeAutoSaveDigestToVault({
            ...inv,
            timestamp: Date.now(),
          })
        }
        return ` ${d.note}${formatTxDigestStatusSuffix(d.txDigest)}`
      }

      const tryMailbox = async (enc: boolean): Promise<PartOk> => {
        throwIfCancelled()
        if (enc && isPrivate) {
          const ready = await ensureEncryptedPeerReady(encryptedMailboxRecipient)
          if (!ready.ok) return failSend(ready.message)
        }
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
        const sendTo = enc && isPrivate ? encryptedMailboxRecipient : recipient.trim()
        /** Posteingang liest die Server-MAILBOX_ID — Kontakt-private Mailbox macht Sends unsichtbar. */
        const hybridOpts = { messagingPersistenceMode }
        const res = enc
          ? await sendEncryptedMailboxHybrid(sendTo, wireForApi, hybridOpts)
          : await sendPlaintextMailboxHybrid(sendTo, wireForApi, messageNonceU64, hybridOpts)
        if (res.ok && isGroupChannel && activeGroup?.streamsAnchorId) {
          void publishStreamsAnchor(activeGroup.streamsAnchorId, {
            type: 'group_message',
            groupId: activeGroup.id,
            from: myAddress.trim(),
            to: recipient.trim(),
            preview: textSnap.slice(0, 240),
            ts: Date.now(),
          })
        }
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
            recordMeshOutgoingPlaintext(appendMeshMessage, myAddress, textSnap, dest, path4Active)
            const path4Footnote = await runPath4MailboxSelfArchive(textSnap)
            if (path4Footnote.startsWith('__PATH4_FAILED__')) {
              return failSend(path4Footnote.replace('__PATH4_FAILED__', '').trim())
            }
            return { ok: true, path4Footnote: path4Footnote || undefined }
          } catch (e) {
            if (isUserCancelError(e)) throw e
            setStatus('error')
            setStatusMsg(formatUnknownError(e))
            return { ok: false }
          }
        }
        return tryMailbox(encrypted)
      }

      if (!encrypted || path4Active) {
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
                recordMeshOutgoingPlaintext(appendMeshMessage, myAddress, textSnap, dest, path4Active)
                const path4Footnote = await runPath4MailboxSelfArchive(textSnap)
                if (path4Footnote.startsWith('__PATH4_FAILED__')) {
                  return failSend(path4Footnote.replace('__PATH4_FAILED__', '').trim())
                }
                return { ok: true, path4Footnote: path4Footnote || undefined }
              } catch (e) {
                if (isUserCancelError(e)) throw e
                lastErr = e
                if (attempt + 1 >= max) break
                const delay = sosMeshRetryDelayMs(attempt)
                setStatusMsg(
                  `SOS: Funk fehlgeschlagen — Wiederholung ${attempt + 2}/${max} in ca. ${Math.round(delay / 1000)} s …`
                )
                await new Promise((r) => setTimeout(r, delay))
                throwIfCancelled()
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
            recordMeshOutgoingPlaintext(appendMeshMessage, myAddress, textSnap, dest, path4Active)
            const path4Footnote = await runPath4MailboxSelfArchive(textSnap)
            if (path4Footnote.startsWith('__PATH4_FAILED__')) {
              return failSend(path4Footnote.replace('__PATH4_FAILED__', '').trim())
            }
            return { ok: true, path4Footnote: path4Footnote || undefined }
          } catch (e) {
            if (isUserCancelError(e)) throw e
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
        return failSend(
          CHAT_ENCRYPTED_MESH_DISABLED_MSG
        )
      }

      if (forcedTransport === 'internet') {
        const encReady = await ensureEncryptedPeerReady(encryptedMailboxRecipient)
        if (!encReady.ok) return failSend(encReady.message)
        const existing = parseMailboxOutNonceMarker(textSnap)
        const messageNonceU64 = existing?.nonce ?? BigInt(nextOfflineMailboxClientOutSeq())
        const wireForApi = existing ? textSnap : prependMailboxOutNonceMarker(textSnap, messageNonceU64)
        throwIfCancelled()
        const hybridOpts = { messagingPersistenceMode }
        const res = await sendEncryptedMailboxHybrid(encryptedMailboxRecipient, wireForApi, hybridOpts)
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

    let userCancelledMain = false
    try {
      let lastOk: PartOk | null = null
      const path4Footnotes: string[] = []
      for (let i = 0; i < textSnaps.length; i++) {
        throwIfCancelled()
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
        if (r.path4Footnote) path4Footnotes.push(r.path4Footnote)
        lastOk = r
      }

      const successTail = path4Footnotes.join('')
      let successMsg: string
      if (textSnaps.length > 1) {
        successMsg = `Alle ${textSnaps.length} Teile gesendet.${successTail}`
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
      const digestSuffix = formatTxDigestStatusSuffix(lastOk?.mailboxCapture?.txDigest)
      let statusLine = successMsg + digestSuffix
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
        setStatusMsg(statusLine)
      }

      if (readTelegramNotifyOnSend() && forcedTransport === 'internet' && isPrivate) {
        const notifyAddr = recipient.trim().toLowerCase()
        if (ADDR_64_LOWER.test(notifyAddr)) {
          const contactEntry = contactDirectory[notifyAddr]
          if (contactEntry?.telegramChatId?.trim()) {
            const preview =
              message.trim() ||
              (attachedTxtFile
                ? attachedTxtFile.text.slice(0, 200) || `[${attachedTxtFile.name}]`
                : attachedBlobBase64
                  ? '[Bild-Anhang]'
                  : attachedAudioBase64
                    ? '[Audio-Anhang]'
                    : textSnaps[0]?.slice(0, 200) || 'Neue Morgendrot-Nachricht')
            const myLabel =
              contactDirectory[myAddress.trim().toLowerCase()]?.label ||
              `${myAddress.trim().slice(0, 10)}…`
            void notifyTelegramContact({
              recipientAddress: notifyAddr,
              messagePreview: preview,
              senderLabel: myLabel,
            }).then((r) => {
              if (r.delivered) {
                setStatusMsg(`${statusLine} · Telegram-Hinweis an Kontakt gesendet.`)
              } else if (r.error) {
                setStatusMsg(`${statusLine} · Telegram: ${r.error}`)
              }
            })
          }
        }
      }

      if (lastOk?.ok && lastOk.mailboxCapture?.txDigest) {
        const inv = {
          digest: lastOk.mailboxCapture.txDigest,
          type: inventoryType,
          status: 'anchored',
          nonce: lastOk.mailboxCapture.messageNonceU64.toString(),
          encrypted: lastOk.mailboxCapture.encrypted,
        } as const
        addTangleInventoryItem(inv)
        void maybeAutoSaveDigestToVault({
          ...inv,
          timestamp: Date.now(),
        })
      }
      setMessage('')
      if (shouldLoadMessagesAfterSend()) {
        setTimeout(() => void loadMessages('reset'), 800)
      }
    } catch (e) {
      if (isUserCancelError(e)) {
        userCancelledMain = true
        setStatus('error')
        setStatusMsg(CHAT_SEND_CANCELLED_MSG)
      } else {
        setStatus('error')
        setStatusMsg(formatUnknownError(e))
      }
    } finally {
      setMeshProgress?.(null)
      if (!userCancelledMain) clearCompactAttachment()
      setSending(false)
      setTimeout(() => setStatus('idle'), userCancelledMain ? 2500 : 4000)
    }
  }, [
    appendMeshMessage,
    attachedAudioBase64,
    attachedBlobBase64,
    attachedLora,
    attachedTxtFile,
    apiStatus,
    refreshApiStatus,
    clearCompactAttachment,
    meshSelfArchiveAfterLoRa,
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
    onOfflineMailboxQueueChanged,
    deviceTimeTrustWarn,
    meshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    clearMeshInboundText,
    drainMeshInboundText,
    contactDirectory,
    partner,
    encryptedMailboxRecipient,
  ])

  return { handleSend, cancelSend }
}
