'use client'

import { useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
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
import {
  encryptPassphraseMessage,
  generatePassphraseMessageSharePassphrase,
} from '@/frontend/lib/passphrase-message-crypto'
import { encryptNftGateMessage } from '@/frontend/lib/nft-gate-dek-capsule'
import {
  fingerprintPassphraseMessageWire,
  readPassphraseNftDualWalletGateEnabled,
  readPassphraseNftKeycardBindObjectId,
  readPassphraseNftKeycardBindSlotId,
  readPassphraseNftPubkeyWrapP4a2Enabled,
  readPassphraseNftRequiredWallet,
  readPassphraseNftRequiredWallets,
  readPassphraseNftSealP4bEnabled,
  readPassphraseNftStrongGateEnabled,
  readPassphraseProtectEnabled,
  readPassphraseRememberOnDeviceEnabled,
  readPassphraseZeitkapselModeEnabled,
  flushPassphraseMessageVaultPersist,
  isPassphraseMessageVaultSessionOpen,
  readPassphraseReuseEnabled,
  resolvePassphraseForProtectSend,
  rememberPassphraseMessagePassphrase,
  rollPassphraseAfterOneShotSend,
  writeZeitkapselLastNftObjectId,
} from '@/frontend/lib/passphrase-message-local-store'
import {
  bindWireToNftKeycard,
  flushNftKeycardVaultPersist,
  getNftKeycard,
} from '@/frontend/lib/nft-keycard-local-store'
import { takeEncryptedSendKeyEpochRenewHint } from '@/frontend/lib/session-epoch-renew-hint'
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
  describeMissingComposerIotaRecipient,
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
import { buildPrivateDmOptimisticInboxRow } from '@/frontend/lib/group-inbox-optimistic'
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
import { buildMorgLoraRetryStubMessage } from '@/frontend/lib/morg-lora-retry-wire'
import { notifyTelegramContact } from '@/frontend/lib/api/telegram-notify'
import { postTelegramGroupAlarm } from '@/frontend/lib/api/telegram-integrations'
import { resolveChatSendEncryption } from '@/frontend/lib/resolve-chat-send-encryption'
import {
  formatTelegramNotifyDeliveredSuffix,
  planTelegramNotifyAfterSend,
} from '@/frontend/lib/telegram-notify-after-send'
import {
  buildTelegramMessagePreview,
  readTelegramNotifyAudience,
  readTelegramNotifyExtraChatIds,
  readTelegramNotifyOnSend,
  telegramNotifyAudienceLabel,
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
  const idle = v.idleMs ?? 20_000
  toast.error(v.message, { duration: Math.max(idle === 0 ? 12_000 : idle, 8_000) })
  /** idleMs === 0: Status bleibt error (z. B. LoRa „Nochmals senden“). */
  if (idle === 0) return
  setTimeout(() => setStatus('idle'), idle)
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
  /** Doppelklick / parallele handleSend → zwei On-Chain-TXs (sichtbar als Doppel-Ausgang). */
  const sendInFlightRef = useRef(false)
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
    /** UI sofort frei — Hintergrund bricht am nächsten Await / Cancel-Poll ab. */
    setSending(false)
    setStatus('error')
    setStatusMsg(`${CHAT_SEND_CANCELLED_MSG} — Bild bleibt: „Nochmals senden“.`)
  }, [setSending, setStatus, setStatusMsg])

  const handleSend = useCallback(async (opts?: ChatSendHandleOptions) => {
    if (sendInFlightRef.current) return
    sendInFlightRef.current = true
    try {
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
      meshLoRaImagesEnabled: meshLoRaImagesEnabled || opts?.forceMeshLoRaImages === true,
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

    /**
     * `isPrivate` = Dialog-Kanal (1:1 **oder** Gruppe). Enc-Partner-Adresse nur bei 1:1 —
     * Gruppe nutzt Team-Postfach / Team-Schlüssel (kein Handshake-Empfängerfeld).
     */
    if (
      sendEncrypted &&
      isPrivate &&
      !isGroupChannel &&
      !ADDR_64_LOWER.test(encryptedMailboxRecipient)
    ) {
      setStatus('error')
      setStatusMsg(
        describeMissingComposerIotaRecipient({
          recipient: sendRecipient,
          partner: sendPartner,
          encrypted: true,
          isPrivate,
        }) ||
          'Verschlüsselt: volle 0x-Empfängeradresse im Partner-Feld (Handshake) oder Empfängerfeld — Telefonbuch optional.'
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

    /** Nach Mailbox-Send: gestaffelte Reloads (Chain-Index braucht oft >1 s). Erster Reset, dann Poll (nur neue mergen). */
    const scheduleInboxReloadAfterSend = () => {
      const delays = inboxReloadDelaysMs(isGroupChannel)
      delays.forEach((ms, i) => {
        setTimeout(() => {
          void loadMessages(i === 0 ? 'reset' : 'poll', undefined, { silent: true })
        }, ms)
      })
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
      /** Anhang nur nach Erfolg löschen — Abbruch/Fehler → „Nochmals senden“. */
      let clearLoraAttachment = false
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
          /** wantAck aus + queueConfirm: ~1,8 s max/Paket statt 25 s×Retries. */
          sendMeshText: (text, d) =>
            meshtastic.sendMeshText(text, d, meshtasticChannelIndex, {
              wantAck: false,
              queueConfirm: true,
              isCancelled: () => cancelRequestedRef.current,
            }),
          ensureConnected: meshtastic.ensureConnected,
        })
        if (!segResult.ok) {
          recordMeshOutgoingPlaintext(
            appendMeshMessage,
            myAddress,
            buildMorgLoraRetryStubMessage(segResult.error),
            dest,
            false
          )
          applyValidationError(
            { ok: false, message: `${segResult.error} — Bild bleibt: „Nochmals senden“ in der Nachricht.`, idleMs: 0 },
            setStatus,
            setStatusMsg
          )
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
        clearLoraAttachment = true
        if (shouldLoadMessagesAfterSend()) {
          scheduleInboxReloadAfterSend()
        }
      } catch (e) {
        const detail = isUserCancelError(e)
          ? CHAT_SEND_CANCELLED_MSG
          : formatUnknownError(e)
        recordMeshOutgoingPlaintext(
          appendMeshMessage,
          myAddress,
          buildMorgLoraRetryStubMessage(detail),
          dest,
          false
        )
        if (isUserCancelError(e)) {
          setStatus('error')
          setStatusMsg(`${CHAT_SEND_CANCELLED_MSG} → „Nochmals senden“ in der Abbruch-Nachricht.`)
        } else {
          setStatus('error')
          setStatusMsg(
            /NO_RESPONSE|\"error\":\s*8\b|error:\s*8\b/i.test(detail)
              ? 'LoRa ohne Antwort — „Nochmals senden“ in der Abbruch-Nachricht.'
              : `${detail} — „Nochmals senden“ in der Abbruch-Nachricht.`
          )
        }
      } finally {
        setMeshProgress?.(null)
        if (clearLoraAttachment) clearCompactAttachment()
        setSending(false)
        if (clearLoraAttachment) {
          setTimeout(() => setStatus('idle'), 6000)
        }
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

    /** Passphrase-Schutz / Zeitkapsel-Nachricht: Ciphertext als Klartext-Wire. */
    let sharedPassphraseNote = ''
    const zeitkapselMode = readPassphraseZeitkapselModeEnabled()
    const passphraseProtect = readPassphraseProtectEnabled()
    if (zeitkapselMode || passphraseProtect) {
      if (sendEncrypted) {
        applyValidationError(
          {
            ok: false,
            message: zeitkapselMode
              ? 'NFT-Leserecht braucht Klartext-Transport (Ciphertext on-chain). Oben „Unverschlüsselt“ wählen oder Modus aus.'
              : 'Passphrase-Schutz braucht Klartext-Transport (Ciphertext on-chain). Oben „Unverschlüsselt“ wählen oder Passphrase-Schutz aus.',
            idleMs: 9000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
      try {
        const wrapped: string[] = []
        const cardOid = readPassphraseNftKeycardBindObjectId()
        if (zeitkapselMode && !cardOid) {
          throw new Error(
            'NFT-Leserecht: NFT-Object-ID wählen oder einfügen (Composer). Schlüsselkarte merken ist optional.'
          )
        }
        /** Zeitkapsel = NFTGATE nur mit Object-ID; lokale Schlüsselkarte ist Komfort, kein Muss. */
        const strongGate = Boolean(
          (zeitkapselMode || readPassphraseNftStrongGateEnabled()) && cardOid
        )

        if (strongGate) {
          // B2-P4a / dual / P4a2 / P4b: DEK-Capsule, kein Blank-DEK / keine Passphrase im Vault.
          const dual = readPassphraseNftDualWalletGateEnabled()
          const p4b = readPassphraseNftSealP4bEnabled()
          const p4a2 = !p4b && dual && readPassphraseNftPubkeyWrapP4a2Enabled()
          const requiredWallets =
            dual || (p4b && readPassphraseNftRequiredWallets().length)
              ? readPassphraseNftRequiredWallets()
              : []
          const requiredWallet = requiredWallets[0] ?? null
          if (dual && requiredWallets.length === 0) {
            throw new Error(
              'Dual-Gate: mind. eine erlaubte Wallet-Adresse (0x…), oder „Wallet + NFT“ aus.'
            )
          }
          if (p4a2 && requiredWallets.length !== 1) {
            throw new Error(
              'P4a2 (Pubkey-Wrap): genau eine Wallet — bei mehreren Adressen Pubkey-Wrap aus oder auf eine kürzen.'
            )
          }
          let recipientEcdhPubRaw: Uint8Array | null = null
          let sealWrapKeyRaw: Uint8Array | null = null
          if (p4b) {
            const { fetchNftSealWrapKey } = await import('@/frontend/lib/nft-gate-seal-client')
            const wr = await fetchNftSealWrapKey({
              nftObjectId: cardOid!,
              requiredWallet: dual ? requiredWallet : null,
            })
            if (!wr.ok) throw new Error(`P4b Seal-Broker: ${wr.error}`)
            sealWrapKeyRaw = wr.wrapKeyRaw
          } else if (p4a2 && requiredWallet) {
            const { base64ToUint8 } = await import('@morgendrot/shared/bytes-base64')
            const { getDirectChatEcdhPeerPubBase64 } = await import(
              '@/frontend/lib/direct-chat-ecdh-session'
            )
            const peerB64 = getDirectChatEcdhPeerPubBase64(requiredWallet)
            if (!peerB64) {
              throw new Error(
                'P4a2: ECDH-Pubkey der erlaubten Wallet fehlt — zuerst Handshake/Connect für diese 0x-Adresse.'
              )
            }
            recipientEcdhPubRaw = base64ToUint8(peerB64)
          }
          for (const snap of textSnaps) {
            if (!snap.trim()) {
              wrapped.push(snap)
              continue
            }
            const { wire, nftObjectId, gate } = await encryptNftGateMessage({
              plainUtf8: snap,
              nftObjectId: cardOid!,
              requiredWallet: dual || p4b ? requiredWallet : null,
              requiredWallets: dual || p4b ? requiredWallets : null,
              recipientEcdhPubRaw,
              sealWrapKeyRaw,
            })
            if (getNftKeycard(nftObjectId)) {
              bindWireToNftKeycard({
                objectId: nftObjectId,
                wireFingerprint: fingerprintPassphraseMessageWire(wire),
                slotId: readPassphraseNftKeycardBindSlotId(),
              })
            }
            wrapped.push(wire)
            void gate
          }
          textSnaps = wrapped
          if (getNftKeycard(cardOid!)) await flushNftKeycardVaultPersist()
          if (cardOid) writeZeitkapselLastNftObjectId(cardOid)
          sharedPassphraseNote = zeitkapselMode
            ? ' NFT-Leserecht gesendet — Klartext nur mit NFT-Besitz. Unten „NFT verleihen…“ oder On-Chain → Verleihen.'
            : p4b
              ? ' Starkes P4b Seal: DEK nur mit Key-Broker nach NFT-AddressOwner. Wire allein reicht nicht. Klartext danach kopierbar.'
              : p4a2
                ? ` Starkes P4a2 (Wallet+NFT+Pubkey): nur ${requiredWallet!.slice(0, 10)}… mit NFT + ECDH-Privatkey. Klartext danach kopierbar.`
                : dual
                  ? requiredWallets.length > 1
                    ? ` Starkes Dual-Gate (Wallet+NFT): ${requiredWallets.length} erlaubte Wallets + NFT-Leserecht. Klartext danach kopierbar.`
                    : ` Starkes Dual-Gate (Wallet+NFT): nur Adresse ${requiredWallet!.slice(0, 10)}… mit NFT-Leserecht. Klartext danach kopierbar. Kein Blank-DEK im Vault.`
                  : ' Starkes NFT-Gate (P4a): Lesen nur mit Besitz/Leihe der Schlüsselkarte — kein Passphrase-Teilen, kein Blank-DEK im Vault. Klartext danach kopierbar.'
        } else {
          const { passphrase: batchPass, reused } = resolvePassphraseForProtectSend(
            generatePassphraseMessageSharePassphrase
          )
          if (batchPass.length < 8) {
            throw new Error(
              readPassphraseReuseEnabled()
                ? 'Wiederverwenden: keine Passphrase im Vault — Tresor entsperren oder „Neu würfeln“.'
                : 'Passphrase mindestens 8 Zeichen (Wiederverwenden: Feld prüfen).'
            )
          }
          let rememberedAny = false
          let rememberOnlyTab = false
          for (const snap of textSnaps) {
            if (!snap.trim()) {
              wrapped.push(snap)
              continue
            }
            const { wire, passphrase } = await encryptPassphraseMessage(snap, batchPass)
            const rememberOnDevice = readPassphraseRememberOnDeviceEnabled()
            if (rememberOnDevice) {
              // Immer merken (RAM + Tab-Backup). Enc-Sidecar nur mit Vault-Sitzung — nicht blockieren.
              rememberPassphraseMessagePassphrase(wire, passphrase)
              rememberedAny = true
              if (!isPassphraseMessageVaultSessionOpen()) rememberOnlyTab = true
            }
            // Kein Auto-Bind an Schlüsselkarte bei normalem PWMSG (Rest-OID von Zeitkapsel
            // erzeugte sonst falschen „gebunden“-Hinweis). Binden: nach Unlock in der Zeile.
            wrapped.push(wire)
          }
          textSnaps = wrapped
          if (!reused) {
            rollPassphraseAfterOneShotSend(generatePassphraseMessageSharePassphrase)
          }
          if (rememberedAny || reused || !readPassphraseReuseEnabled()) {
            await flushPassphraseMessageVaultPersist()
          }
          if (batchPass) {
            sharedPassphraseNote = rememberedAny
              ? reused
                ? ` Passphrase (wiederverwendet, gemerkt): ${batchPass}`
                : ` Passphrase zum Teilen (gemerkt): ${batchPass}`
              : reused
                ? ` Passphrase (wiederverwendet): ${batchPass}`
                : ` Passphrase zum Teilen (kopieren!): ${batchPass}`
            if (rememberOnlyTab) {
              sharedPassphraseNote +=
                ' Merken aktiv (Tab/RAM). Dauerhaft erst nach Vault-Unlock — das ist das Tresor-Passwort, nicht die Nachrichten-Passphrase.'
            }
            if (!reused) {
              sharedPassphraseNote +=
                ' „Wiederverwenden“ war aus → Passphrase für den nächsten Send neu gewürfelt. Anlassen, wenn sie gleich bleiben soll.'
            }
            sharedPassphraseNote +=
              ' Posteingang: Ansicht → Alles — Zeile sollte ohne erneutes Tippen aufgehen.'
          }
        }
      } catch (e) {
        applyValidationError(
          {
            ok: false,
            message: e instanceof Error ? e.message : 'Passphrase-Verschlüsselung fehlgeschlagen.',
            idleMs: 8000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
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
      /** Anhang behalten — sonst „Nochmals senden“ / Toggle-Race löscht das Bild. */
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
      const epochRenewHint =
        encrypted && isPrivate && isSendPartSuccess(lastOk) && lastOk.mailboxCapture?.encrypted === true
          ? takeEncryptedSendKeyEpochRenewHint(recipient.trim()) ?? ''
          : ''
      let statusLine = successMsg + digestSuffix + sharedPassphraseNote + epochRenewHint
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
          baseSuccessMsg: successMsg + epochRenewHint,
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
        const audience = readTelegramNotifyAudience()
        const notifyAddr = recipient.trim().toLowerCase()
        const preview = buildTelegramMessagePreview({
          message,
          attachedTxtFile,
          attachedBlobBase64,
          attachedAudioBase64,
          fallbackText: textSnaps[0],
        })
        const myLabel =
          contactDirectory[myAddress.trim().toLowerCase()]?.label ||
          `${myAddress.trim().slice(0, 10)}…`
        const plan = planTelegramNotifyAfterSend({
          audience,
          recipientAddress: notifyAddr,
          contactTelegramChatId: contactDirectory[notifyAddr]?.telegramChatId,
          extraChatIds: readTelegramNotifyExtraChatIds(),
        })

        if (plan.kind === 'skip') {
          setStatusMsg(
            `${statusLine} · Telegram-Hinweis übersprungen (${plan.reason}; Ziel: ${telegramNotifyAudienceLabel(audience)}).`
          )
        } else {
          void notifyTelegramContact({
            recipientAddress: plan.recipientAddress,
            messagePreview: preview,
            senderLabel: myLabel,
            skipJournal: true,
            /** Bei nur-CC: audience contact ohne Adresse → Server skippt Kontakt, sendet extras. */
            audience: plan.apiAudience,
            extraChatIds: plan.extraChatIds,
          }).then((r) => {
            if (r.delivered) {
              setStatusMsg(
                `${statusLine} · ${formatTelegramNotifyDeliveredSuffix({
                  audience: plan.audience,
                  wantContact: plan.wantContact,
                  contactOk: plan.contactOk,
                  deliveredContact: r.deliveredContact,
                  deliveredAdmin: r.deliveredAdmin,
                  deliveredExtra: r.deliveredExtra,
                })}`
              )
            } else if (r.skipped) {
              setStatusMsg(`${statusLine} · Telegram-Hinweis: ${r.skipped}`)
            } else if (r.error) {
              setStatusMsg(`${statusLine} · Telegram: ${r.error}`)
            }
          })
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
      } else if (
        isPrivate &&
        !isGroupChannel &&
        forcedTransport === 'internet' &&
        isSendPartSuccess(lastOk)
      ) {
        const preview =
          textSnaps[textSnaps.length - 1]?.trim() ||
          message.trim() ||
          (!encrypted ? lastOk.mailboxCapture?.payloadUtf8?.trim() : '') ||
          ''
        const to =
          (recipient || plainMailboxRecipient || encryptedMailboxRecipient || myAddress).trim()
        const dmOpt = buildPrivateDmOptimisticInboxRow({
          myAddress,
          recipient: to,
          text: preview,
          encrypted: lastOk.mailboxCapture?.encrypted ?? encrypted,
          messageNonceU64: lastOk.mailboxCapture?.messageNonceU64,
          mailboxPersisted: messagingPersistenceMode === 'mailbox',
        })
        if (dmOpt) {
          setMessages((prev) => applyGroupOptimisticInboxMerge(prev, [dmOpt]))
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
    } finally {
      sendInFlightRef.current = false
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
