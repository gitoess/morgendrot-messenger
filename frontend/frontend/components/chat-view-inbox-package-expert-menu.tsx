'use client'

/**
 * Experten: IOTA Move-Programm (Package-ID) für den Posteingang.
 * Nicht verwechseln mit „Datei-Paket (.morg-pkg)“ unter Optionen.
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
              ? `Aktives IOTA-Move-Programm (Package-ID):\n${displayId}\nNicht Datei-Paket (.morg-pkg).`
              : 'IOTA-Move-Programm (Package-ID) — Expertenfilter'
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
          IOTA-Vertrag (Move Package-ID)
        </DropdownMenuLabel>
        <p className="px-2 pb-2 text-[10px] leading-snug text-muted-foreground">
          Die <strong className="text-foreground">0x…-Zahl</strong> ist die On-Chain-Programm-ID (Smart Contract),
          mit der Mailboxen gebaut wurden — <strong className="text-foreground">keine Wallet-Adresse</strong>,{' '}
          <strong className="text-foreground">kein</strong> .morg-pkg.
        </p>
        <p className="px-2 pb-2 text-[10px] leading-snug text-muted-foreground">
          <strong className="text-foreground">Warum oft nur eine?</strong> Die Liste kommt aus Deploy-Historie +
          Posteingang. Ein frisches/einmaliges Setup kennt nur die aktuelle ID — das ist normal. Andere IDs
          brauchst du nur nach <em>Contract-Upgrade</em> / altem Netz, um alte Nachrichten noch zu finden.
          Alltag: <strong className="text-foreground">nicht wechseln</strong>. Andere ID = unten eintippen (nicht
          aus einer magischen Auswahlliste).
        </p>
        {canonical ? (
          <p className="px-2 pb-1 font-mono text-[10px] text-foreground/90" title={canonical}>
            Aktiv: {maskPackageIdForUi(canonical)}
          </p>
        ) : null}
        {tempActive ? (
          <p className="px-2 pb-2 text-[10px] leading-snug text-amber-800 dark:text-amber-200">
            Nur diese eine Programm-ID — andere Nachrichten ausgeblendet. „Zurück zum aktiven Vertrag“ für den vollen
            Posteingang.
          </p>
        ) : null}
        <div className="px-2 pb-2">
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
          Dauerhaft wechseln (Server /set-package-id)
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
        {packageIdSuggestions.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
              Bekannte IDs — einmal antippen = temporär laden (kein Doppelklick nötig)
            </DropdownMenuLabel>
            {packageIdSuggestions.slice(0, 8).map((id) => {
              const norm = normalizePackageIdHex(id)
              const isActive = Boolean(canonical && norm === canonical)
              return (
                <DropdownMenuItem
                  key={id}
                  disabled={packageIdBusy || (isActive && !tempActive)}
                  onSelect={(e) => {
                    e.preventDefault()
                    if (isActive && !tempActive) return
                    void onApplyTemporary(id)
                  }}
                >
                  <span className="font-mono text-[10px]">
                    {maskPackageIdForUi(id)}
                    {isActive ? ' · aktiv' : ' · antippen'}
                  </span>
                </DropdownMenuItem>
              )
            })}
          </>
        ) : (
          <>
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-[10px] text-muted-foreground">
              Keine Historie — nur aktuelle ID bekannt. Andere 0x… oben eintippen.
            </p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
