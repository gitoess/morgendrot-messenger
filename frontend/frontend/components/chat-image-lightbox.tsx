'use client'

/**
 * Leichte Vollbild-Ansicht für Chat-Bilder (Funk S-ARQ u. a.).
 * Klick auf Vorschaubild → Overlay; Esc / Schließen / Backdrop → zu.
 * Mausrad / +− für Zoom (kein externes Lib).
 */

import { useCallback, useEffect, useState, type ReactNode, type WheelEvent } from 'react'
import { createPortal } from 'react-dom'

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_STEP = 0.25

export type ChatImageLightboxProps = {
  url: string
  alt?: string
  open: boolean
  onClose: () => void
}

export function ChatImageLightbox({ url, alt = 'Bild', open, onClose }: ChatImageLightboxProps) {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!open) setZoom(1)
  }, [open, url])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
      }
      if (e.key === '-') {
        e.preventDefault()
        setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))
      }
      if (e.key === '0') {
        e.preventDefault()
        setZoom(1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setZoom((z) => {
      const next = e.deltaY < 0 ? z + ZOOM_STEP : z - ZOOM_STEP
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 100) / 100))
    })
  }, [])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/95 p-3"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }}
      onWheel={onWheel}
    >
      <div className="absolute right-3 top-3 z-[10051] flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-white/30 bg-black/60 px-2.5 py-1.5 text-sm text-white hover:bg-black/80"
          title="Verkleinern (−)"
          onClick={(e) => {
            e.stopPropagation()
            setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))
          }}
        >
          −
        </button>
        <span className="min-w-[3rem] text-center text-xs text-white/80">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="rounded-md border border-white/30 bg-black/60 px-2.5 py-1.5 text-sm text-white hover:bg-black/80"
          title="Vergrößern (+)"
          onClick={(e) => {
            e.stopPropagation()
            setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
          }}
        >
          +
        </button>
        <button
          type="button"
          className="rounded-md border border-white/30 bg-black/60 px-3 py-1.5 text-sm text-white hover:bg-black/80"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onClose()
          }}
        >
          Schließen
        </button>
      </div>
      <img
        src={url}
        alt={alt}
        className="max-h-[100vh] max-w-[100vw] origin-center object-contain transition-transform duration-100"
        style={{ transform: `scale(${zoom})` }}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
      />
      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-white/70">
        Mausrad oder +/− · Esc schließt
      </p>
    </div>,
    document.body
  )
}

/** Klickbare Vorschaubild-Hülle → Lightbox. */
export function ChatImageWithLightbox({
  src,
  alt,
  className,
  badge,
  onError,
}: {
  src: string
  alt: string
  className?: string
  badge?: ReactNode
  onError?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="relative inline-block max-w-full cursor-zoom-in border-0 bg-transparent p-0 text-left"
        title="Vollbild / Zoom"
        onClick={() => setOpen(true)}
      >
        {badge}
        <img src={src} alt={alt} className={className} draggable={false} onError={onError} />
      </button>
      <ChatImageLightbox url={src} alt={alt} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
