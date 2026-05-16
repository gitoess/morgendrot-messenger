'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, QrCode } from 'lucide-react'
import { buildContactQrPayload } from '@/frontend/lib/contact-qr'
import {
  readMyPrivateMailboxObjectId,
  writeMyPrivateMailboxObjectId,
} from '@/frontend/lib/my-private-mailbox-store'

export type ChatViewPrivateMailboxConfigProps = {
  myAddressLine: string
}

/** Eigene Mailbox-Object-ID — nur bei „Persistent (Mailbox)“ auf der Chain. */
export function ChatViewPrivateMailboxConfig(p: ChatViewPrivateMailboxConfigProps) {
  const full = (p.myAddressLine || '').trim()
  const walletValid = /^0x[a-fA-F0-9]{64}$/i.test(full)
  const [privateMb, setPrivateMb] = useState('')
  const [mbSaved, setMbSaved] = useState(false)
  const [qrCopied, setQrCopied] = useState(false)

  useEffect(() => {
    setPrivateMb(readMyPrivateMailboxObjectId())
  }, [])

  const profileQr = useCallback(() => {
    if (!walletValid) return ''
    try {
      return buildContactQrPayload({
        address: full,
        mailboxObjectId: privateMb.trim() || undefined,
      })
    } catch {
      return ''
    }
  }, [full, privateMb, walletValid])

  const copyQr = () => {
    const raw = profileQr()
    if (!raw) return
    void navigator.clipboard.writeText(raw).then(() => {
      setQrCopied(true)
      setTimeout(() => setQrCopied(false), 2000)
    })
  }

  const savePrivateMb = () => {
    const t = privateMb.trim()
    if (t && !/^0x[a-fA-F0-9]{64}$/i.test(t)) return
    writeMyPrivateMailboxObjectId(t)
    setMbSaved(true)
    setTimeout(() => setMbSaved(false), 2000)
  }

  const resetToDefaultMailbox = () => {
    writeMyPrivateMailboxObjectId('')
    setPrivateMb('')
    setMbSaved(true)
    setTimeout(() => setMbSaved(false), 2000)
  }

  const mailboxLooksLikeWallet =
    walletValid && privateMb.trim().length > 0 && privateMb.trim().toLowerCase() === full.toLowerCase()

  const qr = profileQr()

  return (
    <div className="mt-2 rounded-lg border border-orange-500/30 bg-orange-500/[0.06] p-3 space-y-2 dark:bg-orange-950/20">
      <p className="text-xs font-medium text-foreground">Eigene private Mailbox (optional)</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Nur nötig, wenn du <strong className="text-foreground">persistent in der Mailbox</strong> speicherst und eine
        eigene Mailbox-Object-ID hast — sonst gilt die Einsatz-Mailbox des Servers.
      </p>
      <input
        type="text"
        value={privateMb}
        onChange={(e) => setPrivateMb(e.target.value)}
        placeholder="0x… Mailbox-Object (64 Hex)"
        className="w-full rounded-md border border-border bg-input px-2 py-2 font-mono text-[11px]"
      />
      {mailboxLooksLikeWallet ? (
        <p className="text-[11px] text-amber-800 dark:text-amber-200">
          Die Mailbox-Object-ID darf nicht dieselbe 0x-Adresse wie deine Wallet sein.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={savePrivateMb}
          className="min-h-9 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          {mbSaved ? (
            <span className="inline-flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Gespeichert
            </span>
          ) : (
            'Mailbox-ID speichern'
          )}
        </button>
        <button
          type="button"
          onClick={resetToDefaultMailbox}
          className="min-h-9 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Zur Morgendrot-Standard-Mailbox
        </button>
        {qr ? (
          <button
            type="button"
            onClick={copyQr}
            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
            <QrCode className="h-3.5 w-3.5" />
            {qrCopied ? 'QR kopiert' : 'Profil-QR (JSON) kopieren'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
