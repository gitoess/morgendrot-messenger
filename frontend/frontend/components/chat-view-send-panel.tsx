'use client'

/**
 * Composer: Empfänger (Klartext), Anhänge, Text, LoRa→Online-Fallback-Banner, Senden + Status.
 * Sendelogik bleibt im Hook (`useChatViewSendFlow`); dieses Panel ist reine Orchestrierung der bestehenden UI-Blöcke.
 */

import { useRef, useState, type DragEvent } from 'react'
import { AlertCircle, Check, RefreshCw, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatViewAttachmentBar } from '@/frontend/components/chat-view-attachment-bar'
import { ChatViewVoiceRecord } from '@/frontend/components/chat-view-voice-record'
import type { ApiStatus } from '@/frontend/lib/api'
import { isLoRaMeshTransport, MESH_PLAINTEXT_MAX_CHARS } from '@/frontend/lib/chat-view-messenger-transport'
import type {
  AttachmentBarPort,
  ComposerDraftPort,
  SendMeshMirrorDelayPort,
  SendTransportReadPort,
  VoiceRecordSendPanelPort,
} from '@/frontend/features/messenger-ports'
import type { ChatSendHandleOptions } from '@/frontend/features/send/chat-send-handle-options'

const MESSAGE_PLACEHOLDER = 'Optional: Unterschrift zu Bild/.txt oder normaler Text …'

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
  status: 'idle' | 'success' | 'error'
  statusMsg: string
}

