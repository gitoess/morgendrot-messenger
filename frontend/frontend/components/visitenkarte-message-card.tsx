'use client'

import { VisitenkarteIngestButton } from '@/frontend/components/visitenkarte-ingest-button'
import {
  parseVisitenkarteMessage,
  type VisitenkarteIngestFields,
} from '@/frontend/lib/visitenkarte-ingest'

function shortWallet(a: string): string {
  const t = a.trim()
  if (t.length < 16) return t
  return `${t.slice(0, 10)}…${t.slice(-6)}`
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm leading-snug text-foreground">
      <span className="text-muted-foreground">{label}: </span>
      <span className="break-all">{value}</span>
    </p>
  )
}

/** Menschliche Visitenkarte — ohne Roh-JSON / ohne „Feld e“-Prosa. */
export function VisitenkarteMessageCard({ content }: { content: string }) {
  const fields: VisitenkarteIngestFields | null = parseVisitenkarteMessage(content)
  if (!fields) return null

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Visitenkarte
      </p>
      {fields.displayName ? <Row label="Name" value={fields.displayName} /> : null}
      <Row label="Wallet" value={shortWallet(fields.address)} />
      {fields.mailboxPrivateId ? (
        <Row label="Mailbox" value={shortWallet(fields.mailboxPrivateId)} />
      ) : null}
      {fields.telegramChatId ? <Row label="Telegram" value={fields.telegramChatId} /> : null}
      {fields.meshNodeId ? <Row label="Funk-Node" value={fields.meshNodeId} /> : null}
      {fields.ecdhPubB64 ? (
        <p className="text-[11px] text-muted-foreground">
          Verschlüsselungs-Schlüssel dabei — wird beim Übernehmen lokal gemerkt.
        </p>
      ) : null}
      {fields.avatarThumbDataUrl ? (
        <div className="flex items-center gap-2 pt-0.5">
          <img
            src={fields.avatarThumbDataUrl}
            alt=""
            className="h-10 w-10 rounded-full border border-border object-cover"
          />
          <p className="text-[11px] text-muted-foreground">
            Profilbild dabei
            {fields.avatarHashHex
              ? ` · Hash ${fields.avatarHashHex.slice(0, 8)}…`
              : ''}{' '}
            — beim Übernehmen lokal (eigenes Bild bleibt).
          </p>
        </div>
      ) : null}
      <div className="pt-1">
        <VisitenkarteIngestButton content={content} />
      </div>
    </div>
  )
}
