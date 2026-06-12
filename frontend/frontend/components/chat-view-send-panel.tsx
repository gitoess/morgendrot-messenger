'use client'

/**
 * Composer: Empfänger (Klartext), Anhänge, Text, LoRa→Online-Fallback-Banner, Senden + Status.
 * Sendelogik bleibt im Hook (`useChatViewSendFlow`); dieses Panel ist reine Orchestrierung der bestehenden UI-Blöcke.
 */

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { AlertCircle, BookUser, Check, ListOrdered, RefreshCw, Send } from 'lucide-react'
import { ChatComposerEmojiPicker } from '@/frontend/components/chat-composer-emoji-picker'
import { cn } from '@/lib/utils'
import {
  needsComposerIotaAddress,
  needsComposerMailboxUi,
  needsComposerTelegramId,
  showComposerRecipientRow,
  type ComposerDeliveryChannel,
} from '@/frontend/lib/composer-delivery-channel'
import {
  resolveComposerIotaAddress,
  resolveComposerKlartextIotaAddress,
  resolveComposerIotaFieldValue,
  resolveComposerTelegramChatIds,
} from '@/frontend/lib/composer-recipient-fields'
import { telegramRecipientToComposerDisplay } from '@/frontend/lib/telegram-notify-pref'
import { ChatViewAttachmentBar } from '@/frontend/components/chat-view-attachment-bar'
import { ChatViewVoiceRecord } from '@/frontend/components/chat-view-voice-record'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { ChatViewEncryptionContextHint } from '@/frontend/components/chat-view-encryption-context-hint'
import { ChatViewChainPersistenceBadge } from '@/frontend/components/chat-view-chain-persistence-badge'
import { ChatViewContactSendMailboxSelect } from '@/frontend/components/chat-view-contact-send-mailbox-select'
import { ChatViewEncryptedRecipientHandshakeBar } from '@/frontend/components/chat-view-encrypted-recipient-handshake-bar'
import {
  encryptedHandshakeStatusLabel,
  type EncryptedRecipientHandshakeStatus,
} from '@/frontend/lib/encrypted-recipient-handshake-status'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import {
  isLoRaMeshTransport,
  MESH_PLAINTEXT_MAX_CHARS,
} from '@/frontend/lib/chat-view-messenger-transport'
import { parseMeshtasticNodeIdToNumber } from '@/frontend/lib/meshtastic-node-id'
import {
  MESHTASTIC_CHANNEL_INDEX_MAX,
  MESHTASTIC_CHANNEL_INDEX_MIN,
  normalizeMeshtasticChannelIndex,
} from '@/frontend/lib/meshtastic-channel-index'
import type {
  AttachmentBarPort,
  ComposerDraftPort,
  SendMeshMirrorDelayPort,
  SendTransportReadPort,
  VoiceRecordSendPanelPort,
} from '@/frontend/features/messenger-ports'
import type { ChatSendHandleOptions } from '@/frontend/features/send/chat-send-handle-options'
import {
  activeSendPathWriteDeniedReason,
  plaintextSendBlockedByCapabilitiesReason,
} from '@/frontend/lib/messenger-capability-gates'
const MESSAGE_PLACEHOLDER = 'Optional: Unterschrift zu Bild/.txt oder normaler Text …'

/** Nur echte Datei-Drags vom OS — sonst kein preventDefault auf dragOver (stört vertikales Scrollen auf dem Handy). */
function dataTransferLooksLikeFileDrag(dt: DataTransfer | null): boolean {
  if (!dt?.types?.length) return false
  try {
    return Array.from(dt.types).includes('Files')
  } catch {
    return false
  }
}

