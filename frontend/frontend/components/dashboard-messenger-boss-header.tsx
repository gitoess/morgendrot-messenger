'use client'

import Link from 'next/link'
import { BookOpen, Settings } from 'lucide-react'
import { DashboardRolePill } from '@/frontend/components/dashboard-role-pill'
import { DashboardHeaderAddress } from '@/frontend/components/dashboard-header-address'

export function DashboardMessengerBossHeader(p: {
  role?: string | null
  myAddressFull?: string | null
  onOpenSettings: () => void
}) {
  return (
    <header className="border-b border-border/80 bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-foreground">Morgendrot</h1>
            <DashboardRolePill role={p.role} />
          </div>
          <DashboardHeaderAddress address={p.myAddressFull} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/handbook"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Handbuch"
            aria-label="Handbuch öffnen"
          >
            <BookOpen className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={p.onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Einstellungen"
            aria-label="Einstellungen"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
