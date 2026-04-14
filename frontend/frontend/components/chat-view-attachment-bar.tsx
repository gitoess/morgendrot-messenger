'use client'

import { useRef, useState } from 'react'
import { Camera, RefreshCw, Upload } from 'lucide-react'
import { MEDIA_IOTA_AUDIO_RAW_MAX_BYTES, MEDIA_LORA_AUDIO_RAW_MAX_BYTES } from '@/frontend/lib/compact-image-wire'
import type { AttachmentBarPort } from '@/frontend/features/messenger-ports'
import { prefersFileCameraCapture } from '@/frontend/lib/device-detect'
import { ChatViewWebcamCaptureDialog } from '@/frontend/components/chat-view-webcam-capture-dialog'

export type ChatViewAttachmentBarProps = AttachmentBarPort

export function ChatViewAttachmentBar(p: ChatViewAttachmentBarProps) {
  const {
    compactFileRef,
    compactBusy,
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
  } = p

  const cameraCaptureRef = useRef<HTMLInputElement>(null)
  const [webcamOpen, setWebcamOpen] = useState(false)

  const openCameraImport = () => {
    if (prefersFileCameraCapture()) {
      cameraCaptureRef.current?.click()
    } else {
      setWebcamOpen(true)
    }
  }

  const hasAnyAttachment =
    attachedBlobBase64 != null ||
    attachedLora != null ||
    attachedTxtFile != null ||
    attachedAudioBase64 != null

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
        {compactMeta && attachedBlobBase64 && (
          <span className="text-xs text-muted-foreground">
            Blob ~{Math.round(compactMeta.total / 1024)} KB · Luma {compactMeta.luma} B · Chroma {compactMeta.chroma} B ·
            WebP q≈{compactMeta.q}
          </span>
        )}
        {compactMeta && attachedLora && (
          <span className="text-xs text-muted-foreground">
            LoRa: Luma {compactMeta.luma} B · Chroma {compactMeta.chroma} B · „Für LoRa senden“ = nur Funk (Heltec).
            Online nur nach expliziter Bestätigung.
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
            LoRa Vorschau (Phase 1, S/W) – zweiter Teil = Chroma. „Für LoRa senden“ nutzt ausschließlich Funk; bei
            Fehler kannst du Online gesondert bestätigen. Phase 2 = Chunking über Heltec.
          </p>
          <img
            src={loraPreviewUrl}
            alt="Vorschau LoRa Luma"
            className="max-h-40 max-w-full rounded-md border border-border object-contain"
          />
        </div>
      )}
      {attachedLora != null && loraMeshProgressLine ? (
        <p
          className="mb-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs font-medium tabular-nums text-foreground"
          role="status"
          aria-live="polite"
        >
          Funk (Mesh v2): {loraMeshProgressLine}
        </p>
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
