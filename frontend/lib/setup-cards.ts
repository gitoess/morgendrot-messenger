import type { SetupCard } from './types'

export const setupCards: SetupCard[] = [
  {
    id: 'chat',
    title: 'Nachrichten & Chat',
    description: 'Verschlüsselte Kommunikation und Broadcast-Nachrichten',
    icon: 'MessageSquare',
    variants: [
      {
        id: 'private-chat',
        title: 'Privat-Chat',
        description: 'Ende-zu-Ende verschlüsselte Nachrichten zwischen Partnern',
      },
      {
        id: 'pinnwand',
        title: 'Pinnwand',
        description: 'Broadcast-Nachrichten an alle sichtbar',
      },
    ],
  },
  {
    id: 'lock',
    title: 'Schloss & Zugang',
    description: 'Smart-Lock, Schlüssel und Zahlungstrigger',
    icon: 'Lock',
    variants: [
      {
        id: 'smart-lock',
        title: 'Smart-Lock Setup',
        description: 'Konfiguriere ein Schloss mit IOTA-Zugang',
      },
      {
        id: 'access-key-ticket',
        title: 'AccessKey & Event-Ticket',
        description: 'Erstelle und verwalte NFT-basierte Schlüssel und Tickets',
      },
      {
        id: 'payment-trigger',
        title: 'Zahlungs-Trigger',
        description: 'Ladesäule oder Geräte per IOTA-Zahlung freischalten',
      },
    ],
  },
  {
    id: 'monitor',
    title: 'Überwachung & Steuerung',
    description: 'Sensoren, Geräte und Heartbeat-Monitoring',
    icon: 'Eye',
    variants: [
      {
        id: 'sensor-central',
        title: 'Sensor-Zentrale',
        description: 'Rauch, Wasser, Einbruch - Alarm-Management',
      },
      {
        id: 'device-monitor',
        title: 'Geräte-Monitor',
        description: 'Überwache mehrere Geräte auf Offline-Status',
      },
      {
        id: 'heartbeat-sender',
        title: 'Heartbeat-Sender',
        description: 'Dieses Gerät sendet regelmäßig Lebenszeichen',
      },
    ],
  },
  {
    id: 'boss',
    title: 'Boss-Modus',
    description: 'Steuere viele Geräte ohne Wallet-Interaktion',
    icon: 'Crown',
    variants: [
      {
        id: 'boss-signer',
        title: 'Boss-Signer & Maschinen',
        description: 'Hierarchische Steuerung mit Delegierung',
      },
      {
        id: 'pinnwand-admin',
        title: 'Pinnwand-Verwaltung',
        description: 'Administriere Broadcast-Kanäle',
      },
    ],
  },
  {
    id: 'vault',
    title: 'Tresor & Notfall',
    description: 'Sichere Daten und Notfall-Löschung',
    icon: 'Shield',
    variants: [
      {
        id: 'local-vault',
        title: 'Lokaler Tresor / On-Chain',
        description: 'Geheime Daten sicher speichern',
      },
      {
        id: 'emergency-purge',
        title: 'Notfall-Löschung',
        description: 'Schnelle Bereinigung aller sensiblen Daten',
      },
    ],
  },
]
