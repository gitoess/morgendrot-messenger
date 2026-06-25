'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SettingsCategoryId } from '@/frontend/lib/settings-navigation'

export type { SettingsCategoryId }

type SettingsCategoryNavProps = {
  active: SettingsCategoryId | null
  onSelect: (id: SettingsCategoryId) => void
  categories: { id: SettingsCategoryId; label: string; icon?: ReactNode }[]
}

export function SettingsCategoryNav(p: SettingsCategoryNavProps) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Einstellungsbereiche">
      {p.categories.map((cat) => {
        const selected = p.active === cat.id
        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => p.onSelect(cat.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              selected
                ? 'border-[var(--path-online)] bg-[color-mix(in_oklab,var(--path-online)_12%,var(--card))] text-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            {cat.icon}
            {cat.label}
            <ChevronDown className={cn('h-4 w-4 transition-transform', selected ? 'rotate-180' : '')} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

type SettingsCollapsiblePanelProps = {
  open: boolean
  title: string
  icon?: ReactNode
  handbookAnchor?: string
  children: ReactNode
}

export function SettingsCollapsiblePanel(p: SettingsCollapsiblePanelProps) {
  if (!p.open) return null
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-3 border-b border-border/60 pb-3">
        {p.icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {p.icon}
          </div>
        ) : null}
        <h3 className="text-base font-semibold text-foreground">{p.title}</h3>
      </div>
      <div className="space-y-4">{p.children}</div>
    </section>
  )
}
