'use client'

import { useRef, useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type ChatViewWebcamCaptureDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File) => Promise<void>
}

export function ChatViewWebcamCaptureDialog(p: ChatViewWebcamCaptureDialogProps) {
  const { open, onOpenChange, onCapture } = p
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setError(null)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const el = videoRef.current
        if (el) {
          el.srcObject = stream
          await el.play()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Webcam nicht erreichbar (Berechtigung?)')
      }
    })()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open])

  function captureFrame() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) {
      setError('Video noch nicht bereit.')
      return
    }
    setBusy(true)
    setError(null)
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setBusy(false)
      setError('Canvas nicht verfügbar.')
      return
    }
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        void (async () => {
          try {
            if (!blob) {
              setError('Bild konnte nicht erzeugt werden.')
              setBusy(false)
              return
            }
            const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' })
            await onCapture(file)
            onOpenChange(false)
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          } finally {
            setBusy(false)
          }
        })()
      },
      'image/jpeg',
      0.92
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Foto mit Webcam</DialogTitle>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <video
          ref={videoRef}
          className="aspect-video w-full rounded-md bg-black object-cover"
          playsInline
          muted
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" disabled={busy || !!error} onClick={captureFrame}>
            {busy ? 'Übernehmen…' : 'Foto übernehmen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
