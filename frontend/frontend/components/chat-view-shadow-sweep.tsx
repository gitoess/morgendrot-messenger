'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { postShadowSweep } from '@/frontend/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

function countMnemonicWords(text: string): number {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length
}

export function ChatViewShadowSweep() {
  const [open, setOpen] = useState(false)
  const [mnemonic, setMnemonic] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Awaited<ReturnType<typeof postShadowSweep>> | null>(null)
  const [copiedField, setCopiedField] = useState<'secret' | 'main' | 'digest' | null>(null)

  const wordCount = useMemo(() => countMnemonicWords(mnemonic), [mnemonic])
  const canSubmit = wordCount >= 12 && !busy

  const resetDialog = () => {
    setMnemonic('')
    setError(null)
    setResult(null)
    setCopiedField(null)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) resetDialog()
  }

  const copyToClipboard = async (label: 'secret' | 'main' | 'digest', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(label)
      setTimeout(() => setCopiedField(null), 2500)
    } catch {
      /* ignore */
    }
  }

  const onSubmit = async () => {
    setError(null)
    setResult(null)
    setBusy(true)
    try {
      const res = await postShadowSweep(mnemonic)
      if (!res.ok) {
        setError(res.error)
        toast.error(res.error)
        return
      }
      toast.success('Sweep abgeschlossen. Main-Secret jetzt sichern (Tresor).')
      setResult(res)
      setMnemonic('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mb-4 rounded-lg border border-dashed border-amber-500/45 bg-amber-500/10 p-4 dark:bg-amber-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <div>
              <p className="text-sm font-medium text-foreground">Wallet: Schatten → Main (Sweep)</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Temporäre Schatten-Adresse leeren – neues Main-Keypair; Secret einmal sichern.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
            Öffnen
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Shadow-Seed → Main-Wallet sweepen</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Überträgt <strong className="text-foreground">Coins</strong> (abzüglich Gas-Reserve) und{' '}
                  <strong className="text-foreground">übertragbare Objekte</strong> von der Schatten-Adresse auf eine{' '}
                  <strong className="text-foreground">neu erzeugte Main-Adresse</strong>. Erfordert RPC/Chain-Zugriff.
                </p>
                <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-950 dark:text-amber-100/90">
                  Nur über <strong className="font-medium">localhost</strong> / vertrauenswürdiges Netz nutzen. Mnemonic
                  und Main-Secret nicht weitergeben.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          {result?.ok === true ? (
            <div className="space-y-3 text-sm">
              <p className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-2 text-emerald-950 dark:text-emerald-100/90">
                Sweep ausgeführt. <strong className="text-foreground">Main-Secret</strong> jetzt kopieren und im Tresor
                sichern – nicht erneut abrufbar.
              </p>
              {result.securityNote && (
                <p className="text-xs text-muted-foreground">{result.securityNote}</p>
              )}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Main-Adresse</p>
                <div className="flex gap-2">
                  <code className="min-w-0 flex-1 break-all rounded border bg-muted/40 px-2 py-1.5 font-mono text-[11px]">
                    {result.mainAddress}
                  </code>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => void copyToClipboard('main', result.mainAddress)}
                    aria-label="Main-Adresse kopieren"
                  >
                    {copiedField === 'main' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Main-Secret (Bech32)</p>
                <div className="flex gap-2">
                  <code className="min-w-0 flex-1 break-all rounded border bg-muted/40 px-2 py-1.5 font-mono text-[11px]">
                    {result.mainSecretKey}
                  </code>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => void copyToClipboard('secret', result.mainSecretKey)}
                    aria-label="Main-Secret kopieren"
                  >
                    {copiedField === 'secret' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {result.digest && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Transaktion</p>
                  <div className="flex gap-2">
                    <code className="min-w-0 flex-1 break-all rounded border bg-muted/40 px-2 py-1.5 font-mono text-[11px]">
                      {result.digest}
                    </code>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => void copyToClipboard('digest', result.digest!)}
                      aria-label="Digest kopieren"
                    >
                      {copiedField === 'digest' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Schatten: <span className="font-mono">{result.shadowAddress}</span> · ca. {result.sentMistApprox} MIST ·
                Objekte: {result.transferredObjectCount}
              </p>
              {result.note && <p className="text-xs text-muted-foreground">{result.note}</p>}
              <p className="text-xs text-muted-foreground">
                Laufendes Backend behält die bisherige <span className="font-mono">MY_ADDRESS</span> bis zum
                Entsperren – neues Secret im SDK/Tresor importieren oder Prozess mit neuer Adresse neu starten.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="shadow-mnemonic" className="mb-1.5 block text-xs font-medium text-foreground">
                  Schatten-Mnemonic (12+ Wörter)
                </label>
                <Textarea
                  id="shadow-mnemonic"
                  value={mnemonic}
                  onChange={(e) => setMnemonic(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Wörter mit Leerzeichen getrennt …"
                  className="min-h-[100px] font-mono text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Wörter: {wordCount} {wordCount < 12 ? '(mindestens 12)' : ''}
                </p>
              </div>
              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            {result?.ok === true ? (
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Schließen
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
                  Abbrechen
                </Button>
                <Button type="button" onClick={() => void onSubmit()} disabled={!canSubmit}>
                  {busy ? '…' : 'Sweep ausführen'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