export type ChatViewSendPanelProps = AttachmentBarPort &
  ComposerDraftPort &
  SendTransportReadPort &
  SendMeshMirrorDelayPort &
  VoiceRecordSendPanelPort & {
  isPrivate: boolean
  sending: boolean
  loraOnlineFallbackOffer: { reasonLabel: string } | null
  onConfirmLoraOnline: () => void | Promise<void>
  onDismissLoraOnlineFallback: () => void
  apiStatus: ApiStatus | null
  onSend: (opts?: ChatSendHandleOptions) => void | Promise<void>
  onCancelSend?: () => void
  status: 'idle' | 'success' | 'error'
  statusMsg: string
  onStatusFeedback?: (msg: string, status?: 'idle' | 'success' | 'error') => void
  partner?: string
  onPartnerChange?: (v: string) => void
  myAddress?: string
  composerDelivery?: ComposerDeliveryChannel
  messagingPersistenceMode?: MessagingPersistenceMode
  /** § H.3g 7a: Einträge in der lokalen Mailbox-Warteschlange (Opt-in). */
  offlineMailboxQueuePending?: number
  /** § H.6c: Einträge mit `timeIsTrusted === false` (Legacy ohne Feld zählt als unvertraut). */
  offlineMailboxQueueUntrustedTimeCount?: number
  /** § H.12 / SYNC §8.1: Einträge, die gerade im exponentiellen Backoff warten (kein sofortiger Retry). */
  offlineMailboxQueueBackoffCount?: number
  /** Kurztext der zuletzt gespeicherten Sendefehlermeldung (höchste `attempts`), nur lokal. */
  offlineMailboxQueueErrorHint?: string
  offlineMailboxQueueItems?: { id: string; recipient: string; createdAt: number; attempts: number; lastError?: string }[]
  onRemoveOfflineMailboxQueueItems?: (ids: string[]) => void
  /** Klartext-Funk: Ziel-Knoten (!hex) statt Broadcast. */
  meshPlaintextToNodeEnabled: boolean
  onMeshPlaintextToNodeEnabledChange: (v: boolean) => void
  meshPlaintextNodeId: string
  onMeshPlaintextNodeIdChange: (v: string) => void
  /** Expert: optionaler Meshtastic Channel-Index (0..7), leer = Default/Primary. */
  meshtasticChannelIndex?: number
  onMeshtasticChannelIndexChange?: (v: number | undefined) => void
  showMeshtasticChannelIndexInput?: boolean
  /** Manueller Status-/Drain-Impuls nach Netzwechsel, ohne kompletten Seitenreload. */
  onManualRefresh?: () => void | Promise<void>
  /** M4b: Kontaktverzeichnis für Mailbox-Routing-Hinweis */
  contactDirectory?: Record<string, ContactMeshEntryClient>
  /** Gruppenkanal: Team-Broadcast (1× Chain) statt pairwise */
  isGroupChannel?: boolean
  groupMailboxSendAll?: boolean
  groupMemberCount?: number
  groupTeamBroadcastReady?: boolean
  /** Expert: Pfad-4-Checkbox; Simple Mode: nur Hinweistext. */
  showPath4Checkbox?: boolean
  /** Nur bei composerDelivery === 'telegram'. */
  onTelegramSend?: () => void | Promise<void>
  canSendTelegram?: boolean
  telegramBusy?: boolean
  onNavigateHomeWhenLocked?: () => void
  composerMailboxObjectId?: string
  onComposerMailboxObjectIdChange?: (id: string) => void
  /** Verschlüsselt + online: Handshake-Status zur Empfänger-0x. */
  encryptedRecipientHandshakeStatus?: EncryptedRecipientHandshakeStatus
  /** 1:1 verschlüsselt online: 0x nur im Transport-Panel „Verschlüsselung & Partner“. */
  hideComposerIotaRecipient?: boolean
  /** Pinnwand-Kanal: Empfänger = feste Brett-0x (Server). */
  isPinnwandChannel?: boolean
  pinnwandBroadcastAddress?: string
  canPostToPinnwand?: boolean
  encryptedHandshakeBlocksSend?: boolean
  onEncryptedHandshakeForRecipient?: () => void | Promise<void>
  onEncryptedAcceptHandshakeForRecipient?: () => void | Promise<void>
  onOpenPhonebook?: () => void
}

