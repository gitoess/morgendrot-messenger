'use client'

/**
 * Eigenes Kontakt-QR (v2): Wallet + optional Name / Private / Team — Scan/Import, kein Freitext-Brief.
 */

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import QRCode from 'qrcode'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildContactQrPayload } from '@/frontend/lib/contact-qr'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import {
  readMyPrivateMailboxes,
  type MyPrivateMailboxEntry,
} from '@/frontend/lib/my-private-mailbox-store'
import {
  readMyTeamMailboxes,
  type MyTeamMailboxEntry,
} from '@/frontend/lib/my-team-mailbox-store'

function maskMid(id: string): string {
  const t = id.trim()
  if (t.length < 20) return t
  return `${t.slice(0, 10)}…${t.slice(-8)}`
}

export function ProfileContactQrDialog(p: {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: string
  /** Vorbelegung Anzeigename (Telefonbuch „Ich“ o. Ä.). */
  displayName?: string
  privateMailboxes?: MyPrivateMailboxEntry[]
  teamMailboxes?: MyTeamMailboxEntry[]
}) {
  const privates = useMemo(() => {
    if (!p.open) return []
    if (p.privateMailboxes !== undefined) return p.privateMailboxes
    return readMyPrivateMailboxes()
  }, [p.open, p.privateMailboxes])

  const teams = useMemo(() => {
    if (!p.open) return []
    if (p.teamMailboxes !== undefined) return p.teamMailboxes
    return readMyTeamMailboxes()
  }, [p.open, p.teamMailboxes])

  const [name, setName] = useState('')
  const [includePrivate, setIncludePrivate] = useState(true)
  const [privateId, setPrivateId] = useState('')
  const [includeTeam, setIncludeTeam] = useState(false)
  const [teamId, setTeamId] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!p.open) return
    setName((p.displayName ?? '').trim().slice(0, 64))
    const firstPriv = privates[0]?.objectId ?? ''
    setIncludePrivate(Boolean(firstPriv))
    setPrivateId(firstPriv)
    setIncludeTeam(false)
    setTeamId(teams[0]?.objectId ?? '')
  }, [p.open, p.displayName, privates, teams])

  const payload = useMemo(() => {
    try {
      const mb =
        includePrivate && /^0x[a-fA-F0-9]{64}$/i.test(privateId.trim()) ? privateId.trim() : undefined
      const mt =
        includeTeam && /^0x[a-fA-F0-9]{64}$/i.test(teamId.trim()) ? teamId.trim() : undefined
      return buildContactQrPayload({
        address: p.address.trim(),
        displayName: name.trim() || undefined,
        mailboxObjectId: mb,
        mailboxTeamId: mt,
      })
    } catch {
      return ''
    }
  }, [p.address, name, includePrivate, privateId, includeTeam, teamId])

  useEffect(() => {
    if (!p.open || !payload) {
      setQrUrl('')
      return
    }
    let cancelled = false
    void QRCode.toDataURL(payload, { width: 240, margin: 2 }).then((url) => {
      if (!cancelled) setQrUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [p.open, payload])

  const copy = () => {
    if (!payload) return
    void navigator.clipboard.writeText(payload).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mein Kontakt-QR</DialogTitle>
          <DialogDescription>
            Maschinencode fürs Telefonbuch — nicht zum Vorlesen. Mindestens Wallet{' '}
            <span className="font-mono">{maskWalletAddress(p.address)}</span>.
          </DialogDescription>
        </DialogHeader>

        {qrUrl ? (
          <img src={qrUrl} alt="Mein Kontakt-QR" className="mx-auto rounded-lg border border-border" />
        ) : (
          <p className="text-sm text-muted-foreground">QR wird erzeugt…</p>
        )}

        <div className="space-y-2.5 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-[11px]">
          <p className="font-medium text-foreground">Inhalt wählen</p>

          <label className="flex items-start gap-2 text-muted-foreground">
            <input type="checkbox" checked disabled className="mt-0.5" />
            <span>
              Wallet-Adresse <span className="text-foreground">(immer)</span>
            </span>
          </label>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-foreground" htmlFor="profile-qr-name">
              Anzeigename (optional)
            </label>
            <input
              id="profile-qr-name"
              type="text"
              value={name}
              maxLength={64}
              placeholder="z. B. Vorname / Funkruf"
              onChange={(e) => setName(e.target.value.slice(0, 64))}
              className="w-full rounded border border-border bg-input px-2 py-1 text-[11px]"
            />
            <p className="text-[10px] text-muted-foreground">
              Kurzname im Telefonbuch — keine längere Notiz (Schema nur Feld <code className="text-[9px]">n</code>).
            </p>
          </div>

          <label className="flex items-start gap-2 text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={includePrivate}
              disabled={privates.length === 0}
              onChange={(e) => setIncludePrivate(e.target.checked)}
            />
            <span>
              Private Mailbox mitschicken
              {privates.length === 0 ? (
                <span className="block text-[10px]">
                  Keine unter „Private Mailboxen“. Hauptpostfach zählt nicht.
                </span>
              ) : includePrivate && privateId ? (
                <span className="mt-0.5 block font-mono text-[10px] text-foreground">
                  {maskMid(privateId)}
                  {privates.find((e) => e.objectId === privateId)?.label
                    ? ` · ${privates.find((e) => e.objectId === privateId)?.label}`
                    : ''}
                </span>
              ) : null}
            </span>
          </label>
          {includePrivate && privates.length > 1 ? (
            <select
              value={privateId}
              onChange={(e) => setPrivateId(e.target.value)}
              className="w-full rounded border border-border bg-input px-2 py-1 text-[11px]"
            >
              {privates.map((e) => (
                <option key={e.objectId} value={e.objectId}>
                  {(e.label || maskMid(e.objectId)).slice(0, 48)}
                </option>
              ))}
            </select>
          ) : null}

          <label className="flex items-start gap-2 text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={includeTeam}
              disabled={teams.length === 0}
              onChange={(e) => setIncludeTeam(e.target.checked)}
            />
            <span>
              Team-Mailbox mitschicken <span className="text-foreground">(selten)</span>
              {teams.length === 0 ? (
                <span className="block text-[10px]">Keine Team-Mailbox in der Liste.</span>
              ) : (
                <span className="block text-[10px]">
                  Nur wenn der Partner dieses Team-Postfach kennen soll. Sonst besser „QR teilen“ am Team.
                </span>
              )}
            </span>
          </label>
          {includeTeam && teams.length > 0 ? (
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded border border-border bg-input px-2 py-1 text-[11px]"
            >
              {teams.map((e) => (
                <option key={e.objectId} value={e.objectId}>
                  {(e.label || maskMid(e.objectId)).slice(0, 48)}
                </option>
              ))}
            </select>
          ) : null}

          <p className="text-[10px] text-muted-foreground">
            Nicht im Kontakt-QR: Hauptpostfach (Deploy), ECDH/Peering (eigenes Peering-QR), längere Notizen.
          </p>
        </div>

        <button
          type="button"
          onClick={copy}
          disabled={!payload}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          {copied ? 'JSON kopiert' : 'QR-Text (JSON) kopieren'}
        </button>
      </DialogContent>
    </Dialog>
  )
}
