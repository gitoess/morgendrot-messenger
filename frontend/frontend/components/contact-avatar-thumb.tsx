'use client'

import { useEffect, useState } from 'react'
import {
  CONTACT_AVATAR_CHANGED_EVENT,
  getContactAvatarDataUrl,
  normalizeAvatarKey,
} from '@/frontend/lib/contact-avatar-local-store'
import { cn } from '@/lib/utils'

/** Kleines Avatar — Wallet oder Sidebar-Slot (lokal). */
export function ContactAvatarThumb(p: {
  /** Wallet `0x…` oder Slot-Key (`slot:…` / `group:…`). Legacy: `address` alias. */
  avatarKey?: string
  address?: string
  className?: string
  /** Initialen-Fallback wenn kein Bild */
  fallbackLabel?: string
}) {
  const raw = (p.avatarKey ?? p.address ?? '').trim()
  const key = normalizeAvatarKey(raw)
  const [url, setUrl] = useState<string | null>(() => (key ? getContactAvatarDataUrl(key) : null))

  useEffect(() => {
    if (!key) {
      setUrl(null)
      return
    }
    setUrl(getContactAvatarDataUrl(key))
    const onChange = (ev: Event) => {
      const d = (ev as CustomEvent<{ address?: string; key?: string }>).detail
      const changed = (d?.key || d?.address || '').toLowerCase()
      if (changed && changed !== key) return
      setUrl(getContactAvatarDataUrl(key))
    }
    window.addEventListener(CONTACT_AVATAR_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(CONTACT_AVATAR_CHANGED_EVENT, onChange)
  }, [key])

  if (!url) {
    const letter = (p.fallbackLabel || raw.slice(0, 1) || '?').trim().slice(0, 1).toUpperCase()
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
    <img
      src={url}
      alt=""
      className={cn('h-8 w-8 shrink-0 rounded-full border border-border object-cover', p.className)}
    />
  )
}
