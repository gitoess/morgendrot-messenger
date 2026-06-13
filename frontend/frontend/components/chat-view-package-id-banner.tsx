'use client'

/**
 * Hinweis, wenn Posteingangs-Package-ID (Filter) ≠ kanonische ID aus /api/status.
 * Aktion: /set-package-id wie „Als aktiv speichern“ + Posteingang neu laden (applyPackageIdBackend).
 */

import { ArrowRightCircle } from 'lucide-react'

export type ChatViewPackageIdBannerProps = {
  visible: boolean
  serverPackageId: string
  busy: boolean
  onSyncToServer: () => void
}

export function ChatViewPackageIdBanner(p: ChatViewPackageIdBannerProps) {
  const { visible, serverPackageId, busy, onSyncToServer } = p
  if (!visible) return null

  const short =
    serverPackageId.startsWith('0x') && serverPackageId.length > 20
      ? `${serverPackageId.slice(0, 10)}…${serverPackageId.slice(-6)}`
      : serverPackageId

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-500/35 bg-sky-500/[0.08] px-3 py-2.5 text-sm text-foreground dark:bg-sky-950/30"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium text-sky-950 dark:text-sky-100">Neue Protokoll-Version verfügbar</p>
        <p className="text-xs leading-snug text-muted-foreground">
          Dein Posteingang ist noch auf eine andere Package-ID eingestellt als die Basis (
          <span className="font-mono text-[11px] text-foreground/90" title={serverPackageId}>
            {short}
          </span>
          ). „Jetzt updaten“ übernimmt die Server-ID und lädt den Posteingang neu.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onSyncToServer}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <ArrowRightCircle className="h-3.5 w-3.5" aria-hidden />
        {busy ? '…' : 'Jetzt updaten'}
      </button>
    </div>
  )
}
