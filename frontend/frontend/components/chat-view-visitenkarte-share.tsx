'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  buildVisitenkarteShare,
  defaultVisitenkarteShareFlags,
  type VisitenkarteShareFlags,
} from '@/frontend/lib/visitenkarte-share'
import { getDirectChatEcdhOwnPubRawBase64 } from '@/frontend/lib/direct-chat-ecdh-session'
import { readActiveSendMailbox } from '@/frontend/lib/my-mailbox-active'

function FlagRow(p: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  return (
    <label htmlFor={p.id} className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        id={p.id}
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 rounded border-border"
        checked={p.checked}
        disabled={p.disabled}
        onChange={(e) => p.onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="font-medium text-foreground">{p.label}</span>
        {p.hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{p.hint}</span> : null}
      </span>
    </label>
  )
}

export function ChatViewVisitenkarteShare(p: {
  address: string
  displayName?: string | null
  telegramChatId?: string | null
}) {
  const addrOk = /^0x[a-fA-F0-9]{64}$/i.test(p.address.trim())
  const name = (p.displayName ?? '').trim()
  const tg = (p.telegramChatId ?? '').trim()
  const ecdh = typeof window !== 'undefined' ? getDirectChatEcdhOwnPubRawBase64() : null
  const activeMb = readActiveSendMailbox()
  const mailboxId = activeMb.kind === 'private' ? activeMb.objectId : ''

  const [flags, setFlags] = useState<VisitenkarteShareFlags>(() =>
    defaultVisitenkarteShareFlags({
      hasDisplayName: Boolean(name),
      hasTelegram: Boolean(tg),
      hasEcdh: Boolean(ecdh),
      hasMailbox: Boolean(mailboxId),
    })
  )
  const [copied, setCopied] = useState<'text' | 'qr' | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!p.address) return
    setFlags(
      defaultVisitenkarteShareFlags({
        hasDisplayName: Boolean(name),
        hasTelegram: Boolean(tg),
        hasEcdh: Boolean(getDirectChatEcdhOwnPubRawBase64()),
        hasMailbox: Boolean(mailboxId),
      })
    )
  }, [p.address, name, tg, mailboxId])

  const built = useMemo(() => {
    if (!addrOk) return null
    try {
      return buildVisitenkarteShare({
        address: p.address,
        displayName: name || undefined,
        telegramChatId: tg || undefined,
        ecdhPubB64: getDirectChatEcdhOwnPubRawBase64() || undefined,
        mailboxObjectId: mailboxId || undefined,
        flags,
      })
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }, [addrOk, p.address, name, tg, mailboxId, flags])

  const copy = useCallback(async (kind: 'text' | 'qr') => {
    if (!built || 'error' in built) return
    const v = kind === 'text' ? built.plainText : built.qrJson
    try {
      await navigator.clipboard.writeText(v)
      setCopied(kind)
      setErr('')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setErr('Zwischenablage nicht verfügbar.')
    }
  }, [built])

  if (!addrOk) return null

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Visitenkarte teilen</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Bestehendes Kontakt-QR (`mc`) — kein Avatar, keine zweite QR-Welt.
        </p>
      </div>
      <div className="space-y-2">
        <FlagRow
          id="vk-name"
          label="Anzeigename"
          checked={flags.includeDisplayName}
          disabled={!name}
          hint={name ? name : 'Kein Name gesetzt'}
          onChange={(v) => setFlags((f) => ({ ...f, includeDisplayName: v }))}
        />
        <FlagRow
          id="vk-wallet"
          label="Wallet-ID"
          checked
          disabled
          hint="Immer enthalten"
          onChange={() => {}}
        />
        <FlagRow
          id="vk-mb"
          label="Aktive Private-Mailbox"
          checked={flags.includeMailbox}
          disabled={!mailboxId}
          hint={mailboxId ? undefined : 'Keine private Mailbox aktiv'}
          onChange={(v) => setFlags((f) => ({ ...f, includeMailbox: v }))}
        />
        <FlagRow
          id="vk-tg"
          label="Telegram-Chat-ID"
          checked={flags.includeTelegram}
          disabled={!tg}
          hint={tg ? 'Nur im Klartext (nicht im QR-Schema)' : 'Keine eigene TG-ID'}
          onChange={(v) => setFlags((f) => ({ ...f, includeTelegram: v }))}
        />
        <FlagRow
          id="vk-ecdh"
          label="ECDH / Peering-Pub"
          checked={flags.includeEcdh}
          disabled={!ecdh}
          hint={ecdh ? 'Feld e im Kontakt-QR' : 'Kein ECDH-Pub in der Sitzung'}
          onChange={(v) => setFlags((f) => ({ ...f, includeEcdh: v }))}
        />
      </div>
      {built && 'error' in built ? (
        <p className="text-xs text-destructive">{built.error}</p>
      ) : null}
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => void copy('text')}>
          {copied === 'text' ? (
            <>
              <Check className="mr-1 h-3.5 w-3.5" aria-hidden /> Kopiert
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3.5 w-3.5" aria-hidden /> Text kopieren
            </>
          )}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void copy('qr')}>
          {copied === 'qr' ? (
            <>
              <Check className="mr-1 h-3.5 w-3.5" aria-hidden /> QR-JSON
            </>
          ) : (
            <>QR-JSON kopieren</>
          )}
        </Button>
      </div>
    </div>
  )
}
