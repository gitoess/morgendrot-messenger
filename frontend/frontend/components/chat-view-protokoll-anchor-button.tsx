'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Message } from '@/frontend/lib/types'
import {
  anchorEinsatzprotokollOnIota,
  type AnchorOnChainRecord,
  type ProtokollAnchorScope,
} from '@/frontend/lib/einsatzprotokoll-anchor'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import { addManyTangleInventoryItems, addTangleInventoryItem } from '@/frontend/lib/tangle-inventory'
import { maybeAutoSaveDigestToVault } from '@/frontend/lib/tangle-inventory-vault'
import { registerProtokollAnchorDialogOpener, takeProtokollAnchorPrefillPayload } from '@/frontend/lib/messenger-imperative-dialogs'

type ScopeMode = 'all' | 'ids' | 'range'

export function ChatViewProtokollAnchorButton(p: {
  messageCount: number
  messages: readonly Message[]
  myAddress: string
  recipient: string
  vaultLocked: boolean
  messagingPersistenceMode: MessagingPersistenceMode
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  triggerClassName?: string
  triggerLabel?: string
  onOpenPartnerSetup?: () => void
}) {
  const {
    messageCount,
    messages,
    myAddress,
    recipient,
    vaultLocked,
    messagingPersistenceMode,
    setStatus,
    setStatusMsg,
    triggerClassName,
    triggerLabel = 'Anchor on chain',
    onOpenPartnerSetup,
  } = p
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [variant, setVariant] = useState<'hash' | 'full'>('hash')
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all')
  const [idsText, setIdsText] = useState('')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [ackFull, setAckFull] = useState(false)
  const [dialogMsg, setDialogMsg] = useState<string>('')
  const [anchorReceipt, setAnchorReceipt] = useState<{
    variant: 'hash' | 'full'
    records: AnchorOnChainRecord[]
    anchorHashHex?: string
    contentSha256?: string
  } | null>(null)

  const copyAnchorField = useCallback((label: string, value: string) => {
    if (!value.trim()) return
    void navigator.clipboard?.writeText(value.trim()).then(
      () => setDialogMsg(`${label} copied to clipboard.`),
      () => setDialogMsg(`${label}: copy failed.`)
    )
  }, [])

  const openDialogWithOptionalPrefill = useCallback(() => {
    const pf = takeProtokollAnchorPrefillPayload()
    setAnchorReceipt(null)
    if (pf?.messageIds?.length) {
      setVariant(pf.variant === 'full' ? 'full' : 'hash')
      setScopeMode('ids')
      setIdsText(pf.messageIds.join(', '))
      setAckFull(false)
      setDialogMsg('')
    }
    setOpen(true)
  }, [])

  useEffect(() => {
    registerProtokollAnchorDialogOpener(() => {
      openDialogWithOptionalPrefill()
    })
    return () => registerProtokollAnchorDialogOpener(null)
  }, [openDialogWithOptionalPrefill])

  function buildScope(): ProtokollAnchorScope | { error: string } {
    if (scopeMode === 'all') return { kind: 'all' }
    if (scopeMode === 'ids') {
      const ids = idsText
        .split(/[\s,]+/)
        .map((x) => x.trim())
        .filter(Boolean)
      if (!ids.length) return { error: 'Enter at least one message ID.' }
      return { kind: 'ids', ids }
    }
    const a = rangeFrom ? Date.parse(rangeFrom) : NaN
    const b = rangeTo ? Date.parse(rangeTo) : NaN
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return { error: 'Time range: choose valid from and to dates.' }
    }
    if (a > b) return { error: '“From” must be before “To”.' }
    return { kind: 'range', fromMs: a, toMs: b }
  }

  async function runAnchor() {
    setDialogMsg('')
    const sc = buildScope()
    if ('error' in sc) {
      setDialogMsg(sc.error)
      setStatus('error')
      setStatusMsg(sc.error)
      setTimeout(() => setStatus('idle'), 6000)
      return
    }
    if (variant === 'full' && !ackFull) {
      setDialogMsg('Variant B: please confirm the checkbox.')
      setStatus('error')
      setStatusMsg('Variant B: please confirm the checkbox.')
      setTimeout(() => setStatus('idle'), 6000)
      return
    }
    const rec = recipient.trim() || myAddress.trim()
    if (variant === 'hash' && !rec) {
      setDialogMsg('For hash anchor: set recipient address (or your own address).')
      setStatus('error')
      setStatusMsg('For hash anchor: set recipient address (or your own address).')
      setTimeout(() => setStatus('idle'), 7000)
      return
    }
    setBusy(true)
    try {
      const r = await anchorEinsatzprotokollOnIota({
        variant,
        messages,
        scope: sc,
        exportedByAddress: myAddress,
        recipientForPlain: rec,
        messagingPersistenceMode,
        onProgress: (msg) => setDialogMsg(msg),
      })
      if (r.ok) {
        const records: AnchorOnChainRecord[] =
          r.records?.length ? r.records : r.txDigest ? [{ digest: r.txDigest }] : []
        const invType = variant === 'hash' ? ('protocol-hash' as const) : ('protocol-full' as const)
        const items = records
          .filter((rec) => typeof rec.digest === 'string' && rec.digest.trim().length > 0)
          .map((rec) => ({
            digest: rec.digest!.trim(),
            type: invType,
            status: 'anchored' as const,
            origin: 'anchor' as const,
            encrypted: variant === 'full',
            nonce: rec.nonce,
            chunkSha256: r.contentSha256,
            chunkPart: rec.chunkPart,
            chunkTotal: rec.chunkTotal,
            anchorHashHex: r.anchorHashHex,
          }))
        if (items.length > 0) {
          addManyTangleInventoryItems(items)
          for (const inv of items) {
            void maybeAutoSaveDigestToVault({ ...inv, timestamp: Date.now() })
          }
        } else if (r.txDigest) {
          const inv = {
            digest: r.txDigest,
            type: invType,
            status: 'anchored' as const,
            origin: 'anchor' as const,
            encrypted: variant === 'full',
            anchorHashHex: r.anchorHashHex,
            chunkSha256: r.contentSha256,
          } as const
          addTangleInventoryItem(inv)
          void maybeAutoSaveDigestToVault({ ...inv, timestamp: Date.now() })
        }
        setAnchorReceipt({
          variant,
          records,
          anchorHashHex: r.anchorHashHex,
          contentSha256: r.contentSha256,
        })
        setDialogMsg(
          'Anchored. Copy digest/nonce/hash below or find under “Saved IOTA transactions”.'
        )
        setStatus('success')
        setStatusMsg(
          variant === 'hash'
            ? 'Hash anchor sent via /send-plain (explorer).'
            : r.chunksSent && r.chunksSent > 1
              ? `Full report anchored in ${r.chunksSent} encrypted transactions. Digests under “Saved IOTA transactions”.`
              : 'Full report encrypted (/send) processed.'
        )
        setTimeout(() => setStatus('idle'), 7000)
      } else {
        setStatus('error')
        const baseErr = r.error || 'Anchor failed.'
        const partial =
          r.chunksSent && r.chunksSent > 0
            ? ` (${r.chunksSent} part(s) already sent — digests in “Saved IOTA transactions”.)`
            : ''
        setDialogMsg(`${baseErr}${partial}`)
        setStatusMsg(`${baseErr}${partial}`)
        setTimeout(() => setStatus('idle'), 9000)
      }
    } catch (e) {
      setDialogMsg(e instanceof Error ? e.message : String(e))
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 8000)
    } finally {
      setBusy(false)
    }
  }

  const recipientOk = /^0x[a-f0-9]{64}$/i.test(recipient.trim()) || /^0x[a-f0-9]{64}$/i.test(myAddress.trim())
  const anchorDisabled = messageCount === 0 || vaultLocked
  const anchorTitle =
    messageCount === 0
      ? 'No messages in inbox.'
      : vaultLocked
        ? 'Unlock vault — anchoring is a normal mailbox send with your wallet.'
        : 'Publish message history as IOTA mailbox message (hash or full text)'

  return (
    <>
      <button
        type="button"
        disabled={anchorDisabled}
        onClick={openDialogWithOptionalPrefill}
        className={cn(
          'inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50',
          triggerClassName
        )}
        title={anchorTitle}
      >
        <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {triggerLabel}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Anchor on chain</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
              <p>
                Vault{vaultLocked ? ' — locked' : ' ✓'} · Recipient{recipientOk ? ' ✓' : ' — missing'}
              </p>
              {onOpenPartnerSetup ? (
                <button
                  type="button"
                  className="mt-2 font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => {
                    setOpen(false)
                    onOpenPartnerSetup()
                  }}
                >
                  Partner &amp; connection
                </button>
              ) : null}
            </div>
            <div>
              <Label className="mb-2 block text-foreground">Variant</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setVariant('hash')
                    setAckFull(false)
                  }}
                  className={cn(
                    'rounded-lg border px-3 py-3 text-left text-xs transition-colors',
                    variant === 'hash'
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-foreground'
                      : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  <span className="font-semibold text-foreground">A — Hash only</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVariant('full')}
                  className={cn(
                    'rounded-lg border px-3 py-3 text-left text-xs transition-colors',
                    variant === 'full'
                      ? 'border-amber-500/60 bg-amber-500/10 text-foreground'
                      : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  <span className="font-semibold text-foreground">B — Full report</span>
                </button>
              </div>
            </div>

            {variant === 'hash' && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-950 dark:text-amber-100/90">
                Der Hash erscheint als <strong>Klartext</strong> in der Chain – Inhalte der Nachrichten sind nicht
                lesbar, nur der Hash ist der Nachweis.
              </p>
            )}

            {variant === 'full' && (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2.5 text-xs text-red-50">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={ackFull}
                  onChange={(e) => setAckFull(e.target.checked)}
                />
                <span>
                  <strong>Variante B bestätigen:</strong> Sehr teuer und groß – wirklich den vollständigen Bericht
                  (alle Nachrichten inkl. Inhalt) auf Chain speichern? Ich habe die Kosten- und Größenrisiken
                  verstanden.
                </span>
              </label>
            )}

            <div>
              <Label className="text-foreground">Scope</Label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-foreground"
                value={scopeMode}
                onChange={(e) => setScopeMode(e.target.value as ScopeMode)}
              >
                <option value="all">Entire inbox</option>
                <option value="ids">Specific message IDs only</option>
                <option value="range">Time range (local)</option>
              </select>
            </div>

            {scopeMode === 'ids' && (
              <div>
                <Label className="text-foreground">IDs (comma-separated)</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-xs text-foreground"
                  rows={3}
                  value={idsText}
                  onChange={(e) => setIdsText(e.target.value)}
                  placeholder="id1, id2, …"
                />
              </div>
            )}

            {scopeMode === 'range' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-foreground">From</Label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-foreground"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-foreground">To</Label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-foreground"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                  />
                </div>
              </div>
            )}

            {variant === 'hash' && (
              <p className="text-[11px] text-muted-foreground">
                Recipient for /send-plain:{' '}
                <span className="font-mono">{recipient.trim() || myAddress || '(—)'}</span> — empty = your address.
              </p>
            )}
            {anchorReceipt ? (
              <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
                <p className="font-medium text-foreground">Anchored — save for search/recovery:</p>
                {anchorReceipt.anchorHashHex ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Report hash (variant A):</span>
                    <code className="break-all font-mono text-[10px]">{anchorReceipt.anchorHashHex}</code>
                    <Button type="button" size="sm" variant="outline" onClick={() => copyAnchorField('Report hash', anchorReceipt.anchorHashHex!)}>
                      Copy
                    </Button>
                  </div>
                ) : null}
                {anchorReceipt.contentSha256 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Full report SHA-256 (chunks):</span>
                    <code className="break-all font-mono text-[10px]">{anchorReceipt.contentSha256}</code>
                    <Button type="button" size="sm" variant="outline" onClick={() => copyAnchorField('Chunk-Hash', anchorReceipt.contentSha256!)}>
                      Copy
                    </Button>
                  </div>
                ) : null}
                {anchorReceipt.records.map((rec, idx) => (
                  <div key={`${rec.digest ?? 'x'}-${rec.nonce ?? idx}`} className="space-y-1 border-t border-border/50 pt-2">
                    {rec.chunkPart ? (
                      <p className="font-medium text-foreground">
                        Part {rec.chunkPart}
                        {rec.chunkTotal ? `/${rec.chunkTotal}` : ''}
                      </p>
                    ) : null}
                    {rec.digest ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">TX-Digest:</span>
                        <code className="break-all font-mono text-[10px]">{rec.digest}</code>
                        <Button type="button" size="sm" variant="outline" onClick={() => copyAnchorField('TX-Digest', rec.digest!)}>
                          Copy
                        </Button>
                      </div>
                    ) : null}
                    {rec.nonce ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">Nonce:</span>
                        <code className="break-all font-mono text-[10px]">{rec.nonce}</code>
                        <Button type="button" size="sm" variant="outline" onClick={() => copyAnchorField('Nonce', rec.nonce!)}>
                          Copy
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground">
                  All values are also saved under “Message history → Saved IOTA transactions”.
                </p>
              </div>
            ) : null}
            {dialogMsg ? (
              <p
                className={cn(
                  'rounded-md border px-2 py-1.5 text-xs',
                  anchorReceipt
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                    : 'border-red-500/35 bg-red-500/10 text-red-900 dark:text-red-100'
                )}
              >
                {dialogMsg}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                setAnchorReceipt(null)
              }}
              disabled={busy}
            >
              {anchorReceipt ? 'Close' : 'Cancel'}
            </Button>
            {!anchorReceipt ? (
              <Button type="button" onClick={() => void runAnchor()} disabled={busy}>
                {busy ? '…' : 'Anchor'}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
