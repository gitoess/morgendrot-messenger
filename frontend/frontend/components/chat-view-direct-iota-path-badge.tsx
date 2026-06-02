'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  formatDirectChainSnapshotStatusLine,
  getDirectChainSnapshotMeta,
} from '@/frontend/lib/direct-iota-chain-context'
import { getDirectIotaHeaderStatusLine } from '@/frontend/lib/autarky-status-line'
import { DIRECT_IOTA_UI_CHANGED } from '@/frontend/lib/direct-iota-ui-events'
import {
  getDirectIotaPathUiShortLine,
  getDirectIotaPathUiState,
  type DirectIotaPathUiContext,
} from '@/frontend/lib/direct-iota-plain-submit'

export type ChatViewDirectIotaPathBadgeProps = {
  /** Aus `/api/status` — steuert „Basis offline“ in der Kurzzeile. */
  backendOnline?: boolean
  className?: string
}

/**
 * Kompakte IOTA-Sendeweg-Zeile im Chat-Kopf (§ H.15 Phase 2).
 */
export function ChatViewDirectIotaPathBadge({ backendOnline, className }: ChatViewDirectIotaPathBadgeProps) {
  const ctx: DirectIotaPathUiContext = { backendOnline }

  const readUi = useCallback(() => {
    const full = getDirectIotaPathUiState(ctx)
    return { line: getDirectIotaPathUiShortLine(ctx), title: full.detail }
  }, [backendOnline])

  const [line, setLine] = useState(() => readUi().line)
  const [title, setTitle] = useState(() => readUi().title)
  const [snapshotLine, setSnapshotLine] = useState('')
  const [snapshotStale, setSnapshotStale] = useState(false)
  const [headerStatusLine, setHeaderStatusLine] = useState<string | null>(null)

  const refresh = useCallback(() => {
    const next = readUi()
    setLine(next.line)
    setTitle(next.title)
    const snapMeta = getDirectChainSnapshotMeta()
    setSnapshotLine(formatDirectChainSnapshotStatusLine(snapMeta))
    setSnapshotStale(snapMeta.stale && snapMeta.hasSnapshot)
    setHeaderStatusLine(getDirectIotaHeaderStatusLine())
  }, [readUi])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(DIRECT_IOTA_UI_CHANGED, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(DIRECT_IOTA_UI_CHANGED, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [refresh])

  const isActive = line.includes('Direkt-RPC aktiv')
  const isRelay = line.startsWith('über Relay')
  const statusReady = headerStatusLine?.includes('vollständig') ?? false
  const statusWarn = Boolean(headerStatusLine) && !statusReady

  return (
    <div className={cn('flex max-w-[14rem] flex-col items-end gap-0.5', className)}>
      <p
        className={cn(
          'text-right text-[10px] leading-snug',
          isActive && 'font-medium text-emerald-700 dark:text-emerald-300',
          isRelay && 'text-muted-foreground',
          !isActive && !isRelay && 'text-muted-foreground'
        )}
        title={title}
      >
        IOTA: {line}
      </p>
      {snapshotStale ? (
        <p
          className="text-right text-[9px] leading-snug text-amber-800 dark:text-amber-200"
          title={snapshotLine}
        >
          IDs-Snapshot veraltet
        </p>
      ) : null}
      {headerStatusLine ? (
        <p
          className={cn(
            'text-right text-[9px] leading-snug',
            statusReady
              ? 'text-emerald-800 dark:text-emerald-200'
              : statusWarn
                ? 'text-amber-800 dark:text-amber-200'
                : 'text-muted-foreground'
          )}
          title="Direkt-RPC — Checkliste im Puls (Autarkie oder Setup-Lücken)"
        >
          {headerStatusLine}
        </p>
      ) : null}
    </div>
  )
}
