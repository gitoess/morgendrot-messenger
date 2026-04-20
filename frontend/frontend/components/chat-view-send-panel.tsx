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
import { isLoRaMeshTransport, MESH_PLAINTEXT_MAX_CHARS } from '@/frontend/lib/chat-view-messenger-transport'
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
  /** Klartext-Funk: Ziel-Knoten (!hex) statt Broadcast. */
  meshPlaintextToNodeEnabled: boolean
  onMeshPlaintextToNodeEnabledChange: (v: boolean) => void
  meshPlaintextNodeId: string
  onMeshPlaintextNodeIdChange: (v: string) => void
}

export function ChatViewSendPanel(p: ChatViewSendPanelProps) {
  const {
    isPrivate,
    delayMirrorToIota,
    onDelayMirrorToIotaChange,
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
    meshPlaintextToNodeEnabled,
    onMeshPlaintextToNodeEnabledChange,
    meshPlaintextNodeId,
    onMeshPlaintextNodeIdChange,
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
      attachmentBarProps.attachedTxtFile != null ||
      attachmentBarProps.attachedLora != null)

  /** Pfad 4: erlaubt Klartext-Text und LoRa-LUMA/CHROMA, aber keine sonstigen Anhänge. */
  const meshPath4Blocked =
    meshSelfArchiveAfterLoRa &&
    (!isPrivate ||
      forcedTransport !== 'mesh' ||
      !!attachmentBarProps.attachedBlobBase64 ||
      !!attachmentBarProps.attachedAudioBase64 ||
      attachmentBarProps.attachedTxtFile != null)

  /** Privat + verschlüsselt + Funk: IOTA-Bild wird per Effect in LUMA+CHROMA umgewandelt — bis dahin nicht senden. */
  const meshIotaBlobAwaitingLora =
    isPrivate &&
    encrypted &&
    forcedTransport === 'mesh' &&
    !!attachmentBarProps.attachedBlobBase64 &&
    attachmentBarProps.attachedLora == null

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
    meshPath4Blocked ||
    meshIotaBlobAwaitingLora

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
            <p className="mt-1 text-xs text-muted-foreground">
              {forcedTransport === 'mesh'
                ? 'Online/Mailbox: 0x-Empfänger nötig. Funk-Klartext-Broadcast: 0x leer lassen möglich, wenn Heltec verbunden und „an Node-ID“ aus ist.'
                : 'Bei unverschlüsselten Nachrichten muss die Empfänger-Adresse (0x…) angegeben werden.'}
            </p>
          </div>
        )}

        {!encrypted && forcedTransport === 'mesh' && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-foreground">
              EINSATZMODUS: Funkpfad -&gt; Heltec verbinden -&gt; optional Node-ID -&gt; Senden.
            </p>
            <p className="text-xs font-medium text-foreground">Meshtastic-Klartext (LongFast / Text)</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Standard-Meshtastic-Text — <strong className="text-foreground">ohne</strong> Morgendrot-Mesh-v2 und{' '}
              <strong className="text-foreground">ohne</strong> /connect. Broadcast an alle im Kanal, oder Ziel-Knoten
              (!… wie am Radio angezeigt).
            </p>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={meshPlaintextToNodeEnabled}
                onChange={(e) => onMeshPlaintextToNodeEnabledChange(e.target.checked)}
                className="mt-1 border-border"
              />
              <span>
                An Node-ID senden (statt Broadcast)
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Nur Klartext + „funk“. Verschlüsselt + Funk nutzt weiter Mesh v2 und braucht Handshake + /connect.
                </span>
              </span>
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
              <span>
                <span className="font-medium">LoRa + eigene Verankerung</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  Nach erfolgreichem Klartext-Funk: Kopie per Klartext-Mailbox an <strong className="text-foreground">deine</strong>{' '}
                  MY_ADDRESS (Tangle) + optionale Forensic-Attestation. Unterstützt jetzt Kurztext sowie
                  LoRa-Bildzweiteiler (LUMA/CHROMA) ohne Peer-ECDH; bei aktivem Pfad 4 wird kein Mesh-v2-/Handshake-Pfad
                  genutzt. Nicht unterstützt: Audio/.txt/IOTA-Kompaktbild direkt.
                </span>
              </span>
            </label>
          </div>
        )}

        {isPrivate && encrypted && forcedTransport === 'mesh' && attachmentBarProps.attachedAudioBase64 != null ? (
          <div className="rounded-lg border border-sky-600/40 bg-sky-950/20 px-3 py-2 text-xs leading-snug text-sky-950 dark:text-sky-50/95">
            <strong className="text-sky-900 dark:text-sky-100">Sprache per Funk:</strong> nur{' '}
            <strong className="text-foreground">kurze</strong> Opus-Memos (harte Byte-Grenze). Längere Sprache:{' '}
            <strong className="text-foreground">online</strong>. In der Konsole „error: 3“ (TIMEOUT): typisch ohne
            Mesh-ACK bei Broadcast — zweites Gerät zum Testen; kurze Memos reduzieren Timeouts.
          </div>
        ) : null}

        {isPrivate && encrypted && forcedTransport === 'mesh' && (
          <fieldset className="rounded-lg border border-border bg-muted/20 p-3">
            <legend className="text-sm font-medium text-foreground">LoRa → Empfänger (Funk)</legend>
            <p className="mb-3 text-xs text-muted-foreground">
              Wähle, ob die Nachricht nur über LoRa geht oder zusätzlich nach dem Funk in den IOTA-Tangle gespiegelt
              werden soll (Delayed Mirror — der Empfänger braucht später Basis/WLAN). Dieser Modus ist
              <strong className="text-foreground"> empfängerbezogen</strong> und benötigt Handshake + /connect.
            </p>
            {(apiStatus?.connectedAddresses?.length ?? 0) > 0 ? (
              <div className="mb-3 rounded-md border border-border bg-background/70 px-2.5 py-2">
                <p className="mb-1 text-[11px] font-medium text-foreground">Verbundene Partner (Handshake)</p>
                <div className="flex flex-wrap gap-1.5">
                  {(apiStatus?.connectedAddresses ?? []).map((addr) => (
                    <button
                      key={addr}
                      type="button"
                      onClick={() => onRecipientChange(addr)}
                      className="rounded border border-border px-2 py-1 font-mono text-[10px] text-foreground hover:bg-muted"
                      title="Als Zieladresse übernehmen"
                    >
                      {addr.length > 16 ? `${addr.slice(0, 10)}…${addr.slice(-4)}` : addr}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {meshSelfArchiveAfterLoRa ? (
              <div className="mb-3 rounded-md border border-amber-600/45 bg-amber-950/20 px-2.5 py-2 text-xs leading-snug text-amber-50">
                Aktiv ist aktuell <strong className="text-foreground">„LoRa + eigene Verankerung“</strong> (Self-Archive).
                Der Empfänger-Mirror-Modus ist dafür bewusst getrennt und hier deaktiviert.
              </div>
            ) : null}
            <div className={cn('space-y-3', meshSelfArchiveAfterLoRa ? 'opacity-60 pointer-events-none' : '')}>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                <input
                  type="radio"
                  name="morg-lora-tangle-mode"
                  checked={!delayMirrorToIota}
                  onChange={() => onDelayMirrorToIotaChange(false)}
                  aria-label="Nur LoRa: Nachricht nur über Meshtastic, ohne IOTA-Spiegel"
                  data-testid="lora-mode-nur-lora"
                  className="mt-0.5 border-border"
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">Nur LoRa</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    Klassisch: Text, Bild (kompakt), Audio, .txt oder LoRa-Bild (LUMA+CHROMA) nur über Mesh v2 —
                    kein automatischer Mailbox-/Tangle-Schritt.
                  </span>
                  <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground/95">
                    Ohne Tangle-Verankerung ist keine Forensic-Attestation für diese Funk-Sendung möglich (Manifest
                    braucht Mailbox-/Chain-Bezug).
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelayMirrorToIotaChange(true)}
                    className="mt-2 inline-flex items-center rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/60"
                    data-testid="lora-mode-spaeter-verankern"
                  >
                    Später verankern: auf „LoRa + Tangle“ wechseln
                  </button>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                <input
                  type="radio"
                  name="morg-lora-tangle-mode"
                  checked={delayMirrorToIota}
                  onChange={() => onDelayMirrorToIotaChange(true)}
                  aria-label="LoRa und Tangle: nach Empfang zusätzlich per Mailbox in den Tangle spiegeln"
                  data-testid="lora-mode-lora-tangle"
                  className="mt-0.5 border-border"
                />
                <span>
                  <span className="font-medium">LoRa + Tangle</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    Zuerst Funk wie oben; nach Entschlüsselung beim Empfänger wird der Klartext per Delayed Mirror
                    in die Mailbox geschrieben und damit im Tangle verankert (Delayed-Mirror-Warteschlange am
                    Empfänger, wie zuvor die Checkbox „Delayed Upload“). Ohne /connect schlägt dieser Modus fehl.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
        )}

        {canOfferSosText ? (
          <div className="rounded-xl border-2 border-red-600/60 bg-red-950/35 p-3 dark:bg-red-950/25">
            <p className="mb-2 text-xs font-medium text-red-100">
              <strong className="block text-red-50">SOS — Hilferuf (Text)</strong>
              <span className="mt-1 block font-normal leading-relaxed text-red-100/95">
                Einsatzmodus: erst Text eingeben oder diktieren, dann SOS senden.
              </span>
            </p>
            <button
              type="button"
              disabled={sending}
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
            'touch-pan-y rounded-xl border border-transparent p-1 transition-colors',
            dropHover && !dropDisabled && 'border-primary/50 bg-primary/5 ring-2 ring-primary/25'
          )}
        >
          <label className="mb-1.5 block text-sm font-medium text-foreground">Deine Nachricht</label>
          <p className="mb-2 text-xs text-muted-foreground">
            Sprachmemo (max. {voiceMaxSeconds}s, nur Online/IOTA). Datei hier
            ablegen, <span className="text-foreground/90">Datei importieren</span> oder{' '}
            <span className="text-foreground/90">Von Kamera</span> (Handy: Kamera-App, PC: Webcam) – danach{' '}
            <span className="text-foreground/90">Senden</span>.
          </p>
          <div className="mb-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">EINSATZMODUS DIKTAT:</strong> Textfeld fokussieren und OS-Diktat nutzen.
            <strong className="text-foreground"> Windows: Win+H</strong> |{' '}
            <strong className="text-foreground">Android: Tastatur-Mikrofon</strong>.
          </div>
          {forcedTransport === 'internet' ? (
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
          ) : (
            <div className="mb-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Sprachmemo ist im Einsatzmodus aktuell <strong className="text-foreground">nur bei Online/IOTA</strong>{' '}
              aktiv.
            </div>
          )}
          <ChatViewAttachmentBar
            {...attachmentBarProps}
            sending={sending}
            pickDisabled={voiceLocksComposer}
          />
          {!encrypted && forcedTransport === 'mesh' && (
            <div className="mb-2 rounded-md border border-orange-600/45 bg-orange-950/35 px-3 py-2 text-xs leading-snug text-orange-50">
              <strong>EINSATZMODUS KLARTEXT-LORA:</strong> mitlesbar und fälschbar durch Reichweite-Teilnehmer. Nur sehr
              kurze Notfall-Texte.{' '}
              <span className="tabular-nums">
                {[...message].length}/{MESH_PLAINTEXT_MAX_CHARS} Zeichen
              </span>
              {attachmentBarProps.attachedBlobBase64 ||
              attachmentBarProps.attachedAudioBase64 ||
              attachmentBarProps.attachedTxtFile != null ||
              attachmentBarProps.attachedLora != null
                ? ' · Anhänge bei Klartext-Funk nicht erlaubt (kein Bild/Sprachmemo/.txt/LoRa-Zweiteiler).'
                : null}
            </div>
          )}
          {meshIotaBlobAwaitingLora ? (
            <div className="mb-2 rounded-md border border-sky-600/45 bg-sky-950/25 px-3 py-2 text-xs leading-snug text-sky-950 dark:text-sky-50/95">
              <strong>LoRa-Bild:</strong> IOTA-Kompakt wird automatisch in <strong>LUMA+CHROMA</strong> umgewandelt —{' '}
              <span className="text-muted-foreground">Senden bleibt kurz deaktiviert, bis die Vorschau da ist.</span>
            </div>
          ) : null}
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
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
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
                className="flex items-center gap-2 rounded-lg border border-sky-500/50 bg-sky-500/10 px-6 py-2.5 text-sm font-medium text-sky-900 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-100"
              >
                {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Wird gesendet…' : attachmentBarProps.attachedLora != null ? 'Für LoRa senden' : 'LoRa senden'}
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