export function ChatViewSendPanel(p: ChatViewSendPanelProps) {
  const {
    isPrivate,
    meshSelfArchiveAfterLoRa,
    onMeshSelfArchiveAfterLoRaChange,
    encrypted,
    recipient,
    onRecipientChange,
    message,
    onMessageChange,
    sending,
    loraOnlineFallbackOffer,
    onConfirmLoraOnline,
    onDismissLoraOnlineFallback,
    apiStatus,
    onSend,
    onCancelSend,
    status,
    statusMsg,
    onStatusFeedback,
    partner = '',
    onPartnerChange,
    myAddress = '',
    composerDelivery = 'chain',
    messagingPersistenceMode = 'event',
    offlineMailboxQueuePending = 0,
    offlineMailboxQueueUntrustedTimeCount = 0,
    offlineMailboxQueueBackoffCount = 0,
    offlineMailboxQueueErrorHint = '',
    offlineMailboxQueueItems = [],
    onRemoveOfflineMailboxQueueItems,
    meshPlaintextToNodeEnabled,
    onMeshPlaintextToNodeEnabledChange,
    meshPlaintextNodeId,
    onMeshPlaintextNodeIdChange,
    meshtasticChannelIndex,
    onMeshtasticChannelIndexChange,
    showMeshtasticChannelIndexInput = false,
    onManualRefresh,
    contactDirectory = {},
    isGroupChannel = false,
    groupMailboxSendAll = false,
    groupMemberCount = 0,
    groupTeamBroadcastReady = false,
    showPath4Checkbox = true,
    onTelegramSend,
    canSendTelegram = false,
    telegramBusy = false,
    onNavigateHomeWhenLocked,
    composerMailboxObjectId = '',
    onComposerMailboxObjectIdChange,
    encryptedRecipientHandshakeStatus = 'idle',
    encryptedHandshakeBlocksSend = false,
    hideComposerIotaRecipient = false,
    isPinnwandChannel = false,
    pinnwandBroadcastAddress = '',
    canPostToPinnwand: canPostPinnwand = true,
    onEncryptedHandshakeForRecipient,
    onEncryptedAcceptHandshakeForRecipient,
    onOpenPhonebook,
    voicePhase,
    voiceActiveKind,
    voiceProgress01,
    voiceMaxSeconds,
    voiceEmergencyMaxSeconds,
    sosVoiceFollowsOnline,
    forcedTransport,
    onVoiceToggle,
    voiceNormalBlockedStart,
    voiceBusy,
    voiceRecording,
    ...attachmentBarProps
  } = p

  const [dropHover, setDropHover] = useState(false)
  const [showLoraChunkDetails, setShowLoraChunkDetails] = useState(false)
  const [showQueueItems, setShowQueueItems] = useState(false)
  const [selectedQueueIds, setSelectedQueueIds] = useState<string[]>([])
  const dragDepth = useRef(0)

  const voiceLocksComposer = voiceRecording || voiceBusy
  const dropDisabled = attachmentBarProps.compactBusy || sending || voiceLocksComposer

  const onComposerDragEnter = (e: DragEvent) => {
    if (dropDisabled) return
    if (!dataTransferLooksLikeFileDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current += 1
    setDropHover(true)
  }

  const onComposerDragLeave = (e: DragEvent) => {
    // Kein Files-Check: types kann beim Leave leer sein — Tiefe nur zurücksetzen, wenn wir ein File-Drag betreten hatten.
    if (dragDepth.current === 0) return
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDropHover(false)
  }

  const onComposerDragOver = (e: DragEvent) => {
    if (dropDisabled) return
    if (!dataTransferLooksLikeFileDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
  }

  const onComposerDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = 0
    setDropHover(false)
    if (dropDisabled) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    void attachmentBarProps.ingestChatAttachmentFile(file)
  }

  const hasNoPayload =
    !message.trim() &&
    !attachmentBarProps.attachedBlobBase64 &&
    attachmentBarProps.attachedLora == null &&
    attachmentBarProps.attachedTxtFile == null &&
    attachmentBarProps.attachedAudioBase64 == null

  const meshPlaintextBlocked =
    !encrypted &&
    forcedTransport === 'mesh' &&
    !(
      isPrivate &&
      meshSelfArchiveAfterLoRa &&
      attachmentBarProps.attachedLora != null &&
      !attachmentBarProps.attachedBlobBase64 &&
      attachmentBarProps.attachedTxtFile == null
    ) &&
    ([...message].length > MESH_PLAINTEXT_MAX_CHARS ||
      !!attachmentBarProps.attachedBlobBase64 ||
      !!attachmentBarProps.attachedAudioBase64 ||
      attachmentBarProps.attachedTxtFile != null)

  /** Pfad 4: erlaubt Klartext-Text und LoRa-LUMA/CHROMA, aber keine sonstigen Anhänge. */
  const meshPath4Blocked =
    meshSelfArchiveAfterLoRa &&
    (!isPrivate ||
      forcedTransport !== 'mesh' ||
      !!attachmentBarProps.attachedBlobBase64 ||
      !!attachmentBarProps.attachedAudioBase64 ||
      attachmentBarProps.attachedTxtFile != null)

  const klartextIota = useMemo(
    () => resolveComposerKlartextIotaAddress(recipient, partner ?? '', isPrivate),
    [recipient, partner, isPrivate]
  )

  const groupMailboxInternetChain =
    isGroupChannel && messagingPersistenceMode === 'mailbox' && forcedTransport === 'internet'
  /** Klartext: Gruppe + Mailbox + Internet braucht Team-Postfach; Funk-Gruppe braucht Mitglieder. */
  const groupSendReady =
    isGroupChannel &&
    (groupMailboxInternetChain
      ? groupTeamBroadcastReady
      : groupMemberCount > 0 || forcedTransport === 'mesh')
  const meshKlartextRecipientOk =
    encrypted ||
    klartextIota.length > 0 ||
    groupSendReady ||
    (forcedTransport === 'mesh' &&
      (!meshPlaintextToNodeEnabled || parseMeshtasticNodeIdToNumber(meshPlaintextNodeId) !== null))

  const vaultLocked = apiStatus?.locked === true
  const sessionKeysReady = apiStatus?.hasKeys === true
  const isTelegramDelivery = composerDelivery === 'telegram'
  const onlineChainNeedsKeys = !isTelegramDelivery && forcedTransport === 'internet'

  const sendPathCapabilityBlocked = Boolean(
    activeSendPathWriteDeniedReason(apiStatus, forcedTransport, composerDelivery ?? 'chain')
  )
  const plaintextCapabilityBlocked = Boolean(
    plaintextSendBlockedByCapabilitiesReason(apiStatus, encrypted, forcedTransport)
  )

  const sendDisabled =
    sending ||
    vaultLocked ||
    (isPinnwandChannel && !canPostPinnwand) ||
    (onlineChainNeedsKeys && !sessionKeysReady) ||
    loraOnlineFallbackOffer != null ||
    hasNoPayload ||
    (encrypted && groupMailboxInternetChain) ||
    (groupMailboxInternetChain && !groupTeamBroadcastReady && !encrypted) ||
    (!encrypted && !meshKlartextRecipientOk) ||
    meshPlaintextBlocked ||
    meshPath4Blocked ||
    sendPathCapabilityBlocked ||
    plaintextCapabilityBlocked

  const sendDisableReason = useMemo(() => {
    if (sending) return 'Senden läuft bereits…'
    if (vaultLocked) return 'Tresor gesperrt — bitte zuerst entsperren.'
    if (onlineChainNeedsKeys && !sessionKeysReady) {
      return 'Wallet-Keys fehlen — unten „Tresor entsperren“ oder Badge „Tresor: Keys fehlen“ im Header.'
    }
    if (loraOnlineFallbackOffer != null) return 'LoRa-Online-Fallback offen — zuerst bestätigen oder abbrechen.'
    if (hasNoPayload) return 'Text oder Anhang eingeben.'
    if (isPinnwandChannel && !canPostPinnwand) {
      return 'Nur autorisierte Führungs-Adressen dürfen auf die Pinnwand schreiben.'
    }
    if (encrypted && groupMailboxInternetChain) {
      return 'Gruppe verschlüsselt auf der Chain folgt mit Team-E2EE (§ H.22) — bis dahin Klartext + Team-Postfach.'
    }
    if (!encrypted && !meshKlartextRecipientOk) {
      if (isGroupChannel && groupMailboxInternetChain && !groupTeamBroadcastReady) {
        return 'Gruppe: Team-Postfach im Gruppenpanel verknüpfen oder neu erstellen (1× Broadcast).'
      }
      return isGroupChannel && groupMemberCount === 0
        ? 'Gruppe: Mitglieder eintragen und speichern — dann geht Senden ohne Empfängerfeld.'
        : 'Empfänger (0x…) fehlt — Partner-Adresse prüfen oder im Empfängerfeld eintragen.'
    }
    if (meshPlaintextBlocked) return 'Nachricht zu lang oder Anhang für Funk-Klartext nicht erlaubt.'
    if (meshPath4Blocked) return '„LoRa + eigene Verankerung“ passt nicht zur aktuellen Auswahl.'
    const capReason = activeSendPathWriteDeniedReason(apiStatus, forcedTransport, composerDelivery ?? 'chain')
    if (capReason) return capReason
    const plainCapReason = plaintextSendBlockedByCapabilitiesReason(apiStatus, encrypted, forcedTransport)
    if (plainCapReason) return plainCapReason
    return undefined
  }, [
    sending,
    vaultLocked,
    onlineChainNeedsKeys,
    sessionKeysReady,
    loraOnlineFallbackOffer,
    hasNoPayload,
    encrypted,
    meshKlartextRecipientOk,
    meshPlaintextBlocked,
    meshPath4Blocked,
    apiStatus,
    forcedTransport,
    composerDelivery,
    groupMailboxInternetChain,
    groupTeamBroadcastReady,
    isGroupChannel,
    groupMemberCount,
    isPinnwandChannel,
    canPostPinnwand,
  ])

  const canOfferSosText =
    (forcedTransport === 'mesh' || forcedTransport === 'internet') &&
    !attachmentBarProps.attachedBlobBase64 &&
    !attachmentBarProps.attachedAudioBase64 &&
    !attachmentBarProps.attachedTxtFile &&
    !attachmentBarProps.attachedLora &&
    loraOnlineFallbackOffer == null
  const onlineConnected = !!apiStatus?.connected
  const showTelegramField = needsComposerTelegramId({
    deliveryChannel: composerDelivery,
    isPrivate,
  })
  const showIotaField =
    !hideComposerIotaRecipient &&
    !(isGroupChannel && groupMailboxSendAll) &&
    needsComposerIotaAddress({
      deliveryChannel: composerDelivery,
      encrypted,
      forcedTransport,
      meshPlaintextToNodeEnabled,
    })
  const showMailboxUi =
    !isPinnwandChannel &&
    needsComposerMailboxUi({
      deliveryChannel: composerDelivery,
      forcedTransport,
      recipient,
      partner: partner ?? '',
      encrypted,
    })
  const showRecipientRow =
    showTelegramField ||
    showIotaField ||
    (showMailboxUi && !groupMailboxSendAll) ||
    (!isPrivate &&
      (showComposerRecipientRow({
        isPrivate,
        deliveryChannel: composerDelivery,
        encrypted,
        forcedTransport,
        meshPlaintextToNodeEnabled,
      }) ||
        !encrypted))

  const composerIota = useMemo(
    () => resolveComposerIotaAddress(recipient, partner ?? '', encrypted),
    [recipient, partner, encrypted]
  )

  const composerIotaField = useMemo(
    () => resolveComposerIotaFieldValue(recipient, partner ?? '', encrypted),
    [recipient, partner, encrypted]
  )

  const composerTelegramIds = useMemo(
    () =>
      resolveComposerTelegramChatIds(recipient, contactDirectory, composerIota, {
        telegramDelivery: isTelegramDelivery,
      }),
    [recipient, contactDirectory, composerIota, isTelegramDelivery]
  )

  const telegramInputFocused = useRef(false)
  const [telegramDraft, setTelegramDraft] = useState('')

  useEffect(() => {
    if (!showTelegramField) return
    if (telegramInputFocused.current) return
    setTelegramDraft(telegramRecipientToComposerDisplay(recipient))
  }, [showTelegramField, recipient])

  const meshBroadcastNoRecipient =
    !isTelegramDelivery &&
    !encrypted &&
    forcedTransport === 'mesh' &&
    !meshPlaintextToNodeEnabled

  const chainRecipientReady =
    encrypted
      ? /^0x[a-f0-9]{64}$/i.test((composerIota || recipient.trim()).toLowerCase())
      : meshBroadcastNoRecipient || meshKlartextRecipientOk

  const primarySendDisabled = isTelegramDelivery
    ? !canSendTelegram || telegramBusy || sending || vaultLocked
    : sendDisabled

  const encryptedOnlineSendBlocked =
    encrypted && forcedTransport === 'internet' && !isTelegramDelivery && encryptedHandshakeBlocksSend

  const primarySendReady =
    sessionKeysReady &&
    !vaultLocked &&
    !sending &&
    !telegramBusy &&
    !encryptedOnlineSendBlocked &&
    (isTelegramDelivery
      ? canSendTelegram
      : !hasNoPayload &&
        chainRecipientReady &&
        !meshPlaintextBlocked &&
        !meshPath4Blocked &&
        loraOnlineFallbackOffer == null)

  const showPrimarySendButton =
    isTelegramDelivery || forcedTransport === 'internet' || forcedTransport === 'mesh'

  const handlePrimarySend = () => {
    if (isTelegramDelivery) {
      void onTelegramSend?.()
      return
    }
    void onSend()
  }

  const recipientSuggestions = useMemo(() => {
    const set = new Set<string>()
    const connected = Array.isArray(apiStatus?.connectedAddresses) ? apiStatus.connectedAddresses : []
    for (const a of connected) {
      const t = String(a || '').trim()
      if (/^0x[a-fA-F0-9]{64}$/.test(t)) set.add(t)
    }
    const own = String(apiStatus?.myAddress || '').trim()
    if (/^0x[a-fA-F0-9]{64}$/.test(own)) set.add(own)
    if (contactDirectory) {
      for (const key of Object.keys(contactDirectory)) {
        const k = key.trim().toLowerCase()
        if (/^0x[a-f0-9]{64}$/.test(k) || /^tg:-?\d{1,20}$/.test(k)) set.add(k)
      }
    }
    return Array.from(set)
  }, [apiStatus?.connectedAddresses, apiStatus?.myAddress, contactDirectory])

  const telegramContactSuggestions = useMemo(() => {
    const set = new Set<string>()
    if (contactDirectory) {
      for (const entry of Object.values(contactDirectory)) {
        const tid = entry.telegramChatId?.trim()
        if (tid && /^-?\d{1,20}$/.test(tid)) set.add(tid)
      }
    }
    return Array.from(set)
  }, [contactDirectory])

  const messageRef = useRef<HTMLTextAreaElement>(null)

  const insertEmojiIntoMessage = (emoji: string) => {
    const el = messageRef.current
    if (!el) {
      onMessageChange(message + emoji)
      return
    }
    const start = el.selectionStart ?? message.length
    const end = el.selectionEnd ?? message.length
    const next = message.slice(0, start) + emoji + message.slice(end)
    onMessageChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
    })
  }

  const prepareSttDictation = () => {
    const composer = document.getElementById('chat-composer-message') as HTMLTextAreaElement | null
    composer?.focus()
    composer?.click()
    window.alert(
      'Sprach-zu-Text: OS-Diktat jetzt manuell starten.\n\n' +
        'Windows: Win+H manuell drücken\n' +
        'Android: Mikrofon in der Tastaturleiste manuell tippen'
    )
  }


  const loraRetryDetails = useMemo(() => {
    const reason = (loraOnlineFallbackOffer?.reasonLabel || '').toLowerCase()
    const luma = reason.includes('luma') && !reason.includes('chroma') ? 'fehlgeschlagen' : 'ok/gesendet'
    const chroma = reason.includes('chroma') ? 'fehlgeschlagen' : reason.includes('luma') ? 'ausstehend' : 'unklar'
    return { luma, chroma }
  }, [loraOnlineFallbackOffer?.reasonLabel])

  return (
    <div className="rounded-xl border border-border bg-card p-5 md:p-6">
      <div className="space-y-4">
        {showRecipientRow ? (
          <div className="min-h-[4.5rem]">
            {showTelegramField ? (
              <>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Empfänger · Telegram (Chat-ID, mehrere mit Komma)
                </label>
                <input
                  type="text"
                  list="chat-telegram-recipients"
                  value={telegramDraft}
                  onFocus={() => {
                    telegramInputFocused.current = true
                  }}
                  onBlur={() => {
                    telegramInputFocused.current = false
                    onRecipientChange(telegramDraft.trim())
                  }}
                  onChange={(e) => {
                    const raw = e.target.value
                    setTelegramDraft(raw)
                    onRecipientChange(raw)
                  }}
                  placeholder="1156058618, 987654321 — aus Telefonbuch oder @userinfobot"
                  className="w-full rounded-lg border border-border bg-input px-4 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <datalist id="chat-telegram-recipients">
                  {telegramContactSuggestions.map((id) => (
                    <option key={id} value={id} />
                  ))}
                </datalist>
                {composerTelegramIds.length > 1 ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {composerTelegramIds.length} Empfänger — Senden geht an alle.
                  </p>
                ) : null}
              </>
            ) : isPinnwandChannel && pinnwandBroadcastAddress ? null : showIotaField ? (
              <>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Empfänger · Wallet (0x)
                </label>
                <input
                  type="text"
                  list="chat-recipient-addresses"
                  value={composerIotaField}
                  onChange={(e) => {
                    const v = e.target.value.trim().toLowerCase()
                    onPartnerChange?.(v)
                    onRecipientChange(v)
                  }}
                  placeholder="0x…"
                  className="w-full rounded-lg border border-border bg-input px-4 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <datalist id="chat-recipient-addresses">
                  {recipientSuggestions.map((addr) => (
                    <option key={addr} value={addr} />
                  ))}
                </datalist>
                {encrypted && forcedTransport === 'internet' ? (
                  <ChatViewEncryptedRecipientHandshakeBar
                    status={encryptedRecipientHandshakeStatus}
                    sending={sending}
                    myAddress={myAddress}
                    onHandshake={onEncryptedHandshakeForRecipient}
                    onAccept={onEncryptedAcceptHandshakeForRecipient}
                    onPeeringImported={({ address }) => {
                      const v = address.trim().toLowerCase()
                      onPartnerChange?.(v)
                      onRecipientChange(v)
                    }}
                    onPeeringStatus={(m) => onStatusFeedback?.(m)}
                  />
                ) : null}
              </>
            ) : null}
            {!showTelegramField && showMailboxUi && !groupMailboxSendAll ? (
              <div className="mt-2">
                <ChatViewContactSendMailboxSelect
                  recipientWallet={composerIota}
                  contactDirectory={contactDirectory ?? {}}
                  serverMailboxId={apiStatus?.mailboxId}
                  onTargetChange={(_target, resolvedObjectId) =>
                    onComposerMailboxObjectIdChange?.(resolvedObjectId)
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!isTelegramDelivery && !encrypted && forcedTransport === 'mesh' && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={meshPlaintextToNodeEnabled}
                onChange={(e) => onMeshPlaintextToNodeEnabledChange(e.target.checked)}
                className="mt-1 border-border"
              />
              <span>An Node-ID senden (statt „An alle“)</span>
            </label>
            {meshPlaintextToNodeEnabled ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Node-ID</label>
                <input
                  type="text"
                  value={meshPlaintextNodeId}
                  onChange={(e) => onMeshPlaintextNodeIdChange(e.target.value.trim())}
                  placeholder="!1a2b3c4d"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
                  spellCheck={false}
                />
                {meshPlaintextNodeId.trim() && parseMeshtasticNodeIdToNumber(meshPlaintextNodeId) === null ? (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Format: Ausrufezeichen + 1–8 Hex-Ziffern.</p>
                ) : null}
              </div>
            ) : null}
            {showMeshtasticChannelIndexInput ? (
              <div>
                <label htmlFor="chat-mesh-channel-index" className="mb-1 block text-xs font-medium text-foreground">
                  Kanalindex (0–7, optional)
                </label>
                <input
                  id="chat-mesh-channel-index"
                  type="number"
                  min={MESHTASTIC_CHANNEL_INDEX_MIN}
                  max={MESHTASTIC_CHANNEL_INDEX_MAX}
                  step={1}
                  value={meshtasticChannelIndex ?? ''}
                  onChange={(e) => {
                    onMeshtasticChannelIndexChange?.(normalizeMeshtasticChannelIndex(e.target.value))
                  }}
                  placeholder="leer = Primary"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
                  inputMode="numeric"
                />
              </div>
            ) : null}
          </div>
        )}

        <div
          onDragEnter={onComposerDragEnter}
          onDragLeave={onComposerDragLeave}
          onDragOver={onComposerDragOver}
          onDrop={onComposerDrop}
          className={cn(
            'touch-pan-y rounded-xl border border-transparent p-2 transition-colors',
            dropHover && !dropDisabled && 'border-primary/50 bg-primary/5 ring-2 ring-primary/25'
          )}
        >
          <label htmlFor="chat-composer-message" className="mb-2 block text-sm font-medium text-foreground">
            Nachricht
          </label>
          <ChatViewAttachmentBar
            {...attachmentBarProps}
            sending={sending}
            pickDisabled={voiceLocksComposer}
            trailingActions={
              isPrivate ? (
                <>
                  {(forcedTransport === 'internet' || forcedTransport === 'mesh' || isTelegramDelivery) && (
                    <button
                      type="button"
                      disabled={sending || voiceLocksComposer || telegramBusy}
                      onClick={prepareSttDictation}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 disabled:opacity-50"
                      title="Sprach-zu-Text über Betriebssystem-Diktat"
                    >
                      STT diktieren
                    </button>
                  )}
                  {forcedTransport === 'internet' && !isTelegramDelivery ? (
                    <ChatViewVoiceRecord
                      slot="normal"
                      density="compact"
                      activeKind={voiceActiveKind}
                      phase={voicePhase}
                      progress01={voiceProgress01}
                      maxSeconds={voiceMaxSeconds}
                      normalIsOnline
                      onToggle={onVoiceToggle}
                      blockedStart={voiceNormalBlockedStart}
                    />
                  ) : null}
                  <ChatComposerEmojiPicker onPick={insertEmojiIntoMessage} disabled={sending} compact />
                  {onOpenPhonebook ? (
                    <button
                      type="button"
                      disabled={sending || voiceLocksComposer}
                      onClick={onOpenPhonebook}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 disabled:opacity-50"
                      title="Telefonbuch"
                    >
                      <BookUser className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Telefonbuch
                    </button>
                  ) : null}
                  {showPath4Checkbox && forcedTransport === 'mesh' && !isTelegramDelivery ? (
                    <label
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-950/20 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-950/35"
                      title="LoRa sofort senden und später eigene Kopie auf IOTA verankern"
                    >
                      <input
                        type="checkbox"
                        checked={meshSelfArchiveAfterLoRa}
                        onChange={(e) => onMeshSelfArchiveAfterLoRaChange(e.target.checked)}
                        data-testid="mesh-path4-self-archive"
                        className="border-border"
                      />
                      Pfad 4
                    </label>
                  ) : null}
                </>
              ) : null
            }
          />
          <ChatViewEncryptionContextHint
            forcedTransport={forcedTransport}
            encrypted={encrypted}
            className="mb-2"
          />
          {!isTelegramDelivery &&
          forcedTransport === 'internet' &&
          (showMailboxUi || groupMailboxSendAll) ? (
            <ChatViewChainPersistenceBadge
              mode={messagingPersistenceMode}
              encrypted={encrypted}
              className="mb-2"
            />
          ) : null}
          {!encrypted && forcedTransport === 'mesh' && (
            <div className="mb-2 rounded-md border border-orange-600/45 bg-orange-950/35 px-3 py-2 text-xs tabular-nums text-orange-50">
              <span className="font-semibold">Klartext-Funk</span> · {[...message].length}/{MESH_PLAINTEXT_MAX_CHARS}{' '}
              Zeichen
              {attachmentBarProps.attachedBlobBase64 ||
              attachmentBarProps.attachedAudioBase64 ||
              attachmentBarProps.attachedTxtFile != null ||
              attachmentBarProps.attachedLora != null
                ? ' · keine Anhänge'
                : null}
            </div>
          )}
          <textarea
            ref={messageRef}
            id="chat-composer-message"
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder={MESSAGE_PLACEHOLDER}
            rows={6}
            className={cn(
              'min-h-[9.5rem] w-full resize-y rounded-lg border bg-input px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              !encrypted &&
                forcedTransport === 'mesh' &&
                [...message].length > MESH_PLAINTEXT_MAX_CHARS
                ? 'border-red-500/70 ring-1 ring-red-500/30'
                : 'border-border'
            )}
          />
        </div>

        {loraOnlineFallbackOffer ? (
          <div className="mb-3 rounded-lg border border-amber-600/45 bg-amber-950/30 p-3 space-y-2 dark:bg-amber-950/20">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
              Funk (LoRa/Mesh) hat nicht gesendet
            </p>
            <p className="text-xs text-amber-900/85 dark:text-amber-100/90">{loraOnlineFallbackOffer.reasonLabel}</p>
            <p className="text-xs text-muted-foreground">
              Ohne deine ausdrückliche Zustimmung wird <strong className="text-foreground">nicht</strong> auf
              Internet/IOTA gewechselt. Erst der untere Button sendet LUMA+CHROMA als zwei Online-Nachrichten.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={sending}
                onClick={() => void onSend()}
                className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Fehlende Teile nochmal senden
              </button>
              <button
                type="button"
                disabled={sending || apiStatus?.locked}
                onClick={() => void onConfirmLoraOnline()}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trotzdem über Online (IOTA) senden
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={onDismissLoraOnlineFallback}
                className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => setShowLoraChunkDetails((v) => !v)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {showLoraChunkDetails ? 'Details ausblenden' : 'Details'}
              </button>
            </div>
            {showLoraChunkDetails ? (
              <div className="rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Chunk-Status (heuristisch)</div>
                <div className="mt-1 font-mono">LUMA: {loraRetryDetails.luma}</div>
                <div className="font-mono">CHROMA: {loraRetryDetails.chroma}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {isPrivate && offlineMailboxQueuePending > 0 ? (
          <div
            className={cn(
              'mb-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs',
              !sessionKeysReady || vaultLocked || /tresor gesperrt/i.test(offlineMailboxQueueErrorHint)
                ? 'border-red-500/45 bg-red-950/25 text-red-950 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-50'
                : 'border-amber-600/45 bg-amber-950/25 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-50'
            )}
            role="status"
            aria-live="polite"
          >
            <span
              className={cn(
                'inline-flex items-center gap-1.5 font-semibold',
                !sessionKeysReady || vaultLocked || /tresor gesperrt/i.test(offlineMailboxQueueErrorHint)
                  ? 'text-red-900 dark:text-red-100'
                  : 'text-amber-900 dark:text-amber-100'
              )}
            >
              <ListOrdered className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Mailbox-Warteschlange
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums',
                !sessionKeysReady || vaultLocked || /tresor gesperrt/i.test(offlineMailboxQueueErrorHint)
                  ? 'bg-red-600/90 dark:bg-red-500/90'
                  : 'bg-amber-600/90 dark:bg-amber-500/90'
              )}
              title="Lokal zwischengespeicherte Sendeversuche (Opt-in: localStorage morgendrot.offlineMailboxQueue = 1)"
            >
              {offlineMailboxQueuePending}
            </span>
            {!sessionKeysReady || vaultLocked || /tresor gesperrt/i.test(offlineMailboxQueueErrorHint) ? (
              <span className="w-full leading-snug text-red-900/95 dark:text-red-100/95">
                {!sessionKeysReady || vaultLocked ? (
                  <>
                    <strong className="font-semibold">Schlüssel nicht in der Sitzung</strong> — die Basis kann nicht
                    signieren (Badge: „Tresor: Keys fehlen“ oder „gesperrt“). Startseite →{' '}
                    <strong>Tresor entsperren</strong>, dann „Aktualisieren“ oder „Warteschlange leeren“.
                  </>
                ) : (
                  <>
                    Letzter Fehler: <span className="font-mono">{offlineMailboxQueueErrorHint}</span> — vermutlich
                    veraltet. <strong>Tresor entsperren</strong>, dann „Aktualisieren“ oder Warteschlange leeren.
                  </>
                )}
              </span>
            ) : (
              <span className="text-amber-900/90 dark:text-amber-100/90">
                {offlineMailboxQueuePending === 1
                  ? 'Eine Nachricht wartet auf die Basis — wird mit dem Status-Takt erneut versucht.'
                  : `${offlineMailboxQueuePending} Nachrichten warten auf die Basis — werden mit dem Status-Takt erneut versucht.`}
              </span>
            )}
            {offlineMailboxQueueUntrustedTimeCount > 0 ? (
              <span className="w-full text-[11px] leading-snug text-amber-900/85 dark:text-amber-100/85">
                Bei {offlineMailboxQueueUntrustedTimeCount}{' '}
                {offlineMailboxQueueUntrustedTimeCount === 1 ? 'Eintrag' : 'Einträgen'} war die Gerätezeit beim
                Einreihen nicht verifiziert (§ H.6c — weder frischer Server-Zeitstempel noch GPS-UTC); für spätere
                Attestation/Export gespeichert als <span className="font-mono">timeIsTrusted: false</span>.
              </span>
            ) : null}
            {offlineMailboxQueueBackoffCount > 0 &&
            !(
              !sessionKeysReady ||
              vaultLocked ||
              /tresor gesperrt/i.test(offlineMailboxQueueErrorHint)
            ) ? (
              <span className="w-full text-[11px] leading-snug text-amber-900/85 dark:text-amber-100/85">
                {offlineMailboxQueueBackoffCount === 1
                  ? '1 Eintrag wartet im Backoff-Zeitfenster vor dem nächsten Versuch.'
                  : `${offlineMailboxQueueBackoffCount} Einträge warten im Backoff vor dem nächsten Versuch.`}
              </span>
            ) : null}
            {offlineMailboxQueueErrorHint ? (
              <span
                className="w-full font-mono text-[10px] leading-snug text-amber-900/80 dark:text-amber-100/80"
                title="Letzte gespeicherte Fehlermeldung aus einem Warteschlangen-Versuch"
              >
                Letzte Meldung: {offlineMailboxQueueErrorHint}
              </span>
            ) : null}
            {(!sessionKeysReady || vaultLocked) && onNavigateHomeWhenLocked ? (
              <button
                type="button"
                onClick={onNavigateHomeWhenLocked}
                className="inline-flex items-center gap-1 rounded-md border border-red-700/50 bg-red-100/80 px-2 py-1 text-[11px] font-semibold text-red-950 hover:bg-red-100 dark:border-red-400/40 dark:bg-red-900/50 dark:text-red-50"
              >
                Tresor entsperren
              </button>
            ) : null}
            {onManualRefresh ? (
              <button
                type="button"
                onClick={() => void onManualRefresh()}
                className="inline-flex items-center gap-1 rounded-md border border-amber-700/40 bg-amber-100/70 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-300/30 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/55"
                title="Status neu holen und Warteschlangen sofort erneut anstoßen"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Aktualisieren
              </button>
            ) : null}
            {onRemoveOfflineMailboxQueueItems && offlineMailboxQueueItems.length > 0 ? (
              <button
                type="button"
                onClick={() => onRemoveOfflineMailboxQueueItems(offlineMailboxQueueItems.map((q) => q.id))}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted"
              >
                Warteschlange leeren
              </button>
            ) : null}
            {offlineMailboxQueueItems.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowQueueItems((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-700/40 bg-amber-100/70 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-300/30 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/55"
                >
                  {showQueueItems ? 'Auswahl schließen' : 'Einträge auswählen'}
                </button>
                {showQueueItems ? (
                  <div className="w-full rounded-md border border-amber-700/30 bg-amber-100/40 p-2 text-[11px] dark:bg-amber-900/30">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedQueueIds(offlineMailboxQueueItems.map((q) => q.id))}
                        className="rounded border border-amber-700/35 px-2 py-1"
                      >
                        Alle
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedQueueIds([])}
                        className="rounded border border-amber-700/35 px-2 py-1"
                      >
                        Keine
                      </button>
                      <button
                        type="button"
                        disabled={selectedQueueIds.length === 0 || !onRemoveOfflineMailboxQueueItems}
                        onClick={() => {
                          onRemoveOfflineMailboxQueueItems?.(selectedQueueIds)
                          setSelectedQueueIds([])
                        }}
                        className="rounded border border-red-700/40 bg-red-100/70 px-2 py-1 font-medium text-red-900 disabled:opacity-50 dark:bg-red-900/35 dark:text-red-100"
                      >
                        Ausgewählte löschen
                      </button>
                    </div>
                    <div className="max-h-40 space-y-1 overflow-auto">
                      {offlineMailboxQueueItems.map((q) => (
                        <label key={q.id} className="flex items-start gap-2 rounded border border-amber-700/20 px-2 py-1">
                          <input
                            type="checkbox"
                            checked={selectedQueueIds.includes(q.id)}
                            onChange={(e) =>
                              setSelectedQueueIds((prev) =>
                                e.target.checked ? [...prev, q.id] : prev.filter((id) => id !== q.id)
                              )
                            }
                          />
                          <span className="font-mono">
                            {new Date(q.createdAt).toLocaleTimeString()} · {q.recipient.slice(0, 10)}… · tries:{q.attempts}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {showPrimarySendButton ? (
              <button
                type="button"
                onClick={handlePrimarySend}
                disabled={primarySendDisabled}
                data-testid="chat-composer-primary-send"
                className={cn(
                  'flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed',
                  primarySendReady && !primarySendDisabled
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/35 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400'
                    : primarySendDisabled
                      ? 'bg-muted text-muted-foreground opacity-50'
                      : isTelegramDelivery
                        ? 'bg-sky-600/80 text-white hover:bg-sky-600/90'
                        : 'border border-border bg-muted/80 text-muted-foreground hover:bg-muted'
                )}
                title={
                  isTelegramDelivery
                    ? 'Telegram-Hinweis senden'
                    : primarySendDisabled && sendDisableReason
                      ? sendDisableReason
                      : encryptedOnlineSendBlocked
                        ? encryptedHandshakeStatusLabel(encryptedRecipientHandshakeStatus)
                        : forcedTransport === 'internet' && !onlineConnected
                          ? 'Online-Verbindung derzeit nicht bestätigt'
                          : undefined
                }
              >
                {sending || telegramBusy ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending || telegramBusy ? 'Wird gesendet…' : 'Senden'}
              </button>
            ) : null}
            {primarySendDisabled && sendDisableReason && !sending && !telegramBusy ? (
              <p className="w-full text-xs text-amber-800 dark:text-amber-200" role="status">
                Senden blockiert: {sendDisableReason}
              </p>
            ) : null}
            {encryptedOnlineSendBlocked && !primarySendDisabled ? (
              <p className="w-full text-xs text-amber-800 dark:text-amber-200" role="status">
                {encryptedHandshakeStatusLabel(encryptedRecipientHandshakeStatus)}
              </p>
            ) : null}
            {canOfferSosText && !isTelegramDelivery ? (
              <button
                type="button"
                disabled={sending}
                title="SOS — Hilferuf (Text), MORG_EMERGENCY_V1. Kein automatischer 112-Ruf."
                onClick={() => {
                  if (!message.trim()) {
                    prepareSttDictation()
                    return
                  }
                  if (
                    !window.confirm(
                      'Echten Hilferuf (SOS) senden?\n\n' +
                        'Die Nachricht geht an deinen Chat-Empfänger (Funk oder Online — wie eingestellt), mit Notfall-Kennzeichnung MORG_EMERGENCY_V1. ' +
                        'Kein automatischer 112-Ruf.\n\n' +
                        'Nur nutzen, wenn wirklich Hilfe nötig ist.'
                    )
                  ) {
                    return
                  }
                  void onSend({ emergencyWire: 'text' })
                }}
                className="rounded-lg border-2 border-red-600/70 bg-red-600/95 px-3 py-2 text-xs font-bold tracking-tight text-white shadow-sm transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                SOS — Hilferuf
              </button>
            ) : null}
            {sending ? (
              <button
                type="button"
                onClick={onCancelSend}
                data-testid="chat-composer-cancel-send"
                className="rounded-lg border border-border bg-background px-4 py-2.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Übertragung abbrechen
              </button>
            ) : null}
          </div>

          <div
            className="min-h-[2.5rem] w-full text-sm leading-snug"
            aria-live="polite"
            aria-atomic="true"
            data-testid="chat-composer-send-status"
          >
            {status !== 'idle' ? (
              <p
                className={cn(
                  'flex items-start gap-1.5 font-medium',
                  status === 'success' ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {status === 'success' ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 break-words">{statusMsg}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
