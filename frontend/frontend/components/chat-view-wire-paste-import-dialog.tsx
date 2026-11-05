'use client'

import { useEffect, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  classifyPastedWire,
  decryptPastedPassphraseWire,
  suggestPassphraseForPastedWire,
} from '@/frontend/lib/wire-paste-import'

/** Posteingang: Wire aus Zwischenablage einfügen und lokal entschlüsseln (PWMSG). */
export function ChatViewWirePasteImportDialog() {
  const [open, setOpen] = useState(false)
  const [wire, setWire] = useState('')
  const [pass, setPass] = useState('')
  const [plain, setPlain] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setPlain(null)
    setError(null)
  }, [open])

  useEffect(() => {
    const kind = classifyPastedWire(wire)
    if (kind === 'passphrase-msg') {
      setPass((prev) => prev || suggestPassphraseForPastedWire(wire))
    }
  }, [wire])

  const onDecrypt = async () => {
    setBusy(true)
    setError(null)
    setPlain(null)
    try {
      const kind = classifyPastedWire(wire)
      if (kind !== 'passphrase-msg') {
        setError(
          'Unbekanntes Wire. Unterstützt: MORG_PWMSG_V1 (Passphrase-Schutz). ECDH-Ciphertexte brauchen Handshake/Connect — nicht diesen Dialog.'
        )
        return
      }
      const r = await decryptPastedPassphraseWire(wire, pass)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setPlain(r.plain)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          title="Kopiertes Wire (MORG_PWMSG) einfügen und mit Passphrase lokal lesen."
        >
          <ClipboardPaste className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Wire einfügen
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Wire einfügen</DialogTitle>
          <DialogDescription>
            Roh-Wire aus „Wire kopieren“ hier einfügen. Passphrase-Nachrichten werden lokal
            entschlüsselt — nicht dasselbe wie „Entschlüsseln“ (Einsatzbericht-.json).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Wire</span>
            <textarea
              value={wire}
              onChange={(e) => setWire(e.target.value)}
              rows={5}
              spellCheck={false}
              placeholder="MORG_PWMSG_V1:…"
              className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-[11px] text-foreground"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Passphrase</span>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="off"
              placeholder="≥ 8 Zeichen"
              className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-xs text-foreground"
            />
          </label>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {plain != null ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <p className="text-[11px] font-medium text-muted-foreground">Klartext</p>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{plain}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(plain)}
              >
                Klartext kopieren
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Schließen
            </Button>
            <Button type="button" disabled={busy || !wire.trim()} onClick={() => void onDecrypt()}>
              {busy ? '…' : 'Entschlüsseln'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
