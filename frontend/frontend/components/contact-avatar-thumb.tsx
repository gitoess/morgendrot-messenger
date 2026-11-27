'use client'

import { useEffect, useState } from 'react'
import {
  CONTACT_AVATAR_CHANGED_EVENT,
  getContactAvatarDataUrl,
} from '@/frontend/lib/contact-avatar-local-store'
import { cn } from '@/lib/utils'

/** Kleines Avatar im Chat — Stufe A lokal. */
export function ContactAvatarThumb(p: {
  address: string
  className?: string
  /** Initialen-Fallback wenn kein Bild */
  fallbackLabel?: string
}) {
  const addr = p.address.trim()
  const [url, setUrl] = useState<string | null>(() =>
    /^0x[a-fA-F0-9]{64}$/i.test(addr) ? getContactAvatarDataUrl(addr) : null
  )

  useEffect(() => {
    if (!/^0x[a-fA-F0-9]{64}$/i.test(addr)) {
      setUrl(null)
      return
    }
    setUrl(getContactAvatarDataUrl(addr))
    const key = addr.toLowerCase()
    const onChange = (ev: Event) => {
      const d = (ev as CustomEvent<{ address?: string }>).detail
      if (d?.address && d.address.toLowerCase() !== key) return
      setUrl(getContactAvatarDataUrl(addr))
    }
    window.addEventListener(CONTACT_AVATAR_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(CONTACT_AVATAR_CHANGED_EVENT, onChange)
  }, [addr])

  if (!url) {
    const letter = (p.fallbackLabel || addr.slice(2, 3) || '?').trim().slice(0, 1).toUpperCase()
    return (
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-semibold text-muted-foreground',
          p.className
        )}
        aria-hidden
      >
        {letter}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={cn('h-8 w-8 shrink-0 rounded-full border border-border object-cover', p.className)}
    />
  )
}
