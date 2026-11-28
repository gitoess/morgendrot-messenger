'use client'

import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import {
  clearContactAvatar,
  getContactAvatarDataUrl,
  isWalletAvatarKey,
  normalizeAvatarKey,
  setContactAvatarFromFile,
} from '@/frontend/lib/contact-avatar-local-store'

/** Profilbild lokal (Wallet oder Sidebar-Slot). Teilen = nur Wallet Stufe B. */
export function ContactAvatarEditor(p: {
  /** Wallet oder Slot-Key. Legacy-Alias: `address`. */
  avatarKey?: string
  address?: string
  /** Kurzlabel für aria */
  label?: string
}) {
  const inputId = useId()
  const key = normalizeAvatarKey((p.avatarKey ?? p.address ?? '').trim()) ?? ''
  const [url, setUrl] = useState<string | null>(() => (key ? getContactAvatarDataUrl(key) : null))
  const [busy, setBusy] = useState(false)
  const walletShare = key ? isWalletAvatarKey(key) : false

  useEffect(() => {
    setUrl(key ? getContactAvatarDataUrl(key) : null)
  }, [key])

  const onFile = async (file: File | null) => {
    if (!file || !key) return
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte ein Bild wählen.')
      return
    }
    setBusy(true)
    try {
      const r = await setContactAvatarFromFile(key, file)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setUrl(r.dataUrl)
      toast.success('Profilbild lokal gespeichert.')
    } finally {
      setBusy(false)
    }
  }

  if (!key) {
    return <p className="text-[11px] text-muted-foreground">Kein gültiger Avatar-Key.</p>
  }

  return (
    <div className="flex items-center gap-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
            —
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[11px] text-muted-foreground">
          {walletShare
            ? 'Profilbild lokal (dieses Gerät). Im Chat sichtbar; Teilen = Visitenkarte-Opt-in (Klartext, nicht QR).'
            : 'Bild nur lokal für diese Sidebar-Zeile — nicht in QR/Visitenkarte.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={inputId}
            className="cursor-pointer text-xs font-medium text-primary hover:underline"
          >
            {busy ? '…' : url ? 'Bild ändern…' : 'Bild wählen…'}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            aria-label={p.label ? `Profilbild ${p.label}` : 'Profilbild wählen'}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.target.value = ''
              void onFile(f)
            }}
          />
          {url ? (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              disabled={busy}
              onClick={() => {
                clearContactAvatar(key)
                setUrl(null)
                toast.message('Profilbild entfernt.')
              }}
            >
              Entfernen
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
