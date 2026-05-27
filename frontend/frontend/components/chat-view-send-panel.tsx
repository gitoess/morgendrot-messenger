'use client'

/**
 * Composer: Empfänger (Klartext), Anhänge, Text, LoRa→Online-Fallback-Banner, Senden + Status.
 * Sendelogik bleibt im Hook (`useChatViewSendFlow`); dieses Panel ist reine Orchestrierung der bestehenden UI-Blöcke.
 */

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { AlertCircle, Check, ListOrdered, RefreshCw, Send } from 'lucide-react'
import { ChatComposerEmojiPicker } from '@/frontend/components/chat-composer-emoji-picker'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { notifyTelegramContact } from '@/frontend/lib/api/telegram-notify'
import {
  resolveComposerIotaAddress,
  resolveComposerIotaFieldValue,
  resolveComposerTelegramChatId,
} from '@/frontend/lib/composer-recipient-fields'
import {
  buildTelegramMessagePreview,
  normalizeTelegramRecipientInput,
  readTelegramNotifyOnSend,
  resolveTelegramNotifyRecipientAddress,
  writeTelegramNotifyOnSend,
} from '@/frontend/lib/telegram-notify-pref'
import { ChatViewAttachmentBar } from '@/frontend/components/chat-view-attachment-bar'
import { ChatViewVoiceRecord } from '@/frontend/components/chat-view-voice-record'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'
import { ChatViewContactSendMailboxSelect } from '@/frontend/components/chat-view-contact-send-mailbox-select'
import { readMessagingPersistenceModeFromStorage } from '@/frontend/lib/messaging-persistence-mode'
import {
  CHAT_PATH4_SELF_ARCHIVE_HINT,
  CHAT_SIMPLE_LORA_ARCHIV_HINT,
  isLoRaMeshTransport,
  MESH_PLAINTEXT_MAX_CHARS,
} from '@/frontend/lib/chat-view-messenger-transport'
import { parseMeshtasticNodeIdToNumber } from '@/frontend/lib/meshtastic-node-id'
import type {
  AttachmentBarPort,
  ComposerDraftPort,
  SendMeshMirrorDelayPort,
  SendTransportReadPort,
  VoiceRecordSendPanelPort,
} from '@/frontend/features/messenger-ports'
import type { ChatSendHandleOptions } from '@/frontend/features/send/chat-send-handle-options'
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
  /** Nach erfolgreichem Nur-Telegram-Send: Zeile im Posteingang/Ausgang. */
  onTelegramDelivered?: (payload: { recipientKey: string; text: string }) => void
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
  /** Manueller Status-/Drain-Impuls nach Netzwechsel, ohne kompletten Seitenreload. */
  onManualRefresh?: () => void | Promise<void>
  /** M4b: Kontaktverzeichnis für Mailbox-Routing-Hinweis */
  contactDirectory?: Record<string, ContactMeshEntryClient>
  /** Gruppenkanal: Hinweis zu pairwise Mailbox-Multicast */
  isGroupChannel?: boolean
  groupMailboxSendAll?: boolean
  groupMemberCount?: number
  /** Expert: Pfad-4-Checkbox; Simple Mode: nur Hinweistext. */
  showPath4Checkbox?: boolean
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
    onTelegramDelivered,
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
    onManualRefresh,
    contactDirectory = {},
    isGroupChannel = false,
    groupMailboxSendAll = false,
    groupMemberCount = 0,
    showPath4Checkbox = true,
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
  const [telegramNotifyOnSend, setTelegramNotifyOnSend] = useState(false)
  const [telegramOnlyBusy, setTelegramOnlyBusy] = useState(false)

  useEffect(() => {
    setTelegramNotifyOnSend(readTelegramNotifyOnSend())
  }, [])
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

  /** Klartext: 0x nötig außer Funk-Broadcast bzw. gültiger Node-ID bei „an Node-ID“. */
  const meshKlartextRecipientOk =
    encrypted ||
    recipient.trim().length > 0 ||
    (forcedTransport === 'mesh' &&
      (!meshPlaintextToNodeEnabled || parseMeshtasticNodeIdToNumber(meshPlaintextNodeId) !== null))

  const sendDisabled =
    sending ||
    loraOnlineFallbackOffer != null ||
    hasNoPayload ||
    (!encrypted && !meshKlartextRecipientOk) ||
    meshPlaintextBlocked ||
    meshPath4Blocked

  const canOfferSosText =
    (forcedTransport === 'mesh' || forcedTransport === 'internet') &&
    !attachmentBarProps.attachedBlobBase64 &&
    !attachmentBarProps.attachedAudioBase64 &&
    !attachmentBarProps.attachedTxtFile &&
    !attachmentBarProps.attachedLora &&
    loraOnlineFallbackOffer == null
  const onlineConnected = !!apiStatus?.connected
  const persistenceMode = readMessagingPersistenceModeFromStorage()

  const composerIota = useMemo(
    () => resolveComposerIotaAddress(recipient, partner ?? '', encrypted),
    [recipient, partner, encrypted]
  )

  const routedMailboxId = useMemo(
    () => resolveOutboundMailboxObjectId(contactDirectory, composerIota || recipient.trim()),
    [contactDirectory, recipient, composerIota]
  )

  const composerIotaField = useMemo(
    () => resolveComposerIotaFieldValue(recipient, partner ?? '', encrypted),
    [recipient, partner, encrypted]
  )

  const composerTelegramId = useMemo(
    () => resolveComposerTelegramChatId(recipient, contactDirectory, composerIota),
    [recipient, contactDirectory, composerIota]
  )

  const notifyRecipientAddr = useMemo(() => {
    const resolved = resolveTelegramNotifyRecipientAddress({
      recipient,
      partner,
      encrypted,
      connectedAddresses: apiStatus?.connectedAddresses,
    })
    if (resolved) return resolved
    if (/^-?\d{1,20}$/.test(composerTelegramId)) return `tg:${composerTelegramId}`
    return null
  }, [recipient, partner, encrypted, apiStatus?.connectedAddresses, composerTelegramId])

  const recipientHasTelegram = useMemo(() => {
    if (!notifyRecipientAddr) return false
    if (notifyRecipientAddr.startsWith('tg:')) return true
    return Boolean(contactDirectory?.[notifyRecipientAddr]?.telegramChatId?.trim())
  }, [contactDirectory, notifyRecipientAddr])

  const telegramPreview = useMemo(
    () =>
      buildTelegramMessagePreview({
        message,
        attachedTxtFile: attachmentBarProps.attachedTxtFile,
        attachedBlobBase64: attachmentBarProps.attachedBlobBase64,
        attachedAudioBase64: attachmentBarProps.attachedAudioBase64,
        hasLoraAttachment: attachmentBarProps.attachedLora != null,
      }),
    [
      message,
      attachmentBarProps.attachedTxtFile,
      attachmentBarProps.attachedBlobBase64,
      attachmentBarProps.attachedAudioBase64,
      attachmentBarProps.attachedLora,
    ]
  )

  const canSendTelegramOnly =
    isPrivate &&
    recipientHasTelegram &&
    !telegramOnlyBusy &&
    !sending &&
    Boolean(telegramPreview.trim()) &&
    !apiStatus?.locked

  const handleTelegramOnly = async () => {
    if (!notifyRecipientAddr || !onStatusFeedback) return
    setTelegramOnlyBusy(true)
    onStatusFeedback('Sende Telegram-Hinweis…', 'idle')
    const myLabel =
      contactDirectory[myAddress.trim().toLowerCase()]?.label ||
      (myAddress.trim() ? `${myAddress.trim().slice(0, 10)}…` : 'Morgendrot')
    const r = await notifyTelegramContact({
      recipientAddress: notifyRecipientAddr,
      messagePreview: telegramPreview,
      senderLabel: myLabel,
    })
    if (r.delivered) {
      onTelegramDelivered?.({
        recipientKey: notifyRecipientAddr,
        text: telegramPreview,
      })
      onMessageChange('')
      attachmentBarProps.clearCompactAttachment()
      onStatusFeedback('Telegram gesendet — siehe Ausgang im Posteingang.', 'success')
    } else if (r.skipped) {
      onStatusFeedback(`Telegram: ${r.skipped}`, 'error')
    } else {
      onStatusFeedback(r.error || 'Telegram-Hinweis fehlgeschlagen', 'error')
    }
    setTelegramOnlyBusy(false)
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
        {(isPrivate || !encrypted) && (
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">Empfänger (Telefonbuch oder manuell)</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  IOTA-Adresse (0x + 64 Hex)
                </label>
                <input
                  type="text"
                  list="chat-recipient-addresses"
                  value={composerIotaField}
                  onChange={(e) => {
                    const v = e.target.value.trim().toLowerCase()
                    onPartnerChange?.(v)
                    const tgOnly = recipient.trim().toLowerCase().startsWith('tg:')
                    if (!tgOnly || v) onRecipientChange(v)
                  }}
                  placeholder="0x… — Online / verschlüsselt"
                  className="w-full rounded-lg border border-border bg-input px-4 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Telegram Chat-ID</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={composerTelegramId}
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    if (raw === '') {
                      if (recipient.trim().toLowerCase().startsWith('tg:')) {
                        onRecipientChange(composerIota)
                      }
                      return
                    }
                    if (!/^-?\d{0,20}$/.test(raw)) return
                    if (/^-?\d{1,20}$/.test(raw)) {
                      onRecipientChange(normalizeTelegramRecipientInput(raw))
                    }
                  }}
                  placeholder="Zahl von @userinfobot — für „Nur Telegram senden“"
                  className="w-full rounded-lg border border-border bg-input px-4 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <datalist id="chat-recipient-addresses">
              {recipientSuggestions.map((addr) => (
                <option key={addr} value={addr} />
              ))}
            </datalist>
            {isGroupChannel && persistenceMode === 'mailbox' ? (
              <p className="mt-2 text-[10px] text-muted-foreground">
                {groupMailboxSendAll ? (
                  <>
                    Gruppe + Persistent: Senden geht{' '}
                    <strong className="text-foreground">pairwise</strong> an{' '}
                    {groupMemberCount > 0 ? `${groupMemberCount} Mitglieder` : 'alle gespeicherten Mitglieder'} (
                    {groupMemberCount}× Chain-Fee). Umschalter im Gruppen-Panel.
                  </>
                ) : (
                  <>
                    Gruppe: nur die <strong className="text-foreground">0x im Composer</strong> (ein Mitglied). „An alle“
                    im Gruppen-Panel aktivieren.
                  </>
                )}
              </p>
            ) : null}
            {/^0x[a-fA-F0-9]{64}$/i.test(composerIota) && !groupMailboxSendAll ? (
              <ChatViewContactSendMailboxSelect
                className="mt-2"
                recipientWallet={composerIota}
                contactDirectory={contactDirectory}
                serverMailboxId={apiStatus?.mailboxId}
              />
            ) : null}
            {routedMailboxId && persistenceMode === 'mailbox' ? (
              <p className="mt-1.5 text-[11px] text-violet-800 dark:text-violet-200">
                On-chain Postfach:{' '}
                <span className="font-mono text-[10px]">
                  {routedMailboxId.slice(0, 10)}…{routedMailboxId.slice(-6)}
                </span>
                {' '}
                (Empfänger-Wallet{' '}
                <strong className="font-mono">{maskWalletAddress(composerIota || recipient.trim(), 10, 6)}</strong>)
              </p>
            ) : persistenceMode === 'mailbox' ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Empfänger = <strong className="text-foreground">Wallet 0x</strong>. Ziel-Postfach wählbar, sobald im
                Telefonbuch Mailbox-IDs hinterlegt sind.
              </p>
            ) : null}
          </div>
        )}

        {isPrivate ? (
          <div className="space-y-2 rounded-lg border border-border/80 bg-muted/15 px-3 py-3">
            <div className="min-w-0 text-xs">
              <p className="font-medium text-foreground">Telegram an Kontakt</p>
              <p className="mt-1 text-muted-foreground">
                {recipientHasTelegram
                  ? 'Ausgang erscheint im Posteingang (Filter „Ausgang“). Eingehende Telegram-Antworten nur mit Bot-Webhook (öffentliche URL → /api/integrations/telegram/webhook).'
                  : 'Telefonbuch antippen oder Chat-ID oben eintragen.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canSendTelegramOnly || !onStatusFeedback}
                onClick={() => void handleTelegramOnly()}
                className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-600/90 disabled:opacity-50 dark:bg-sky-500"
                title="Nur Telegram — ohne IOTA/Mailbox/LoRa"
              >
                {telegramOnlyBusy ? 'Sende…' : 'Nur Telegram senden'}
              </button>
            </div>
            {forcedTransport === 'internet' ? (
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
                <span className="text-xs text-foreground">Zusätzlich nach Online-Send (IOTA)</span>
                <Switch
                  checked={telegramNotifyOnSend}
                  onCheckedChange={(on) => {
                    writeTelegramNotifyOnSend(on)
                    setTelegramNotifyOnSend(on)
                  }}
                  aria-label="Telegram-Hinweis zusätzlich nach IOTA-Send"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!encrypted && forcedTransport === 'mesh' && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-foreground">Meshtastic-Klartext (LongFast / Text)</p>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={meshPlaintextToNodeEnabled}
                onChange={(e) => onMeshPlaintextToNodeEnabledChange(e.target.checked)}
                className="mt-1 border-border"
              />
              <span>An Node-ID senden (statt Broadcast)</span>
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
          </div>
        )}

        {forcedTransport === 'mesh' && isPrivate ? (
          showPath4Checkbox ? (
            <div className="rounded-lg border border-emerald-600/35 bg-emerald-950/15 p-3 dark:bg-emerald-950/20">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={meshSelfArchiveAfterLoRa}
                  onChange={(e) => onMeshSelfArchiveAfterLoRaChange(e.target.checked)}
                  data-testid="mesh-path4-self-archive"
                  className="mt-0.5 border-border"
                />
                <span className="font-medium">LoRa + eigene Verankerung (Pfad 4)</span>
              </label>
              <p className="mt-2 text-[11px] leading-relaxed text-emerald-100/90">{CHAT_PATH4_SELF_ARCHIVE_HINT}</p>
            </div>
          ) : (
            <p className="rounded-lg border border-emerald-600/30 bg-emerald-950/10 px-3 py-2 text-[11px] leading-relaxed text-emerald-100/90">
              {CHAT_SIMPLE_LORA_ARCHIV_HINT}
            </p>
          )
        ) : null}

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
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="chat-composer-message" className="text-sm font-medium text-foreground">
              Nachricht
            </label>
            {isPrivate ? (
              <ChatComposerEmojiPicker onPick={insertEmojiIntoMessage} disabled={sending} />
            ) : null}
          </div>
          <ChatViewAttachmentBar
            {...attachmentBarProps}
            sending={sending}
            pickDisabled={voiceLocksComposer}
          />
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
            className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-600/45 bg-amber-950/25 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-50"
            role="status"
            aria-live="polite"
          >
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-100">
              <ListOrdered className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Mailbox-Warteschlange
            </span>
            <span
              className="rounded-full bg-amber-600/90 px-2 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums dark:bg-amber-500/90"
              title="Lokal zwischengespeicherte Sendeversuche (Opt-in: localStorage morgendrot.offlineMailboxQueue = 1)"
            >
              {offlineMailboxQueuePending}
            </span>
            <span className="text-amber-900/90 dark:text-amber-100/90">
              {offlineMailboxQueuePending === 1
                ? 'Eine Nachricht wartet auf die Basis — wird mit dem Status-Takt erneut versucht.'
                : `${offlineMailboxQueuePending} Nachrichten warten auf die Basis — werden mit dem Status-Takt erneut versucht.`}
            </span>
            {offlineMailboxQueueUntrustedTimeCount > 0 ? (
              <span className="w-full text-[11px] leading-snug text-amber-900/85 dark:text-amber-100/85">
                Bei {offlineMailboxQueueUntrustedTimeCount}{' '}
                {offlineMailboxQueueUntrustedTimeCount === 1 ? 'Eintrag' : 'Einträgen'} war die Gerätezeit beim
                Einreihen nicht verifiziert (§ H.6c — weder frischer Server-Zeitstempel noch GPS-UTC); für spätere
                Attestation/Export gespeichert als <span className="font-mono">timeIsTrusted: false</span>.
              </span>
            ) : null}
            {offlineMailboxQueueBackoffCount > 0 ? (
              <span className="w-full text-[11px] leading-snug text-amber-900/85 dark:text-amber-100/85">
                {offlineMailboxQueueBackoffCount === 1
                  ? '1 Eintrag wartet im Backoff-Zeitfenster vor dem nächsten Versuch (exponentielles Warten — SYNC §8.1).'
                  : `${offlineMailboxQueueBackoffCount} Einträge warten im Backoff vor dem nächsten Versuch (SYNC §8.1).`}
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
            {forcedTransport === 'internet' && onlineConnected ? (
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={sendDisabled}
                data-testid="chat-composer-primary-send"
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? 'Wird gesendet…' : 'Online senden (IOTA)'}
              </button>
            ) : forcedTransport === 'internet' ? (
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={sendDisabled}
                data-testid="chat-composer-primary-send"
                className="flex items-center gap-2 rounded-lg border border-border bg-muted px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
                title={onlineConnected ? 'Online-Verbindung aktiv' : 'Online-Verbindung derzeit nicht bestätigt'}
              >
                <Send className="h-4 w-4" />
                Online senden (IOTA)
              </button>
            ) : forcedTransport === 'mesh' ? (
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={sendDisabled}
                data-testid="chat-composer-primary-send"
                className="flex items-center gap-2 rounded-lg border border-sky-700/70 bg-sky-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-300/40 dark:bg-sky-700 dark:hover:bg-sky-600"
              >
                {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Wird gesendet…' : attachmentBarProps.attachedLora != null ? 'Für LoRa senden' : 'LoRa senden'}
              </button>
            ) : null}
            {canOfferSosText ? (
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
            {forcedTransport === 'internet' || forcedTransport === 'mesh' ? (
              <button
                type="button"
                disabled={sending || voiceLocksComposer}
                onClick={prepareSttDictation}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                title="Sprach-zu-Text ueber Betriebssystem-Diktat in das Nachrichtenfeld"
              >
                STT diktieren
              </button>
            ) : null}
            {forcedTransport === 'internet' ? (
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
