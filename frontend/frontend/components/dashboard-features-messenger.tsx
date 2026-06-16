'use client'

import { MessageSquare, Crown } from 'lucide-react'
import type { ProjectType, ProjectVariant } from '@/frontend/lib/types'
import type { DashboardFeatureDef } from '@/frontend/lib/dashboard-active-view'

export type DashboardFeature = Omit<DashboardFeatureDef, 'variants'> & {
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
  variants: { id: ProjectVariant; title: string; hint: string }[]
}

type MessengerFeatureShell = DashboardFeatureDef & {
  icon: React.ReactNode
  color: string
  variants: { id: ProjectVariant }[]
}

/** Icons/Farben — Texte über `useMessengerFeatures()` / dashboard.json. */
export const messengerFeatureShells: MessengerFeatureShell[] = [
  {
    id: 'chat',
    icon: <MessageSquare className="h-6 w-6" />,
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    variants: [{ id: 'private-chat' }],
  },
  {
    id: 'einsatzleitung',
    icon: <Crown className="h-6 w-6" />,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    variants: [{ id: 'einsatzleitung-hub' }],
  },
  {
    id: 'boss',
    icon: <Crown className="h-6 w-6" />,
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    variants: [{ id: 'boss-signer' }, { id: 'pinnwand-admin' }],
  },
]

/** @deprecated Nur für Session-Restore-IDs — UI-Texte via useMessengerFeatures(). */
export const messengerFeatures: DashboardFeature[] = messengerFeatureShells.map((shell) => ({
  ...shell,
  title: shell.id,
  subtitle: '',
  variants: shell.variants.map((v) => ({ ...v, title: v.id, hint: '' })),
}))

export function featureTitle(id: ProjectType, features: DashboardFeature[]): string | undefined {
  return features.find((f) => f.id === id)?.title
}
