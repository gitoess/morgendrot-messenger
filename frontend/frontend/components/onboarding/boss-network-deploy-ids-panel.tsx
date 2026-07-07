'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { cn } from '@/lib/utils'

export type NetworkDeployIds = {
  packageId?: string
  mailboxId?: string
}

const PKG_RE = /^0x[a-fA-F0-9]{64}$/i

export function hasNetworkDeployPackageId(ids?: NetworkDeployIds): boolean {
  return PKG_RE.test((ids?.packageId || '').trim())
}

export function hasAnyNetworkDeployIds(testnet?: NetworkDeployIds, mainnet?: NetworkDeployIds): boolean {
  return hasNetworkDeployPackageId(testnet) || hasNetworkDeployPackageId(mainnet)
}

export function buildBossDeployIdExtrasFromApi(apiStatus?: ApiStatus | null) {
  const extras: { label: string; value: string; copyKey: string }[] = []
  const add = (label: string, value: string | undefined, copyKey: string) => {
    const v = (value || '').trim()
    if (PKG_RE.test(v)) extras.push({ label, value: v, copyKey })
  }
  add('Vault-Registry', apiStatus?.einsatzConfig?.vaultRegistryId, 'vault-reg')
  add('Command-Registry', apiStatus?.einsatzConfig?.commandRegistryId, 'cmd-reg')
  add('Upgrade Cap', apiStatus?.einsatzConfig?.upgradeCapId, 'upgrade-cap')
  return extras
}

function IdRow(p: {
  label: string
  value: string
  copyKey: string
  copied: string | null
  onCopy: (v: string, k: string) => void
}) {
  if (!p.value.trim()) return null
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{p.label}</p>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-foreground" title={p.value}>
          {p.value}
        </p>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 text-[10px] text-primary hover:underline"
          onClick={() => p.onCopy(p.value, p.copyKey)}
        >
          {p.copied === p.copyKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {p.copied === p.copyKey ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
    </div>
  )
}

function NetworkBlock(p: {
  network: 'testnet' | 'mainnet'
  ids: NetworkDeployIds
  copied: string | null
  onCopy: (v: string, k: string) => void
}) {
  if (!hasNetworkDeployPackageId(p.ids)) return null
  const prefix = p.network === 'testnet' ? 'tn' : 'mn'
  const title = p.network === 'testnet' ? 'Testnet (Übung)' : 'Mainnet (Produktion)'
  const borderClass =
    p.network === 'testnet' ? 'border-sky-500/35 bg-sky-500/10' : 'border-violet-500/35 bg-violet-500/10'

  return (
    <div className={cn('space-y-2 rounded-md border px-3 py-2.5', borderClass)}>
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <IdRow
        label="Package-ID"
        value={p.ids.packageId || ''}
        copyKey={`${prefix}-pkg`}
        copied={p.copied}
        onCopy={p.onCopy}
      />
      <IdRow
        label="Postfach (Mailbox)"
        value={p.ids.mailboxId || ''}
        copyKey={`${prefix}-mb`}
        copied={p.copied}
        onCopy={p.onCopy}
      />
    </div>
  )
}

type Props = {
  testnet?: NetworkDeployIds
  mainnet?: NetworkDeployIds
  /** Zusätzliche globale IDs (Registries, Upgrade Cap) — nur wenn gesetzt. */
  extras?: { label: string; value: string; copyKey: string }[]
  className?: string
}

export function BossNetworkDeployIdsPanel(p: Props) {
  const [copied, setCopied] = useState<string | null>(null)

  if (!hasAnyNetworkDeployIds(p.testnet, p.mainnet) && !(p.extras?.length ?? 0)) {
    return null
  }

  const copyId = (value: string, key: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(key)
      window.setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className={cn('space-y-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-3', p.className)}>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
          Chain-IDs zum Sichern
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Kopiere oder notiere diese IDs (Passwortmanager, Handoff, Support). Sie liegen auch in der Boss-{' '}
          <span className="font-mono">.env</span> — Testnet und Mainnet haben jeweils eigenes Package.
        </p>
      </div>
      <NetworkBlock network="testnet" ids={p.testnet || {}} copied={copied} onCopy={copyId} />
      <NetworkBlock network="mainnet" ids={p.mainnet || {}} copied={copied} onCopy={copyId} />
      {p.extras?.map((row) => (
        <IdRow
          key={row.copyKey}
          label={row.label}
          value={row.value}
          copyKey={row.copyKey}
          copied={copied}
          onCopy={copyId}
        />
      ))}
    </div>
  )
}
