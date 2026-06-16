'use client'

import { MessageSquare, Lock, Eye, Crown } from 'lucide-react'
import type { ProjectType, ProjectVariant } from '@/frontend/lib/types'
import type { DashboardFeatureDef } from '@/frontend/lib/dashboard-active-view'

export type DashboardFeature = Omit<DashboardFeatureDef, 'variants'> & {
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
  variants: { id: ProjectVariant; title: string; hint: string }[]
}

export const projektFeatures: DashboardFeature[] = [
  {
    id: 'chat',
    title: 'Nachrichten',
    subtitle: 'Sicher kommunizieren',
    icon: <MessageSquare className="h-6 w-6" />,
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    variants: [
      {
        id: 'private-chat',
        title: 'Nachrichten',
        hint: '1:1 Privat & Pinnwand — Gruppenchat geplant (M2, Fahrplan § H.22)',
      },
    ],
  },
  {
    id: 'einsatzleitung',
    title: 'Einsatzleitung',
    subtitle: 'Team, Kontakte, Export',
    icon: <Crown className="h-6 w-6" />,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    variants: [
      { id: 'einsatzleitung-hub', title: 'Einsatzleitung', hint: 'Handoff-ZIP, Helfer-QR (WLAN)' },
    ],
  },
  {
    id: 'lock',
    title: 'Zugang',
    subtitle: 'Schlüssel verwalten',
    icon: <Lock className="h-6 w-6" />,
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    variants: [
      { id: 'smart-lock', title: 'Türschloss', hint: 'Per IOTA öffnen' },
      { id: 'access-key-ticket', title: 'Schlüssel', hint: 'NFT-Berechtigungen' },
      { id: 'payment-trigger', title: 'Zahlung', hint: 'Bezahlen & Freischalten' },
    ],
  },
  {
    id: 'monitor',
    title: 'Überwachung',
    subtitle: 'Geräte im Blick',
    icon: <Eye className="h-6 w-6" />,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    variants: [
      { id: 'sensor-central', title: 'Sensoren', hint: 'Alarme empfangen' },
      { id: 'device-monitor', title: 'Geräte', hint: 'Online-Status prüfen' },
      { id: 'heartbeat-sender', title: 'Heartbeat', hint: 'Lebenszeichen senden' },
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
]

export function featureTitle(id: ProjectType, features: DashboardFeature[]): string | undefined {
  return features.find((f) => f.id === id)?.title
}
