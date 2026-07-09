'use client'

import { useCallback, useMemo, useRef } from 'react'
import {
  isOfflineMailboxQueueEnabled,
  nextChainMessageNonceU64,
  nextOfflineMailboxClientOutSeq,
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
  CHAT_ENCRYPTED_HANDSHAKE_AWAITING_PEER_MSG,
  MESH_PLAINTEXT_MAX_CHARS,
} from '@/frontend/lib/chat-view-messenger-transport'
import {
  isMeshLoRaImageSendActive,
  isMeshPath4SelfArchiveActive,
} from '@/frontend/lib/mesh-lora-composer-options'
import {
  createChatViewPath4SendHandlers,
} from '@/frontend/features/send/chat-view-handle-send-path4'
import type { ChatSendHandleOptions } from '@/frontend/features/send/chat-send-handle-options'
import { prependMorgEmergencyV1Marker } from '@/frontend/lib/morg-emergency-v1-text'
import {
  MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES,
  wireUtf8ByteLength,
} from '@/frontend/lib/compact-image-wire'
import { sendEncryptedMailboxHybrid } from '@/frontend/lib/mailbox-send-hybrid'
import { canTryLiveEncryptedDirectMailbox } from '@/frontend/lib/direct-iota-encrypted-submit'
import { findPeerHandshake } from '@/frontend/lib/api/package-connect'
import { connectPartnerHybrid } from '@/frontend/lib/connect-hybrid'
import { readCachedHandshakeOffers } from '@/frontend/lib/handshake-offers-cache'
import { resolveEncryptedRecipientHandshakeStatusSync } from '@/frontend/lib/encrypted-recipient-handshake-status'
import { prependPinnwandPostMarker } from '@/frontend/lib/pinnwand-post-marker'
import {
  parseComposerIotaRecipientAddresses,
  resolveComposerKlartextIotaAddress,
  resolveEncryptedMailboxRecipient,
} from '@/frontend/lib/composer-recipient-fields'
import {
  getDirectChatEcdhMaterialForRecipient,
  getDirectChatEcdhPrivateKey,
  hasDirectChatEcdhPeerPubForRecipient,
  setDirectChatEcdhPeerPubBase64,
} from '@/frontend/lib/direct-chat-ecdh-session'
import {
  applyGroupOptimisticInboxMerge,
  buildGroupOptimisticRowsAfterSend,
  getGroupSendPreSendError,
  inboxReloadDelaysMs,
  isGroupMailboxInternetChainSend,
  publishGroupStreamsAnchorAfterSend,
  resolveGroupTargetsForInternetSend,
  resolveSingleWireSuccessMessage,
} from '@/frontend/features/send/chat-view-handle-send-group'
import { createChatViewSendOnePart } from '@/frontend/features/send/chat-view-handle-send-one-part'
import {
  emergencyFanOutAnyOk,
  formatEmergencyFanOutStatus,
  planEmergencyFanOutLegs,
  runEmergencyFanOut,
  type EmergencyFanOutLegResult,
} from '@/frontend/features/send/chat-view-emergency-fanout'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { type SendPartOk, isSendPartSuccess } from '@/frontend/features/send/chat-view-handle-send-part-types'
import {
  isForensicImageMailboxAttestationEnabled,
  runForensicMailboxAttestationAfterSend,
  sha256HexFromBase64Bytes,
} from '@/frontend/lib/forensic-mailbox-attestation'
import { formatTxDigestStatusSuffix } from '@/frontend/lib/iota-tx-explorer-hint'
import { addTangleInventoryItem } from '@/frontend/lib/tangle-inventory'
import { trimTangleContentPreview } from '@/frontend/lib/tangle-inventory-recover'
import { maybeAutoSaveDigestToVault } from '@/frontend/lib/tangle-inventory-vault'
import { sendLoraImageViaMorgSegV1 } from '@/frontend/features/send/lora-image-morg-seg-v1-send'
import {
  recordMeshOutgoingPlaintext,
} from '@/frontend/features/send/chat-view-handle-send-mesh-plaintext'
import {
  parseMeshtasticNodeIdToNumber,
  resolveMeshtasticPlaintextDestination,
} from '@/frontend/lib/meshtastic-node-id'
import type { Message } from '@/frontend/lib/types'
import { formatUnknownError } from '@/frontend/lib/format-unknown-error'
import { notifyTelegramContact } from '@/frontend/lib/api/telegram-notify'
import { postTelegramGroupAlarm } from '@/frontend/lib/api/telegram-integrations'
import { resolveChatSendEncryption } from '@/frontend/lib/resolve-chat-send-encryption'
import {
  buildTelegramMessagePreview,
  readTelegramNotifyOnSend,
  resolveTelegramNotifyRecipientAddress,
} from '@/frontend/lib/telegram-notify-pref'
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'
import {
  purgeStaleOfflineMailboxQueue,
  syncActiveNetworkChainSnapshot,
} from '@/frontend/lib/active-network-chain-sync'

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


