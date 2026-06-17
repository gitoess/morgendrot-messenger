'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Camera, RefreshCw, Upload } from 'lucide-react'
import { MEDIA_IOTA_AUDIO_RAW_MAX_BYTES, MEDIA_LORA_AUDIO_RAW_MAX_BYTES } from '@/frontend/lib/compact-image-wire'
import type { AttachmentBarPort } from '@/frontend/features/messenger-ports'
import { prefersFileCameraCapture } from '@/frontend/lib/device-detect'
import {
  formatFluentLoraPreSendWarning,
  isFluentLoraImagePlan,
  planFluentLoraImage,
} from '@/frontend/features/send/lora-image-morg-seg-v1-policy'
import { ChatViewWebcamCaptureDialog } from '@/frontend/components/chat-view-webcam-capture-dialog'

export type ChatViewAttachmentBarProps = AttachmentBarPort & {
  /** z. B. STT, Sprachmemo — rechts neben „Von Kamera“. */
  trailingActions?: ReactNode
  /** false = nur Vorschau/Pipeline (Picker im +-Menü). */
  showImportPickers?: boolean
  onRegisterCameraPick?: (pick: () => void) => void
}

export function ChatViewAttachmentBar(p: ChatViewAttachmentBarProps) {
  const {
    compactFileRef,
    compactBusy,
    attachmentPipelineHint = null,
    sending,
    pickDisabled = false,
    onFileChange,
    ingestChatAttachmentFile,
    compactMeta,
    attachedBlobBase64,
    attachedLora,
    attachedTxtFile,
    attachedAudioBase64,
    clearCompactAttachment,
    compactPreviewUrl,
    loraPreviewUrl,
    loraMeshProgressLine,
    trailingActions,
    showImportPickers = true,
    onRegisterCameraPick,
  } = p

  const cameraCaptureRef = useRef<HTMLInputElement>(null)
  const [webcamOpen, setWebcamOpen] = useState(false)

  const openCameraImport = useCallback(() => {
    if (prefersFileCameraCapture()) {
      cameraCaptureRef.current?.click()
    } else {
      setWebcamOpen(true)
    }
  }, [])

  useEffect(() => {
    onRegisterCameraPick?.(openCameraImport)
  }, [onRegisterCameraPick, openCameraImport])

  const hasAnyAttachment =
    attachedBlobBase64 != null ||
    attachedLora != null ||
    attachedTxtFile != null ||
    attachedAudioBase64 != null

  const fluentLoraPlan =
    attachedLora != null ? planFluentLoraImage(attachedLora) : null
  const fluentLoraHint =
    fluentLoraPlan && isFluentLoraImagePlan(fluentLoraPlan)
      ? formatFluentLoraPreSendWarning(fluentLoraPlan)
      : null
  const fluentLoraError =
    fluentLoraPlan && !isFluentLoraImagePlan(fluentLoraPlan) ? fluentLoraPlan.message : null

  return (
    <>
      <input
        ref={compactFileRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.txt,text/plain,.opus,.ogg,audio/ogg,audio/opus,application/ogg,video/ogg"
        className="hidden"
        onChange={onFileChange}
      />
      <input
        ref={cameraCaptureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />
      <ChatViewWebcamCaptureDialog
        open={webcamOpen}
        onOpenChange={setWebcamOpen}
        onCapture={(file) => ingestChatAttachmentFile(file)}
      />
      {attachmentPipelineHint ? (
        <div
          className="mb-2 w-full max-w-xl space-y-2 rounded-md border border-sky-500/35 bg-sky-500/10 px-3 py-2 dark:bg-sky-950/25"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="text-xs font-medium text-sky-950 dark:text-sky-50/95">{attachmentPipelineHint}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full w-full origin-left animate-pulse rounded-full bg-gradient-to-r from-sky-600/25 via-sky-500/90 to-sky-600/25" />
          </div>
        </div>
      ) : null}
      {showImportPickers ? (
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={compactBusy || sending || pickDisabled}
          onClick={() => compactFileRef.current?.click()}
          title={`Bild (.jpg, .png, .webp), Text (.txt), Opus/Ogg. Online bis ~${Math.round(MEDIA_IOTA_AUDIO_RAW_MAX_BYTES / 1024)} KiB Rohdaten; Funk bis ~${Math.round(MEDIA_LORA_AUDIO_RAW_MAX_BYTES / 1024)} KiB. Kein .morg-pkg – dafür Werkzeugleiste.`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 disabled:opacity-50"
        >
          {compactBusy ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" aria-hidden />
          )}
          {compactBusy ? 'Anhang wird vorbereitet…' : 'Datei importieren'}
        </button>
        <button
          type="button"
          disabled={compactBusy || sending || pickDisabled}
          onClick={openCameraImport}
          title={
            prefersFileCameraCapture()
              ? 'Kamera-App (Handy/Tablet): Foto aufnehmen und als Bild-Anhang laden.'
              : 'Webcam: Foto aufnehmen und als Bild-Anhang laden.'
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 disabled:opacity-50"
        >
          <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Von Kamera
        </button>
        {trailingActions}
        {compactMeta && attachedBlobBase64 && (
          <span className="text-xs text-muted-foreground">
            Blob ~{Math.round(compactMeta.total / 1024)} KB · Luma {compactMeta.luma} B · Chroma {compactMeta.chroma} B ·
            WebP q≈{compactMeta.q}
          </span>
        )}
        {compactMeta && attachedLora && (
          <span className="text-xs text-muted-foreground">
            Flüchtig (LoRa): ~{Math.round(compactMeta.total / 1024)} KB komprimiert · Luma {compactMeta.luma} B · Chroma{' '}
            {compactMeta.chroma} B · Pfad 4 + MORG_SEG_V1.
          </span>
        )}
        {compactMeta && attachedTxtFile != null && (
          <span className="text-xs text-muted-foreground">
            .txt · {attachedTxtFile.name} · {compactMeta.total} Byte UTF-8
          </span>
        )}
        {attachedAudioBase64 != null && compactMeta != null && (
          <span className="text-xs text-muted-foreground">
            Opus/Ogg · {compactMeta.total} B Rohdaten (Online max. {MEDIA_IOTA_AUDIO_RAW_MAX_BYTES} B, Funk max.{' '}
            {MEDIA_LORA_AUDIO_RAW_MAX_BYTES} B)
          </span>
        )}
        {hasAnyAttachment && (
          <button
            type="button"
            onClick={clearCompactAttachment}
            className="text-xs font-medium text-red-400 hover:underline"
          >
            Anhang entfernen
          </button>
        )}
      </div>
      ) : null}
      {fluentLoraError ? (
        <p className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {fluentLoraError}
        </p>
      ) : fluentLoraHint ? (
        <p className="mb-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-950 dark:text-amber-100">
          {fluentLoraHint}
        </p>
      ) : null}
      {compactPreviewUrl && (
        <div className="mb-2">
          <p className="mb-1 text-xs text-muted-foreground">Vorschau (Canvas color-Blend wie im Chat):</p>
          <img
            src={compactPreviewUrl}
            alt="Vorschau kompaktes Bild"
            className="max-h-40 max-w-full rounded-md border border-border object-contain"
          />
        </div>
      )}
      {loraPreviewUrl && (
        <div className="mb-2">
          <p className="mb-1 text-xs text-muted-foreground">
            Vorschau Flüchtig (LoRa): zuerst Luma (S/W), dann Chroma. Senden über Funk (Heltec) mit MORG_SEG_V1-Segmenten.
          </p>
          <img
            src={loraPreviewUrl}
            alt="Vorschau LoRa Luma"
            className="max-h-40 max-w-full rounded-md border border-border object-contain"
          />
        </div>
      )}
      {attachedLora != null && loraMeshProgressLine ? (
        <div
          className="mb-2 space-y-1.5 rounded-md border border-border bg-muted/30 px-2 py-1.5"
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-medium tabular-nums text-foreground">Flüchtig (LoRa): {loraMeshProgressLine}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary/80" />
          </div>
        </div>
      ) : null}
      {attachedTxtFile != null && !attachedBlobBase64 && (
        <div className="mb-2 max-h-28 overflow-auto rounded-md border border-border bg-muted/20 p-2">
          <p className="mb-1 text-xs text-muted-foreground">Vorschau .txt (gekürzt):</p>
          <pre className="whitespace-pre-wrap break-words text-xs text-foreground">
            {attachedTxtFile.text.length > 800
              ? `${attachedTxtFile.text.slice(0, 800)}…`
              : attachedTxtFile.text}
          </pre>
        </div>
      )}
    </>
  )
}
