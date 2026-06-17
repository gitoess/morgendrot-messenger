'use client'

import { cn } from '@/lib/utils'
import { setDashboardSosPending } from '@/frontend/lib/dashboard-sos-pending'

export function DashboardSosEmergencyButton(p: {
  onOpenMessages: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      title="SOS — Hilferuf (Text), MORG_EMERGENCY_V1. Kein automatischer 112-Ruf."
      onClick={() => {
        const text = window.prompt(
          'SOS — Hilferuf\n\nKurz beschreiben, was passiert ist (Ort, Verletzte, Gefahr):\n\n' +
            'Windows-Diktat: Win+H · Android: Mikrofon in der Tastatur'
        )
        if (text == null) return
        if (!text.trim()) {
          window.alert(
            'Ohne Text kein Hilferuf. Bitte erneut tippen oder diktieren (Win+H / Tastatur-Mikro).'
          )
          return
        }
        if (
          !window.confirm(
            'Echten Hilferuf (SOS) senden?\n\n' +
              'Du wechselst in Nachrichten — Versand an den eingestellten Empfänger (Funk oder Online) ' +
              'mit Notfall-Kennzeichnung MORG_EMERGENCY_V1. Kein automatischer 112-Ruf.\n\n' +
              'Nur nutzen, wenn wirklich Hilfe nötig ist.'
          )
        ) {
          return
        }
        setDashboardSosPending(text.trim())
        p.onOpenMessages()
      }}
      className={cn(
        'mx-auto w-full max-w-md rounded-xl border-2 border-red-600/70 bg-red-600/95 px-4 py-4 text-base font-bold tracking-tight text-white shadow-md transition-colors hover:bg-red-500 sm:text-lg',
        p.className
      )}
    >
      SOS — Hilferuf
    </button>
  )
}