const ADDR_64_LOWER = /^0x[a-f0-9]{64}$/

export function useChatViewHandleSend(p: UseChatViewSendFlowParams) {
  const {
    isPrivate,
    encrypted,
    forcedTransport,
    partner,
    messagingPersistenceMode,
    composerMailboxObjectId,
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
    setMessages,
    setSending,
    setStatus,
    setStatusMsg,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
    meshLoRaImagesEnabled,
    meshSelfArchiveAfterLoRa,
    setMeshProgress,
    onOfflineMailboxQueueChanged,
    deviceTimeTrustWarn,
    meshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    meshtasticChannelIndex,
    clearMeshInboundText,
    drainMeshInboundText,
    appendMeshMessage,
    contactDirectory,
    activeGroup,
    isGroupChannel,
    isPinnwandChannel = false,
  } = p
  const cancelRequestedRef = useRef(false)
  /** Hook-Ebene: immer definiert (kein ReferenceError in älteren/minifizierten Bundles). */
  const encryptedMailboxRecipient = useMemo(
    () => resolveEncryptedMailboxRecipient(recipient, partner),
    [recipient, partner]
  )
  const plainMailboxRecipient = useMemo(
    () => resolveComposerKlartextIotaAddress(recipient, partner, isPrivate),
    [recipient, partner, isPrivate]
  )
  const shouldMarkPinnwandPlainPost = useCallback(
    (_target: string, enc: boolean) => {
      if (enc) return false
      /** Nur Tab „Pinnwand“ — sonst würde 1:1 an dieselbe 0x (Brett=Wallet) fälschlich markiert. */
      return isPinnwandChannel
    },
    [isPinnwandChannel]
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
    const emergencyPartnerHint = opts?.emergencyPartnerOverride?.trim().toLowerCase() ?? ''
    const emergencyPartnerResolved =
      emergencyPartnerHint && ADDR_64_LOWER.test(emergencyPartnerHint) ? emergencyPartnerHint : ''
    const sendPartner = emergencyPartnerResolved || partner
    const sendRecipient = recipient.trim() || emergencyPartnerResolved || recipient
    const sendPlainMailboxRecipient = emergencyPartnerResolved
      ? resolveComposerKlartextIotaAddress(sendRecipient, sendPartner, isPrivate)
      : plainMailboxRecipient
    const sendEncryptedMailboxRecipient = emergencyPartnerResolved
      ? resolveEncryptedMailboxRecipient(sendRecipient, sendPartner)
      : encryptedMailboxRecipient
    const sendEncrypted = resolveChatSendEncryption({ encrypted, emergencyWire: emergencyKind })
    const inventoryType = attachedBlobBase64 || attachedAudioBase64 || attachedLora ? 'image' : 'text'
    const meshLoRaImageSendActive = isMeshLoRaImageSendActive({
      isPrivate,
      forcedTransport,
      meshLoRaImagesEnabled,
    })
    const path4SelfArchiveActive = isMeshPath4SelfArchiveActive({
      isPrivate,
      forcedTransport,
      meshSelfArchiveAfterLoRa,
    })
    /** Klartext-Funk mit Pfad-4-Metadaten (Bild oder Verankerung). */
    const meshPath4StyleActive = meshLoRaImageSendActive || path4SelfArchiveActive

    const groupMailboxInternetChain = isGroupMailboxInternetChainSend({
      isGroupChannel,
      messagingPersistenceMode,
      forcedTransport,
    })

    const groupPreSendErr = getGroupSendPreSendError({
      isGroupChannel,
      messagingPersistenceMode,
      forcedTransport,
      encrypted: sendEncrypted,
      activeGroup,
      myAddress,
      composerRecipient: plainMailboxRecipient,
    })
    if (groupPreSendErr) {
      setStatus('error')
      setStatusMsg(groupPreSendErr)
      return
    }

    if (sendEncrypted && isPrivate && !ADDR_64_LOWER.test(encryptedMailboxRecipient)) {
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
      const cachedHs = readCachedHandshakeOffers()
      const hsSync = resolveEncryptedRecipientHandshakeStatusSync({
        recipient: target,
        connectedAddresses: connected,
        incomingOffers: cachedHs?.offers ?? [],
        outgoingOffers: cachedHs?.outgoingOffers ?? [],
      })
      if (hsSync === 'awaiting_peer') {
        const selfNorm = myAddress.trim().toLowerCase()
        if (target === selfNorm && ADDR_64_LOWER.test(selfNorm)) {
          return {
            ok: false,
            message:
              'Handshake an deine eigene Adresse: im Partner-Panel „Handshake annehmen“ (Connect) — oder zum Test unverschlüsselt senden.',
          }
        }
        return { ok: false, message: CHAT_ENCRYPTED_HANDSHAKE_AWAITING_PEER_MSG }
      }
      if (hsSync === 'needs_accept') {
        const selfNorm = myAddress.trim().toLowerCase()
        if (target === selfNorm && ADDR_64_LOWER.test(selfNorm)) {
          return {
            ok: false,
            message:
              'Eigener Handshake wartet — im Partner-Panel „Handshake annehmen“ (Connect), dann verschlüsselt senden.',
          }
        }
        return {
          ok: false,
          message:
            'Der Partner hat einen Handshake gesendet — zuerst „Handshake annehmen“ (Connect), dann verschlüsselt senden.',
        }
      }
      if (connected.includes(target)) return { ok: true }
      if (getDirectChatEcdhMaterialForRecipient(target)) return { ok: true }
      if (canTryLiveEncryptedDirectMailbox(target)) return { ok: true }
      if (connected.length > 1) {
        return {
          ok: false,
          message:
            'Mehrere verbundene Partner: Zieladresse im Composer muss verbunden sein (Handshake/Connect für genau diese 0x-Adresse).',
        }
      }
      try {
        const hs = await findPeerHandshake(target)
        if (hs.ok && hs.found && hs.peerPubRawBase64) {
          setDirectChatEcdhPeerPubBase64(target, hs.peerPubRawBase64)
          if (getDirectChatEcdhMaterialForRecipient(target)) return { ok: true }
          const cr = await connectPartnerHybrid(target)
          if (cr.ok) {
            await refreshApiStatus?.()
            return { ok: true }
          }
          if (hasDirectChatEcdhPeerPubForRecipient(target) && !getDirectChatEcdhPrivateKey()) {
            return {
              ok: false,
              message:
                'Handshake gefunden, aber Chat-ECDH-Privatkey fehlt im Browser. In den Puls-Einstellungen den P-256-ECDH-JWK setzen oder „Handshake annehmen“ (Connect) für diese 0x-Adresse.',
            }
          }
          return {
            ok: false,
            message:
              'Handshake auf der Chain gefunden — bitte „Handshake annehmen“ (Connect) für genau diese 0x-Adresse, bis der Status „verbunden“ zeigt. Nur Handshake senden reicht nicht.',
          }
        }
      } catch {
        /* optional */
      }
      return { ok: false, message: CHAT_ENCRYPTED_HANDSHAKE_REQUIRED_MSG }
    }

    const singleWireSuccessMsg = (
      delivery?: 'team-broadcast' | 'pairwise',
      pairwiseTargetCount?: number
    ): string => {
      const groupMsg = resolveSingleWireSuccessMessage(isGroupChannel, delivery, pairwiseTargetCount)
      if (groupMsg) return groupMsg
      if (!isPrivate) return 'Gesendet!'
      if (path4SelfArchiveActive) {
        return 'Klartext über LoRa gesendet; anschließend eigene Tangle-Kopie (Mailbox an dich).'
      }
      if (!sendEncrypted) {
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
      if (!sendEncrypted) {
        if (forcedTransport === 'internet' || forcedTransport === 'mesh') return true
        return false
      }
      if (forcedTransport === 'internet') return true
      return false
    }

    /** Nach Mailbox-Send: gestaffelte Reloads (Chain-Index braucht oft >1 s). */
    const scheduleInboxReloadAfterSend = () => {
      for (const ms of inboxReloadDelaysMs(isGroupChannel)) {
        setTimeout(() => void loadMessages('reset', undefined, { silent: true }), ms)
      }
    }

    const mailboxOptsFor = (to: string) => {
      const mb = resolveOutboundMailboxObjectId(contactDirectory, to, undefined, p.composerMailboxObjectId)
      return {
        messagingPersistenceMode,
        ...(mb ? { mailboxObjectId: mb } : {}),
      }
    }

    const publishGroupStreamsAfterSend = (textSnap: string, toAddr: string, multicast: boolean) => {
      publishGroupStreamsAnchorAfterSend({
        isGroupChannel,
        activeGroup,
        myAddress,
        textSnap,
        toAddr,
        multicast,
      })
    }

    const { runPath4MailboxSelfArchive, runPath4SelfMirrorForLoraImage } = createChatViewPath4SendHandlers({
      myAddress,
      apiStatus,
      deviceTimeTrustWarn,
      path4SelfArchiveActive,
      meshSelfArchiveAfterLoRa,
      forcedTransport,
      mailboxOptsFor,
      onOfflineMailboxQueueChanged,
      throwIfCancelled,
      setStatusMsg,
    })

    /** Ohne Pfad 4: verschlüsselter „Funk“-Modus + LUMA — nicht unterstützt (Pfad 4 = Klartext-Luft). */
    if (attachedLora && sendEncrypted && isPrivate && forcedTransport === 'mesh' && !meshLoRaImageSendActive) {
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

    if (attachedLora && sendEncrypted && isPrivate && forcedTransport === 'internet') {
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
        const n1 = nextChainMessageNonceU64()
        const w1 = prependMailboxOutNonceMarker(lumaText, n1)
        setStatusMsg('Online: LUMA (IOTA/Mailbox)…')
        const r1 = await sendEncryptedMailboxHybrid(rTrim, w1, mailboxOptsFor(rTrim))
        if (!r1.ok) throw new Error(r1.error || r1.message || 'LUMA fehlgeschlagen.')
        throwIfCancelled()
        const n2 = n1 + 1n
        const w2 = prependMailboxOutNonceMarker(chromaText, n2)
        setStatusMsg('Online: CHROMA (IOTA/Mailbox)…')
        const r2 = await sendEncryptedMailboxHybrid(rTrim, w2, mailboxOptsFor(rTrim))
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
          scheduleInboxReloadAfterSend()
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
    if (attachedLora && isPrivate && forcedTransport === 'internet' && !sendEncrypted) {
      applyValidationError(
        {
          ok: false,
          message:
            'Bild (LUMA+CHROMA) über „online“: Schloss / Verschlüsselung aktivieren — zwei IOTA-Mailbox-Nachrichten. Alternative: Transport „funk“ mit „Bilder über Funk“ (Luft bleibt Klartext).',
          idleMs: 12_000,
        },
        setStatus,
        setStatusMsg
      )
      return
    }

    if (attachedLora && meshLoRaImageSendActive) {
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
          sendMeshText: (text, d) => meshtastic.sendMeshText(text, d, meshtasticChannelIndex),
        })
        if (!segResult.ok) {
          applyValidationError({ ok: false, message: segResult.error, idleMs: 10_000 }, setStatus, setStatusMsg)
          return
        }
        throwIfCancelled()
        const mirrorNote = await runPath4SelfMirrorForLoraImage(
          attachedLora.lumaWire,
          attachedLora.chromaWire,
          { luma: segResult.plan.luma.msgId, chroma: segResult.plan.chroma.msgId }
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
          scheduleInboxReloadAfterSend()
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

    const composerText = opts?.composerOverride ?? message

    const cap = composerText.trim() || undefined
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
        composerPlainText: composerText,
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

    if (
      !isEmergencySend &&
      !sendEncrypted &&
      !plainMailboxRecipient &&
      !groupMailboxInternetChain
    ) {
      const broadcastTargets = parseComposerIotaRecipientAddresses(recipient, partner, false)
      if (broadcastTargets.length === 0 && !meshKlartextOkWithoutZeroXRecipient) {
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
    const iotaSendTargets = parseComposerIotaRecipientAddresses(recipient, partner, sendEncrypted)
    if (
      sendEncrypted &&
      forcedTransport === 'internet' &&
      !groupMailboxInternetChain &&
      iotaSendTargets.length === 0
    ) {
      applyValidationError(
        {
          ok: false,
          message:
            'Verschlüsselt: mindestens eine gültige Empfänger-0x (64 Hex) — bei „Alle“ im Telefonbuch eintragen.',
          idleMs: 9000,
        },
        setStatus,
        setStatusMsg
      )
      return
    }
    const recipientTrimLower = plainMailboxRecipient.trim().toLowerCase()
    if (
      !isEmergencySend &&
      !sendEncrypted &&
      forcedTransport === 'internet' &&
      iotaSendTargets.length === 0 &&
      !ADDR_64_LOWER.test(recipientTrimLower) &&
      !groupMailboxInternetChain
    ) {
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

    if (isPrivate && !sendEncrypted && forcedTransport === 'mesh') {
      const blocksPlaintextByAttachment =
        !!attachedBlobBase64 ||
        !!attachedAudioBase64 ||
        attachedTxtFile != null ||
        (attachedLora != null && !meshLoRaImageSendActive)
      if (blocksPlaintextByAttachment) {
        applyValidationError(
          {
            ok: false,
            message:
              'Unverschlüsselter Funk: erlaubt nur Kurztext. LoRa-Bild nur mit aktivem „Bilder über Funk“.',
            idleMs: 9000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
    }

    /** LongFast / TEXT_MESSAGE: harte Nutzlastgrenze — galt fälschlich nur privat; öffentlicher Funk braucht dieselbe Kappe. */
    if (!sendEncrypted && forcedTransport === 'mesh' && !isEmergencySend) {
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
              '„Auf Chain verankern“ nur im privaten Chat mit Transport „funk“. Sonst Option deaktivieren.',
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
              '„Auf Chain verankern“: MY_ADDRESS (0x + 64 Hex) muss gesetzt sein — sonst keine Mailbox-Kopie an dich möglich.',
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
              '„Auf Chain verankern“: Tresor entsperren — die Mailbox-Kopie braucht Wallet/Signatur.',
            idleMs: 9000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
    }

    syncActiveNetworkChainSnapshot(myAddress.trim())
    const purgedQueue = purgeStaleOfflineMailboxQueue()
    if (purgedQueue > 0) onOfflineMailboxQueueChanged?.()

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

    type PartOk = SendPartOk

    const emergencyFanOutLegs =
      isEmergencySend && emergencyKind === 'text'
        ? planEmergencyFanOutLegs({
            isPrivate,
            plainMailboxRecipient: sendPlainMailboxRecipient,
            composerRecipient: sendRecipient,
            composerPartner: sendPartner,
            groupMailboxInternetChain,
          })
        : null

    const mailboxCtx = {
      throwIfCancelled,
      ensureEncryptedPeerReady,
      shouldMarkPinnwandPlainPost,
      mailboxOptsFor,
      publishGroupStreamsAfterSend,
      onOfflineMailboxQueueChanged,
      myAddress,
      encryptedMailboxRecipient: sendEncryptedMailboxRecipient,
      plainMailboxRecipient: sendPlainMailboxRecipient,
      composerRecipient: sendRecipient,
      composerPartner: sendPartner,
      apiStatus,
      deviceTimeTrustWarn,
      allowOfflineMailboxQueue,
      groupMailboxInternetChain,
      isGroupChannel,
      isPrivate,
      activeGroup,
      messagingPersistenceMode,
    }

    const meshCtx = {
      meshtastic,
      meshtasticChannelIndex,
      meshPlaintextDest,
      appendMeshMessage,
      myAddress,
      meshPath4StyleActive,
      isEmergencySend,
      isUserCancelError,
      runPath4MailboxSelfArchive,
    }

    const buildSendOnePart = (transport: ForcedTransport, quiet: boolean) => {
      const legCapture = { err: '' }
      const enc = emergencyFanOutLegs ? false : sendEncrypted
      const sender = createChatViewSendOnePart({
        throwIfCancelled,
        setStatus: quiet ? () => {} : setStatus,
        setStatusMsg: quiet ? (m) => { legCapture.err = m } : setStatusMsg,
        isPrivate,
        encrypted: enc,
        meshPath4StyleActive,
        forcedTransport: transport,
        mailbox: { ...mailboxCtx, forcedTransport: transport },
        mesh: { ...meshCtx, encrypted: enc },
      })
      return { sender, legCapture }
    }

    const sendOnePart = buildSendOnePart(forcedTransport, false).sender

    let userCancelledMain = false
    let lastFanOutResults: EmergencyFanOutLegResult[] | null = null
    try {
      let lastOk: PartOk | null = null
      const path4Footnotes: string[] = []
      for (let i = 0; i < textSnaps.length; i++) {
        throwIfCancelled()
        const textSnap = textSnaps[i]!
        if (emergencyFanOutLegs) {
          const { results, best } = await runEmergencyFanOut(emergencyFanOutLegs, async (transport) => {
            const { sender, legCapture } = buildSendOnePart(transport, true)
            const part = await sender(textSnap)
            return {
              ok: part.ok,
              part: part.ok ? part : undefined,
              detail: part.ok ? undefined : legCapture.err.trim() || 'Senden fehlgeschlagen',
            }
          })
          lastFanOutResults = results
          if (!emergencyFanOutAnyOk(results)) {
            setStatus('error')
            setStatusMsg(formatEmergencyFanOutStatus(results))
            return
          }
          if (isSendPartSuccess(best) && best.path4Footnote) path4Footnotes.push(best.path4Footnote)
          lastOk = best
          continue
        }
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
      if (isEmergencySend && lastFanOutResults) {
        successMsg = `SOS — ${formatEmergencyFanOutStatus(lastFanOutResults)}${successTail}`
      } else if (textSnaps.length > 1) {
        successMsg = `Alle ${textSnaps.length} Teile gesendet.${successTail}`
      } else if (isSendPartSuccess(lastOk) && lastOk.broadcastTargetCount != null && lastOk.broadcastTargetCount > 1) {
        successMsg = `An ${lastOk.broadcastTargetCount} Empfänger gesendet.${successTail}`
      } else {
        successMsg =
          singleWireSuccessMsg(
            isSendPartSuccess(lastOk) ? lastOk.groupDelivery : undefined,
            isSendPartSuccess(lastOk) ? lastOk.pairwiseTargetCount : undefined
          ) + successTail
      }

      const forensicGate =
        isForensicImageMailboxAttestationEnabled() &&
        sendEncrypted &&
        isPrivate &&
        forcedTransport === 'internet' &&
        attachedBlobBase64 &&
        textSnaps.length === 1 &&
        lastOk?.ok === true &&
        lastOk.mailboxCapture?.encrypted === true

      setStatus('success')
      const digestSuffix = formatTxDigestStatusSuffix(
        isSendPartSuccess(lastOk) ? lastOk.mailboxCapture?.txDigest : undefined
      )
      let statusLine = successMsg + digestSuffix
      if (forensicGate && isSendPartSuccess(lastOk) && lastOk.mailboxCapture) {
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

      if (isEmergencySend) {
        void postTelegramGroupAlarm({ eventType: 'sos' }).then((r) => {
          if (r.delivered) {
            setStatusMsg(`${statusLine} · Telegram-Alarmgruppe benachrichtigt.`)
          }
        })
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
              skipJournal: true,
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

      if (isSendPartSuccess(lastOk) && lastOk.mailboxCapture?.txDigest) {
        const previewSource =
          lastOk.mailboxCapture.payloadUtf8?.trim() ||
          textSnaps[textSnaps.length - 1]?.trim() ||
          message.trim()
        const inv = {
          digest: lastOk.mailboxCapture.txDigest,
          type: inventoryType,
          status: 'anchored',
          origin: 'mailbox',
          nonce: lastOk.mailboxCapture.messageNonceU64.toString(),
          encrypted: lastOk.mailboxCapture.encrypted,
          contentPreview:
            previewSource && !lastOk.mailboxCapture.encrypted
              ? trimTangleContentPreview(previewSource)
              : undefined,
        } as const
        addTangleInventoryItem(inv)
        void maybeAutoSaveDigestToVault({
          ...inv,
          timestamp: Date.now(),
        })
      }
      if (
        isGroupChannel &&
        isSendPartSuccess(lastOk) &&
        lastOk.mailboxCapture &&
        lastOk.groupDelivery &&
        forcedTransport === 'internet' &&
        messagingPersistenceMode === 'mailbox'
      ) {
        const pairwiseTargets =
          lastOk.groupDelivery === 'pairwise'
            ? resolveGroupTargetsForInternetSend({
                activeGroup,
                myAddress,
                composerRecipient: plainMailboxRecipient,
              })
            : undefined
        const optimistic = buildGroupOptimisticRowsAfterSend({
          isGroupChannel,
          forcedTransport,
          messagingPersistenceMode,
          myAddress,
          activeGroup,
          delivery: lastOk.groupDelivery,
          mailboxCapture: lastOk.mailboxCapture,
          previewFallback: textSnaps[textSnaps.length - 1]?.trim() || message.trim(),
          pairwiseTargets,
        })
        if (optimistic.length > 0) {
          setMessages((prev) => applyGroupOptimisticInboxMerge(prev, optimistic))
        }
      }

      setMessage('')
      if (shouldLoadMessagesAfterSend()) {
        scheduleInboxReloadAfterSend()
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
    meshLoRaImagesEnabled,
    meshSelfArchiveAfterLoRa,
    encrypted,
    forcedTransport,
    messagingPersistenceMode,
    isPrivate,
    loraOnlineOfferPayloadRef,
    loadMessages,
    setMessages,
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
    meshtasticChannelIndex,
    clearMeshInboundText,
    drainMeshInboundText,
    contactDirectory,
    partner,
    encryptedMailboxRecipient,
    plainMailboxRecipient,
    activeGroup,
    isGroupChannel,
  ])

  return { handleSend, cancelSend }
}
