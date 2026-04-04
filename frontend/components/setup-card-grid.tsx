'use client'

import { useState } from 'react'
import {
  MessageSquare,
  Lock,
  Eye,
  Crown,
  Shield,
  MessageCircle,
  Megaphone,
  KeyRound,
  Ticket,
  Zap,
  Flame,
  Monitor,
  Wifi,
  Users,
  Radio,
  HardDrive,
  AlertTriangle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ProjectType, ProjectVariant } from '@/lib/types'

const iconMap = {
  MessageSquare,
  Lock,
  Eye,
  Crown,
  Shield,
}

// More descriptive variant icons
const variantIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'private-chat': MessageCircle,
  'pinnwand': Megaphone,
  'smart-lock': Lock,
  'access-key-ticket': Ticket,
  'payment-trigger': Zap,
  'sensor-central': Flame,
  'device-monitor': Monitor,
  'heartbeat-sender': Wifi,
  'boss-signer': Users,
  'pinnwand-admin': Radio,
  'local-vault': HardDrive,
  'emergency-purge': AlertTriangle,
}

interface SetupCard {
  id: ProjectType
  title: string
  description: string
  icon: keyof typeof iconMap
  variants: {
    id: ProjectVariant
    title: string
    description: string
  }[]
}

const setupCards: SetupCard[] = [
  {
    id: 'chat',
    title: 'Nachrichten',
    description: 'Senden & Empfangen',
    icon: 'MessageSquare',
    variants: [
      {
        id: 'private-chat',
        title: 'Privat-Chat',
        description: 'Verschlüsselt mit einem Partner',
      },
      {
        id: 'pinnwand',
        title: 'Pinnwand',
        description: 'Offene Broadcast-Nachrichten',
      },
    ],
  },
  {
    id: 'lock',
    title: 'Zugang',
    description: 'Schlüssel & Tickets',
    icon: 'Lock',
    variants: [
      {
        id: 'smart-lock',
        title: 'Smart-Lock',
        description: 'Türschloss per IOTA öffnen',
      },
      {
        id: 'access-key-ticket',
        title: 'Schlüssel & Tickets',
        description: 'NFT-Zugangsberechtigungen',
      },
      {
        id: 'payment-trigger',
        title: 'Zahlungs-Trigger',
        description: 'Gerät nach Zahlung freischalten',
      },
    ],
  },
  {
    id: 'monitor',
    title: 'Überwachung',
    description: 'Sensoren & Geräte',
    icon: 'Eye',
    variants: [
      {
        id: 'sensor-central',
        title: 'Sensor-Zentrale',
        description: 'Alarme bei Rauch, Wasser, Einbruch',
      },
      {
        id: 'device-monitor',
        title: 'Geräte-Monitor',
        description: 'Prüft ob Geräte online sind',
      },
      {
        id: 'heartbeat-sender',
        title: 'Heartbeat-Sender',
        description: 'Sendet Lebenszeichen',
      },
    ],
  },
  {
    id: 'boss',
    title: 'Boss-Modus',
    description: 'Geräte steuern',
    icon: 'Crown',
    variants: [
      {
        id: 'boss-signer',
        title: 'Boss & Maschinen',
        description: 'Befehle an viele Geräte senden',
      },
      {
        id: 'pinnwand-admin',
        title: 'Pinnwand-Admin',
        description: 'Kanäle verwalten',
      },
    ],
  },
  {
    id: 'vault',
    title: 'Tresor',
    description: 'Backup & Notfall',
    icon: 'Shield',
    variants: [
      {
        id: 'local-vault',
        title: 'Datentresor',
        description: 'Geheime Daten sicher speichern',
      },
      {
        id: 'emergency-purge',
        title: 'Notfall-Löschung',
        description: 'Alles sofort bereinigen',
      },
    ],
  },
]

interface SetupCardGridProps {
  onSelectVariant: (projectType: ProjectType, variant: ProjectVariant) => void
}

export function SetupCardGrid({ onSelectVariant }: SetupCardGridProps) {
  const [selectedCard, setSelectedCard] = useState<SetupCard | null>(null)

  const getIcon = (iconName: keyof typeof iconMap) => {
    const Icon = iconMap[iconName]
    return Icon ? <Icon className="h-7 w-7" /> : null
  }

  const getVariantIcon = (variantId: string) => {
    const Icon = variantIconMap[variantId] || KeyRound
    return <Icon className="h-5 w-5" />
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {setupCards.map((card) => (
          <button
            key={card.id}
            onClick={() => setSelectedCard(card)}
            className="group relative flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center transition-all hover:border-primary hover:bg-accent"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              {getIcon(card.icon)}
            </div>
            <div className="space-y-0.5">
              <h3 className="text-base font-semibold text-card-foreground">
                {card.title}
              </h3>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              {selectedCard && (
                <>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {getIcon(selectedCard.icon)}
                  </span>
                  {selectedCard.title}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {selectedCard?.variants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => {
                  onSelectVariant(selectedCard.id, variant.id)
                  setSelectedCard(null)
                }}
                className="flex items-center gap-4 rounded-lg border border-border p-4 text-left transition-all hover:border-primary hover:bg-accent"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {getVariantIcon(variant.id)}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block font-medium text-card-foreground">
                    {variant.title}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {variant.description}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
