// Morgendrot Types

export type ProjectType = 
  | 'chat'
  | 'lock'
  | 'monitor'
  | 'boss'
  | 'vault'

export type ProjectVariant = 
  // Chat variants
  | 'private-chat'
  | 'pinnwand'
  // Lock variants
  | 'smart-lock'
  | 'access-key-ticket'
  | 'payment-trigger'
  // Monitor variants
  | 'sensor-central'
  | 'device-monitor'
  | 'heartbeat-sender'
  // Boss variants
  | 'boss-signer'
  | 'pinnwand-admin'
  // Vault variants
  | 'local-vault'
  | 'emergency-purge'

export interface SetupCard {
  id: ProjectType
  title: string
  description: string
  icon: string
  variants: Array<{
    id: ProjectVariant
    title: string
    description: string
  }>
}

export interface Message {
  sender: string
  text: string
  isPlain?: boolean
  nonce?: number
  timestamp?: number
}

export interface AccessKey {
  id: string
  lockAddress: string
  owner: string
  validUntil?: number
  createdAt?: number
}

export interface Ticket {
  id: string
  eventId: string
  owner: string
  validFrom?: number
  validUntil?: number
  metadata?: string
  used?: boolean
}

export interface MonitorDevice {
  address: string
  name?: string
  status: 'online' | 'offline' | 'warning'
  lastSeen?: number
  sensor?: string
  purgeable?: boolean
}

export interface FormField {
  name: string
  label: string
  placeholder?: string
  type?: 'text' | 'number' | 'select' | 'textarea'
  required?: boolean
  options?: Array<{ value: string; label: string }>
  helpText?: string
}

export interface CommandResult {
  status: 'idle' | 'loading' | 'success' | 'error'
  message?: string
}
