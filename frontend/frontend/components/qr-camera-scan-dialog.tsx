'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike
  }
}

export type QrCameraScanDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (text: string) => void
  title?: string
  description?: string
}

async function decodeQrFromVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  detector: BarcodeDetectorLike | null
): Promise<string | null> {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return null
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  if (detector) {
    try {
      const codes = await detector.detect(canvas)
      const raw = codes?.[0]?.rawValue?.trim()
      if (raw) return raw
    } catch {
      /* BarcodeDetector optional */
    }
  }
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const found = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
  return found?.data?.trim() || null
}

export function QrCameraScanDialog(p: QrCameraScanDialogProps) {
  const { open, onOpenChange, onScan, title = 'QR scannen', description } = p
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const el = videoRef.current
    if (el) el.srcObject = null
  }, [])

  useEffect(() => {
    if (!open) {
      stopCamera()
      setError(null)
      setBusy(false)
      return
    }

    let cancelled = false
    detectorRef.current = null

    void (async () => {
      if (typeof window !== 'undefined' && window.BarcodeDetector) {
        try {
          detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] })
        } catch {
          detectorRef.current = null
        }
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
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

        const tick = async () => {
          if (cancelled) return
          const video = videoRef.current
          const canvas = canvasRef.current
          if (video && canvas && !busy) {
            const text = await decodeQrFromVideoFrame(video, canvas, detectorRef.current)
            if (text) {
              setBusy(true)
              stopCamera()
              onScan(text)
              onOpenChange(false)
              return
            }
          }
          rafRef.current = requestAnimationFrame(() => void tick())
        }
        rafRef.current = requestAnimationFrame(() => void tick())
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'Kamera nicht erreichbar — Berechtigung in Browser/App erlauben oder QR-Text einfügen.'
        )
      }
    })()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [open, busy, onOpenChange, onScan, stopCamera])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? 'QR-Code in den Rahmen halten — Rückkamera bevorzugt.'}
          </DialogDescription>
        </DialogHeader>
        <div className="relative overflow-hidden rounded-lg border border-border bg-black">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full object-cover"
            playsInline
            muted
            autoPlay
          />
          <div
            className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/70"
            aria-hidden
          />
        </div>
        <canvas ref={canvasRef} className="hidden" aria-hidden />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
          Abbrechen
        </Button>
      </DialogContent>
    </Dialog>
  )
}
