'use client'

/**
 * Experten: IOTA Move-Programm (Package-ID) für den Posteingang.
 * Nicht verwechseln mit „Datei-Paket (.morg-pkg)“ unter Optionen.
 * Platz: Einstellungen → Expertenmodus (nicht Posteingang-Toolbar).
 */

import { useState } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  inboxPackageViewFromFilter,
  isTemporaryInboxPackageView,
  maskPackageIdForUi,
} from '@/frontend/lib/inbox-package-view'
import { normalizePackageIdHex } from '@/frontend/lib/package-id-compare'

export type ChatViewInboxPackageExpertMenuProps = {
  serverPackageId?: string | null
  inboxPackageFilter: string
  packageIdSuggestions: string[]
  packageIdBusy?: boolean
  onApplyTemporary: (packageId: string) => void | Promise<void>
  onClearTemporary: () => void | Promise<void>
  onApplyPermanent: (packageId: string) => void | Promise<void>
  className?: string
  /** Ohne Toolbar-Trigger — z. B. eingebettet in Einstellungen. */
  embedded?: boolean
}

export function ChatViewInboxPackageExpertMenu(p: ChatViewInboxPackageExpertMenuProps) {
  const {
    serverPackageId,
    inboxPackageFilter,
    packageIdSuggestions,
    packageIdBusy = false,
    onApplyTemporary,
    onClearTemporary,
    onApplyPermanent,
    className,
    embedded = false,
  } = p

  const [draft, setDraft] = useState('')
  const view = inboxPackageViewFromFilter(inboxPackageFilter, serverPackageId)
  const tempActive = isTemporaryInboxPackageView(view)
  const canonical = normalizePackageIdHex(serverPackageId ?? undefined)
  const displayId = tempActive
    ? (view.temporaryPackageId ?? '')
    : canonical ?? serverPackageId?.trim() ?? ''
  const short = maskPackageIdForUi(displayId)

  const applyDraft = (permanent: boolean) => {
    const id = normalizePackageIdHex(draft.trim() || inboxPackageFilter.trim())
    if (!id) return
    if (permanent) void onApplyPermanent(id)
    else void onApplyTemporary(id)
    setDraft('')
  }

  const body = (
    <>
      {canonical ? (
        <p className="px-2 pb-1 font-mono text-[10px] text-foreground/90" title={canonical}>
          Aktiv: {maskPackageIdForUi(canonical)}
          {tempActive ? ` · Temp: ${short}` : ''}
        </p>
      ) : null}
      {tempActive ? (
        <p className="px-2 pb-2 text-[10px] leading-snug text-amber-800 dark:text-amber-200">
          Temporär: nur diese Programm-ID. Zurück = voller Posteingang.
        </p>
      ) : null}
      <div className={embedded ? 'space-y-2' : 'px-2 pb-2'}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Andere Package-ID 0x… (64 Hex)"
          spellCheck={false}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground"
          list="inbox-package-expert-suggestions"
        />
        <datalist id="inbox-package-expert-suggestions">
          {packageIdSuggestions.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </div>
      {embedded ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
            disabled={packageIdBusy || !normalizePackageIdHex(draft.trim() || inboxPackageFilter.trim())}
            onClick={() => applyDraft(false)}
          >
            Temporär anzeigen
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
            disabled={packageIdBusy || !normalizePackageIdHex(draft.trim() || inboxPackageFilter.trim())}
            onClick={() => applyDraft(true)}
          >
            Dauerhaft wechseln
          </button>
          {tempActive ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
              disabled={packageIdBusy}
              onClick={() => void onClearTemporary()}
            >
              <RotateCcw className="h-3.5 w-3.5 opacity-80" aria-hidden />
              Zurück zum aktiven Vertrag
            </button>
          ) : null}
        </div>
      ) : null}
      {!embedded ? (
        <>
          <DropdownMenuItem
            disabled={packageIdBusy || !normalizePackageIdHex(draft.trim() || inboxPackageFilter.trim())}
            onSelect={(e) => {
              e.preventDefault()
              applyDraft(false)
            }}
          >
            Temporär nur dieses Programm anzeigen
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={packageIdBusy || !normalizePackageIdHex(draft.trim() || inboxPackageFilter.trim())}
            onSelect={(e) => {
              e.preventDefault()
              applyDraft(true)
            }}
          >
            Dauerhaft wechseln (Server)
          </DropdownMenuItem>
          {tempActive ? (
            <DropdownMenuItem
              disabled={packageIdBusy}
              onSelect={(e) => {
                e.preventDefault()
                void onClearTemporary()
              }}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5 opacity-80" aria-hidden />
              Zurück zum aktiven Vertrag
            </DropdownMenuItem>
          ) : null}
        </>
      ) : null}
      {packageIdSuggestions.length > 0 ? (
        <>
          {!embedded ? <DropdownMenuSeparator /> : <div className="my-2 border-t border-border/60" />}
          <p className="px-0 pb-1 text-[10px] text-muted-foreground">
            Bekannte IDs — antippen = temporär
          </p>
          <ul className="max-h-36 space-y-0.5 overflow-y-auto">
            {packageIdSuggestions.slice(0, 8).map((id) => {
              const n = normalizePackageIdHex(id)
              const isActive = Boolean(canonical && n === canonical)
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left font-mono text-[10px] hover:bg-muted disabled:opacity-50"
                    disabled={packageIdBusy || (isActive && !tempActive)}
                    onClick={() => {
                      if (isActive && !tempActive) return
                      void onApplyTemporary(id)
                    }}
                  >
                    {maskPackageIdForUi(id)}
                    {isActive ? ' · aktiv' : ''}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <p className="pt-1 text-[10px] text-muted-foreground">
          Keine Historie — andere 0x… oben eintippen.
        </p>
      )}
    </>
  )

  if (embedded) {
    return <div className={cn('space-y-2', className)}>{body}</div>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={packageIdBusy}
          className={cn(
            'inline-flex max-w-[min(100%,14rem)] items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors',
            tempActive
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100'
              : 'border-border bg-muted/30 text-foreground hover:bg-muted',
            className
          )}
          title={
            displayId
              ? `Aktives IOTA-Move-Programm (Package-ID):\n${displayId}`
              : 'IOTA-Move-Programm (Package-ID)'
          }
        >
          <span className="truncate font-mono">
            {tempActive ? 'Vertrag temp: ' : 'Vertrag: '}
            {short || '—'}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,20rem)]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          IOTA-Vertrag (Package-ID)
        </DropdownMenuLabel>
        {body}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
