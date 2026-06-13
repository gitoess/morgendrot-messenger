'use client'

import { useCallback, useMemo, useRef } from 'react'
import {
  enqueueOfflineMailboxFailure,
  isOfflineMailboxQueueEnabled,
  stableOfflineMailboxThreadId,
  nextChainMessageNonceU64,
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
  CHAT_ENCRYPTED_HANDSHAKE_AWAITING_PEER_MSG,
  CHAT_ENCRYPTED_MESH_DISABLED_MSG,
  MESH_PLAINTEXT_MAX_CHARS,
} from '@/frontend/lib/chat-view-messenger-transport'
import {
  isMeshLoRaImageSendActive,
  isMeshPath4SelfArchiveActive,
} from '@/frontend/lib/mesh-lora-composer-options'
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
  sendTeamPlaintextBroadcastHybrid,
} from '@/frontend/lib/mailbox-send-hybrid'
import { canTryLiveEncryptedDirectMailbox } from '@/frontend/lib/direct-iota-encrypted-submit'
import { findPeerHandshake } from '@/frontend/lib/api/package-connect'
import { connectPartnerHybrid } from '@/frontend/lib/connect-hybrid'
import { readCachedHandshakeOffers } from '@/frontend/lib/handshake-offers-cache'
import { resolveEncryptedRecipientHandshakeStatusSync } from '@/frontend/lib/encrypted-recipient-handshake-status'
import { prependPinnwandPostMarker } from '@/frontend/lib/pinnwand-post-marker'
import {
  resolveComposerKlartextIotaAddress,
  resolveEncryptedMailboxRecipient,
} from '@/frontend/lib/composer-recipient-fields'
import {
  getDirectChatEcdhMaterialForRecipient,
  getDirectChatEcdhPrivateKey,
  hasDirectChatEcdhPeerPubForRecipient,
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
import { trimTangleContentPreview } from '@/frontend/lib/tangle-inventory-recover'
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
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'
import { readGroupMailboxSendAll } from '@/frontend/lib/group-mailbox-pairwise-send'
import {
  GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG,
  GROUP_TEAM_MAILBOX_REQUIRED_MSG,
  isGroupMailboxInternetChainSend,
  resolveGroupTeamMailboxObjectId,
  shouldSendGroupTeamBroadcast,
} from '@/frontend/lib/group-team-broadcast'
import {
  buildGroupMailboxOptimisticInboxRows,
  mergeOptimisticGroupInboxRows,
} from '@/frontend/lib/group-inbox-optimistic'
import {
  isWrongNetworkPackageError,
  isMainnetDirectSendBlockedError,
  purgeStaleOfflineMailboxQueue,
  recoverWrongNetworkPackageSendFailure,
  recoverMainnetDirectSendBlockedFailure,
  syncActiveNetworkChainSnapshot,
} from '@/frontend/lib/active-network-chain-sync'

/** Gleiche Meldung: Klartext-Mesh und verschlüsselter Mesh-Pfad bei fehlendem Heltec. */
const MESH_BT_NOT_CONNECTED_MSG = 'Meshtastic/Web Bluetooth not connected (Heltec).'

/** Abbruch-Button / `throwIfCancelled` — eine kanonische Meldung für `isUserCancelError`. */
const CHAT_SEND_CANCELLED_MSG = 'Transfer cancelled.'

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
  return 'Error'
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
    setStatusMsg('Cancel requested — stops after the current step …')
  }, [setStatusMsg])

  const handleSend = useCallback(async (opts?: ChatSendHandleOptions) => {
    cancelRequestedRef.current = false
    const throwIfCancelled = () => {
      if (cancelRequestedRef.current) throw new Error(CHAT_SEND_CANCELLED_MSG)
    }
    const emergencyKind = opts?.emergencyWire
    const isEmergencySend = emergencyKind === 'text' || emergencyKind === 'voice'
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

    if (groupMailboxInternetChain && encrypted) {
      setStatus('error')
      setStatusMsg(GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG)
      return
    }

    if (groupMailboxInternetChain && !resolveGroupTeamMailboxObjectId(activeGroup)) {
      setStatus('error')
      setStatusMsg(GROUP_TEAM_MAILBOX_REQUIRED_MSG)
      return
    }

    if (encrypted && isPrivate && !ADDR_64_LOWER.test(encryptedMailboxRecipient)) {
      setStatus('error')
      setStatusMsg(
        'Encrypted: enter a valid 0x recipient address in the composer or partner (handshake).'
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
        return { ok: false, message: 'Recipient: valid 0x address (64 hex) required for encrypted send.' }
      }
      if (apiStatus?.locked) {
        return { ok: false, message: 'Wallet is locked — unlock first.' }
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
              'Handshake to your own address: accept in the partner panel ("Accept handshake" / Connect) — or send unencrypted for testing.',
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
              'Your own handshake is pending — accept in the partner panel (Connect), then send encrypted.',
          }
        }
        return {
          ok: false,
          message:
            'Partner sent a handshake — first "Accept handshake" (Connect), then send encrypted.',
        }
      }
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
              'Multiple connected partners: choose the target address in "Partner (handshake)", then send encrypted.',
          }
        }
        if (!connected.includes(partnerNorm)) {
          return {
            ok: false,
            message:
              'Partner address is not connected. Complete handshake/connect for this address or fix the partner field.',
          }
        }
        return { ok: true }
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
                'Handshake found, but chat ECDH private key is missing in the browser. Set the P-256 ECDH JWK in pulse settings or "Accept handshake" (Connect) for this 0x address.',
            }
          }
          return {
            ok: false,
            message:
              'Handshake found on chain — please "Accept handshake" (Connect) for this exact 0x address until status shows "connected". Sending a handshake alone is not enough.',
          }
        }
      } catch {
        /* optional */
      }
      const partnerForConnect = partner.trim().toLowerCase()
      if (ADDR_64_LOWER.test(partnerForConnect) && partnerForConnect !== target) {
        try {
          const cr2 = await connectPartnerHybrid(partnerForConnect)
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

    const singleWireSuccessMsg = (delivery?: 'team-broadcast' | 'pairwise'): string => {
      if (isGroupChannel && delivery === 'team-broadcast') {
        return 'Team broadcast sent (1× chain). Inbox: channel "All" or "Outbox".'
      }
      if (!isPrivate) return 'Sent!'
      if (path4SelfArchiveActive) {
        return 'Plaintext sent over LoRa; then your own tangle copy (mailbox to you).'
      }
      if (!encrypted) {
        if (forcedTransport === 'internet') return 'Plaintext sent over IOTA (/send-plain).'
        if (forcedTransport === 'mesh') {
          return meshSelfArchiveAfterLoRa && isPrivate
            ? 'Plaintext over LoRa (Meshtastic text); then your own tangle copy (mailbox to you).'
            : 'Plaintext over LoRa (Meshtastic text) sent.'
        }
      }
      if (forcedTransport === 'internet') return 'Sent online (IOTA/mailbox).'
      return 'Sent.'
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

    /** Nach Mailbox-Send: gestaffelte Reloads (Chain-Index braucht oft >1 s). */
    const scheduleInboxReloadAfterSend = () => {
      const delays = isGroupChannel ? [1200, 4000, 9000] : [1200]
      for (const ms of delays) {
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
      if (!isGroupChannel || !activeGroup?.streamsAnchorId) return
      void publishStreamsAnchor(activeGroup.streamsAnchorId, {
        type: 'group_message',
        groupId: activeGroup.id,
        from: myAddress.trim(),
        to: multicast ? `@group:${activeGroup.id}` : toAddr,
        preview: multicast ? `${textSnap.slice(0, 180)} [team-broadcast]` : textSnap.slice(0, 240),
        ts: Date.now(),
      })
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
        return { status: 'failed', note: 'Self-archive: MY_ADDRESS invalid — no mailbox copy.' }
      }
      if (apiStatus?.locked) {
        return { status: 'failed', note: 'Self-archive: vault locked — mailbox copy skipped.' }
      }
      const res = await sendPlaintextMailboxHybrid(selfAddr, payload, messageNonceU64, mailboxOptsFor(selfAddr))
      if (res.ok) {
        const txDigest = res.txDigest
        if (txDigest) {
          const previewSource = parseMailboxOutNonceMarker(payload)?.rest ?? payload
          const inv = {
            digest: txDigest,
            type: kind === 'image_luma' || kind === 'image_chroma' ? ('image' as const) : ('text' as const),
            status: 'anchored' as const,
            origin: 'path4' as const,
            nonce: messageNonceU64.toString(),
            encrypted: false,
            contentPreview: trimTangleContentPreview(previewSource),
            ...(kind === 'image_luma' ? { chunkPart: 1, chunkTotal: 2 } : {}),
            ...(kind === 'image_chroma' ? { chunkPart: 2, chunkTotal: 2 } : {}),
          }
          addTangleInventoryItem(inv)
          void maybeAutoSaveDigestToVault({ ...inv, timestamp: Date.now() })
        }
        return {
          status: 'anchored',
          note: 'Self-archive: plaintext mailbox sent to you.',
          txDigest,
        }
      }
      const err = mailboxHybridErr(res)
      if (!isOfflineMailboxQueueEnabled()) return { status: 'failed', note: `Self-archive (mailbox): ${err}` }
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
      if (!en.ok) return { status: 'failed', note: `Self-archive (queue): ${en.reason}` }
      if (en.queued) return { status: 'queued', note: 'Self-archive: queued offline (opt-in).' }
      return { status: 'duplicate', note: 'Self-archive: already in offline queue (dedup).' }
    }

    const runPath4SelfMirrorForLoraImage = async (
      lumaText: string,
      chromaText: string,
      segMsgIds?: { luma?: string; chroma?: string }
    ): Promise<string> => {
      if (!meshSelfArchiveAfterLoRa || forcedTransport !== 'mesh') return ''
      throwIfCancelled()
      const loraMsgIdLuma =
        segMsgIds?.luma ??
        parseLoraProgressiveMessage(lumaText)?.msgId ??
        parseLoraProgressiveMessage(chromaText)?.msgId ??
        null
      const loraMsgIdChroma =
        segMsgIds?.chroma ?? parseLoraProgressiveMessage(chromaText)?.msgId ?? loraMsgIdLuma
      const n1 = nextChainMessageNonceU64()
      const w1 = prependMailboxOutNonceMarker(prependPath4SelfArchiveMarker(lumaText), n1)
      const d1 = await dispatchPath4Mirror(w1, n1, 'image_luma', loraMsgIdLuma)
      if (d1.status !== 'anchored') return ` ${d1.note}`
      throwIfCancelled()
      const n2 = n1 + 1n
      const w2 = prependMailboxOutNonceMarker(prependPath4SelfArchiveMarker(chromaText), n2)
      const d2 = await dispatchPath4Mirror(w2, n2, 'image_chroma', loraMsgIdChroma)
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
          baseSuccessMsg: 'Self-archive: image anchored in your mailbox.',
          setStatusMsg,
          mailboxTxDigest: mbTx,
          silent: true,
        })
      }
      return ` Self-archive anchored.${formatTxDigestStatusSuffix(mbTx)}`
    }

    /** Ohne Pfad 4: verschlüsselter „Funk“-Modus + LUMA — nicht unterstützt (Pfad 4 = Klartext-Luft). */
    if (attachedLora && encrypted && isPrivate && forcedTransport === 'mesh' && !meshLoRaImageSendActive) {
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
            'Encrypted (LoRa→online): enter 0x recipient in the composer or partner (0x…) in setup.'
          )
          setSending(false)
          return
        }
        const n1 = nextChainMessageNonceU64()
        const w1 = prependMailboxOutNonceMarker(lumaText, n1)
        setStatusMsg('Online: LUMA (IOTA/mailbox)…')
        const r1 = await sendEncryptedMailboxHybrid(rTrim, w1, mailboxOptsFor(rTrim))
        if (!r1.ok) throw new Error(r1.error || r1.message || 'LUMA failed.')
        throwIfCancelled()
        const n2 = n1 + 1n
        const w2 = prependMailboxOutNonceMarker(chromaText, n2)
        setStatusMsg('Online: CHROMA (IOTA/mailbox)…')
        const r2 = await sendEncryptedMailboxHybrid(rTrim, w2, mailboxOptsFor(rTrim))
        if (!r2.ok) throw new Error(r2.error || r2.message || 'CHROMA failed.')
        const baseSuccess = 'Online (IOTA/mailbox): LUMA + CHROMA sent.'
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
    if (attachedLora && isPrivate && forcedTransport === 'internet' && !encrypted) {
      applyValidationError(
        {
          ok: false,
          message:
            'Image (LUMA+CHROMA) over "online": enable lock / encryption — two IOTA mailbox messages. Alternative: transport "radio" with "Images over radio" (air stays plaintext).',
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
          'Radio plaintext to node: enter a valid node ID (e.g. !1a2b3c4d) — or disable "to node ID" for broadcast.'
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
          `Ephemeral (LoRa): image sent (${segResult.plan.totalSegments} segments).${mirrorNote || ''}`
        )
        const cap = message.trim()
        recordMeshOutgoingPlaintext(
          appendMeshMessage,
          myAddress,
          `[LoRa image ephemeral] ${segResult.plan.luma.n}+${segResult.plan.chroma.n} segments${cap ? `: ${cap}` : ''}`,
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
              ? 'LoRa (radio) did not respond (NO_RESPONSE / error 8). Please send again or connect closer/more reliably.'
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
              'SOS voice: no audio data in composer — use recording and send again.',
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
              'SOS text: not together with attachments. Remove attachment or use "SOS now over LoRa" for the voice variant.',
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

    if (!encrypted && !plainMailboxRecipient && !groupMailboxInternetChain) {
      if (!meshKlartextOkWithoutZeroXRecipient) {
        applyValidationError(
          {
            ok: false,
            message:
              'Plaintext: enter recipient address (0x…) — or for "radio" without target node connect Heltec and use broadcast ("to node ID" unchecked). With checkbox: valid node ID e.g. !1a2b3c4d.',
            idleMs: 9000,
          },
          setStatus,
          setStatusMsg
        )
        return
      }
    }
    const recipientTrimLower = plainMailboxRecipient.trim().toLowerCase()
    if (
      !encrypted &&
      forcedTransport === 'internet' &&
      !ADDR_64_LOWER.test(recipientTrimLower) &&
      !groupMailboxInternetChain
    ) {
      applyValidationError(
        {
          ok: false,
          message:
            'Online/IOTA: recipient address must be 0x + 64 hex (e.g. 0x1234…abcd). Send or queue only after that.',
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
        (attachedLora != null && !meshLoRaImageSendActive)
      if (blocksPlaintextByAttachment) {
        applyValidationError(
          {
            ok: false,
            message:
              'Unencrypted radio: short text only. LoRa image only with active "Images over radio".',
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
                ? `Unencrypted LoRa voice memo does not fit in one Meshtastic text frame (${charCount} characters, max. ${plaintextMaxChars}). Voice: choose "online". Unencrypted voice over LoRa needs chunking+ACK (roadmap).`
                : `Unencrypted LoRa text max. ${plaintextMaxChars} characters (currently ${charCount}). Shorten, send multiple short messages, or use "online" with encryption for longer content.`,
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
            ? 'LoRa image (LUMA+CHROMA) is only available in private chat. Bulletin board: short text — or image over "online" with encryption.'
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
            'Voice message is currently enabled for online/IOTA only. For radio use SOS text (dictation) or short text.',
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
              '"Anchor on chain" only in private chat with transport "radio". Otherwise disable the option.',
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
              '"Anchor on chain": MY_ADDRESS (0x + 64 hex) must be set — otherwise no mailbox copy to you is possible.',
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
              '"Anchor on chain": unlock vault — the mailbox copy requires wallet/signature.',
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
      setStatusMsg(`Splitting file into ${textSnaps.length} parts…`)
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
      if (isMainnetDirectSendBlockedError(lastErr) || isWrongNetworkPackageError(lastErr)) {
        return { reject: 'Mainnet direct send not ready — not queued (§ H.12).' }
      }
      if (apiStatus?.locked || /tresor gesperrt/i.test(lastErr)) {
        return {
          reject:
            'Vault locked — please unlock first. Not queued again.',
        }
      }
      const recipientTrim = encrypted ? encryptedMailboxRecipient : plainMailboxRecipient.trim().toLowerCase()
      if (!ADDR_64_LOWER.test(recipientTrim)) {
        return { reject: 'Invalid recipient address; not saved to mailbox queue.' }
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
          groupDelivery?: 'team-broadcast' | 'pairwise'
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
        if (!path4SelfArchiveActive) return ''
        const n = nextChainMessageNonceU64()
        const marked = prependPath4SelfArchiveMarker(airUtf8)
        const wireForApi = prependMailboxOutNonceMarker(marked, n)
        const d = await dispatchPath4Mirror(wireForApi, n, 'text')
        if (d.status === 'failed') return `__PATH4_FAILED__${d.note}`
        if (d.status !== 'anchored') return ` ${d.note}`
        return ` ${d.note}${formatTxDigestStatusSuffix(d.txDigest)}`
      }

      const payloadWithoutOutNonce = (snap: string) => parseMailboxOutNonceMarker(snap)?.rest ?? snap

      type MailboxPartResult = PartOk | { ok: false; error: string }

      const sendMailboxSingle = async (
        sendTo: string,
        enc: boolean,
        textSnap: string,
        opts?: { suppressStatus?: boolean }
      ): Promise<MailboxPartResult> => {
        const failPart = (msg: string): { ok: false; error: string } => {
          if (!opts?.suppressStatus) failSend(msg)
          return { ok: false, error: msg }
        }
        throwIfCancelled()
        const target = sendTo.trim().toLowerCase()
        if (!ADDR_64_LOWER.test(target)) return failPart('Invalid recipient wallet (0x + 64 hex).')
        if (enc) {
          const ready = await ensureEncryptedPeerReady(target)
          if (!ready.ok) return failPart(ready.message)
        }
        let body = payloadWithoutOutNonce(textSnap)
        if (shouldMarkPinnwandPlainPost(target, enc)) {
          body = prependPinnwandPostMarker(body)
        }
        const messageNonceU64 = nextChainMessageNonceU64()
        const wireForApi = enc ? prependMailboxOutNonceMarker(body, messageNonceU64) : body
        const hybridOpts = mailboxOptsFor(target)
        const res = enc
          ? await sendEncryptedMailboxHybrid(target, wireForApi, hybridOpts)
          : await sendPlaintextMailboxHybrid(target, wireForApi, messageNonceU64, hybridOpts)
        if (res.ok) {
          publishGroupStreamsAfterSend(textSnap, target, false)
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
        if (isWrongNetworkPackageError(errText)) {
          const { userMessage } = recoverWrongNetworkPackageSendFailure(errText, myAddress.trim())
          onOfflineMailboxQueueChanged?.()
          return failPart(userMessage)
        }
        if (isMainnetDirectSendBlockedError(errText)) {
          const { userMessage } = recoverMainnetDirectSendBlockedFailure(myAddress.trim())
          onOfflineMailboxQueueChanged?.()
          return failPart(userMessage)
        }
        const qm = await queueMailboxIfAllowed(
          enc ? 'encrypted_send' : 'plain_send',
          wireForApi,
          enc,
          errText,
          messageNonceU64
        )
        if (qm === 'queued') {
          return failPart(
            `${errText} — buffered; retry when the basis is reachable again (opt-in "mailbox queue").`
          )
        }
        if (qm === 'duplicate') {
          return failPart(
            `${errText} — same message is already in the mailbox queue (dedup / § H.12).`
          )
        }
        if (typeof qm === 'object' && 'reject' in qm) {
          return failPart(`Queue: ${qm.reject}`)
        }
        return failPart(`${target.slice(0, 10)}…: ${errText}`)
      }

      const tryGroupTeamBroadcast = async (textSnap: string, enc: boolean): Promise<PartOk | null> => {
        if (
          !shouldSendGroupTeamBroadcast({
            activeGroup,
            encrypted: enc,
            messagingPersistenceMode,
            forcedTransport,
            sendAllMembers: readGroupMailboxSendAll(),
            isGroupChannel,
          })
        ) {
          return null
        }
        const teamMb = resolveGroupTeamMailboxObjectId(activeGroup)
        if (!teamMb) return null
        const body = payloadWithoutOutNonce(textSnap)
        const messageNonceU64 = nextChainMessageNonceU64()
        const res = await sendTeamPlaintextBroadcastHybrid(teamMb, body, messageNonceU64)
        if (res.ok) {
          publishGroupStreamsAfterSend(textSnap, teamMb, true)
          return {
            ok: true,
            groupDelivery: 'team-broadcast',
            mailboxCapture: {
              payloadUtf8: body,
              messageNonceU64,
              encrypted: false,
              txDigest: res.txDigest,
            },
          }
        }
        const errText = res.error || res.message || 'Team broadcast failed.'
        return failSend(
          `${errText} — team mailbox must match the current Move package (recreate after deploy).`
        )
      }

      const tryMailbox = async (enc: boolean): Promise<PartOk> => {
        if (groupMailboxInternetChain) {
          if (enc) return failSend(GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG)
          const tb = await tryGroupTeamBroadcast(textSnap, false)
          return tb ?? failSend(GROUP_TEAM_MAILBOX_REQUIRED_MSG)
        }
        const sendTo = enc && isPrivate ? encryptedMailboxRecipient : plainMailboxRecipient
        return sendMailboxSingle(sendTo, enc, textSnap)
      }

      if (!isPrivate) {
        if (forcedTransport === 'mesh') {
          if (encrypted) {
            return failSend(
              'Public channel: encrypted radio requires private chat with handshake and /connect. Choose plaintext + "radio" or switch to private chat.'
            )
          }
          if (!meshtastic.connected) return failSend(MESH_BT_NOT_CONNECTED_MSG)
          const dest = meshPlaintextDest()
          if (dest === null) {
            return failSend(
              'Radio plaintext to node: enter a valid node ID (e.g. !1a2b3c4d) — or disable "to node ID" for broadcast.'
            )
          }
          try {
            await meshtastic.sendMeshText(textSnap, dest, meshtasticChannelIndex)
            recordMeshOutgoingPlaintext(appendMeshMessage, myAddress, textSnap, dest, meshPath4StyleActive)
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

      if (!encrypted || meshPath4StyleActive) {
        if (forcedTransport === 'internet') {
          return tryMailbox(false)
        }
        if (forcedTransport === 'mesh') {
          const dest = meshPlaintextDest()
          if (dest === null) {
            return failSend(
              'Radio plaintext: valid node ID (e.g. !1a2b3c4d) or disable "to node ID" for broadcast.'
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
                await meshtastic.sendMeshText(textSnap, dest, meshtasticChannelIndex)
                recordMeshOutgoingPlaintext(appendMeshMessage, myAddress, textSnap, dest, meshPath4StyleActive)
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
                  `SOS: radio failed — retry ${attempt + 2}/${max} in ~${Math.round(delay / 1000)} s …`
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
            await meshtastic.sendMeshText(textSnap, dest, meshtasticChannelIndex)
            recordMeshOutgoingPlaintext(appendMeshMessage, myAddress, textSnap, dest, meshPath4StyleActive)
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
            ? 'Ad-hoc: not implemented. Choose "online" or "radio" (plaintext) or encrypted.'
            : 'Unknown plaintext path.'
        )
        return { ok: false }
      }

      if (forcedTransport === 'adhoc') {
        setStatus('error')
        setStatusMsg(
          'Layer 3 (smartphone direct): not implemented — BLE advertising/scan is concept only (bleUuid in vault).'
        )
        return { ok: false }
      }

      if (forcedTransport === 'mesh') {
        return failSend(
          CHAT_ENCRYPTED_MESH_DISABLED_MSG
        )
      }

      if (forcedTransport === 'internet') {
        return tryMailbox(true)
      }

      setStatus('error')
      setStatusMsg('Unknown send path.')
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
              `Part ${i + 1}/${textSnaps.length} failed (earlier parts may already have arrived).`
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
        successMsg = `All ${textSnaps.length} parts sent.${successTail}`
      } else {
        successMsg = singleWireSuccessMsg(lastOk?.groupDelivery) + successTail
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
                  ? '[Image attachment]'
                  : attachedAudioBase64
                    ? '[Audio attachment]'
                    : textSnaps[0]?.slice(0, 200) || 'New Morgendrot message')
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
                setStatusMsg(`${statusLine} · Telegram notification sent to contact.`)
              } else if (r.error) {
                setStatusMsg(`${statusLine} · Telegram: ${r.error}`)
              }
            })
          }
        }
      }

      if (lastOk?.ok && lastOk.mailboxCapture?.txDigest) {
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
        lastOk?.ok &&
        lastOk.mailboxCapture &&
        forcedTransport === 'internet' &&
        messagingPersistenceMode === 'mailbox'
      ) {
        const previewText =
          lastOk.mailboxCapture.payloadUtf8?.trim() ||
          textSnaps[textSnaps.length - 1]?.trim() ||
          message.trim()
        const optimistic = buildGroupMailboxOptimisticInboxRows({
          myAddress,
          text: previewText,
          encrypted: lastOk.mailboxCapture.encrypted,
          messageNonceU64: lastOk.mailboxCapture.messageNonceU64,
          mode: 'team-broadcast',
          teamMailboxObjectId: resolveGroupTeamMailboxObjectId(activeGroup),
        })
        if (optimistic.length > 0) {
          setMessages((prev) => mergeOptimisticGroupInboxRows(prev, optimistic))
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
