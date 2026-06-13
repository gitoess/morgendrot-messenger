'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cleanupPrivateMailboxOnChain } from '@/frontend/lib/cleanup-private-mailbox-on-chain'
import { fetchPrivateMailboxContents } from '@/frontend/lib/fetch-private-mailbox-contents'
import { explorerTxUrlFromDigest } from '@/frontend/lib/iota-tx-explorer-hint'
import { purgePrivateMailboxOnChain } from '@/frontend/lib/purge-private-mailbox-on-chain'

function maskMid(id: string): string {
  const t = id.trim()
  if (t.length < 20) return t
  return `${t.slice(0, 10)}…${t.slice(-8)}`
}

function formatActionError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/message channel closed|asynchronous response/i.test(msg)) {
    return 'Browser extension interrupted the request (often wallet/ad-blocker). Reload the page or disable the extension temporarily — then try again.'
  }
  return msg || 'Unknown error.'
}

export type ChatViewPrivateMailboxDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  objectId: string
  myAddress: string
  walletValid: boolean
  onDone: () => void
  onStatus?: (msg: string, kind: 'success' | 'error') => void
}

export function ChatViewPrivateMailboxDeleteDialog(p: ChatViewPrivateMailboxDeleteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<'cleanup' | 'delete' | 'both' | null>(null)
  const [hsCount, setHsCount] = useState(0)
  const [msgCount, setMsgCount] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [cleanupFirst, setCleanupFirst] = useState(true)
  const [successTx, setSuccessTx] = useState<{ digest: string; url: string } | null>(null)

  const total = hsCount + msgCount
  const isEmpty = total === 0

  const reloadContents = useCallback(async () => {
    if (!p.open || !/^0x[a-fA-F0-9]{64}$/i.test(p.objectId)) return
    setLoading(true)
    setLoadError('')
    const r = await fetchPrivateMailboxContents(p.objectId, p.myAddress)
    setLoading(false)
    if (!r.ok || !r.contents) {
      setLoadError(r.error || 'Could not load contents.')
      setHsCount(0)
      setMsgCount(0)
      return
    }
    setHsCount(r.contents.handshakeCount)
    setMsgCount(r.contents.messageCount)
  }, [p.open, p.objectId, p.myAddress])

  useEffect(() => {
    if (p.open) {
      setCleanupFirst(true)
      setActionError('')
      setSuccessTx(null)
      void reloadContents()
    }
  }, [p.open, reloadContents])

  const runCleanup = async (): Promise<boolean> => {
    const r = await cleanupPrivateMailboxOnChain(p.objectId)
    if (!r.ok) {
      const err = r.error || 'Cleanup failed.'
      setActionError(err)
      p.onStatus?.(err, 'error')
      return false
    }
    await reloadContents()
    const msg = r.message || `Cleanup OK (${r.purgedHandshakes ?? 0} HS, ${r.purgedMessages ?? 0} msg).`
    p.onStatus?.(msg, 'success')
    return true
  }

  const runDelete = async (): Promise<boolean> => {
    const r = await purgePrivateMailboxOnChain(p.objectId)
    if (!r.ok) {
      const err = r.error || 'Rebate failed.'
      setActionError(err)
      p.onStatus?.(err, 'error')
      return false
    }
    const digest = (r.digest || '').trim()
    if (!digest) {
      const err =
        'Rebate without TX digest — nothing confirmed on-chain. Check backend/wallet (vault, PACKAGE_ID, npm run dev).'
      setActionError(err)
      p.onStatus?.(err, 'error')
      return false
    }
    const txUrl =
      (r.explorerTxLink && r.explorerTxLink.trim()) || explorerTxUrlFromDigest(digest)
    setSuccessTx({ digest, url: txUrl })
    p.onStatus?.(`Mailbox deleted (rebate). TX in explorer (txblock): ${txUrl}`, 'success')
    return true
  }

  const closeAfterSuccess = () => {
    p.onDone()
    p.onOpenChange(false)
    setSuccessTx(null)
    setActionError('')
  }

  const withBusy = async (kind: 'cleanup' | 'delete' | 'both', fn: () => Promise<void>) => {
    setBusy(kind)
    setActionError('')
    try {
      await fn()
    } catch (e) {
      const err = formatActionError(e)
      setActionError(err)
      p.onStatus?.(err, 'error')
    } finally {
      setBusy(null)
    }
  }

  const onCleanupOnly = () =>
    void withBusy('cleanup', async () => {
      if (!p.walletValid) {
        setActionError('Unlock vault.')
        p.onStatus?.('Unlock vault.', 'error')
        return
      }
      await runCleanup()
    })

  const onDeleteRisky = () =>
    void withBusy('delete', async () => {
      if (!p.walletValid) {
        setActionError('Unlock vault.')
        p.onStatus?.('Unlock vault.', 'error')
        return
      }
      if (!isEmpty && !window.confirm('Mailbox is not empty — rebate often fails. Delete anyway?')) return
      if (await runDelete()) {
        /* onDone erst nach Bestätigung — Nutzer kann Explorer-Link öffnen */
      }
    })

  const onCleanupAndDelete = () =>
    void withBusy('both', async () => {
      if (!p.walletValid) {
        setActionError('Unlock vault.')
        p.onStatus?.('Unlock vault.', 'error')
        return
      }
      if (!isEmpty) {
        const cleaned = await runCleanup()
        if (!cleaned) return
        const again = await fetchPrivateMailboxContents(p.objectId, p.myAddress)
        const left = (again.contents?.handshakeCount ?? 0) + (again.contents?.messageCount ?? 0)
        if (left > 0) {
          const err = `Still ${left} entr${left === 1 ? 'y' : 'ies'} — clean up again or purge individually.`
          setActionError(err)
          p.onStatus?.(err, 'error')
          await reloadContents()
          return
        }
      }
      await runDelete()
    })

  const handleOpenChange = (open: boolean) => {
    if (!open && busy) return
    if (!open) {
      setSuccessTx(null)
      setActionError('')
    }
    p.onOpenChange(open)
  }

  return (
    <Dialog open={p.open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete private mailbox</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-left text-sm text-muted-foreground">
              <p>
                Object-ID: <code className="font-mono text-[10px] text-foreground">{maskMid(p.objectId)}</code>
              </p>
              {loading ? (
                <p className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading contents…
                </p>
              ) : loadError ? (
                <p className="text-destructive">{loadError}</p>
              ) : isEmpty ? (
                <p className="text-emerald-800 dark:text-emerald-200">
                  The mailbox is <strong className="text-foreground">empty</strong> — rebate can run directly.
                </p>
              ) : (
                <p className="rounded-md border border-amber-600/35 bg-amber-500/10 px-2 py-1.5 text-amber-950 dark:text-amber-100">
                  The mailbox still contains{' '}
                  <strong className="text-foreground">
                    {msgCount} message{msgCount === 1 ? '' : 's'}
                  </strong>{' '}
                  and{' '}
                  <strong className="text-foreground">
                    {hsCount} handshake{hsCount === 1 ? '' : 's'}
                  </strong>
                  . Clean up before rebate.
                </p>
              )}
              {!isEmpty ? (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cleanupFirst}
                    onChange={(e) => setCleanupFirst(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>Clean up mailbox first (recommended)</span>
                </label>
              ) : null}
              <p className="text-[10px]">
                Im Explorer die <strong className="text-foreground">Transaktion (txblock)</strong> öffnen — nicht die
                Object-Seite. Ohne TX-Digest wurde nichts on-chain ausgeführt.
              </p>
              {actionError ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-destructive text-xs">
                  {actionError}
                </p>
              ) : null}
              {successTx ? (
                <div className="rounded-md border border-emerald-600/40 bg-emerald-500/10 px-2 py-2 text-xs text-emerald-950 dark:text-emerald-100">
                  <p className="font-medium text-foreground">Rebate confirmed on-chain</p>
                  <p className="mt-1 font-mono text-[10px] break-all">{maskMid(successTx.digest)}</p>
                  <a
                    href={successTx.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-[11px] font-medium text-primary underline"
                  >
                    Open transaction in IOTA Explorer
                  </a>
                </div>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          {successTx ? (
            <button
              type="button"
              onClick={closeAfterSuccess}
              className="min-h-10 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Done (remove from list)
            </button>
          ) : !isEmpty ? (
            <>
              <button
                type="button"
                disabled={!p.walletValid || busy !== null || loading}
                onClick={onCleanupAndDelete}
                className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  cleanupFirst ? 'bg-destructive hover:bg-destructive/90' : 'bg-destructive/80 hover:bg-destructive/70'
                }`}
              >
                {busy === 'both' ? (
                  <span className="inline-flex items-center justify-center gap-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Clean up + delete…
                  </span>
                ) : (
                  'Clean up and delete now'
                )}
              </button>
              <button
                type="button"
                disabled={!p.walletValid || busy !== null}
                onClick={onCleanupOnly}
                className="min-h-10 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium hover:bg-primary/15 disabled:opacity-50"
              >
                {busy === 'cleanup' ? (
                  <span className="inline-flex items-center justify-center gap-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cleaning up…
                  </span>
                ) : (
                  'Clean up only'
                )}
              </button>
              <button
                type="button"
                disabled={!p.walletValid || busy !== null}
                onClick={onDeleteRisky}
                className="min-h-10 rounded-lg border border-amber-600/50 px-4 py-2 text-xs font-medium text-amber-950 dark:text-amber-100 hover:bg-amber-500/10 disabled:opacity-50"
              >
                {busy === 'delete' ? (
                  <span className="inline-flex items-center justify-center gap-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting…
                  </span>
                ) : (
                  'Delete anyway (risky)'
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={!p.walletValid || busy !== null || loading}
              onClick={onDeleteRisky}
              className="min-h-10 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              {busy === 'delete' ? (
                <span className="inline-flex items-center justify-center gap-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Please wait (wallet may prompt to sign)…
                </span>
              ) : (
                'Delete permanently (rebate)'
              )}
            </button>
          )}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => handleOpenChange(false)}
            className="min-h-9 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
