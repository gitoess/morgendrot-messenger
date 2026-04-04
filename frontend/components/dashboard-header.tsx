'use client'

import { Sun, Moon, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SetupOverlay } from '@/components/setup-overlay'

interface DashboardHeaderProps {
  onBackToDashboard?: () => void
  showBack?: boolean
}

export function DashboardHeader({
  onBackToDashboard,
  showBack = false,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {showBack && onBackToDashboard && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToDashboard}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
          )}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">M</span>
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none text-foreground">
                Morgendrot
              </h1>
              <p className="text-xs text-muted-foreground">IOTA Rebased</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open('http://127.0.0.1:3342', '_blank')
            }}
          >
            Alte Oberfläche
          </Button>
          <SetupOverlay />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              document.documentElement.classList.toggle('dark')
            }}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
