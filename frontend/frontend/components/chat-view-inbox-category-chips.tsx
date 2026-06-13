'use client'

import { cn } from '@/lib/utils'
import type { InboxOverviewCategory } from '@/frontend/lib/inbox-overview-filter'

const CHIP_LABELS: Record<InboxOverviewCategory, string> = {
  alle: 'Alle',
  lagebild: 'Pinnwand',
  direkt: 'Direkt',
  funk: 'Funk',
}

const CHIP_ORDER: InboxOverviewCategory[] = ['alle', 'lagebild', 'direkt', 'funk']

export function ChatViewInboxCategoryChips(p: {
  category: InboxOverviewCategory
  onCategoryChange: (c: InboxOverviewCategory) => void
  unreadCounts: Record<InboxOverviewCategory, number>
  showLagebild?: boolean
}) {
  const chips = CHIP_ORDER.filter((c) => c !== 'lagebild' || p.showLagebild !== false)

  return (
    <div
      className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2"
      role="tablist"
      aria-label="Posteingang Kategorien"
    >
      {chips.map((id) => {
        const active = p.category === id
        const unread = p.unreadCounts[id] ?? 0
        const showBadge = !active && unread > 0
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => p.onCategoryChange(id)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? id === 'lagebild'
                  ? 'border-orange-500/60 bg-orange-500/15 text-orange-950 dark:text-orange-100'
                  : id === 'funk'
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                    : 'border-primary/50 bg-primary/10 text-foreground'
                : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
            )}
          >
            {CHIP_LABELS[id]}
            {showBadge ? (
              <span
                className="min-w-[1.1rem] rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white"
                aria-label={`${unread} ungelesen`}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
