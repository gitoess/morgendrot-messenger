'use client'

import { useEffect, useState } from 'react'
import { reconstructCompactImageToDataUrl } from '@/frontend/lib/compact-image-canvas'
import { cn } from '@/lib/utils'

const INTERVAL_MS = 2800
const FADE_MS = 400

/**
 * Kein ML: feste Timings + CSS opacity (No-AI). Payloads = MORG_COMPACT_IMG_V1-Innen-Blobs (Base64).
 */
export function SlideShowCrossfade({ frames }: { frames: string[] }) {
  const [urls, setUrls] = useState<string[]>([])
  const [i, setI] = useState(0)
  const fadeStyle = { transitionDuration: `${FADE_MS}ms` } as const

  useEffect(() => {
    let alive = true
    setUrls([])
    void (async () => {
      const u: string[] = []
      for (const b64 of frames) {
        try {
          u.push(await reconstructCompactImageToDataUrl(b64))
        } catch {
          u.push('')
        }
        if (!alive) return
      }
      if (alive) setUrls(u)
    })()
    return () => {
      alive = false
    }
  }, [frames])

  useEffect(() => {
    setI(0)
  }, [frames])

  useEffect(() => {
    if (urls.length <= 1) return
    const t = setInterval(() => setI((x) => (x + 1) % urls.length), INTERVAL_MS)
    return () => clearInterval(t)
  }, [urls.length])

  const valid = urls.filter(Boolean)
  if (valid.length === 0 && urls.length > 0) {
    return <p className="text-xs text-red-400">Slideshow: Frames konnten nicht dekodiert werden.</p>
  }
  if (urls.length === 0) {
    return <p className="text-xs text-muted-foreground">Slideshow wird geladen…</p>
  }

  return (
    <div className="relative max-h-80 min-h-[140px] w-full overflow-hidden rounded-lg border border-border bg-muted/20">
      {urls.map((src, j) =>
        src ? (
          <img
            key={j}
            src={src}
            alt=""
            style={fadeStyle}
            className={cn(
              'absolute inset-0 m-auto max-h-full max-w-full object-contain transition-opacity ease-in-out motion-reduce:transition-none',
              j === i ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none'
            )}
          />
        ) : null
      )}
      <span className="absolute bottom-1 right-1 z-20 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {i + 1}/{urls.length}
      </span>
    </div>
  )
}
