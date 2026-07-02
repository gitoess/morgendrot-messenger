'use client'

import { useState } from 'react'
import { Database, Loader2 } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { Button } from '@/components/ui/button'
import {
  bossRegistryStatus,
  createBossGlobalsRegistries,
} from '@/frontend/lib/boss-registry-bootstrap'

function StatusDot(p: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={p.ok ? 'text-emerald-500' : 'text-muted-foreground'} aria-hidden>
        {p.ok ? '✓' : '○'}
      </span>
      <span className={p.ok ? 'text-foreground' : 'text-muted-foreground'}>{p.label}</span>
    </div>
  )
}

export function BossRegistryBootstrapPanel(p: {
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  onReload?: () => void
  className?: string
  /** Wizard: nur Hinweis + Aktion wenn nötig */
  variant?: 'full' | 'compact'
}) {
  const variant = p.variant ?? 'full'
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const status = bossRegistryStatus(p.apiSnapshot)

  if (!status.hasPackage) return null
  if (variant === 'compact' && !status.needsBootstrap) return null

  const runBootstrap = async (force = false) => {
    if (
      !force &&
      status.hasMailbox &&
      window.confirm(
        'MAILBOX_ID ist bereits gesetzt.\n\ncreate_globals legt neue Registry-IDs an — nur bei neuem Package sinnvoll.\n\nTrotzdem fortfahren?'
      ) === false
    ) {
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const r = await createBossGlobalsRegistries({
        packageId: p.apiSnapshot?.packageId,
        force: force || status.hasMailbox,
      })
      setMsg(r.ok ? r.message || 'Registries angelegt.' : r.error || 'Fehlgeschlagen.')
      if (r.ok) p.onReload?.()
    } finally {
      setBusy(false)
    }
  }

  if (variant === 'compact') {
    return (
      <div className={p.className ?? 'rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2'}>
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Nach dem Deploy fehlen noch Postfach- und Registry-IDs auf der Chain.
        </p>
        {p.backendOnline ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void runBootstrap(false)}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Registries anlegen
          </Button>
        ) : null}
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </div>
    )
  }

  return (
    <div className={p.className ?? 'rounded-md border border-border/80 bg-muted/30 p-3 space-y-2'}>
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" aria-hidden />
        <p className="text-xs font-medium text-foreground">Move-Registries (create_globals)</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Einmal pro neuer PACKAGE_ID: Vault-Registry, Server-Postfach und Command-Registry on-chain anlegen.
      </p>
      <div className="grid gap-1">
        <StatusDot ok={status.hasMailbox} label="MAILBOX_ID (Server-Postfach)" />
        <StatusDot ok={status.hasVaultRegistry} label="VAULT_REGISTRY_ID" />
        <StatusDot ok={status.hasCommandRegistry} label="COMMAND_REGISTRY_ID" />
      </div>
      {status.needsBootstrap ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Nach Deploy fehlen noch Registry-IDs — create_globals ausführen (Gas, IOTA-CLI auf diesem PC).
        </p>
      ) : (
        <p className="text-xs text-emerald-800 dark:text-emerald-200">Registries konfiguriert.</p>
      )}
      {p.backendOnline && status.needsBootstrap ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runBootstrap(false)}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Registries anlegen (create_globals)
        </Button>
      ) : null}
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  )
}
