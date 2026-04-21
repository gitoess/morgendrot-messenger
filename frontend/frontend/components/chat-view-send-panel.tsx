'use client'

/**
 * Composer: Empfänger (Klartext), Anhänge, Text, LoRa→Online-Fallback-Banner, Senden + Status.
 * Sendelogik bleibt im Hook (`useChatViewSendFlow`); dieses Panel ist reine Orchestrierung der bestehenden UI-Blöcke.
 */

import { useMemo, useRef, useState, type DragEvent } from 'react'
import { AlertCircle, Check, ListOrdered, RefreshCw, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatViewAttachmentBar } from '@/frontend/components/chat-view-attachment-bar'
import { ChatViewVoiceRecord } from '@/frontend/components/chat-view-voice-record'
import type { ApiStatus } from '@/frontend/lib/api'
import {
  CHAT_PATH4_SELF_ARCHIVE_HINT,
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

  const prepareSosDictation = () => {
    const composer = document.getElementById('chat-composer-message') as HTMLTextAreaElement | null
    composer?.focus()
    composer?.click()
    window.alert(
      'Einsatzmodus SOS-Text: OS-Diktat jetzt manuell starten.\n\n' +
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
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="space-y-4">
        {!encrypted && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Empfänger-Adresse</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => onRecipientChange(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}

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

        {forcedTransport === 'mesh' && isPrivate && (
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
        )}

        <div
          onDragEnter={onComposerDragEnter}
          onDragLeave={onComposerDragLeave}
          onDragOver={onComposerDragOver}
          onDrop={onComposerDrop}
          className={cn(
            'touch-pan-y rounded-xl border border-transparent p-1 transition-colors',
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
            id="chat-composer-message"
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder={MESSAGE_PLACEHOLDER}
            rows={3}
            className={cn(
              'w-full resize-none rounded-lg border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
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
                    prepareSosDictation()
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

          {status !== 'idle' && (
            <span
              className={cn(
                'flex min-w-0 items-center gap-1.5 text-sm font-medium',
                status === 'success' ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {status === 'success' ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="min-w-0 break-words">{statusMsg}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
