'use client'

import { MessageSquare, Crown, Shield } from 'lucide-react'
import type { ProjectType, ProjectVariant } from '@/frontend/lib/types'
import type { DashboardFeatureDef } from '@/frontend/lib/dashboard-active-view'

export type DashboardFeature = DashboardFeatureDef & {
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
  variants: { id: ProjectVariant; title: string; hint: string }[]
}

export const messengerFeatures: DashboardFeature[] = [
  {
    id: 'chat',
    title: 'Nachrichten',
    subtitle: 'Sicher kommunizieren',
    icon: <MessageSquare className="h-6 w-6" />,
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    variants: [
      { id: 'private-chat', title: 'Nachrichten', hint: 'Chats, Funk, Team-Postfächer' },
    ],
  },
  {
    id: 'einsatzleitung',
    title: 'Einsatzleitung',
    subtitle: 'Team, Handoff, Helfer',
    icon: <Crown className="h-6 w-6" />,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    variants: [
      { id: 'einsatzleitung-hub', title: 'Einsatzleitung', hint: 'Handoff-ZIP, Helfer-QR (WLAN)' },
    ],
  },
  {
    id: 'boss',
    title: 'Steuerung',
    subtitle: 'Geräte befehligen',
    icon: <Crown className="h-6 w-6" />,
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    variants: [
      { id: 'boss-signer', title: 'Boss-Modus', hint: 'Befehle an Geräte' },
      { id: 'pinnwand-admin', title: 'Admin', hint: 'Kanäle verwalten' },
    ],
  },
  {
    id: 'vault',
    title: 'Tresor & Sicherheit',
    subtitle: 'Keys & Zugänge sichern',
    icon: <Shield className="h-6 w-6" />,
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    variants: [
      { id: 'local-vault', title: 'Tresor öffnen', hint: 'Passwort, Seed, Export' },
      { id: 'emergency-purge', title: 'Notfall', hint: 'Alles löschen' },
    ],
  },
]

export function featureTitle(id: ProjectType, features: DashboardFeature[]): string | undefined {
  return features.find((f) => f.id === id)?.title
}