export function ChatViewSendPanel(p: ChatViewSendPanelProps) {
  const {
    isPrivate,
    delayMirrorToIota,
    onDelayMirrorToIotaChange,
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
    status,
    statusMsg,
    voicePhase,
    voiceActiveKind,
    voiceProgress01,
    voiceMaxSeconds,
    voiceEmergencyMaxSeconds,
    sosVoiceFollowsOnline,
    forcedTransport,
    onVoiceToggle,
    onVoiceEmergencyToggle,
    voiceNormalBlockedStart,
    voiceEmergencyBlockedStart,
    voiceBusy,
    voiceRecording,
    sosVoiceAwaitingSend,
    ...attachmentBarProps
  } = p

  const [dropHover, setDropHover] = useState(false)
  const dragDepth = useRef(0)

  const voiceLocksComposer = voiceRecording || voiceBusy
  const dropDisabled = attachmentBarProps.compactBusy || sending || voiceLocksComposer

  const onComposerDragEnter = (e: DragEvent) => {
    if (dropDisabled) return
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current += 1
    setDropHover(true)
  }

  const onComposerDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDropHover(false)
  }

  const onComposerDragOver = (e: DragEvent) => {
    if (dropDisabled) return
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
    ([...message].length > MESH_PLAINTEXT_MAX_CHARS ||
      !!attachmentBarProps.attachedBlobBase64 ||
      !!attachmentBarProps.attachedAudioBase64 ||
      attachmentBarProps.attachedTxtFile != null ||
      attachmentBarProps.attachedLora != null)

  const sendDisabled =
    sending ||
    loraOnlineFallbackOffer != null ||
    hasNoPayload ||
    (!encrypted && !recipient.trim()) ||
    meshPlaintextBlocked

  const sosSendMode =
    sosVoiceAwaitingSend &&
    attachmentBarProps.attachedAudioBase64 != null &&
    loraOnlineFallbackOffer == null &&
    isLoRaMeshTransport(forcedTransport)

  const canOfferSosText =
    isPrivate &&
    encrypted &&
    (forcedTransport === 'mesh' || forcedTransport === 'internet') &&
    !attachmentBarProps.attachedBlobBase64 &&
    !attachmentBarProps.attachedAudioBase64 &&
    !attachmentBarProps.attachedTxtFile &&
    !attachmentBarProps.attachedLora &&
    !sosSendMode &&
    loraOnlineFallbackOffer == null

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
            <p className="mt-1 text-xs text-muted-foreground">
              Bei unverschlüsselten Nachrichten muss die Empfänger-Adresse angegeben werden
            </p>
          </div>
        )}

        {isPrivate && encrypted && forcedTransport === 'mesh' && (
          <label
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm text-foreground',
              (attachmentBarProps.attachedLora != null ||
                !!attachmentBarProps.attachedBlobBase64 ||
                !!attachmentBarProps.attachedAudioBase64 ||
                attachmentBarProps.attachedTxtFile != null) &&
                'pointer-events-none opacity-50'
            )}
          >
            <input
              type="checkbox"
              checked={delayMirrorToIota}
              onChange={(e) => onDelayMirrorToIotaChange(e.target.checked)}
              className="mt-0.5 rounded border-border"
            />
            <span>
              <span className="font-medium">Delayed Upload (Text)</span>
              <span className="block text-xs text-muted-foreground">
                Nach Empfang und Entschlüsselung wird der Klartext zusätzlich per IOTA-Mailbox gespeichert (nur
                reiner Text ohne Anhang; LoRa-Bild-Zweiteiler folgt separat).
              </span>
            </span>
          </label>
        )}

        {canOfferSosText ? (
          <div className="rounded-xl border-2 border-red-600/60 bg-red-950/35 p-3 dark:bg-red-950/25">
            <p className="mb-2 text-xs font-medium text-red-100">
              Hilferuf (Text): wird als <span className="font-mono">MORG_EMERGENCY_V1</span> vor der
              Verschlüsselung gesetzt; Funk-Versand nutzt Burst ohne Paketpause (App-Priorität Flash).
            </p>
            <button
              type="button"
              disabled={sending || apiStatus?.locked}
              onClick={() => {
                if (
                  !window.confirm(
                    'Echten Hilferuf (SOS) senden?\n\nDie Nachricht wird als Notfall gekennzeichnet (MORG_EMERGENCY_V1). Nur nutzen, wenn wirklich Hilfe nötig ist.'
                  )
                ) {
                  return
                }
                void onSend({ emergencyWire: 'text' })
              }}
              className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-base font-bold tracking-tight text-white shadow-lg transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              SOS — Hilferuf (Text)
            </button>
          </div>
        ) : null}

        <div
          onDragEnter={onComposerDragEnter}
          onDragLeave={onComposerDragLeave}
          onDragOver={onComposerDragOver}
          onDrop={onComposerDrop}
          className={cn(
            'rounded-xl border border-transparent p-1 transition-colors',
            dropHover && !dropDisabled && 'border-primary/50 bg-primary/5 ring-2 ring-primary/25'
          )}
        >
          <label className="mb-1.5 block text-sm font-medium text-foreground">Deine Nachricht</label>
          <p className="mb-2 text-xs text-muted-foreground">
            Sprachmemo (max. {voiceMaxSeconds}s) und SOS-Sprache (max. {voiceEmergencyMaxSeconds}s). Datei hier
            ablegen, <span className="text-foreground/90">Datei importieren</span> oder{' '}
            <span className="text-foreground/90">Von Kamera</span> (Handy: Kamera-App, PC: Webcam) – danach{' '}
            <span className="text-foreground/90">Senden</span>.
          </p>
          <ChatViewVoiceRecord
            slot="emergency"
            activeKind={voiceActiveKind}
            phase={voicePhase}
            progress01={voiceProgress01}
            maxSeconds={voiceEmergencyMaxSeconds}
            emergencySosOnline={sosVoiceFollowsOnline}
            onToggle={onVoiceEmergencyToggle}
            blockedStart={voiceEmergencyBlockedStart}
          />
          <ChatViewVoiceRecord
            slot="normal"
            activeKind={voiceActiveKind}
            phase={voicePhase}
            progress01={voiceProgress01}
            maxSeconds={voiceMaxSeconds}
            normalIsOnline={forcedTransport === 'internet'}
            onToggle={onVoiceToggle}
            blockedStart={voiceNormalBlockedStart}
          />
          <ChatViewAttachmentBar
            {...attachmentBarProps}
            sending={sending}
            pickDisabled={voiceLocksComposer}
          />
          {sosSendMode ? (
            <div className="rounded-xl border-2 border-orange-500/70 bg-orange-950/40 p-3">
              <p id="sos-send-hint" className="sr-only">
                Sendepfad Funk. Eine SOS-Sprachdatei ist angehängt. Nach Bestätigung wird der Hilferuf als
                MORG_EMERGENCY_V1 mit hoher Burst-Priorität über LoRa gesendet.
              </p>
              <button
                type="button"
                disabled={sendDisabled}
                aria-describedby="sos-send-hint"
                onClick={() => {
                  if (
                    !window.confirm(
                      'SOS-Sprachnachricht als Hilferuf senden?\n\nDie Aufnahme wird als MORG_EMERGENCY_V1 gekennzeichnet. Nur nutzen, wenn wirklich Hilfe nötig ist.'
                    )
                  ) {
                    return
                  }
                  void onSend({ emergencyWire: 'voice' })
                }}
                className="flex min-h-[3.75rem] w-full items-center justify-center gap-3 rounded-xl bg-orange-600 px-5 py-4 text-lg font-bold tracking-tight text-white shadow-lg transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? <RefreshCw className="h-7 w-7 shrink-0 animate-spin" aria-hidden /> : <Send className="h-7 w-7 shrink-0" aria-hidden />}
                {sending ? 'Wird gesendet…' : 'SOS jetzt über LoRa senden'}
              </button>
            </div>
          ) : null}
          {!encrypted && forcedTransport === 'mesh' && (
            <div className="mb-2 rounded-md border border-orange-600/45 bg-orange-950/35 px-3 py-2 text-xs leading-snug text-orange-50">
              <strong>Unverschlüsselte LoRa-Nachricht</strong> – kann von allen in Reichweite mitgehört und gefälscht
              werden. Nur für extrem kurze Notfall-Texte geeignet.{' '}
              <span className="tabular-nums">
                {[...message].length}/{MESH_PLAINTEXT_MAX_CHARS} Zeichen
              </span>
              {attachmentBarProps.attachedBlobBase64 ||
              attachmentBarProps.attachedAudioBase64 ||
              attachmentBarProps.attachedTxtFile != null ||
              attachmentBarProps.attachedLora != null
                ? ' · Anhänge bei Klartext-Funk nicht erlaubt.'
                : null}
            </div>
          )}
          <textarea
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
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {!sosSendMode ? (
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={sendDisabled}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? 'Wird gesendet…' : attachmentBarProps.attachedLora != null ? 'Für LoRa senden' : 'Senden'}
            </button>
          ) : (
            <div className="min-w-[1px] flex-1" aria-hidden />
          )}

          {status !== 'idle' && (
            <span
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium',
                status === 'success' ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {status === 'success' ? (
                <Check className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {statusMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
