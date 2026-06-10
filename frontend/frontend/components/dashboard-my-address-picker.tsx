'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Copy, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import { setConfig } from '@/frontend/lib/api'
import { mergeMyAddressOptions, recordSeenMyAddress } from '@/frontend/lib/my-address-local-history'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

function maskMid(addr: string): string {
  const t = addr.trim()
  if (t.length < 20) return t || '—'
  return `${t.slice(0, 10)}…${t.slice(-8)}`
}

export type DashboardMyAddressPickerProps = {
  apiSnapshot: (ApiStatus & { error?: string }) | null
  onAfterSet?: () => void | Promise<void>
}

export function DashboardMyAddressPicker({ apiSnapshot, onAfterSet }: DashboardMyAddressPickerProps) {
  const { t } = useAppTranslation('dashboard')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const current = (apiSnapshot?.myAddressFull ?? '').trim()
  const options = useMemo(() => mergeMyAddressOptions(current || undefined), [current])

  useEffect(() => {
    if (current && /^0x[a-fA-F0-9]{64}$/i.test(current)) recordSeenMyAddress(current)
  }, [current])

  const applyAddress = async (addr: string) => {
    const a = addr.trim()
    if (!/^0x[a-fA-F0-9]{64}$/i.test(a)) {
      setMsg('Adresse muss 0x + 64 Hex sein.')
      return
    }
    setBusy(a)
    setMsg(null)
    const r = await setConfig('MY_ADDRESS', a)
    setBusy(null)
    if (r.ok) {
      recordSeenMyAddress(a)
      setOpen(false)
      setMsg(null)
      await onAfterSet?.()
    } else {
      setMsg((r as { error?: string; message?: string }).error || (r as { message?: string }).message || 'Speichern fehlgeschlagen')
    }
  }

  const copyAddr = async (a: string) => {
    try {
      await navigator.clipboard.writeText(a)
      setCopied(a)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setMsg('Zwischenablage nicht verfügbar.')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80">{t('address.label')}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex max-w-[min(100%,22rem)] items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] text-foreground hover:bg-accent',
              !current && 'text-muted-foreground'
            )}
            title={current || t('address.noBackendTitle')}
          >
            <span className="truncate">{current ? maskMid(current) : t('address.notConfigured')}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,26rem)] space-y-3 text-sm" align="start">
          <p className="text-xs text-muted-foreground">
            Liste = <strong className="text-foreground">lokal gemerkte</strong> Adressen plus die aktuelle vom Backend.
            „Übernehmen“ schreibt <span className="font-mono">MY_ADDRESS</span> in die <span className="font-mono">.env</span> der
            Basis und aktualisiert die Sitzung (Berechtigung: Konfiguration ändern, typisch Boss).
          </p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {options.length === 0 ? (
              <li className="text-xs text-muted-foreground">Noch keine gültige Adresse bekannt — Setup / .env prüfen.</li>
            ) : (
              options.map((addr) => {
                const active = addr.toLowerCase() === current.toLowerCase()
                return (
                  <li
                    key={addr}
                    className={cn(
                      'flex flex-col gap-1 rounded-md border p-2 text-xs',
                      active ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border bg-card'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <code className="break-all font-mono text-[11px] leading-snug">{addr}</code>
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => void copyAddr(addr)}
                          title="Kopieren"
                        >
                          {copied === addr ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                    {active ? (
                      <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Aktiv (Backend)</span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 w-full text-xs"
                        disabled={busy !== null}
                        onClick={() => void applyAddress(addr)}
                      >
                        {busy === addr ? 'Speichern…' : 'Als MY_ADDRESS übernehmen'}
                      </Button>
                    )}
                  </li>
                )
              })
            )}
          </ul>
          {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}
